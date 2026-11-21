/**
 * Episode contract. An episode is pure data registered in the episode registry: which environment
 * and lighting, who is in it, where they spawn, what each playable side must do, scripted chase
 * events, items, audio and the ending. The engine runs any episode without code changes.
 */
import type { PropPlacement, XZ } from '../environment/types';
import type { Vec3Tuple } from '../core/math';
import type { NpcOptions } from '../ai/brain';
import type { MusicTheme } from '../audio/audio';
import type { GameEvent } from '../core/events';

/** Who an event is about, relative to the human player. */
export type Who = 'player' | 'opponent' | 'any' | `npc:${string}`;

export type CountedEvent =
  | 'pickup'
  | 'caught' // subject = the one who got caught
  | 'catch' // subject = the catcher
  | 'slipped'
  | 'trapped'
  | 'pummeled'
  | 'knocked'
  | 'hide'
  | 'searched'
  | 'spotted'
  | 'taunt'
  | 'trapPlaced'
  | 'enterZone'
  | 'enterRoom'
  | 'found' // subject = the searcher who found someone
  | 'broken' // subject = who broke an object
  | 'bonked' // subject = who got hit by a falling object
  | 'splat' // subject = who face-planted (door slam, wall, fall)
  | 'slam' // subject = who slammed a door
  | 'nearMiss'; // subject = the prey who escaped at the last second

/** Live values the game session measures for 'metric' objectives. */
export type MetricName = 'unseen' | 'hiddenSeconds' | 'seesOpponent';

export type ObjectiveDef = { id: string; label: string; optional?: boolean } & (
  | { type: 'collect'; itemType: string; count: number }
  | { type: 'reach'; zoneId: string; after?: string[] }
  | { type: 'survive'; seconds: number }
  | { type: 'count'; event: CountedEvent; who: Who; count: number; zoneId?: string; roomId?: string }
  | { type: 'avoid'; event: CountedEvent; who: Who; max: number }
  | { type: 'metric'; metric: MetricName; target: number }
);

export type LoseCondition =
  | { type: 'count'; event: CountedEvent; who: Who; max: number; reason: string; zoneId?: string }
  | { type: 'opponentGoal'; itemType: string; count: number; zoneId: string; reason: string };

export interface CutsceneShot {
  /** Look-at target. Use `focus` to frame a cast member instead. */
  target?: Vec3Tuple;
  focus?: string;
  /** Camera position; defaults to an orbit around the target. */
  from?: Vec3Tuple;
  duration: number;
  caption?: string;
}

/**
 * One mission in an episode's sequence. Stages run in order; objectives inside a stage only count
 * events that happen after the stage starts.
 */
export interface StageDef {
  id: string;
  title: string;
  brief: string;
  objectives: ObjectiveDef[];
  /** Extra lose conditions only active in this stage. */
  lose?: LoseCondition[];
  /** Optional stage timer: running out loses the episode with `timeoutReason`. */
  timeLimit?: number;
  timeoutReason?: string;
  /** Where the player reappears if caught during this stage. */
  checkpoint?: { position: Vec3Tuple; facing?: number };
  /** Actions applied only when a run *starts* at this stage (mission select / continue). */
  onResume?: EpisodeAction[];
  /** Where the AI opponent reappears if caught during this stage. */
  opponentRespawn?: { position: Vec3Tuple; facing?: number };
  /** Actions fired when the stage begins (AI commands, doors, cutscenes...). */
  onStart?: EpisodeAction[];
}

export interface SideConfig {
  /** One-line mission brief shown on the character card and at the start. */
  brief: string;
  /** Mode summary on the mode select card ("Hide, sneak, outsmart"). */
  modeSummary?: string;
  timeLimit: number;
  /** Mission sequence. When present, the episode is won by completing every stage. */
  stages?: StageDef[];
  /** Flat objectives (or global bonus goals when `stages` is used). */
  objectives: ObjectiveDef[];
  lose: LoseCondition[];
  /** Starting item charges, e.g. { bananaPeel: 3 }. Defaults to the character's own. */
  charges?: Record<string, number>;
  /** AI options for the opposing character when this side is played. */
  opponentAi?: NpcOptions;
}

/** Episode-specific costume / temporary look. Only accessories and hats - never a different character. */
export interface CharacterVariant {
  hat?: { type: 'nightcap' | 'sunHat' | 'chefHat' | 'partyHat'; color: string; band?: string };
  accessory?: { type: 'scarf' | 'collar' | 'bowtie'; color: string; tag?: string };
}

