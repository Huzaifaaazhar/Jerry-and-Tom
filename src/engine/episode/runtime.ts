/**
 * EpisodeRuntime: pure mission logic, independent of React and rendering (fully unit-testable).
 * Feeds on gameplay events, tracks counters, evaluates objectives / lose conditions / timer, and
 * fires scripted chase events.
 */
import type { GameEvent } from '../core/events';
import type { ChaseEvent, CountedEvent, EpisodeAction, EpisodeDefinition, ObjectiveDef, SideConfig, Who } from './types';
import type { ObjectiveView } from '../core/store';

export interface RuntimeHooks {
  /** Map an agent id to who it is relative to the player. */
  whoIs: (agentId: string) => { who: 'player' | 'opponent' | 'npc'; characterId: string };
  onAction?: (a: EpisodeAction, ev: ChaseEvent) => void;
}

export type Outcome = { outcome: 'win' | 'lose'; reason: string } | null;

interface Counted {
  event: CountedEvent;
  subjectId: string;
  zoneId?: string;
  roomId?: string;
  itemType?: string;
}

function toCounted(e: GameEvent): Counted[] {
  switch (e.type) {
    case 'pickup':
      return [{ event: 'pickup', subjectId: e.agentId, itemType: e.itemType }];
    case 'caught':
      return [
        { event: 'caught', subjectId: e.targetId },
        { event: 'catch', subjectId: e.catcherId },
      ];
    case 'slipped':
    case 'pummeled':
    case 'knocked':
    case 'taunt':
    case 'trapPlaced':
      return [{ event: e.type, subjectId: e.agentId }];
    case 'trapped':
      return [{ event: 'trapped', subjectId: e.agentId }];
    case 'hide':
      return [{ event: 'hide', subjectId: e.agentId }];
    case 'searched':
      return [{ event: 'searched', subjectId: e.agentId }];
    case 'spotted':
      return [{ event: 'spotted', subjectId: e.agentId }];
    case 'enterZone':
      return [{ event: 'enterZone', subjectId: e.agentId, zoneId: e.zoneId }];
    case 'enterRoom':
      return [{ event: 'enterRoom', subjectId: e.agentId, roomId: e.roomId }];
    default:
      return [];
  }
}

export class EpisodeRuntime {
  readonly side: SideConfig;
  elapsed = 0;
  private log: Counted[] = [];
  private done = new Set<string>();
  private failed = new Set<string>();
  private fired = new Set<string>();
  private outcome: Outcome = null;
  private lastEvents: GameEvent[] = [];

  constructor(
    readonly episode: EpisodeDefinition,
    readonly playerCharacterId: string,
    private hooks: RuntimeHooks,
  ) {
    const side = episode.sides[playerCharacterId];
    if (!side) throw new Error(`Episode ${episode.id} has no side for ${playerCharacterId}`);
    this.side = side;
  }

  get timeLeft() {
    return Math.max(0, this.side.timeLimit - this.elapsed);
  }

  get result() {
    return this.outcome;
  }

  private matches(c: Counted, who: Who) {
    if (who === 'any') return true;
    const w = this.hooks.whoIs(c.subjectId);
    if (who === 'player' || who === 'opponent') return w.who === who;
    return who === `npc:${w.characterId}`;
  }

  count(event: CountedEvent, who: Who, filter: { zoneId?: string; roomId?: string; itemType?: string } = {}) {
    let n = 0;
    for (const c of this.log) {
      if (c.event !== event) continue;
      if (filter.zoneId && c.zoneId !== filter.zoneId) continue;
      if (filter.roomId && c.roomId !== filter.roomId) continue;
      if (filter.itemType && c.itemType !== filter.itemType) continue;
      if (this.matches(c, who)) n++;
    }
    return n;
  }

  handleEvent(e: GameEvent) {
    if (this.outcome) return;
    const counted = toCounted(e);
    this.log.push(...counted);
    this.lastEvents.push(e);
    // "reach" objectives complete on entering the zone once prerequisites are done.
    for (const o of this.side.objectives) {
      if (o.type === 'reach' && !this.done.has(o.id) && e.type === 'enterZone' && e.zoneId === o.zoneId) {
        if (this.hooks.whoIs(e.agentId).who === 'player' && (o.after ?? []).every((id) => this.done.has(id))) this.done.add(o.id);
      }
    }
    this.evaluate();
  }

  progress(o: ObjectiveDef): { progress: number; target: number } {
    switch (o.type) {
      case 'collect':
        return { progress: Math.min(o.count, this.count('pickup', 'player', { itemType: o.itemType })), target: o.count };
      case 'reach':
        return { progress: this.done.has(o.id) ? 1 : 0, target: 1 };
      case 'survive':
        return { progress: Math.min(o.seconds, Math.floor(this.elapsed)), target: o.seconds };
      case 'count':
        return { progress: Math.min(o.count, this.count(o.event, o.who, { zoneId: o.zoneId, roomId: o.roomId })), target: o.count };
      case 'avoid':
        return { progress: this.count(o.event, o.who), target: o.max };
    }
  }

