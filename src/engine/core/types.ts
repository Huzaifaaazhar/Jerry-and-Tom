import type { Vec3Tuple } from './math';

/** Behavioural archetype decides which brain / catch rules apply. Content picks one per character. */
export type Archetype = 'hunter' | 'prey' | 'guardian';

export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sneak'
  | 'jump'
  | 'fall'
  | 'land'
  | 'slip'
  | 'stunned'
  | 'laugh'
  | 'react'
  | 'grab'
  | 'pounce'
  | 'interact'
  | 'sleep'
  | 'hidden'
  | 'celebrate'
  | 'defeat';

export type Expression =
  | 'neutral'
  | 'happy'
  | 'smug'
  | 'scared'
  | 'angry'
  | 'determined'
  | 'surprised'
  | 'laughing'
  | 'dizzy'
  | 'sleepy'
  | 'sad';

export type StunKind = 'slip' | 'trap' | 'pummel' | 'dizzy';

export interface ControlIntent {
  /** World-space desired move direction, length 0..1. */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  sneak: boolean;
  jump: boolean;
  interact: boolean;
  /** Primary ability (pounce for hunters, taunt for prey). */
  ability: boolean;
  /** Place the character's trap item. */
  trap: boolean;
}

export const emptyIntent = (): ControlIntent => ({
  moveX: 0,
  moveZ: 0,
  sprint: false,
  sneak: false,
  jump: false,
  interact: false,
  ability: false,
  trap: false,
});

export interface AgentStatus {
  stunnedUntil: number;
  stunKind: StunKind | null;
  hiddenIn: string | null;
  invulnerableUntil: number;
  respawnAt: number | null;
  /** Locked into an action (pounce, grab windup) until this time. */
  actionUntil: number;
  action: 'pounce' | 'grab' | 'taunt' | 'interact' | null;
}

export type Role = 'player' | 'npc';

export interface SpawnPoint {
  position: Vec3Tuple;
  /** Facing in radians around Y; 0 = +Z. */
  facing?: number;
}