export interface CastEntry {
  characterId: string;
  variant?: CharacterVariant;
  /** Playable sides can be chosen by the player; the other side becomes AI. */
  playable: boolean;
  spawn: { position: Vec3Tuple; facing?: number };
  /** Where this character reappears after being caught. Defaults to spawn. */
  respawn?: { position: Vec3Tuple; facing?: number };
  npc?: NpcOptions;
}

export type Trigger =
  | { type: 'time'; at: number }
  | { type: 'event'; event: CountedEvent | 'door' | 'npcState'; who?: Who; zoneId?: string; roomId?: string; state?: string; count?: number }
  | { type: 'objective'; id: string };

export type EpisodeAction =
  | { type: 'toast'; text: string; tone?: 'info' | 'good' | 'bad' | 'gag' }
  | { type: 'wake'; characterId: string }
  | { type: 'music'; intensity: number }
  | { type: 'shake'; amount: number }
  | { type: 'door'; doorId: string; open: boolean }
  | { type: 'grant'; item: string; count: number }
  | { type: 'sound'; id: string }
  | { type: 'npc'; characterId: string; command: NpcCommand }
  | { type: 'teleport'; characterId: string; position: Vec3Tuple; facing?: number }
  | { type: 'cutscene'; shots: CutsceneShot[] }
  | { type: 'noise'; position: Vec3Tuple; radius: number; kind?: string }
  | { type: 'showPickups'; group: string };

/** Commands an episode can give to AI characters. */
export type NpcCommand =
  | { type: 'sleep'; at?: XZ }
  | { type: 'wake' }
  | { type: 'alert'; at?: XZ }
  | { type: 'hunt'; seconds?: number }
  | { type: 'mode'; mode: NonNullable<NpcOptions['mode']> }
  | { type: 'hideIn'; roomId?: string; spotId?: string }
  | { type: 'goto'; at: XZ }
  | { type: 'runTo'; zoneId: string }
  | { type: 'enrage'; seconds?: number };

export interface ChaseEvent {
  id: string;
  /** Only run when the player controls one of these characters. */
  sides?: string[];
  once?: boolean;
  when: Trigger;
  do: EpisodeAction[];
}

export interface EndingCard {
  title: string;
  caption: string;
}

/** Conditions for achievements and challenges, evaluated against a finished run. */
export type RunCondition =
  | { type: 'win' }
  | { type: 'winUnder'; seconds: number }
  | { type: 'winWithout'; event: CountedEvent; who: Who }
  | { type: 'eventCount'; event: CountedEvent; who: Who; count: number }
  | { type: 'allBonus' }
  | { type: 'allCollectibles' };

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Limit to one playable character (side). */
  side?: string;
  condition: RunCondition;
}

export interface EpisodeDefinition {
  id: string;
  number: number;
  title: string;
  tagline: string;
  description: string;
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: 1 | 2 | 3;
  /** Rough minutes for a first play-through of one side. */
  estimatedMinutes: number;
  /** Episodes that must be completed (as either side) before this one unlocks. */
  unlock?: { after: string[] };
  /** Episode-specific achievements (one-off unlocks). */
  achievements?: AchievementDef[];
  /** Replayable challenges shown on the episode card. */
  challenges?: AchievementDef[];
  /** Hidden collectibles: found once per save, by either character. */
  collectibles?: { id: string; position: Vec3Tuple }[];
  /** Item type used to render collectibles (default 'goldenThimble'). */
  collectibleType?: string;
  /** Procedural title-card art used for the episode thumbnail. `image` overrides it. */
  thumbnail: { motif: 'moon' | 'sun' | 'cheese' | 'bone' | 'star'; sky: string; ground: string; image?: string };
  environment: string;
  lighting: string;
  extraProps?: PropPlacement[];
  cast: CastEntry[];
  sides: Record<string, SideConfig>;
  /** `group` pickups stay hidden until a `showPickups` action reveals them. */
  pickups: { id: string; type: string; position: Vec3Tuple; group?: string }[];
  /** Persistent environmental hazards (puddles, rakes) placed at the start. */
  hazards?: { kind: string; position: Vec3Tuple }[];
  events: ChaseEvent[];
  audio: { music: MusicTheme; sounds?: Record<string, string>; ambience?: 'night' | 'day' | 'none' };
  ending: { win: Record<string, EndingCard>; lose: Record<string, EndingCard> };
  /** Opening sequence: camera shots with captions, played before control is handed over. */
  intro?: { shots: CutsceneShot[]; text?: string };
}

export type { GameEvent };
