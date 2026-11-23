/**
 * Prey AI (the mouse when the player is the cat).
 *
 * States: forage → flee → hide → forage, plus stayHidden / runHome / goto for scripted missions.
 * Avoids the hunter, prefers escape routes only it can use (mouse holes, under furniture), picks
 * hiding places, changes route when the hunter blocks the way, slams doors in the hunter's face,
 * drops banana peels mid-chase, knocks things over as distractions and taunts a dizzy hunter.
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee } from '../perception';
import { world, type AgentState } from '../../core/world';
import { interactions, type HideSpot } from '../../interaction/registry';
import { hideAgent, unhideAgent } from '../../interaction/hiding';
import { useItems } from '../../interaction/items';
import type { XZ } from '../../environment/types';
import type { NpcCommand } from '../../episode/types';
import { holePassages, segmentDistance } from '../holes';
import * as THREE from 'three';

type S = 'forage' | 'flee' | 'hide' | 'home' | 'taunt' | 'idle' | 'stayHidden' | 'runHome' | 'goto';

export class PreyBrain implements Brain {
  state: S = 'forage';
  private follow = new PathFollower();
  private fleeGoal: XZ | null = null;
  private fleeSpot: HideSpot | null = null;
  private fleeUntil = 0;
  private hideUntil = 0;
  private lastThreatSeen = -100;
  private tauntedStun = 0;
  private look = new THREE.Vector3();
  private scripted: { mode: 'stayHidden'; spot: string | null; roomId?: string } | { mode: 'runHome'; zoneId: string } | { mode: 'goto'; at: XZ } | { mode: 'idle' } | null = null;
  private nextTrick = 0;
  private initialised = false;

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  command(cmd: NpcCommand, ctx: BrainContext) {
    switch (cmd.type) {
      case 'hideIn':
        this.scripted = { mode: 'stayHidden', spot: cmd.spotId ?? null, roomId: cmd.roomId };
        if (ctx.self.status.hiddenIn && cmd.spotId && ctx.self.status.hiddenIn !== cmd.spotId) unhideAgent(ctx.self);
        this.set('stayHidden', ctx);
        break;
      case 'runTo':
        if (ctx.self.status.hiddenIn) unhideAgent(ctx.self);
        this.scripted = { mode: 'runHome', zoneId: cmd.zoneId };
        this.set('runHome', ctx);
        break;
      case 'goto':
        this.scripted = { mode: 'goto', at: cmd.at };
        this.set('goto', ctx);
        break;
      case 'mode':
        if (cmd.mode === 'idle') this.scripted = { mode: 'idle' };
        else if (cmd.mode === 'stayHidden') this.scripted = { mode: 'stayHidden', spot: null };
        else {
          this.scripted = null;
          if (ctx.self.status.hiddenIn) unhideAgent(ctx.self);
          this.set('forage', ctx);
        }
        break;
      default:
        break;
    }
  }

  update(ctx: BrainContext) {
    const { self, nav, rng, def } = ctx;
    const it = self.intent;
    const now = world.time;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    if (!this.initialised) {
      this.initialised = true;
      const m = ctx.options.mode;
      if (m === 'stayHidden') this.command({ type: 'hideIn' }, ctx);
      else if (m === 'idle') this.command({ type: 'mode', mode: 'idle' }, ctx);
      else if (m === 'runHome') this.command({ type: 'runTo', zoneId: ctx.options.homeZone ?? 'mouse-home' }, ctx);
      self.aiState = this.state;
    }
    if (world.isStunned(self) || self.status.respawnAt !== null) return;

    const threat = this.nearestHunter(self);
    const dThreat = threat ? threat.position.distanceTo(self.position) : Infinity;
    const seesThreat = !!threat && !self.status.hiddenIn && (dThreat < 3.5 || canSee(ctx.physics, self, def, threat));
    if (seesThreat) this.lastThreatSeen = now;
    const threatStunned = !!threat && world.isStunned(threat);

    // ----- Scripted: stay hidden -----
    if (this.scripted?.mode === 'stayHidden') {
      if (self.status.hiddenIn) {
        self.aiState = 'stayHidden';
        return;
      }
      const spot = this.pickHideSpot(ctx, this.scripted.spot, this.scripted.roomId);
      if (spot) {
        const d = this.follow.steer(self, nav, [spot.exit.x, spot.exit.z], 0.8, 0.45);
        it.sprint = true;
        self.anim.expression = 'scared';
        if (d < 0.9) hideAgent(self, spot);
        return;
      }
    }
    if (this.scripted?.mode === 'idle') {
      self.anim.expression = 'smug';
      return;
    }

    // ----- Hidden (unscripted) -----
    if (self.status.hiddenIn) {
      this.state = 'hide';
      self.aiState = 'hide';
      if (now > this.hideUntil && (dThreat > 7 || threatStunned)) {
        unhideAgent(self);
        this.set(this.scripted?.mode === 'runHome' ? 'runHome' : 'forage', ctx);
      }
      return;
    }

    // Taunt a stunned hunter (once per stun)
    if (threat && threatStunned && dThreat < 9 && this.tauntedStun !== threat.status.stunnedUntil && def.ability === 'taunt') {
      this.tauntedStun = threat.status.stunnedUntil;
      self.facing = Math.atan2(threat.position.x - self.position.x, threat.position.z - self.position.z);
      it.ability = true;
      self.anim.expression = 'smug';
      this.set('taunt', ctx);
      return;
    }
    if (self.status.action === 'taunt') return;

    if (threat && !threatStunned && dThreat < 6) this.tricks(ctx, threat, dThreat);

    // ----- Scripted: run for it -----
    if (this.scripted?.mode === 'runHome') {
      const zone = ctx.env.zones.find((z) => z.id === (this.scripted as { zoneId: string }).zoneId);
      // Hunter right on top of us or blocking the way: juke sideways before resuming the dash.
      if (zone && threat && !threatStunned && dThreat < 3.2 && now > this.fleeUntil - 1.3) {
        const blocking = segmentDistance([threat.position.x, threat.position.z], [self.position.x, self.position.z], [zone.center[0], zone.center[2]]) < 2.5;
        if (blocking || dThreat < 2) {
          this.pickFleeGoal(ctx, threat);
          this.fleeUntil = now + 1.3;
        }
      }
      if (zone && this.fleeGoal && now < this.fleeUntil) {
        this.follow.steer(self, nav, this.fleeGoal, 0.4, 0.4);
        it.sprint = self.stamina > 0.03;
        self.anim.expression = 'scared';
        return;
      }
      if (zone) {
        this.follow.steer(self, nav, [zone.center[0], zone.center[2]], 0.5, 0.25);
        it.sprint = self.stamina > 0.03;
        self.anim.expression = dThreat < 6 ? 'scared' : 'determined';
        if (threat && dThreat < 3) self.anim.lookAt = this.look.copy(threat.position);
        return;
      }
    }
    if (this.scripted?.mode === 'goto') {
      const d = this.follow.steer(self, nav, this.scripted.at, 1, 0.4);
      it.sprint = d > 3;
      if (d < 0.5 && !(threat && seesThreat && dThreat < 8)) return;
    }

    // ----- Flee -----
    const danger = threat && !threatStunned && ((seesThreat && dThreat < 8.5) || dThreat < 3);
    if (danger && threat) {
      if (this.state !== 'flee' || now > this.fleeUntil || !this.fleeGoal) this.pickFleeGoal(ctx, threat);
      this.set('flee', ctx);
    }
    if (this.state === 'flee') {
      if (!this.fleeGoal || (now > this.fleeUntil && now - this.lastThreatSeen > 2)) {
        this.set('forage', ctx);
      } else {
        const d = this.follow.steer(self, nav, this.fleeGoal, 0.35, 0.45);
        it.sprint = self.stamina > 0.05;
        self.anim.expression = 'scared';
        if (threat) self.anim.lookAt = this.look.copy(threat.position);
        if (def.trap && threat && dThreat < 3.2 && (self.charges[def.trap.kind] ?? 0) > 0 && rng() < 0.05) it.trap = true;
        if (this.fleeSpot && d < 0.9) {
          if (!this.fleeSpot.occupant && hideAgent(self, this.fleeSpot)) {
            this.hideUntil = now + 2.5 + rng() * 3.5;
            this.fleeSpot = null;
            return;
          }
          if (threat) this.pickFleeGoal(ctx, threat);
        } else if (d < 0.6 && threat) {
          this.pickFleeGoal(ctx, threat);
        }
        return;
      }
    }

    // ----- Forage / go home -----
    const items = useItems.getState().pickups.filter((p) => !p.collected && !p.hidden && (ctx.options.collects ?? ['cheese']).includes(p.type));
    if (!items.length) {
      const zone = ctx.env.zones.find((z) => z.id === (ctx.options.homeZone ?? 'mouse-home'));
      if (zone) {
        this.set('home', ctx);
        this.follow.steer(self, nav, [zone.center[0], zone.center[2]], 1, 0.3);
        self.anim.expression = 'happy';
        it.sprint = dThreat < 10;
      }
      return;
    }
    this.set('forage', ctx);
    let best = items[0];
    let bestScore = Infinity;
    const me: XZ = [self.position.x, self.position.z];
    for (const p of items) {
      const pp: XZ = [p.position[0], p.position[2]];
      const d = Math.hypot(pp[0] - me[0], pp[1] - me[1]);
      const dt = threat ? Math.hypot(pp[0] - threat.position.x, pp[1] - threat.position.z) : 99;
      // Change route when the hunter stands in the way.
      const blocking = threat ? segmentDistance([threat.position.x, threat.position.z], me, pp) : 99;
      const score = d - Math.min(dt, 12) * 0.6 + (blocking < 3 ? 14 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    const d = this.follow.steer(self, nav, [best.position[0], best.position[2]], 1.2, 0.2);
    const sneaky = !!threat && dThreat < 11;
    it.sneak = sneaky && d > 1.5;
    self.anim.expression = sneaky ? 'smug' : 'determined';
    if (best.position[1] > 0.5 && d < 1.1) it.jump = true;
  }

  /** Cartoon tricks while being chased: slam a door, topple something onto the hunter. */
  private tricks(ctx: BrainContext, threat: AgentState, dThreat: number) {
    const now = world.time;
    if (now < this.nextTrick) return;
    const self = ctx.self;
    // Hunter right behind and closing?
    const toThreat = threat.position.clone().sub(self.position).setY(0);
    const closing = threat.velocity.x * -toThreat.x + threat.velocity.z * -toThreat.z > 0;
    if (!closing) return;
    for (const door of interactions.doors.values()) {
      if (!door.open) continue;
      const dMe = Math.hypot(door.center.x - self.position.x, door.center.z - self.position.z);
      const dHunter = Math.hypot(door.center.x - threat.position.x, door.center.z - threat.position.z);
      if (dMe < 1.6 && dHunter < 3.2 && dHunter > dMe) {
        door.slam(self.id);
        this.nextTrick = now + 4;
        return;
      }
    }
    if (dThreat < 4.5) {
      for (const item of interactions.items.values()) {
        if (item.kind !== 'knock') continue;
        const dMe = item.position.distanceTo(self.position);
        const dHunter = Math.hypot(item.position.x - threat.position.x, item.position.z - threat.position.z);
        if (dMe < 1.4 && dHunter < 3 && item.prompt(self)) {
          item.interact(self);
          this.nextTrick = now + 4;
          return;
        }
      }
    }
  }

  private pickHideSpot(ctx: BrainContext, spotId: string | null, roomId?: string): HideSpot | null {
    if (spotId) {
      const s = interactions.hideSpots.get(spotId);
      if (s && (!s.occupant || s.occupant === ctx.self.id)) return s;
    }
    const room = roomId ? ctx.env.rooms.find((r) => r.id === roomId) : undefined;
    let best: HideSpot | null = null;
    let bd = Infinity;
    for (const s of interactions.hideSpots.values()) {
      if (!s.archetypes.includes('prey') || s.occupant || s.searchable === false) continue;
      if (room) {
        const [x0, z0, x1, z1] = room.bounds;
        if (s.position.x < x0 || s.position.x > x1 || s.position.z < z0 || s.position.z > z1) continue;
      }
      const d = s.position.distanceTo(ctx.self.position) + (ctx.rng() * 3);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best && spotId === null && this.scripted?.mode === 'stayHidden') this.scripted.spot = best.id;
    return best;
  }

  private pickFleeGoal(ctx: BrainContext, threat: AgentState) {
    const { self, nav, rng, navs } = ctx;
    const candidates: { p: XZ; spot: HideSpot | null; small?: boolean }[] = [];
    for (const s of interactions.hideSpots.values()) {
      if (s.archetypes.includes('prey') && !s.occupant) candidates.push({ p: [s.exit.x, s.exit.z], spot: s });
    }
    // Far side of nearby mouse holes: routes the hunter can't follow.
    for (const h of holePassages(ctx.env)) {
      if (Math.hypot(h.center[0] - self.position.x, h.center[1] - self.position.z) > 9) continue;
      for (const side of h.sides) candidates.push({ p: side, spot: null, small: true });
    }
    for (let k = 0; k < 12; k++) {
      const a = rng() * Math.PI * 2;
      const r = 5 + rng() * 9;
      const free = nav.nearestFree(self.position.x + Math.cos(a) * r, self.position.z + Math.sin(a) * r, 2);
      if (free) candidates.push({ p: free, spot: null, small: !navs.large.isFree(free[0], free[1]) });
    }
    let best: { p: XZ; spot: HideSpot | null } | null = null;
    let bestScore = -Infinity;
    const tx = threat.position.x - self.position.x;
    const tz = threat.position.z - self.position.z;
    const tl = Math.hypot(tx, tz) || 1;
    for (const c of candidates) {
      const dMe = Math.hypot(c.p[0] - self.position.x, c.p[1] - self.position.z);
      if (dMe > 18 || dMe < 1.2) continue;
      if (!nav.isFree(c.p[0], c.p[1]) && !nav.nearestFree(c.p[0], c.p[1], 0.5)) continue;
      const dThreat = Math.hypot(c.p[0] - threat.position.x, c.p[1] - threat.position.z);
      const dir = ((c.p[0] - self.position.x) * tx + (c.p[1] - self.position.z) * tz) / (dMe * tl);
      let score = dThreat - dMe * 0.55 - Math.max(0, dir) * 6 + (c.spot ? 2.5 : 0) + rng() * 1.5;
      if (c.small) score += 4;
      if (c.spot && c.spot.archetypes.includes('hunter')) score -= 1.5; // the cat can climb in there too
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    this.fleeGoal = best?.p ?? null;
    this.fleeSpot = best?.spot ?? null;
    this.fleeUntil = world.time + 2.5;
  }

  private nearestHunter(self: AgentState): AgentState | undefined {
    let best: AgentState | undefined;
    let bd = Infinity;
    for (const a of world.agents.values()) {
      if (a.archetype !== 'hunter' || a.status.hiddenIn) continue;
      const d = a.position.distanceTo(self.position);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }
}
