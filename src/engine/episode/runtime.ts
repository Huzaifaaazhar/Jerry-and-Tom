/**
 * EpisodeRuntime: pure mission logic, independent of React and rendering (fully unit-testable).
 * Feeds on gameplay events, tracks counters, runs the stage (mission) sequence, evaluates
 * objectives / lose conditions / timers, and fires scripted chase events.
 */
import type { GameEvent } from '../core/events';
import type { ChaseEvent, CountedEvent, EpisodeAction, EpisodeDefinition, LoseCondition, MetricName, ObjectiveDef, SideConfig, StageDef, Who } from './types';
import type { ObjectiveView } from '../core/store';

export interface RuntimeHooks {
  /** Map an agent id to who it is relative to the player. */
  whoIs: (agentId: string) => { who: 'player' | 'opponent' | 'npc'; characterId: string };
  onAction?: (a: EpisodeAction, source: { kind: 'event' | 'stage'; id: string }) => void;
  /** Live measurements for 'metric' objectives. */
  metric?: (name: MetricName) => number;
  /** Is the player currently inside a zone (lets "reach" complete if already standing there). */
  inZone?: (zoneId: string) => boolean;
  onStage?: (stage: StageDef, index: number) => void;
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
    case 'trapped':
    case 'hide':
    case 'spotted':
    case 'broken':
    case 'bonked':
    case 'splat':
    case 'slam':
    case 'nearMiss':
      return [{ event: e.type, subjectId: e.agentId }];
    case 'searched':
      return e.found ? [{ event: 'searched', subjectId: e.agentId }, { event: 'found', subjectId: e.agentId }] : [{ event: 'searched', subjectId: e.agentId }];
    case 'enterZone':
      return [{ event: 'enterZone', subjectId: e.agentId, zoneId: e.zoneId }];
    case 'enterRoom':
      return [{ event: 'enterRoom', subjectId: e.agentId, roomId: e.roomId }];
    default:
      return [];
  }
}

export interface StageInfo {
  index: number;
  total: number;
  id: string;
  title: string;
  brief: string;
  timeLeft: number | null;
}

