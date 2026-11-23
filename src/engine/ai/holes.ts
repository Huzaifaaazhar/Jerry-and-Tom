/** Mouse-hole passages extracted from environment walls: shortcuts only prey can use. */
import type { EnvironmentDefinition, XZ } from '../environment/types';
import { wallDir } from '../environment/geometry';

export interface Passage {
  center: XZ;
  sides: [XZ, XZ];
}

const cache = new WeakMap<EnvironmentDefinition, Passage[]>();

export function holePassages(env: EnvironmentDefinition): Passage[] {
  let p = cache.get(env);
  if (p) return p;
  p = [];
  for (const w of env.walls) {
    const [dx, dz] = wallDir(w);
    for (const o of w.openings ?? []) {
      if (o.kind !== 'mousehole') continue;
      const cx = w.from[0] + dx * o.at;
      const cz = w.from[1] + dz * o.at;
      const nx = dz;
      const nz = -dx;
      const off = 1.1;
      p.push({ center: [cx, cz], sides: [[cx + nx * off, cz + nz * off], [cx - nx * off, cz - nz * off]] });
    }
  }
  cache.set(env, p);
  return p;
}

/** Shortest distance from point p to segment ab (2D). */
export function segmentDistance(p: XZ, a: XZ, b: XZ) {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const l2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / l2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}