  private evaluate() {
    if (this.outcome) return;
    for (const o of this.side.objectives) {
      if (this.done.has(o.id) || this.failed.has(o.id)) continue;
      const p = this.progress(o);
      if (o.type === 'avoid') {
        if (p.progress > o.max) this.failed.add(o.id);
      } else if (o.type !== 'reach' && p.progress >= p.target) this.done.add(o.id);
    }
    for (const l of this.side.lose) {
      if (l.type === 'count' && this.count(l.event, l.who) >= l.max) {
        this.outcome = { outcome: 'lose', reason: l.reason };
        return;
      }
      if (l.type === 'opponentGoal') {
        const got = this.count('pickup', 'opponent', { itemType: l.itemType });
        const home = this.log.some((c) => c.event === 'enterZone' && c.zoneId === l.zoneId && this.matches(c, 'opponent'));
        if (got >= l.count && home) {
          // Only counts if they reached home *after* collecting everything.
          const lastPickup = this.lastIndex((c) => c.event === 'pickup' && c.itemType === l.itemType && this.matches(c, 'opponent'));
          const lastHome = this.lastIndex((c) => c.event === 'enterZone' && c.zoneId === l.zoneId && this.matches(c, 'opponent'));
          if (lastHome > lastPickup) {
            this.outcome = { outcome: 'lose', reason: l.reason };
            return;
          }
        }
      }
    }
    const required = this.side.objectives.filter((o) => !o.optional && o.type !== 'survive');
    const survive = this.side.objectives.filter((o) => !o.optional && o.type === 'survive');
    if (required.length && required.every((o) => this.done.has(o.id)) && survive.every((o) => this.done.has(o.id))) {
      this.outcome = { outcome: 'win', reason: 'All objectives complete' };
    }
  }

  private lastIndex(pred: (c: Counted) => boolean) {
    for (let i = this.log.length - 1; i >= 0; i--) if (pred(this.log[i])) return i;
    return -1;
  }

  /** Advance time; fires timed events and resolves the timer. */
  tick(dt: number): Outcome {
    if (this.outcome) return this.outcome;
    this.elapsed += dt;
    this.runEvents();
    this.lastEvents = [];
    this.evaluate();
    if (!this.outcome && this.elapsed >= this.side.timeLimit) {
      for (const o of this.side.objectives) if (o.type === 'survive') this.done.add(o.id);
      const required = this.side.objectives.filter((o) => !o.optional);
      const ok = required.every((o) => this.done.has(o.id) || (o.type === 'avoid' && !this.failed.has(o.id)));
      this.outcome = ok ? { outcome: 'win', reason: 'Survived until the clock ran out' } : { outcome: 'lose', reason: "Time's up!" };
    }
    return this.outcome;
  }

  private runEvents() {
    for (const ev of this.episode.events) {
      if (ev.sides && !ev.sides.includes(this.playerCharacterId)) continue;
      if ((ev.once ?? true) && this.fired.has(ev.id)) continue;
      if (!this.triggered(ev)) continue;
      this.fired.add(ev.id);
      for (const a of ev.do) this.hooks.onAction?.(a, ev);
    }
  }

  private triggered(ev: ChaseEvent): boolean {
    const w = ev.when;
    if (w.type === 'time') return this.elapsed >= w.at;
    if (w.type === 'objective') return this.done.has(w.id);
    // event trigger
    if (w.event === 'door' || w.event === 'npcState') {
      return this.lastEvents.some((e) => e.type === w.event && (w.event !== 'npcState' || (e.type === 'npcState' && (!w.state || e.state === w.state) && (!w.who || this.whoMatches(e.agentId, w.who)))));
    }
    const n = this.count(w.event, w.who ?? 'any', { zoneId: w.zoneId, roomId: w.roomId });
    return n >= (w.count ?? 1);
  }

  private whoMatches(agentId: string, who: Who) {
    return this.matches({ event: 'pickup', subjectId: agentId }, who);
  }

  objectiveViews(): ObjectiveView[] {
    return this.side.objectives.map((o) => {
      const p = this.progress(o);
      return {
        id: o.id,
        label: o.label,
        progress: p.progress,
        target: p.target,
        done: this.done.has(o.id) || (o.type === 'avoid' && !!this.outcome && !this.failed.has(o.id)),
        failed: this.failed.has(o.id),
        optional: !!o.optional,
      };
    });
  }

  /** Optional objectives, resolved for the results screen. */
  bonusSummary() {
    return this.side.objectives
      .filter((o) => o.optional)
      .map((o) => ({ label: o.label, done: o.type === 'avoid' ? !this.failed.has(o.id) : this.done.has(o.id) }));
  }
}
