/**
 * Pure geometry for walls and rooms. Shared by the 3D builder (render + physics) and by the
 * navigation grid so what you see, what you collide with and what AI plans around always agree.
 */
import type { BoxSpec, OpeningSpec, RoomSpec, WallSpec, XZ } from './types';

export const DEFAULT_WALL_THICKNESS = 0.3;

export interface WallPiece {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  /** True for the transparent pane filling a window. */
  glass?: boolean;
}

export function wallLength(w: WallSpec) {
  return Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
}

export function wallDir(w: WallSpec): XZ {
  const len = wallLength(w) || 1;
  return [(w.to[0] - w.from[0]) / len, (w.to[1] - w.from[1]) / len];
}

/** Split a wall into solid pieces around its openings. */
export function splitWall(length: number, height: number, openings: OpeningSpec[] = []): WallPiece[] {
  const pieces: WallPiece[] = [];
  const sorted = [...openings].sort((a, b) => a.at - b.at);
  let cursor = 0;
  for (const o of sorted) {
    const a = Math.max(cursor, o.at - o.width / 2);
    const b = Math.min(length, o.at + o.width / 2);
    if (a > cursor + 1e-4) pieces.push({ u0: cursor, u1: a, y0: 0, y1: height });
    const bottom = o.kind === 'window' ? (o.sill ?? 1) : 0;
    const top = bottom + o.height;
    if (o.kind === 'window') {
      if (bottom > 1e-4) pieces.push({ u0: a, u1: b, y0: 0, y1: bottom });
      pieces.push({ u0: a, u1: b, y0: bottom, y1: Math.min(top, height), glass: true });
    }
    if (top < height - 1e-4) pieces.push({ u0: a, u1: b, y0: top, y1: height });
    cursor = Math.max(cursor, b);
  }
  if (cursor < length - 1e-4) pieces.push({ u0: cursor, u1: length, y0: 0, y1: height });
  return pieces;
}

/** World-space boxes for a wall (glass panes included: they still block movement). */
export function wallBoxes(w: WallSpec, defaultHeight: number): BoxSpec[] {
  const len = wallLength(w);
  const [dx, dz] = wallDir(w);
  const t = w.thickness ?? DEFAULT_WALL_THICKNESS;
  const h = w.height ?? defaultHeight;
  const yaw = Math.atan2(dx, dz) - Math.PI / 2; // box local X runs along the wall
  return splitWall(len, h, w.openings).map((p) => {
    const mid = (p.u0 + p.u1) / 2;
    return {
      center: [w.from[0] + dx * mid, (p.y0 + p.y1) / 2, w.from[1] + dz * mid],
      size: [p.u1 - p.u0, p.y1 - p.y0, t],
      rotation: yaw,
    } satisfies BoxSpec;
  });
}

export interface RoomFace {
  roomId: string;
  wall: WallSpec;
  /** Interval along the wall that borders the room. */
  u0: number;
  u1: number;
  /** +1 if the room lies on the left normal of the wall direction, -1 if on the right. */
  side: 1 | -1;
}

/** Find the wall stretches that face into each room (used for wallpaper panels). */
export function roomFaces(rooms: RoomSpec[], walls: WallSpec[]): RoomFace[] {
  const faces: RoomFace[] = [];
  const eps = 0.05;
  for (const room of rooms) {
    if (room.outdoor) continue;
    const [x0, z0, x1, z1] = room.bounds;
    for (const wall of walls) {
      if (wall.kind === 'fence' || wall.kind === 'hedge') continue;
      const [ax, az] = wall.from;
      const [bx, bz] = wall.to;
      const horizontal = Math.abs(az - bz) < eps;
      const vertical = Math.abs(ax - bx) < eps;
      if (horizontal && (Math.abs(az - z0) < eps || Math.abs(az - z1) < eps)) {
        const lo = Math.max(Math.min(ax, bx), x0);
        const hi = Math.min(Math.max(ax, bx), x1);
        if (hi - lo < eps) continue;
        const dir = bx > ax ? 1 : -1;
        const u0 = dir > 0 ? lo - ax : ax - hi;
        const u1 = dir > 0 ? hi - ax : ax - lo;
        // Left normal of direction (dx,0,dz) is (dz,0,-dx) -> for +x wall it points -z.
        const roomIsNegZ = Math.abs(az - z1) < eps; // wall on room's far edge: room on -z side
        const leftIsNegZ = dir > 0;
        faces.push({ roomId: room.id, wall, u0, u1, side: roomIsNegZ === leftIsNegZ ? 1 : -1 });
      } else if (vertical && (Math.abs(ax - x0) < eps || Math.abs(ax - x1) < eps)) {
        const lo = Math.max(Math.min(az, bz), z0);
        const hi = Math.min(Math.max(az, bz), z1);
        if (hi - lo < eps) continue;
        const dir = bz > az ? 1 : -1;
        const u0 = dir > 0 ? lo - az : az - hi;
        const u1 = dir > 0 ? hi - az : az - lo;
        // For a +z wall, left normal (dz,0,-dx) = (+1,0,0) points +x.
        const roomIsPosX = Math.abs(ax - x0) < eps;
        const leftIsPosX = dir > 0;
        faces.push({ roomId: room.id, wall, u0, u1, side: roomIsPosX === leftIsPosX ? 1 : -1 });
      }
    }
  }
  return faces;
}

export function roomAt(rooms: RoomSpec[], x: number, z: number): RoomSpec | undefined {
  // Prefer the smallest containing room so nested areas (garden inside yard) win.
  let best: RoomSpec | undefined;
  let bestArea = Infinity;
  for (const r of rooms) {
    const [x0, z0, x1, z1] = r.bounds;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
      const area = (x1 - x0) * (z1 - z0);
      if (area < bestArea) {
        best = r;
        bestArea = area;
      }
    }
  }
  return best;
}

/** Rotate a local box by a placement transform into world space. */
export function transformBox(b: BoxSpec, pos: [number, number, number], yaw = 0, scale = 1): BoxSpec {
  const [lx, ly, lz] = b.center;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    center: [pos[0] + (lx * c + lz * s) * scale, pos[1] + ly * scale, pos[2] + (-lx * s + lz * c) * scale],
    size: [b.size[0] * scale, b.size[1] * scale, b.size[2] * scale],
    rotation: (b.rotation ?? 0) + yaw,
  };
}
