/**
 * Hunter AI (e.g. the cat when the player is the mouse): patrols, investigates noises, chases on
 * sight, pounces, searches hiding places around the last known position, lays traps, and runs from
 * an angry guardian.
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee, hear } from '../perception';
import { world, type AgentState } from '../../core/world';
import { interactions } from '../../interaction/registry';
import { searchSpot } from '../../interaction/hiding';
import { grabbable, performCatch } from '../../controller/rules';
import { audio } from '../../audio/audio';
import type { XZ } from '../../environment/types';
import * as THREE from 'three';

type S = 'patrol' | 'investigate' | 'chase' | 'search' | 'flee' | 'stunned' | 'enraged';

export class HunterBrain implements Brain {
  state: S = 'patrol';
  private follow = new PathFollower();
  private goal: XZ | null = null;
  private wait = 0;
  private lastSeen = -100;
  private lastKnown: XZ | null = null;
  private searchList: string[] = [];
  private searchUntil = 0;
  private searched = new Set<string>();
  private grabAt = 0;
  private lookAt = new THREE.Vector3();
  private nextTrap = 8;
  private nextSniff = 12;
  private ignoreUntil = 0;

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  update(ctx: BrainContext) {
    const { self, def, nav, env, rng } = ctx;
    const now = world.time;
    const it = self.intent;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    const skill = ctx.options.skill ?? 0.7;
    if (!self.aiState) self.aiState = this.state;

    if (world.isStunned(self)) {
      self.aiState = 'stunned';
      return;
    }
    const prey = this.findPrey(self);
    const guardian = [...world.agents.values()].find((a) => a.archetype === 'guardian' && a.aiState === 'chase');

    // Run from an angry guardian.
    if (guardian && guardian.position.distanceTo(self.position) < 7) {
      this.set('flee', ctx);
      const away = self.position.clone().sub(guardian.position).setY(0).normalize().multiplyScalar(8).add(self.position);
      const tgt = nav.nearestFree(away.x, away.z, 4) ?? [self.position.x, self.position.z];
      this.follow.steer(self, nav, tgt, 0.4);
      it.sprint = true;
      self.anim.expression = 'scared';
      return;
    }

    const blind = world.time < (ctx.options.grace ?? 5) || world.time < this.ignoreUntil;
    const sees = prey && !blind ? canSee(ctx.physics, self, def, prey) : false;
    if (sees && prey) {
      if (this.state !== 'chase' && this.state !== 'enraged') {
        world.playOneShot(self, 'react', 0.45);
        audio.play('yowl', { pitch: def.voice.pitch, gain: 0.5 });
        world.events.emit({ type: 'spotted', agentId: self.id, targetId: prey.id });
      }
      this.lastSeen = now;
      this.lastKnown = [prey.position.x, prey.position.z];
      if (this.state !== 'enraged') this.set('chase', ctx);
    }

    // Hearing: taunts enrage, crashes and running feet draw attention.
    const noise = now < this.ignoreUntil ? null : hear(self, def, (n) => n.sourceId !== undefined && world.agents.get(n.sourceId)?.archetype !== 'hunter');
    if (noise && this.state !== 'chase' && this.state !== 'enraged') {
      this.goal = [noise.position.x, noise.position.z];
      if (noise.kind === 'taunt') {
        this.set('enraged', ctx);
        this.lastKnown = this.goal;
        this.lastSeen = now;
      } else this.set('investigate', ctx);
    }

    switch (this.state) {
      case 'chase':
      case 'enraged': {
        if (!prey || prey.status.respawnAt !== null) {
          this.set('patrol', ctx);
          break;
        }
        const target: XZ = sees ? [prey.position.x, prey.position.z] : (this.lastKnown ?? [prey.position.x, prey.position.z]);
        const d = this.follow.steer(self, nav, target, 0.25, 0.2);
        it.sprint = true;
        self.anim.expression = this.state === 'enraged' ? 'angry' : 'determined';
        self.anim.lookAt = this.lookAt.copy(prey.position);
        // Jump if prey is above us (on furniture)
        if (sees && prey.position.y - self.position.y > 0.6 && d < 2.2) it.jump = true;
        // Pounce
        if (sees && d > 1.8 && d < 3.6 && rng() < 0.04 * skill * 3) {
          self.facing = Math.atan2(prey.position.x - self.position.x, prey.position.z - self.position.z);
          it.ability = true;
        }
        // Grab with a short, fair windup
        const g = grabbable(self, 0.55);
        if (g) {
          if (!this.grabAt) {
            this.grabAt = now + 0.22 - skill * 0.08;
            world.playOneShot(self, 'grab', 0.3);
          } else if (now >= this.grabAt) {
            this.grabAt = 0;
            performCatch(self, g);
            this.set('patrol', ctx);
            this.wait = 1.2;
            // Sporting cartoon rules: no spawn camping. Wander off and give the prey a head start.
            this.ignoreUntil = now + 7;
            this.nextSniff = now + 14;
            const pts = env.patrolPoints;
            let far = pts[0];
            for (const p of pts) if (Math.hypot(p[0] - g.position.x, p[1] - g.position.z) > Math.hypot(far[0] - g.position.x, far[1] - g.position.z) && rng() < 0.7) far = p;
            this.goal = far;
          }
        } else this.grabAt = 0;
        if (!sees && now - this.lastSeen > 0.8) {
          this.startSearch(ctx);
        }
        break;
      }
      case 'investigate': {
        if (!this.goal) {
          this.set('patrol', ctx);
          break;
        }
        const d = this.follow.steer(self, nav, this.goal, 1, 0.9);
        it.sprint = d > 5;
        self.anim.expression = 'determined';
        if (d < 1) {
          this.wait += ctx.dt;
          self.anim.expression = 'neutral';
          if (this.wait > 1.4) {
            this.wait = 0;
            this.lastKnown = this.goal;
            this.startSearch(ctx);
          }
        }
        break;
      }
      case 'search': {
        self.anim.expression = 'determined';
        it.sneak = rng() < 0.002 ? !it.sneak : false;
        if (now > this.searchUntil || (!this.searchList.length && !this.goal)) {
          this.set('patrol', ctx);
          break;
        }
        const id = this.searchList[0];
        const spot = id ? interactions.hideSpots.get(id) : undefined;
        if (!spot) {
          this.searchList.shift();
          if (this.goal) {
            const d = this.follow.steer(self, nav, this.goal, 1, 1);
            if (d < 1.2) this.goal = null;
          }
          break;
        }
        const d = this.follow.steer(self, nav, [spot.exit.x, spot.exit.z], 1, 0.7);
        self.anim.lookAt = this.lookAt.copy(spot.position);
        if (d < 0.9) {
          this.searchList.shift();
          this.searched.add(spot.id);
          searchSpot(self, spot);
          // If they bolted out, we'll see them next frame and chase.
        }
        break;
      }
      case 'flee':
        this.set('patrol', ctx);
        break;
      case 'patrol':
      default: {
        self.anim.expression = 'neutral';
        if (this.wait > 0) {
          this.wait -= ctx.dt;
          break;
        }
        // Cartoon "sniff": every so often the hunter catches a whiff of the prey's area.
        if (prey && now > this.nextSniff && !prey.status.hiddenIn) {
          this.nextSniff = now + 16 - skill * 8 + rng() * 6;
          const a = rng() * Math.PI * 2;
          const r = 2 + (1 - skill) * 5;
          this.goal = nav.nearestFree(prey.position.x + Math.cos(a) * r, prey.position.z + Math.sin(a) * r, 3) ?? this.goal;
          world.playOneShot(self, 'interact', 0.5);
          self.anim.expression = 'smug';
        }
        if (!this.goal) {
          const pts = env.patrolPoints;
          this.goal = pts[Math.floor(rng() * pts.length)];
        }
        const d = this.follow.steer(self, nav, this.goal, 2, 0.8);
        if (d < 1 || this.follow.failed) {
          this.goal = null;
          this.wait = 0.6 + rng() * 1.6;
        }
        // Lay a trap now and then, in busy spots.
        if (def.trap && (self.charges[def.trap.kind] ?? 0) > 0 && now > this.nextTrap && rng() < 0.01) {
          it.trap = true;
          this.nextTrap = now + 14 + rng() * 10;
        }
        break;
      }
    }
  }

  private startSearch(ctx: BrainContext) {
    const center = this.lastKnown ?? [ctx.self.position.x, ctx.self.position.z];
    const spots = [...interactions.hideSpots.values()]
      .filter((s) => s.archetypes.includes('prey') && Math.hypot(s.position.x - center[0], s.position.z - center[1]) < 7.5)
      .sort((a, b) => Math.hypot(a.position.x - center[0], a.position.z - center[1]) - Math.hypot(b.position.x - center[0], b.position.z - center[1]));
    this.searchList = spots.slice(0, 3).map((s) => s.id);
    this.goal = center;
    this.searchUntil = world.time + 12;
    this.set('search', ctx);
  }

  private findPrey(self: AgentState): AgentState | undefined {
    let best: AgentState | undefined;
    let bd = Infinity;
    for (const a of world.agents.values()) {
      if (a.archetype !== 'prey') continue;
      const d = a.position.distanceTo(self.position);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }
}
