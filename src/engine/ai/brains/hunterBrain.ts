/**
 * Hunter AI (the cat when the player is the mouse).
 *
 * States: sleep → patrol ⇄ investigate → chase ⇄ intercept → search → patrol, plus flee (from an
 * angry guardian) and enraged (after a gag or a taunt). It detects prey by sight (cone + line of
 * sight) and sound, predicts escape routes through mouse holes, searches hiding places around the
 * last known position, sidesteps visible banana peels (unless it's too angry to care), and loses
 * track when the prey breaks line of sight long enough.
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee, hear } from '../perception';
import { world, type AgentState } from '../../core/world';
import { interactions } from '../../interaction/registry';
import { searchSpot } from '../../interaction/hiding';
import { grabbable, performCatch } from '../../controller/rules';
import { useItems, getTrap } from '../../interaction/items';
import { audio } from '../../audio/audio';
import type { XZ } from '../../environment/types';
import type { NpcCommand } from '../../episode/types';
import { holePassages } from '../holes';
import * as THREE from 'three';

type S = 'sleep' | 'patrol' | 'investigate' | 'chase' | 'intercept' | 'search' | 'flee' | 'enraged';

export class HunterBrain implements Brain {
  state: S = 'patrol';
  private follow = new PathFollower();
  private goal: XZ | null = null;
  private wait = 0;
  private lastSeen = -100;
  private lastKnown: XZ | null = null;
  private lastVel = new THREE.Vector2();
  private searchList: string[] = [];
  private searchUntil = 0;
  private grabAt = 0;
  private lookAt = new THREE.Vector3();
  private nextTrap = 8;
  private nextSniff = 12;
  private ignoreUntil = 0;
  private huntUntil = 0;
  private enragedUntil = 0;
  private interceptUntil = 0;
  private wasStunned = false;
  private initialised = false;
  private sleepAt: XZ | null = null;
  private rummageUntil = 0;

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  command(cmd: NpcCommand, ctx: BrainContext) {
    const now = world.time;
    switch (cmd.type) {
      case 'sleep':
        this.sleepAt = cmd.at ?? [ctx.self.position.x, ctx.self.position.z];
        this.set('sleep', ctx);
        break;
      case 'wake':
        if (this.state === 'sleep') this.wakeUp(ctx);
        break;
      case 'alert': {
        if (this.state === 'sleep') this.wakeUp(ctx, false);
        const prey = this.findPrey(ctx.self);
        this.goal = cmd.at ?? (prey ? [prey.position.x, prey.position.z] : null);
        this.lastKnown = this.goal;
        this.lastSeen = now;
        this.ignoreUntil = 0;
        this.set('investigate', ctx);
        break;
      }
      case 'hunt':
        if (this.state === 'sleep') this.wakeUp(ctx, false);
        this.huntUntil = now + (cmd.seconds ?? 9999);
        this.ignoreUntil = 0;
        break;
      case 'enrage':
        this.enragedUntil = now + (cmd.seconds ?? 8);
        break;
      case 'goto':
        if (this.state === 'sleep') this.wakeUp(ctx, false);
        this.goal = cmd.at;
        this.set('investigate', ctx);
        break;
      case 'mode':
        if (cmd.mode === 'sleep') this.command({ type: 'sleep' }, ctx);
        else if (cmd.mode === 'hunt') this.command({ type: 'hunt' }, ctx);
        else {
          this.huntUntil = 0;
          this.set('patrol', ctx);
        }
        break;
      default:
        break;
    }
  }

  private wakeUp(ctx: BrainContext, react = true) {
    if (react) {
      world.playOneShot(ctx.self, 'react', 0.6);
      audio.play('yowl', { pitch: ctx.def.voice.pitch, gain: 0.6 });
    }
    this.sleepAt = null;
    this.set('patrol', ctx);
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: 'awake' });
  }

  update(ctx: BrainContext) {
    const { self, def, nav, env, rng } = ctx;
    const now = world.time;
    const it = self.intent;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    const skill = ctx.options.skill ?? 0.7;
    this.env = env;
    if (!this.initialised) {
      this.initialised = true;
      if (ctx.options.mode === 'sleep') this.command({ type: 'sleep' }, ctx);
      if (ctx.options.mode === 'hunt') this.command({ type: 'hunt' }, ctx);
      self.aiState = this.state;
    }

    const stunned = world.isStunned(self);
    if (stunned) {
      this.wasStunned = true;
      this.grabAt = 0;
      return;
    }
    // Cartoon temper: after a gag, the hunter is furious for a while.
    if (this.wasStunned) {
      this.wasStunned = false;
      if (this.state !== 'sleep') {
        this.enragedUntil = now + 6;
        world.flashExpression(self, 'angry', 2);
        audio.play('yowl', { pitch: 0.8, gain: 0.6 });
      }
    }
    const enraged = this.enragedUntil > now;
    const hunting = this.huntUntil > now;
    const prey = this.findPrey(self);

    // ----- Sleeping -----
    if (this.state === 'sleep') {
      if (this.sleepAt && Math.hypot(this.sleepAt[0] - self.position.x, this.sleepAt[1] - self.position.z) > 1) {
        this.follow.steer(self, nav, this.sleepAt, 2, 0.6);
        return;
      }
      world.playOneShot(self, 'sleep', 0.2);
      self.anim.expression = 'sleepy';
      const noise = hear(self, def, (n) => n.sourceId !== self.id && (n.kind !== 'step' || n.radius > 2));
      const close = prey && !prey.status.hiddenIn && prey.position.distanceTo(self.position) < (prey.sneaking ? 1.2 : 2.6);
      if (noise || close) {
        this.wakeUp(ctx);
        if (noise) {
          this.goal = [noise.position.x, noise.position.z];
          this.set('investigate', ctx);
        }
      }
      return;
    }

    const guardian = [...world.agents.values()].find((a) => a.archetype === 'guardian' && a.aiState === 'chase');
    if (guardian && guardian.position.distanceTo(self.position) < 7) {
      this.set('flee', ctx);
      const away = self.position.clone().sub(guardian.position).setY(0).normalize().multiplyScalar(8).add(self.position);
      const tgt = nav.nearestFree(away.x, away.z, 4) ?? [self.position.x, self.position.z];
      this.follow.steer(self, nav, tgt, 0.4);
      it.sprint = true;
      self.anim.expression = 'scared';
      return;
    }

    const blind = now < (ctx.options.grace ?? 5) || now < this.ignoreUntil;
    const sees = !!prey && !blind && canSee(ctx.physics, self, def, prey);
    if (prey && sees) {
      if (this.state !== 'chase' && this.state !== 'enraged' && this.state !== 'intercept') {
        // The classic double-take.
        world.playOneShot(self, 'react', 0.45);
        world.flashExpression(self, 'surprised', 0.5);
        audio.play('yowl', { pitch: def.voice.pitch, gain: 0.5 });
        world.events.emit({ type: 'spotted', agentId: self.id, targetId: prey.id });
      }
      this.lastSeen = now;
      this.lastKnown = [prey.position.x, prey.position.z];
      this.lastVel.set(prey.velocity.x, prey.velocity.z);
      if (this.state !== 'intercept') this.set(enraged ? 'enraged' : 'chase', ctx);
    } else if (prey && hunting && !prey.status.hiddenIn && prey.status.respawnAt === null) {
      // Scripted hunts: the hunter always has the scent.
      this.lastKnown = [prey.position.x, prey.position.z];
      this.lastSeen = now;
      if (this.state !== 'chase' && this.state !== 'enraged' && this.state !== 'intercept' && this.state !== 'search') this.set('chase', ctx);
    }

    const noise = now < this.ignoreUntil ? null : hear(self, def, (n) => n.sourceId !== undefined && world.agents.get(n.sourceId)?.archetype !== 'hunter');
    if (noise && this.state !== 'chase' && this.state !== 'enraged' && this.state !== 'intercept') {
      this.goal = [noise.position.x, noise.position.z];
      if (noise.kind === 'taunt') {
        this.enragedUntil = now + 7;
        this.lastKnown = this.goal;
        this.lastSeen = now;
        this.set('enraged', ctx);
      } else {
        if (this.state !== 'investigate') world.flashExpression(self, 'surprised', 0.6);
        this.set('investigate', ctx);
      }
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
        self.anim.expression = this.state === 'enraged' || enraged ? 'angry' : 'determined';
        self.anim.lookAt = this.lookAt.copy(prey.position);
        if (sees && prey.position.y - self.position.y > 0.6 && d < 2.2) it.jump = true;
        // The prey is somewhere only it can reach - predict where it pops out.
        if (sees && this.follow.failed) this.startIntercept(ctx, prey);
        else if (!sees && prey && this.nearHole(prey.position, 2.2)) this.startIntercept(ctx, prey);
        if (sees && d > 1.8 && d < 3.6 && rng() < 0.04 * skill * 3) {
          self.facing = Math.atan2(prey.position.x - self.position.x, prey.position.z - self.position.z);
          it.ability = true;
        }
        this.tryGrab(ctx, prey);
        if (!sees && !hunting && now - this.lastSeen > 0.9) this.startSearch(ctx);
        if (!sees && hunting && prey.status.hiddenIn) this.startSearch(ctx);
        break;
      }
      case 'intercept': {
        if (!this.goal || now > this.interceptUntil) {
          this.startSearch(ctx);
          break;
        }
        const d = this.follow.steer(self, nav, this.goal, 0.6, 0.4);
        it.sprint = d > 1.5;
        self.anim.expression = 'smug';
        if (prey) {
          self.anim.lookAt = this.lookAt.copy(prey.position);
          this.tryGrab(ctx, prey);
          if (sees && !this.follow.failed && prey.position.distanceTo(self.position) < 4 && d < 1) this.set('chase', ctx);
        }
        if (d < 0.6) it.sneak = true; // lie in wait
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
        if (d < 1 || this.follow.failed) {
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
            if (d < 1.2 || this.follow.failed) this.goal = null;
          }
          break;
        }
        const d = this.follow.steer(self, nav, [spot.exit.x, spot.exit.z], 1, 0.7);
        self.anim.lookAt = this.lookAt.copy(spot.position);
        if (d < 0.9 || (this.follow.failed && d < 2)) {
          // Rummage for a beat before the reveal - gives the player a moment of suspense.
          if (!this.rummageUntil) {
            this.rummageUntil = now + 1.0;
            world.playOneShot(self, 'interact', 1.0);
          }
          it.moveX = it.moveZ = 0;
          if (now >= this.rummageUntil) {
            this.rummageUntil = 0;
            this.searchList.shift();
            searchSpot(self, spot);
          }
        } else if (this.follow.failed) this.searchList.shift();
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
        if (prey && now > this.nextSniff && !prey.status.hiddenIn && now > this.ignoreUntil) {
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
        if (def.trap && (self.charges[def.trap.kind] ?? 0) > 0 && now > this.nextTrap && rng() < 0.01) {
          it.trap = true;
          this.nextTrap = now + 14 + rng() * 10;
        }
        break;
      }
    }
    this.avoidPeels(ctx, enraged);
  }

  private tryGrab(ctx: BrainContext, prey: AgentState) {
    const { self } = ctx;
    const now = world.time;
    const skill = ctx.options.skill ?? 0.7;
    const g = grabbable(self, 0.55);
    if (g) {
      if (!this.grabAt) {
        this.grabAt = now + 0.24 - skill * 0.08;
        world.playOneShot(self, 'grab', 0.3);
      } else if (now >= this.grabAt) {
        this.grabAt = 0;
        performCatch(self, g);
        this.afterCatch(ctx, g);
      }
    } else if (this.grabAt) {
      // The windup whiffed: escaped by a whisker!
      if (now >= this.grabAt) {
        this.grabAt = 0;
        if (prey.position.distanceTo(self.position) < 2.4 && !prey.status.hiddenIn) {
          world.events.emit({ type: 'nearMiss', agentId: prey.id, hunterId: self.id, position: prey.position.toArray() as [number, number, number] });
          world.flashExpression(self, 'angry', 1);
        }
      }
    }
  }

  private afterCatch(ctx: BrainContext, g: AgentState) {
    const { env, rng } = ctx;
    const now = world.time;
    this.set('patrol', ctx);
    this.wait = 1.2;
    // Sporting cartoon rules: no spawn camping. Wander off and give the prey a head start.
    this.ignoreUntil = now + 7;
    this.nextSniff = now + 14;
    this.huntUntil = Math.min(this.huntUntil, now + 7) > now ? this.huntUntil : 0;
    const pts = env.patrolPoints;
    let far = pts[0];
    for (const p of pts) if (Math.hypot(p[0] - g.position.x, p[1] - g.position.z) > Math.hypot(far[0] - g.position.x, far[1] - g.position.z) && rng() < 0.7) far = p;
    this.goal = far;
  }

  private env: BrainContext['env'] | null = null;
  private nearHole(p: THREE.Vector3, r: number) {
    return !!this.env && holePassages(this.env).some((h) => Math.hypot(h.center[0] - p.x, h.center[1] - p.z) < r);
  }

  /** Predict where the prey will pop out (far side of the nearest mouse hole) and wait there. */
  private startIntercept(ctx: BrainContext, prey: AgentState) {
    const { self, nav } = ctx;
    const passages = holePassages(ctx.env);
    if (!passages.length) return;
    const ahead: XZ = [prey.position.x + this.lastVel.x * 1.2, prey.position.z + this.lastVel.y * 1.2];
    let best: XZ | null = null;
    let bestScore = Infinity;
    for (const h of passages) {
      const dPrey = Math.hypot(h.center[0] - ahead[0], h.center[1] - ahead[1]);
      if (dPrey > 9) continue;
      for (const side of h.sides) {
        if (!nav.isFree(side[0], side[1])) continue;
        // The exit is the side farther from the prey right now.
        const away = Math.hypot(side[0] - prey.position.x, side[1] - prey.position.z);
        const dMe = Math.hypot(side[0] - self.position.x, side[1] - self.position.z);
        const score = dPrey + dMe * 0.35 - away * 0.8;
        if (score < bestScore) {
          bestScore = score;
          best = side;
        }
      }
    }
    if (!best) return;
    this.goal = best;
    this.interceptUntil = world.time + 4.5;
    if (this.state !== 'intercept') world.flashExpression(self, 'smug', 1);
    this.set('intercept', ctx);
  }

  private avoidPeels(ctx: BrainContext, enraged: boolean) {
    const { self, rng } = ctx;
    if (enraged || !self.grounded) return;
    const skill = ctx.options.skill ?? 0.7;
    const fx = self.intent.moveX;
    const fz = self.intent.moveZ;
    if (Math.hypot(fx, fz) < 0.5) return;
    for (const t of useItems.getState().traps) {
      if (t.sprung) continue;
      const def = getTrap(t.kind);
      if (!def?.affects.includes('hunter')) continue;
      const dx = t.position[0] - self.position.x;
      const dz = t.position[2] - self.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.7 && d > 0.6 && (dx * fx + dz * fz) / d > 0.7 && rng() < skill * 0.5) {
        self.intent.jump = true;
        return;
      }
    }
  }

  private startSearch(ctx: BrainContext) {
    const center = this.lastKnown ?? [ctx.self.position.x, ctx.self.position.z];
    const spots = [...interactions.hideSpots.values()]
      .filter((s) => s.archetypes.includes('prey') && s.searchable !== false && Math.hypot(s.position.x - center[0], s.position.z - center[1]) < 7.5)
      .sort((a, b) => Math.hypot(a.position.x - center[0], a.position.z - center[1]) - Math.hypot(b.position.x - center[0], b.position.z - center[1]));
    // Check the closest few in a plausible but not perfect order.
    const pick = spots.slice(0, 4);
    for (let i = pick.length - 1; i > 0; i--) {
      if (ctx.rng() < 0.5) [pick[i], pick[i - 1]] = [pick[i - 1], pick[i]];
    }
    this.searchList = pick.map((s) => s.id);
    this.goal = center;
    this.searchUntil = world.time + 14;
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
