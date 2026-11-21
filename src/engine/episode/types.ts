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
  | 'enterRoom';

export type ObjectiveDef = { id: string; label: string; optional?: boolean } & (
  | { type: 'collect'; itemType: string; count: number }
  | { type: 'reach'; zoneId: string; after?: string[] }
  | { type: 'survive'; seconds: number }
  | { type: 'count'; event: CountedEvent; who: Who; count: number; zoneId?: string; roomId?: string }
  | { type: 'avoid'; event: CountedEvent; who: Who; max: number }
);

export type LoseCondition =
  | { type: 'count'; event: CountedEvent; who: Who; max: number; reason: string }
  | { type: 'opponentGoal'; itemType: string; count: number; zoneId: string; reason: string };

export interface SideConfig {
  /** One-line mission brief shown on the character card and at the start. */
  brief: string;
  timeLimit: number;
  objectives: ObjectiveDef[];
  lose: LoseCondition[];
  /** Starting item charges, e.g. { bananaPeel: 3 }. Defaults to the character's own. */
  charges?: Record<string, number>;
  /** AI options for the opposing character when this side is played. */
  opponentAi?: NpcOptions;
}

export interface CastEntry {
  characterId: string;
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
  | { type: 'sound'; id: string };

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

export interface EpisodeDefinition {
  id: string;
  number: number;
  title: string;
  tagline: string;
  description: string;
  /** Procedural title-card art used for the episode thumbnail. `image` overrides it. */
  thumbnail: { motif: 'moon' | 'sun' | 'cheese' | 'bone' | 'star'; sky: string; ground: string; image?: string };
  environment: string;
  lighting: string;
  extraProps?: PropPlacement[];
  cast: CastEntry[];
  sides: Record<string, SideConfig>;
  pickups: { id: string; type: string; position: Vec3Tuple }[];
  events: ChaseEvent[];
  audio: { music: MusicTheme; sounds?: Record<string, string> };
  ending: { win: Record<string, EndingCard>; lose: Record<string, EndingCard> };
  /** Optional camera framing hint for the intro. */
  intro?: { focus: XZ; text?: string };
}

export type { GameEvent };
