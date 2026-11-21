/**
 * UI-facing game state (zustand). Coarse-grained: screens, selections, settings and the HUD
 * snapshot that the episode runtime publishes at ~10Hz. Per-frame simulation lives in world.ts.
 */
import { create } from 'zustand';

export type Screen = 'menu' | 'episodes' | 'characters' | 'playing' | 'results' | 'howto' | 'scrapbook';

export interface ObjectiveView {
  id: string;
  label: string;
  progress: number;
  target: number;
  done: boolean;
  failed: boolean;
  optional: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'gag';
  until: number;
}

export interface MatchResult {
  outcome: 'win' | 'lose';
  title: string;
  caption: string;
  stats: { label: string; value: string }[];
  bonus: { label: string; done: boolean }[];
  stages?: { title: string; done: boolean }[];
  rewards?: {
    achievements: string[];
    challenges: string[];
    unlockedEpisodes: string[];
    newBest: boolean;
    collectibles: { found: number; total: number; newThisRun: number };
  };
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  invertY: boolean;
  touchControls: 'auto' | 'on' | 'off';
  quality: 'auto' | 'high' | 'low';
  reducedMotion: boolean;
  showDebug: boolean;
}

export interface HudState {
  timeLeft: number;
  objectives: ObjectiveView[];
  prompt: string | null;
  stamina: number;
  charges: Record<string, number>;
  chase: number;
  hidden: boolean;
  stunned: boolean;
  /** Short label of the room the player is in. */
  room: string | null;
  lives: { current: number; max: number } | null;
  /** Current mission in the episode's stage sequence. */
  stage: { index: number; total: number; title: string; brief: string; timeLeft: number | null } | null;
  /** Prey HUD: how exposed the player is right now. */
  detection: 'hidden' | 'safe' | 'heard' | 'seen' | null;
  /** Hunter HUD: screen-space direction (degrees) toward the prey's last known whereabouts. */
  scent: { angle: number; fresh: number } | null;
  role: 'hunter' | 'prey' | 'guardian' | null;
}

export interface CutsceneView {
  caption: string | null;
  skippable: boolean;
}

export interface StageBanner {
  index: number;
  total: number;
  title: string;
  brief: string;
  key: number;
}

interface GameStore {
  screen: Screen;
  paused: boolean;
  episodeId: string | null;
  characterId: string | null;
  runId: number;
  loading: boolean;
  /** Mission to start from (continue / mission select). */
  startStage: number;
  setStartStage: (i: number) => void;
  settings: Settings;
  hud: HudState;
  toasts: Toast[];
  result: MatchResult | null;
  pointerLocked: boolean;
  cutscene: CutsceneView | null;
  banner: StageBanner | null;
  setCutscene: (c: CutsceneView | null) => void;
  showBanner: (b: Omit<StageBanner, 'key'> | null) => void;

  goTo: (screen: Screen) => void;
  selectEpisode: (id: string) => void;
  selectCharacter: (id: string) => void;
  startRun: () => void;
  restart: () => void;
  setPaused: (p: boolean) => void;
  setLoading: (l: boolean) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setHud: (h: Partial<HudState>) => void;
  pushToast: (text: string, tone?: Toast['tone'], seconds?: number) => void;
  pruneToasts: () => void;
  finish: (r: MatchResult) => void;
  setPointerLocked: (v: boolean) => void;
}

const SETTINGS_KEY = 'squeak-pounce-settings-v1';
const defaultSettings: Settings = {
  musicVolume: 0.55,
  sfxVolume: 0.8,
  mouseSensitivity: 1,
  invertY: false,
  touchControls: 'auto',
  quality: 'auto',
  reducedMotion: false,
  showDebug: false,
};

function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return { ...defaultSettings, reducedMotion: reduced };
}

export const emptyHud = (): HudState => ({
  timeLeft: 0,
  objectives: [],
  prompt: null,
  stamina: 1,
  charges: {},
  chase: 0,
  hidden: false,
  stunned: false,
  room: null,
  lives: null,
  stage: null,
  detection: null,
  scent: null,
  role: null,
});

let toastId = 0;

export const useGame = create<GameStore>((set, get) => ({
  screen: 'menu',
  paused: false,
  episodeId: null,
  characterId: null,
  runId: 0,
  loading: false,
  startStage: 0,
  setStartStage: (startStage) => set({ startStage }),
  settings: loadSettings(),
  hud: emptyHud(),
  toasts: [],
  result: null,
  pointerLocked: false,
  cutscene: null,
  banner: null,
  setCutscene: (cutscene) => set({ cutscene }),
  showBanner: (b) => set({ banner: b ? { ...b, key: ++toastId } : null }),

  goTo: (screen) => set({ screen, paused: false }),
  selectEpisode: (id) => set({ episodeId: id }),
  selectCharacter: (id) => set({ characterId: id }),
  startRun: () =>
    set((s) => ({ screen: 'playing', paused: false, runId: s.runId + 1, result: null, hud: emptyHud(), toasts: [], loading: true, cutscene: null, banner: null })),
  restart: () => get().startRun(),
  setPaused: (paused) => set({ paused }),
  setLoading: (loading) => set({ loading }),
  updateSettings: (s) => {
    const settings = { ...get().settings, ...s };
    try {
      globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    set({ settings });
  },
  setHud: (h) => set((s) => ({ hud: { ...s.hud, ...h } })),
  pushToast: (text, tone = 'info', seconds = 2.6) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-3), { id: ++toastId, text, tone, until: performance.now() + seconds * 1000 }],
    })),
  pruneToasts: () => {
    const now = performance.now();
    const toasts = get().toasts;
    if (toasts.some((t) => t.until < now)) set({ toasts: toasts.filter((t) => t.until >= now) });
  },
  finish: (result) => set({ result, screen: 'results', paused: false }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
}));
