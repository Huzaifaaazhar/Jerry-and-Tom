/**
 * Persistent player progress (localStorage, versioned). Tracks per-episode, per-side completion,
 * best times, furthest mission, collectibles, achievements, challenges and lifetime statistics.
 * Pure evaluation (`evaluateRun`) is separated from storage so it can be unit tested.
 */
import { create } from 'zustand';
import type { AchievementDef, EpisodeDefinition, RunCondition } from '../episode/types';
import { allEpisodes } from '../episode/registry';
import { allLifetimeAchievements } from './achievements';

export interface SideProgress {
  plays: number;
  wins: number;
  losses: number;
  completed: boolean;
  bestTime: number | null;
  /** Highest mission index reached (0-based). */
  furthestStage: number;
}

export interface EpisodeProgress {
  sides: Record<string, SideProgress>;
  collectibles: string[];
  achievements: string[];
  challenges: string[];
}

export interface SaveData {
  version: 1;
  episodes: Record<string, EpisodeProgress>;
  /** Lifetime statistics per character id: stat name -> total. */
  stats: Record<string, Record<string, number>>;
  achievements: string[];
  lastPlayed: { episodeId: string; characterId: string } | null;
}

/** Everything the game knows about one finished (won or lost) run. */
export interface RunReport {
  episodeId: string;
  characterId: string;
  outcome: 'win' | 'lose';
  elapsed: number;
  furthestStage: number;
  /** Counted events for this run, keyed `${event}:${who}` (who = player | opponent). */
  counts: Record<string, number>;
  bonusAll: boolean;
  collectiblesFound: string[];
}

export interface RunRewards {
  achievements: AchievementDef[];
  challenges: AchievementDef[];
  lifetime: { id: string; title: string }[];
  unlockedEpisodes: string[];
  newBest: boolean;
  collectibles: number;
}

const KEY = 'squeak-pounce-save-v1';

export const emptySave = (): SaveData => ({ version: 1, episodes: {}, stats: {}, achievements: [], lastPlayed: null });
const emptySide = (): SideProgress => ({ plays: 0, wins: 0, losses: 0, completed: false, bestTime: null, furthestStage: 0 });
const emptyEpisode = (): EpisodeProgress => ({ sides: {}, collectibles: [], achievements: [], challenges: [] });

export function loadSave(): SaveData {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return emptySave();
    return { ...emptySave(), ...data } as SaveData;
  } catch {
    return emptySave();
  }
}

function persist(s: SaveData) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full / unavailable: progress lives for this session only */
  }
}

export function conditionMet(c: RunCondition, run: RunReport, ep: EpisodeDefinition, allCollectibles: string[]): boolean {
  const n = (event: string, who: string) => run.counts[`${event}:${who}`] ?? 0;
  switch (c.type) {
    case 'win':
      return run.outcome === 'win';
    case 'winUnder':
      return run.outcome === 'win' && run.elapsed <= c.seconds;
    case 'winWithout':
      return run.outcome === 'win' && n(c.event, c.who) === 0;
    case 'eventCount':
      return n(c.event, c.who) >= c.count;
    case 'allBonus':
      return run.outcome === 'win' && run.bonusAll;
    case 'allCollectibles':
      return (ep.collectibles ?? []).length > 0 && (ep.collectibles ?? []).every((k) => allCollectibles.includes(k.id));
  }
}

export function isUnlocked(ep: EpisodeDefinition, save: SaveData) {
  return (ep.unlock?.after ?? []).every((id) => Object.values(save.episodes[id]?.sides ?? {}).some((s) => s.completed));
}

