/**
 * Guardian AI (the bulldog): an independent character with its own agenda.
 *
 * States: sleep ⇄ patrol/roam → warn → chase → satisfied → return, plus alert (investigating a
 * noise) and zoomies (a random burst of excitement). Wakes to loud noises or a hunter creeping too
 * close, growls a warning before charging, intervenes when it sees a chase in progress, protects
 * prey, and occasionally does something unexpected (sudden nap, zoomies across the yard).
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee, hear } from '../perception';
import { world, type AgentState } from '../../core/world';
import { audio } from '../../audio/audio';
import type { XZ } from '../../environment/types';
import type { NpcCommand } from '../../episode/types';
import * as THREE from 'three';

type S = 'sleep' | 'patrol' | 'alert' | 'warn' | 'chase' | 'return' | 'satisfied' | 'zoomies';

export class GuardianBrain implements Brain {
  state: S = 'sleep';
  private follow = new PathFollower();
  private goal: XZ | null = null;
  private alertUntil = 0;
  private lastSeen = 0;
  private wait = 0;
  private started = false;
  private nextSnore = 0;
  private warnUntil = 0;
  private nextQuirk = 25;
  private quirkUntil = 0;
  private mode: 'sleep' | 'patrol' | 'roam' = 'sleep';
  private home: XZ = [0, 0];
  private look = new THREE.Vector3();

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  /** Wake up (episode events and noises call this). */
  wake(ctx: BrainContext, at?: XZ) {
    if (this.state === 'sleep' || this.state === 'patrol' || this.state === 'return' || this.state === 'zoomies') {
      world.playOneShot(ctx.self, 'react', 0.6);
      audio.play('bark', { pitch: ctx.def.voice.pitch });
      this.goal = at ?? null;
      this.alertUntil = world.time + 7;
      this.set('alert', ctx);
    }
  }

  command(cmd: NpcCommand, ctx: BrainContext) {
    switch (cmd.type) {
      case 'wake':
        this.wake(ctx);
        break;
      case 'alert':
        this.wake(ctx, cmd.at);
        if (cmd.at) this.goal = cmd.at;
        break;
      case 'sleep':
        if (cmd.at) this.home = cmd.at;
        this.mode = 'sleep';
        this.set('return', ctx);
        break;
      case 'mode':
        if (cmd.mode === 'sleep' || cmd.mode === 'patrol' || cmd.mode === 'roam') {
          this.mode = cmd.mode;
          this.set(cmd.mode === 'sleep' ? 'return' : 'patrol', ctx);
        }
        break;
      case 'goto':
        this.goal = cmd.at;
        this.alertUntil = world.time + 10;
        this.set('alert', ctx);
        break;
      default:
        break;
    }
  }

  update(ctx: BrainContext) {
    const { self, def, nav, rng, options, env } = ctx;
    const it = self.intent;
    const now = world.time;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    if (!this.started) {
      this.started = true;
      this.mode = options.mode === 'patrol' || options.mode === 'roam' ? options.mode : 'sleep';
      this.home = options.home ?? [self.spawn.position[0], self.spawn.position[2]];
      this.set(this.mode === 'sleep' ? 'sleep' : 'patrol', ctx);
      self.aiState = this.state;
    }
    if (world.isStunned(self)) return;
    if (self.aiState === 'satisfied' && this.state === 'chase') this.set('satisfied', ctx);

    const hunter = [...world.agents.values()].find((a) => a.archetype === 'hunter' && !a.status.hiddenIn);
    const dHunter = hunter ? hunter.position.distanceTo(self.position) : Infinity;
    const hunterFair = !!hunter && hunter.status.invulnerableUntil < now;

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
        // Sleep-walking surprise: every now and then he wanders off for a snack.
        if (now > this.nextQuirk) {
          this.nextQuirk = now + 40 + rng() * 40;
          if (rng() < 0.35) {
            this.mode = 'roam';
            this.quirkUntil = now + 20;
            this.set('patrol', ctx);
          }
        }
        break;
      }
      case 'patrol': {
        self.anim.expression = 'neutral';
        if (hunter && hunterFair && canSee(ctx.physics, self, def, hunter) && (this.mode === 'roam' || this.withinTurf(hunter, options.leash ?? 12))) {
          this.startWarn(ctx);
          break;
        }
        const noise = hear(self, def, (n) => n.kind === 'crash' || n.kind === 'taunt' || n.kind === 'snap' || n.kind === 'slip');
        if (noise) {
          this.goal = [noise.position.x, noise.position.z];
          this.alertUntil = now + 6;
          this.set('alert', ctx);
          break;
        }
        if (this.quirkUntil && now > this.quirkUntil) {
          this.quirkUntil = 0;
          this.mode = (options.mode as 'sleep' | 'patrol' | 'roam') ?? 'sleep';
          if (this.mode === 'sleep') {
            this.set('return', ctx);
            break;
          }
        }
        if (now > this.nextQuirk && this.mode !== 'sleep') {
          this.nextQuirk = now + 30 + rng() * 30;
          if (rng() < 0.5) {
            this.set('zoomies', ctx);
            this.quirkUntil = now + 4;
            this.goal = null;
            break;
          }
        }
        if (this.wait > 0) {
          this.wait -= ctx.dt;
          break;
        }
        if (!this.goal) {
          if (this.mode === 'roam') {
            const pts = env.patrolPoints;
            this.goal = pts[Math.floor(rng() * pts.length)];
          } else {
            const leash = options.leash ?? 10;
            const a = rng() * Math.PI * 2;
            this.goal = nav.nearestFree(this.home[0] + Math.cos(a) * leash * rng(), this.home[1] + Math.sin(a) * leash * rng(), 3) ?? this.home;
          }
        }
        const d = this.follow.steer(self, nav, this.goal, 2, 0.8);
        if (d < 1 || this.follow.failed) {
          this.goal = null;
          this.wait = 1 + rng() * 2;
        }
        break;
      }
      case 'zoomies': {
        self.anim.expression = 'happy';
        if (!this.goal || Math.hypot(this.goal[0] - self.position.x, this.goal[1] - self.position.z) < 1) {
          const a = rng() * Math.PI * 2;
          this.goal = nav.nearestFree(self.position.x + Math.cos(a) * 6, self.position.z + Math.sin(a) * 6, 3) ?? this.home;
          audio.play('bark', { pitch: 1.2, gain: 0.5 });
        }
        this.follow.steer(self, nav, this.goal, 0.5, 0.8);
        it.sprint = true;
        if (now > this.quirkUntil) {
          this.quirkUntil = 0;
          this.set('patrol', ctx);
        }
        break;
      }
      case 'alert': {
        self.anim.expression = 'angry';
        if (hunter && hunterFair && canSee(ctx.physics, self, def, hunter)) {
          this.startWarn(ctx);
          break;
        }
        if (this.goal) {
          const d = this.follow.steer(self, nav, this.goal, 1, 1);
          it.sprint = d > 4;
          if (d < 1.2 || this.follow.failed) this.goal = null;
        }
        if (now > this.alertUntil) this.set('return', ctx);
        break;
      }
      case 'warn': {
        // A growl and a stare: the hunter gets a moment to back off.
        self.anim.expression = 'angry';
        if (hunter) {
          self.facing = Math.atan2(hunter.position.x - self.position.x, hunter.position.z - self.position.z);
          self.anim.lookAt = this.look.copy(hunter.position);
        }
        if (now > this.warnUntil) {
          if (hunter && dHunter < 11) this.set('chase', ctx);
          else this.set('return', ctx);
          this.lastSeen = now;
        }
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
        const d = this.follow.steer(self, nav, this.home, 1.5, 0.8);
        if (d < 1.1 || this.follow.failed) {
          this.set(this.mode === 'sleep' ? 'sleep' : 'patrol', ctx);
          self.facing = self.spawn.facing;
        }
        if (hunter && hunterFair && dHunter < 5 && canSee(ctx.physics, self, def, hunter)) this.startWarn(ctx);
        break;
      }
    }

    // Intervene: a chase is going on in view, or a hunter is cornering prey nearby.
    if (this.state !== 'chase' && this.state !== 'warn' && this.state !== 'sleep' && hunter && hunterFair) {
      const chasing = hunter.aiState === 'chase' || hunter.aiState === 'enraged' || hunter.sprinting;
      for (const p of world.agents.values()) {
        if (p.archetype !== 'prey') continue;
        const near = p.position.distanceTo(hunter.position) < (chasing ? 6 : 3.5);
        if (near && dHunter < 13 && canSee(ctx.physics, self, def, hunter)) {
          this.startWarn(ctx, 0.35);
          break;
        }
      }
    }
    // Friendly to prey nearby.
    if (this.state === 'patrol' || this.state === 'return') {
      for (const p of world.agents.values()) {
        if (p.archetype === 'prey' && p.position.distanceTo(self.position) < 3 && !p.status.hiddenIn) {
          self.anim.expression = 'happy';
          self.anim.lookAt = this.look.copy(p.position);
        }
      }
    }
  }

  private withinTurf(a: AgentState, leash: number) {
    return Math.hypot(a.position.x - this.home[0], a.position.z - this.home[1]) < leash + 4;
  }

  private startWarn(ctx: BrainContext, seconds = 0.8) {
    if (this.state === 'chase' || this.state === 'warn') return;
    audio.play('growl', { pitch: ctx.def.voice.pitch });
    world.playOneShot(ctx.self, 'react', 0.4);
    world.events.emit({ type: 'spotted', agentId: ctx.self.id, targetId: 'hunter' });
    this.warnUntil = world.time + seconds;
    this.set('warn', ctx);
  }
}
