/**
 * Guardian AI (e.g. the bulldog): sleeps or patrols its turf, wakes up to loud noises or a hunter
 * creeping too close, then chases the hunter and gives it a cartoon pummelling. Protects prey.
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee, hear } from '../perception';
import { world, type AgentState } from '../../core/world';
import { audio } from '../../audio/audio';
import type { XZ } from '../../environment/types';
import * as THREE from 'three';

type S = 'sleep' | 'patrol' | 'alert' | 'chase' | 'return' | 'satisfied';

export class GuardianBrain implements Brain {
  state: S = 'sleep';
  private follow = new PathFollower();
  private goal: XZ | null = null;
  private alertUntil = 0;
  private lastSeen = 0;
  private wait = 0;
  private started = false;
  private nextSnore = 0;
  private look = new THREE.Vector3();

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  /** External wake-up (episode chase events can call this). */
  wake(ctx: BrainContext, at?: XZ) {
    if (this.state === 'sleep' || this.state === 'patrol' || this.state === 'return') {
      world.playOneShot(ctx.self, 'react', 0.6);
      audio.play('bark', { pitch: ctx.def.voice.pitch });
      this.goal = at ?? null;
      this.alertUntil = world.time + 7;
      this.set('alert', ctx);
    }
  }

  update(ctx: BrainContext) {
    const { self, def, nav, rng, options } = ctx;
    const it = self.intent;
    const now = world.time;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    const mode = options.mode ?? 'sleep';
    const home: XZ = options.home ?? [self.spawn.position[0], self.spawn.position[2]];
    if (!this.started) {
      this.started = true;
      this.set(mode === 'sleep' ? 'sleep' : 'patrol', ctx);
      self.aiState = this.state;
    }
    if (world.isStunned(self)) return;
    if (self.aiState === 'satisfied' && this.state === 'chase') this.set('satisfied', ctx);

    const hunter = [...world.agents.values()].find((a) => a.archetype === 'hunter' && !a.status.hiddenIn);
    const dHunter = hunter ? hunter.position.distanceTo(self.position) : Infinity;

    switch (this.state) {
      case 'sleep': {
        world.playOneShot(self, 'sleep', 0.2);
        self.anim.expression = 'sleepy';
        if (now > this.nextSnore) {
          this.nextSnore = now + 2.6;
          if (world.player && world.player.position.distanceTo(self.position) < 10) audio.play('snore', { gain: 0.6 });
        }
        const noise = hear(self, def, (n) => n.kind !== 'step' || (world.agents.get(n.sourceId ?? '')?.sprinting ?? false));
        const tooClose = hunter && dHunter < (hunter.sneaking ? 1.6 : 3.4);
        if (tooClose) this.wake(ctx, [hunter!.position.x, hunter!.position.z]);
        else if (noise && world.agents.get(noise.sourceId ?? '')?.archetype !== 'guardian') this.wake(ctx, [noise.position.x, noise.position.z]);
        break;
      }
      case 'patrol': {
        self.anim.expression = 'neutral';
        if (hunter && canSee(ctx.physics, self, def, hunter) && this.withinTurf(hunter, home, options.leash ?? 12)) {
          this.startChase(ctx);
          break;
        }
        const noise = hear(self, def, (n) => n.kind === 'crash' || n.kind === 'taunt' || n.kind === 'snap' || n.kind === 'slip');
        if (noise) {
          this.goal = [noise.position.x, noise.position.z];
          this.alertUntil = now + 6;
          this.set('alert', ctx);
          break;
        }
        if (this.wait > 0) {
          this.wait -= ctx.dt;
          break;
        }
        if (!this.goal) {
          const leash = options.leash ?? 10;
          const a = rng() * Math.PI * 2;
          this.goal = nav.nearestFree(home[0] + Math.cos(a) * leash * rng(), home[1] + Math.sin(a) * leash * rng(), 3) ?? home;
        }
        const d = this.follow.steer(self, nav, this.goal, 2, 0.8);
        if (d < 1 || this.follow.failed) {
          this.goal = null;
          this.wait = 1 + rng() * 2;
        }
        break;
      }
      case 'alert': {
        self.anim.expression = 'angry';
        if (hunter && canSee(ctx.physics, self, def, hunter)) {
          this.startChase(ctx);
          break;
        }
        if (this.goal) {
          const d = this.follow.steer(self, nav, this.goal, 1, 1);
          it.sprint = d > 4;
          if (d < 1.2) this.goal = null;
        }
        if (now > this.alertUntil) this.set('return', ctx);
        break;
      }
      case 'chase': {
        if (!hunter) {
          this.set('return', ctx);
          break;
        }
        const sees = canSee(ctx.physics, self, def, hunter);
        if (sees) this.lastSeen = now;
        this.follow.steer(self, nav, [hunter.position.x, hunter.position.z], 0.3, 0.2);
        it.sprint = true;
        self.anim.expression = 'angry';
        self.anim.lookAt = this.look.copy(hunter.position);
        if (hunter.position.y - self.position.y > 0.8 && dHunter < 2.5) it.jump = true;
        if (now - this.lastSeen > 4 || hunter.status.invulnerableUntil > now + 1) this.set('return', ctx);
        break;
      }
      case 'satisfied':
      case 'return': {
        self.anim.expression = this.state === 'satisfied' ? 'smug' : 'neutral';
        const d = this.follow.steer(self, nav, home, 1.5, 0.8);
        if (d < 1.1 || this.follow.failed) {
          this.set(mode === 'sleep' ? 'sleep' : 'patrol', ctx);
          self.facing = self.spawn.facing;
        }
        // Still protective on the way back.
        if (hunter && dHunter < 5 && hunter.status.invulnerableUntil < now && canSee(ctx.physics, self, def, hunter)) this.startChase(ctx);
        break;
      }
    }
    // Protect prey: hunter close to a prey near the guardian -> chase.
    if (this.state !== 'chase' && this.state !== 'sleep' && hunter && hunter.status.invulnerableUntil < now) {
      for (const p of world.agents.values()) {
        if (p.archetype === 'prey' && p.position.distanceTo(self.position) < 7 && p.position.distanceTo(hunter.position) < 4 && canSee(ctx.physics, self, def, hunter)) {
          this.startChase(ctx);
          break;
        }
      }
    }
  }

  private withinTurf(a: AgentState, home: XZ, leash: number) {
    return Math.hypot(a.position.x - home[0], a.position.z - home[1]) < leash + 4;
  }

  private startChase(ctx: BrainContext) {
    if (this.state !== 'chase') {
      audio.play('bark', { pitch: ctx.def.voice.pitch });
      world.events.emit({ type: 'spotted', agentId: ctx.self.id, targetId: 'hunter' });
    }
    this.lastSeen = world.time;
    this.set('chase', ctx);
  }
}
