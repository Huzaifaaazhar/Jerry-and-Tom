/**
 * Reusable character definition. One definition = one recurring cast member, reusable by every
 * episode. Appearance comes from either a GLB model (preferred, when an artist asset exists) or the
 * built-in procedural cartoon rig described by `look`.
 */
import type { AnimState, Archetype } from '../core/types';
import type { SoundId } from '../audio/audio';

export type EarType = 'pointed' | 'round' | 'floppy';
export type TailType = 'long' | 'thin' | 'stub';

export interface ProceduralLook {
  /** World height of the top of the head (ears excluded). */
  height: number;
  fur: string;
  furDark: string;
  belly: string;
  muzzle: string;
  nose: string;
  innerEar: string;
  iris: string;
  /** Darker stripe overlay on fur (tabby). */
  stripes?: boolean;
  /** Proportions are fractions of a unit-height character. */
  legLength: number;
  torso: { w: number; h: number; d: number; belly: number };
  head: { r: number; squash: number; muzzle: number; jowls?: boolean; cheekFluff?: boolean; brow?: boolean; tuft?: boolean };
  eyes: { w: number; h: number; spacing: number; y: number; pupil: number; irisRing?: boolean };
  ears: { type: EarType; size: number };
  arms: { length: number; thickness: number; hand: number };
  legs: { thickness: number; foot: number };
  tail: { type: TailType; length: number; thickness: number };
  teeth?: 'buck' | 'fangs' | 'underbite';
  whiskers?: boolean;
  accessory?: { type: 'scarf' | 'collar' | 'bowtie'; color: string; tag?: string };
  /** Thickness multiplier for ink outlines. */
  outline?: number;
}

export interface GltfModelSpec {
  /** Path under /public, e.g. "/models/characters/cat.glb". */
  url: string;
  scale?: number;
  yOffset?: number;
  /** Map engine animation states to clip names in the GLB. Missing states fall back to idle/walk. */
  clips: Partial<Record<AnimState, string>>;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  species: string;
  archetype: Archetype;
  tagline: string;
  description: string;
  body: { radius: number; halfHeight: number; mass: number };
  movement: {
    walk: number;
    run: number;
    sneak: number;
    accel: number;
    jump: number;
    airControl: number;
    staminaDrain: number;
    staminaRegen: number;
  };
  /** Ability on F, trap item on Q. */
  ability: 'pounce' | 'taunt' | null;
  trap: { kind: string; charges: number } | null;
  perception: { viewDistance: number; fov: number; hearing: number };
  voice: { sound: SoundId; pitch: number };
  camera: { distance: number; height: number };
  look: ProceduralLook;
  model?: GltfModelSpec;
  ui: { color: string; accent: string };
}
