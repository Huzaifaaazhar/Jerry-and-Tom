/**
 * Prey AI (e.g. the mouse when the player is the cat): forages the episode's items, flees when the
 * hunter is close, uses mouse holes and hiding places, drops banana peels mid-chase, taunts a
 * stunned hunter, and heads home once its shopping list is done.
 */
import type { Brain, BrainContext } from '../brain';
import { PathFollower } from '../pathFollower';
import { canSee } from '../perception';
import { world, type AgentState } from '../../core/world';
import { interactions, type HideSpot } from '../../interaction/registry';
import { hideAgent, unhideAgent } from '../../interaction/hiding';
import { useItems } from '../../interaction/items';
import type { XZ } from '../../environment/types';
import * as THREE from 'three';

type S = 'forage' | 'flee' | 'hide' | 'home' | 'taunt' | 'idle';

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

  private set(s: S, ctx: BrainContext) {
    if (this.state === s) return;
    this.state = s;
    this.follow.clear();
    ctx.self.aiState = s;
    world.events.emit({ type: 'npcState', agentId: ctx.self.id, state: s });
  }

  update(ctx: BrainContext) {
    const { self, nav, rng, def } = ctx;
    const it = self.intent;
    const now = world.time;
    it.moveX = it.moveZ = 0;
    it.sprint = it.sneak = it.jump = it.interact = it.ability = it.trap = false;
    self.anim.lookAt = null;
    if (world.isStunned(self) || self.status.respawnAt !== null) return;
    if (!self.aiState) self.aiState = this.state;

    const threat = this.nearestHunter(self);
    const dThreat = threat ? threat.position.distanceTo(self.position) : Infinity;
    const seesThreat = !!threat && !self.status.hiddenIn && (dThreat < 3.5 || canSee(ctx.physics, self, def, threat));
    if (seesThreat) this.lastThreatSeen = now;
    const threatStunned = !!threat && world.isStunned(threat);

    // ----- Hidden -----
    if (self.status.hiddenIn) {
      this.state = 'hide';
      self.aiState = 'hide';
      if (now > this.hideUntil && (dThreat > 7 || threatStunned)) {
        unhideAgent(self);
        this.set('forage', ctx);
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
        // Drop a peel when the hunter is right behind us.
        if (def.trap && threat && dThreat < 3.2 && (self.charges[def.trap.kind] ?? 0) > 0 && rng() < 0.05) it.trap = true;
        if (this.fleeSpot && d < 0.9) {
          if (!this.fleeSpot.occupant && hideAgent(self, this.fleeSpot)) {
            this.hideUntil = now + 2.5 + rng() * 3.5;
            this.fleeSpot = null;
            return;
          }
          this.pickFleeGoal(ctx, threat ?? self);
        } else if (d < 0.6) {
          if (threat) this.pickFleeGoal(ctx, threat);
        }
        return;
      }
    }

    // ----- Forage / go home -----
    const items = useItems.getState().pickups.filter((p) => !p.collected && (ctx.options.collects ?? ['cheese']).includes(p.type));
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
    for (const p of items) {
      const d = Math.hypot(p.position[0] - self.position.x, p.position[2] - self.position.z);
      const dt = threat ? Math.hypot(p.position[0] - threat.position.x, p.position[2] - threat.position.z) : 99;
      const score = d - Math.min(dt, 12) * 0.6;
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

  private pickFleeGoal(ctx: BrainContext, threat: AgentState) {
    const { self, nav, rng } = ctx;
    const candidates: { p: XZ; spot: HideSpot | null }[] = [];
    for (const s of interactions.hideSpots.values()) {
      if (s.archetypes.includes('prey') && !s.occupant) candidates.push({ p: [s.exit.x, s.exit.z], spot: s });
    }
    for (let k = 0; k < 14; k++) {
      const a = rng() * Math.PI * 2;
      const r = 5 + rng() * 9;
      const free = nav.nearestFree(self.position.x + Math.cos(a) * r, self.position.z + Math.sin(a) * r, 2);
      if (free) candidates.push({ p: free, spot: null });
    }
    let best: { p: XZ; spot: HideSpot | null } | null = null;
    let bestScore = -Infinity;
    const tx = threat.position.x - self.position.x;
    const tz = threat.position.z - self.position.z;
    const tl = Math.hypot(tx, tz) || 1;
    for (const c of candidates) {
      const dMe = Math.hypot(c.p[0] - self.position.x, c.p[1] - self.position.z);
      if (dMe > 18 || dMe < 1.2) continue;
      const dThreat = Math.hypot(c.p[0] - threat.position.x, c.p[1] - threat.position.z);
      const dir = ((c.p[0] - self.position.x) * tx + (c.p[1] - self.position.z) * tz) / (dMe * tl);
      // Prefer places far from the hunter, reasonably close to us, not past the hunter.
      let score = dThreat - dMe * 0.55 - Math.max(0, dir) * 6 + (c.spot ? 2.5 : 0) + rng() * 1.5;
      // Spots only the small can reach (mouse holes / under furniture) are gold.
      const bigNav = ctx.nav;
      if (bigNav && !nav.isFree(c.p[0], c.p[1])) score -= 10;
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