/** Apply a run to a save (pure: returns the new save and what was earned). */
export function evaluateRun(save: SaveData, run: RunReport, episodes: EpisodeDefinition[]): { save: SaveData; rewards: RunRewards } {
  const next: SaveData = JSON.parse(JSON.stringify(save));
  const ep = episodes.find((e) => e.id === run.episodeId);
  const rewards: RunRewards = { achievements: [], challenges: [], lifetime: [], unlockedEpisodes: [], newBest: false, collectibles: 0 };
  if (!ep) return { save: next, rewards };
  const lockedBefore = episodes.filter((e) => !isUnlocked(e, save)).map((e) => e.id);

  const epp = (next.episodes[ep.id] ??= emptyEpisode());
  const side = (epp.sides[run.characterId] ??= emptySide());
  side.plays++;
  side.furthestStage = Math.max(side.furthestStage, run.furthestStage);
  if (run.outcome === 'win') {
    side.wins++;
    side.completed = true;
    if (side.bestTime === null || run.elapsed < side.bestTime) {
      rewards.newBest = side.bestTime !== null;
      side.bestTime = Math.round(run.elapsed * 10) / 10;
    }
  } else side.losses++;
  for (const c of run.collectiblesFound) {
    if (!epp.collectibles.includes(c)) {
      epp.collectibles.push(c);
      rewards.collectibles++;
    }
  }
  for (const a of ep.achievements ?? []) {
    if (epp.achievements.includes(a.id) || (a.side && a.side !== run.characterId)) continue;
    if (conditionMet(a.condition, run, ep, epp.collectibles)) {
      epp.achievements.push(a.id);
      rewards.achievements.push(a);
    }
  }
  for (const c of ep.challenges ?? []) {
    if (epp.challenges.includes(c.id) || (c.side && c.side !== run.characterId)) continue;
    if (conditionMet(c.condition, run, ep, epp.collectibles)) {
      epp.challenges.push(c.id);
      rewards.challenges.push(c);
    }
  }
  // Lifetime stats for the player's character.
  const stats = (next.stats[run.characterId] ??= {});
  stats.plays = (stats.plays ?? 0) + 1;
  if (run.outcome === 'win') stats.wins = (stats.wins ?? 0) + 1;
  for (const [k, v] of Object.entries(run.counts)) {
    if (!k.endsWith(':player') || !v) continue;
    const stat = k.slice(0, -':player'.length);
    stats[stat] = (stats[stat] ?? 0) + v;
  }
  // "Escapes": winning as prey, plus last-second dodges.
  for (const a of allLifetimeAchievements()) {
    if (next.achievements.includes(a.id)) continue;
    if ((next.stats[a.characterId]?.[a.stat] ?? 0) >= a.count) {
      next.achievements.push(a.id);
      rewards.lifetime.push({ id: a.id, title: a.title });
    }
  }
  next.lastPlayed = { episodeId: run.episodeId, characterId: run.characterId };
  rewards.unlockedEpisodes = lockedBefore.filter((id) => isUnlocked(episodes.find((e) => e.id === id)!, next));
  return { save: next, rewards };
}

interface ProgressStore {
  save: SaveData;
  lastRewards: RunRewards | null;
  record: (run: RunReport) => RunRewards;
  reset: () => void;
  /** Replace the save (import / tests). */
  load: (s: SaveData) => void;
}

export const useProgress = create<ProgressStore>((set, get) => ({
  save: loadSave(),
  lastRewards: null,
  record: (run) => {
    const { save, rewards } = evaluateRun(get().save, run, allEpisodes());
    persist(save);
    set({ save, lastRewards: rewards });
    return rewards;
  },
  reset: () => {
    const s = emptySave();
    persist(s);
    set({ save: s, lastRewards: null });
  },
  load: (s) => {
    persist(s);
    set({ save: s });
  },
}));

export function episodeCompletion(ep: EpisodeDefinition, save: SaveData) {
  const p = save.episodes[ep.id];
  const sides = ep.cast.filter((c) => c.playable).map((c) => c.characterId);
  const sideDone = sides.filter((s) => p?.sides[s]?.completed).length;
  const total = sides.length + (ep.achievements?.length ?? 0) + (ep.challenges?.length ?? 0) + (ep.collectibles?.length ?? 0);
  const got = sideDone + (p?.achievements.length ?? 0) + (p?.challenges.length ?? 0) + (p?.collectibles.length ?? 0);
  return { sides, sideDone, percent: total ? Math.round((got / total) * 100) : 0 };
}