export class EpisodeRuntime {
  readonly side: SideConfig;
  readonly stages: StageDef[];
  elapsed = 0;
  stageIndex = 0;
  private stageStartLog = 0;
  private stageStartTime = 0;
  private started = false;
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
    this.stages = side.stages ?? [];
  }

  get timeLeft() {
    return Math.max(0, this.side.timeLimit - this.elapsed);
  }

  get result() {
    return this.outcome;
  }

  get currentStage(): StageDef | null {
    return this.stages[this.stageIndex] ?? null;
  }

  stageInfo(): StageInfo | null {
    const s = this.currentStage;
    if (!s) return null;
    return {
      index: this.stageIndex,
      total: this.stages.length,
      id: s.id,
      title: s.title,
      brief: s.brief,
      timeLeft: s.timeLimit ? Math.max(0, s.timeLimit - (this.elapsed - this.stageStartTime)) : null,
    };
  }

  private matches(c: Counted, who: Who) {
    if (who === 'any') return true;
    const w = this.hooks.whoIs(c.subjectId);
    if (who === 'player' || who === 'opponent') return w.who === who;
    return who === `npc:${w.characterId}`;
  }

  count(event: CountedEvent, who: Who, filter: { zoneId?: string; roomId?: string; itemType?: string; sinceStage?: boolean } = {}) {
    let n = 0;
    for (let i = filter.sinceStage ? this.stageStartLog : 0; i < this.log.length; i++) {
      const c = this.log[i];
      if (c.event !== event) continue;
      if (filter.zoneId && c.zoneId !== filter.zoneId) continue;
      if (filter.roomId && c.roomId !== filter.roomId) continue;
      if (filter.itemType && c.itemType !== filter.itemType) continue;
      if (this.matches(c, who)) n++;
    }
    return n;
  }

  private key(o: ObjectiveDef, stageLocal: boolean) {
    return stageLocal ? `${this.stageIndex}:${o.id}` : `g:${o.id}`;
  }

  handleEvent(e: GameEvent) {
    if (this.outcome) return;
    this.log.push(...toCounted(e));
    this.lastEvents.push(e);
    if (e.type === 'enterZone' && this.hooks.whoIs(e.agentId).who === 'player') {
      for (const [list, local] of this.objectiveLists()) {
        for (const o of list) {
          if (o.type === 'reach' && o.zoneId === e.zoneId && this.prereqsDone(o, local)) this.done.add(this.key(o, local));
        }
      }
    }
    this.evaluate();
  }

  private objectiveLists(): [ObjectiveDef[], boolean][] {
    const out: [ObjectiveDef[], boolean][] = [];
    const st = this.currentStage;
    if (st) out.push([st.objectives, true]);
    out.push([this.side.objectives, false]);
    return out;
  }

  private prereqsDone(o: ObjectiveDef & { type: 'reach' }, local: boolean) {
    const list = local ? (this.currentStage?.objectives ?? []) : this.side.objectives;
    return (o.after ?? []).every((id) => {
      const dep = list.find((d) => d.id === id);
      return dep ? this.done.has(this.key(dep, local)) : true;
    });
  }

  progress(o: ObjectiveDef, stageLocal = false): { progress: number; target: number } {
    const since = { sinceStage: stageLocal };
    switch (o.type) {
      case 'collect':
        return { progress: Math.min(o.count, this.count('pickup', 'player', { itemType: o.itemType, ...since })), target: o.count };
      case 'reach':
        return { progress: this.done.has(this.key(o, stageLocal)) ? 1 : 0, target: 1 };
      case 'survive': {
        const t = stageLocal ? this.elapsed - this.stageStartTime : this.elapsed;
        return { progress: Math.min(o.seconds, Math.floor(t)), target: o.seconds };
      }
      case 'count':
        return { progress: Math.min(o.count, this.count(o.event, o.who, { zoneId: o.zoneId, roomId: o.roomId, ...since })), target: o.count };
      case 'avoid':
        return { progress: this.count(o.event, o.who, since), target: o.max };
      case 'metric': {
        if (this.done.has(this.key(o, stageLocal))) return { progress: o.target, target: o.target };
        const v = this.hooks.metric?.(o.metric) ?? 0;
        return { progress: Math.min(o.target, Math.floor(v * 10) / 10), target: o.target };
      }
    }
  }

  private evaluateList(list: ObjectiveDef[], local: boolean) {
    for (const o of list) {
      const k = this.key(o, local);
      if (this.done.has(k) || this.failed.has(k)) continue;
      if (o.type === 'reach') {
        if (this.hooks.inZone?.(o.zoneId) && this.prereqsDone(o, local)) this.done.add(k);
        continue;
      }
      if (o.type === 'survive') {
        if (local && this.progress(o, local).progress >= o.seconds) this.done.add(k);
        continue;
      }
      const p = this.progress(o, local);
      if (o.type === 'avoid') {
        if (p.progress > o.max) this.failed.add(k);
      } else if (p.progress >= p.target) this.done.add(k);
    }
  }

  private checkLose(rules: LoseCondition[], stageLocal: boolean): boolean {
    for (const l of rules) {
      if (l.type === 'count' && this.count(l.event, l.who, { sinceStage: stageLocal, zoneId: l.zoneId }) >= l.max) {
        this.outcome = { outcome: 'lose', reason: l.reason };
        return true;
      }
      if (l.type === 'opponentGoal') {
        const got = this.count('pickup', 'opponent', { itemType: l.itemType });
        if (got < l.count) continue;
        const lastPickup = this.lastIndex((c) => c.event === 'pickup' && c.itemType === l.itemType && this.matches(c, 'opponent'));
        const lastHome = this.lastIndex((c) => c.event === 'enterZone' && c.zoneId === l.zoneId && this.matches(c, 'opponent'));
        const floor = stageLocal ? this.stageStartLog : 0;
        if (lastHome >= floor && lastHome > lastPickup) {
          this.outcome = { outcome: 'lose', reason: l.reason };
          return true;
        }
      }
    }
    return false;
  }

  private evaluate() {
    if (this.outcome) return;
    const st = this.currentStage;
    if (st) this.evaluateList(st.objectives, true);
    this.evaluateList(this.side.objectives, false);
    if (this.checkLose(this.side.lose, false)) return;
    if (st && st.lose && this.checkLose(st.lose, true)) return;

    if (this.stages.length) {
      if (!this.started) return;
      if (st && st.objectives.filter((o) => !o.optional).every((o) => this.done.has(this.key(o, true)))) this.advanceStage();
      return;
    }
    const required = this.side.objectives.filter((o) => !o.optional && o.type !== 'survive');
    const survive = this.side.objectives.filter((o) => !o.optional && o.type === 'survive');
    if (required.length && required.every((o) => this.done.has(this.key(o, false))) && survive.every((o) => this.done.has(this.key(o, false)))) {
      this.outcome = { outcome: 'win', reason: 'All objectives complete' };
    }
  }

  private startStage(index: number) {
    this.stageIndex = index;
    this.stageStartLog = this.log.length;
    this.stageStartTime = this.elapsed;
    const st = this.stages[index];
    this.hooks.onStage?.(st, index);
    for (const a of st.onStart ?? []) this.hooks.onAction?.(a, { kind: 'stage', id: st.id });
  }

  private advanceStage() {
    if (this.stageIndex + 1 >= this.stages.length) {
      this.stageIndex = this.stages.length;
      this.outcome = { outcome: 'win', reason: 'Episode complete' };
      return;
    }
    this.startStage(this.stageIndex + 1);
    this.evaluate();
  }

  /** Jump straight to a stage (debug / tests / chapter select). */
  skipToStage(index: number) {
    if (!this.stages.length) return;
    this.started = true;
    this.startStage(Math.max(0, Math.min(index, this.stages.length - 1)));
  }

  private lastIndex(pred: (c: Counted) => boolean) {
    for (let i = this.log.length - 1; i >= 0; i--) if (pred(this.log[i])) return i;
    return -1;
  }

  /** Advance time; starts the first stage, fires timed events and resolves timers. */
  tick(dt: number): Outcome {
    if (this.outcome) return this.outcome;
    if (!this.started) {
      this.started = true;
      if (this.stages.length) this.startStage(0);
    }
    this.elapsed += dt;
    this.runEvents();
    this.lastEvents = [];
    this.evaluate();
    if (this.outcome) return this.outcome;
    const st = this.currentStage;
    if (st?.timeLimit && this.elapsed - this.stageStartTime >= st.timeLimit) {
      this.outcome = { outcome: 'lose', reason: st.timeoutReason ?? "Time's up!" };
      return this.outcome;
    }
    if (this.elapsed >= this.side.timeLimit) {
      if (this.stages.length) {
        this.outcome = { outcome: 'lose', reason: "Time's up!" };
        return this.outcome;
      }
      for (const o of this.side.objectives) if (o.type === 'survive') this.done.add(this.key(o, false));
      const required = this.side.objectives.filter((o) => !o.optional);
      const ok = required.every((o) => this.done.has(this.key(o, false)) || (o.type === 'avoid' && !this.failed.has(this.key(o, false))));
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
      for (const a of ev.do) this.hooks.onAction?.(a, { kind: 'event', id: ev.id });
    }
  }

  private triggered(ev: ChaseEvent): boolean {
    const w = ev.when;
    if (w.type === 'time') return this.elapsed >= w.at;
    if (w.type === 'objective') {
      for (const [list, local] of this.objectiveLists()) {
        const o = list.find((x) => x.id === w.id);
        if (o && this.done.has(this.key(o, local))) return true;
      }
      return this.stages.slice(0, this.stageIndex).some((s) => s.id === w.id);
    }
    if (w.event === 'door' || w.event === 'npcState') {
      return this.lastEvents.some((e) => e.type === w.event && (w.event !== 'npcState' || (e.type === 'npcState' && (!w.state || e.state === w.state) && (!w.who || this.whoMatches(e.agentId, w.who)))));
    }
    const n = this.count(w.event, w.who ?? 'any', { zoneId: w.zoneId, roomId: w.roomId });
    return n >= (w.count ?? 1);
  }

  private whoMatches(agentId: string, who: Who) {
    return this.matches({ event: 'pickup', subjectId: agentId }, who);
  }

  private view(o: ObjectiveDef, local: boolean): ObjectiveView {
    const p = this.progress(o, local);
    const k = this.key(o, local);
    return {
      id: o.id,
      label: o.label,
      progress: p.progress,
      target: p.target,
      done: this.done.has(k) || (o.type === 'avoid' && !!this.outcome && !this.failed.has(k)),
      failed: this.failed.has(k),
      optional: !!o.optional || (!local && this.stages.length > 0),
    };
  }

  /** Current stage objectives (or flat objectives) followed by optional/bonus goals. */
  objectiveViews(): ObjectiveView[] {
    const st = this.currentStage;
    const out: ObjectiveView[] = [];
    if (st) for (const o of st.objectives) out.push(this.view(o, true));
    for (const o of this.side.objectives) out.push(this.view(o, false));
    return out;
  }

  /** Optional objectives, resolved for the results screen. */
  bonusSummary() {
    return this.side.objectives
      .filter((o) => o.optional || this.stages.length > 0)
      .map((o) => ({ label: o.label, done: o.type === 'avoid' ? !this.failed.has(this.key(o, false)) : this.done.has(this.key(o, false)) }));
  }

  /** How many stages have been completed (for the results screen). */
  stagesCompleted() {
    return this.outcome?.outcome === 'win' && this.stages.length ? this.stages.length : Math.min(this.stageIndex, this.stages.length);
  }
}
