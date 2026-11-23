/** Data contracts for modular, reusable environments. Episodes reference environments by id. */
import type { Vec3Tuple } from '../core/math';

export type XZ = [number, number];
export type Bounds = [x0: number, z0: number, x1: number, z1: number];

export type FloorStyle = 'wood' | 'checker' | 'carpet' | 'grass' | 'patio' | 'tile';

export interface WallpaperStyle {
  base: string;
  accent: string;
  pattern: 'stripes' | 'diamonds' | 'dots' | 'plain' | 'flowers';
  /** Lower panelling colour; omit for none. */
  wainscot?: string;
}

export interface RoomSpec {
  id: string;
  name: string;
  bounds: Bounds;
  floor: FloorStyle;
  floorColor?: string;
  wallpaper?: WallpaperStyle;
  outdoor?: boolean;
}

export type OpeningKind = 'door' | 'arch' | 'mousehole' | 'window';

export interface OpeningSpec {
  /** Centre of the opening measured along the wall from `from`. */
  at: number;
  width: number;
  height: number;
  kind: OpeningKind;
  /** Window sill height. */
  sill?: number;
  /** Doors: unique id so episodes can script them. */
  id?: string;
  startOpen?: boolean;
  /** Which side the door swings into: +1 = left normal of the wall direction. */
  swing?: 1 | -1;
}

export interface WallSpec {
  from: XZ;
  to: XZ;
  height?: number;
  thickness?: number;
  openings?: OpeningSpec[];
  kind?: 'interior' | 'exterior' | 'fence' | 'hedge';
}

export interface PropPlacement {
  id?: string;
  type: string;
  position: Vec3Tuple;
  /** Yaw in radians. */
  rotation?: number;
  scale?: number;
  /** Type-specific options (colours, variants). */
  options?: Record<string, unknown>;
}

export interface ZoneSpec {
  id: string;
  label: string;
  center: Vec3Tuple;
  radius: number;
  /** Render a visible marker (e.g. a mouse hole glow). */
  marker?: boolean;
}

export interface LightingPreset {
  sky: string;
  fog: string;
  ambient: number;
  hemi: [sky: string, ground: string, intensity: number];
  sun: { color: string; intensity: number; position: Vec3Tuple };
  /** Warm interior lamp glow multiplier (night scenes). */
  lamps: number;
  exposure: number;
}

export interface EnvironmentDefinition {
  id: string;
  name: string;
  /** World bounds used for the navigation grid. */
  bounds: Bounds;
  wallHeight: number;
  rooms: RoomSpec[];
  walls: WallSpec[];
  props: PropPlacement[];
  zones: ZoneSpec[];
  /** Points AI uses to patrol when it has nothing better to do. */
  patrolPoints: XZ[];
  lighting: Record<string, LightingPreset>;
}

/** Axis-aligned (in local space) box collider description used by both physics and navigation. */
export interface BoxSpec {
  center: Vec3Tuple;
  size: Vec3Tuple;
  /** Yaw of the box around its centre (world). */
  rotation?: number;
}
