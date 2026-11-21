/**
 * Grid navigation. Obstacles are rasterised from the same BoxSpec list the physics uses, inflated
 * by the agent radius and filtered by agent height - so a mouse plans through mouse holes and under
 * tables while a cat or dog plans around them. A* with octile heuristic + string-pulling.
 */
import type { BoxSpec, Bounds, XZ } from '../environment/types';

export interface NavProfile {
  id: string;
  radius: number;
  height: number;
}

class MinHeap {
  private items: number[] = [];
  private scores: Float32Array;
  constructor(scores: Float32Array) {
    this.scores = scores;
  }
  get size() {
    return this.items.length;
  }
  push(i: number) {
    const a = this.items;
    a.push(i);
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (this.scores[a[p]] <= this.scores[a[n]]) break;
      [a[p], a[n]] = [a[n], a[p]];
      n = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1;
        const r = l + 1;
        let m = n;
        if (l < a.length && this.scores[a[l]] < this.scores[a[m]]) m = l;
        if (r < a.length && this.scores[a[r]] < this.scores[a[m]]) m = r;
        if (m === n) break;
        [a[m], a[n]] = [a[n], a[m]];
        n = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  readonly w: number;
  readonly h: number;
  readonly blocked: Uint8Array;
  private g: Float32Array;
  private f: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private gen = 1;

  constructor(
    readonly bounds: Bounds,
    readonly cell: number,
    readonly profile: NavProfile,
    boxes: BoxSpec[],
  ) {
    this.w = Math.ceil((bounds[2] - bounds[0]) / cell);
    this.h = Math.ceil((bounds[3] - bounds[1]) / cell);
    const n = this.w * this.h;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    for (const b of boxes) this.rasterise(b);
    // Seal the outer border.
    for (let i = 0; i < this.w; i++) {
      this.blocked[i] = 1;
      this.blocked[(this.h - 1) * this.w + i] = 1;
    }
    for (let j = 0; j < this.h; j++) {
      this.blocked[j * this.w] = 1;
      this.blocked[j * this.w + this.w - 1] = 1;
    }
  }

  private rasterise(b: BoxSpec) {
    const bottom = b.center[1] - b.size[1] / 2;
    const top = b.center[1] + b.size[1] / 2;
    if (bottom >= this.profile.height || top <= 0.12) return;
    const r = this.profile.radius;
    const hx = b.size[0] / 2 + r;
    const hz = b.size[2] / 2 + r;
    const yaw = b.rotation ?? 0;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const ext = Math.abs(hx * c) + Math.abs(hz * s);
    const extZ = Math.abs(hx * s) + Math.abs(hz * c);
    const [i0, j0] = this.toCell(b.center[0] - ext, b.center[2] - extZ);
    const [i1, j1] = this.toCell(b.center[0] + ext, b.center[2] + extZ);
    for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) {
        const [px, pz] = this.toWorld(i, j);
        const dx = px - b.center[0];
        const dz = pz - b.center[2];
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) this.blocked[j * this.w + i] = 1;
      }
    }
  }

  toCell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.bounds[0]) / this.cell), Math.floor((z - this.bounds[1]) / this.cell)];
  }

  toWorld(i: number, j: number): XZ {
    return [this.bounds[0] + (i + 0.5) * this.cell, this.bounds[1] + (j + 0.5) * this.cell];
  }

  inside(i: number, j: number) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  isFreeCell(i: number, j: number) {
    return this.inside(i, j) && this.blocked[j * this.w + i] === 0;
  }

  isFree(x: number, z: number) {
    const [i, j] = this.toCell(x, z);
    return this.isFreeCell(i, j);
  }

  /** Spiral search for the closest walkable cell centre. */
  nearestFree(x: number, z: number, maxRadius = 4): XZ | null {
    const [ci, cj] = this.toCell(x, z);
    if (this.isFreeCell(ci, cj)) return this.toWorld(ci, cj);
    const maxR = Math.ceil(maxRadius / this.cell);
    let best: XZ | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!this.isFreeCell(ci + di, cj + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bestD) {
            bestD = d;
            best = this.toWorld(ci + di, cj + dj);
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** True if a straight walk between two points crosses only free cells. */
  lineOfSight(a: XZ, b: XZ): boolean {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps;
      if (!this.isFree(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return true;
  }

  findPath(from: XZ, to: XZ, maxIterations = 60000): XZ[] | null {
    const start = this.nearestFree(from[0], from[1], 2);
    const goal = this.nearestFree(to[0], to[1], 3);
    if (!start || !goal) return null;
    const [si, sj] = this.toCell(start[0], start[1]);
    const [gi, gj] = this.toCell(goal[0], goal[1]);
    const W = this.w;
    const sIdx = sj * W + si;
    const gIdx = gj * W + gi;
    const gen = ++this.gen;
    const heur = (i: number, j: number) => {
      const dx = Math.abs(i - gi);
      const dy = Math.abs(j - gj);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const heap = new MinHeap(this.f);
    this.g[sIdx] = 0;
    this.f[sIdx] = heur(si, sj);
    this.parent[sIdx] = -1;
    this.stamp[sIdx] = gen;
    heap.push(sIdx);
    let iter = 0;
    let found = false;
    while (heap.size && iter++ < maxIterations) {
      const cur = heap.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === gIdx) {
        found = true;
        break;
      }
      const ci = cur % W;
      const cj = (cur - ci) / W;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (!this.isFreeCell(ni, nj)) continue;
          if (di && dj && (!this.isFreeCell(ci + di, cj) || !this.isFreeCell(ci, cj + dj))) continue;
          const n = nj * W + ni;
          if (this.closed[n] === gen) continue;
          const ng = this.g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (this.stamp[n] !== gen || ng < this.g[n]) {
            this.stamp[n] = gen;
            this.g[n] = ng;
            this.f[n] = ng + heur(ni, nj);
            this.parent[n] = cur;
            heap.push(n);
          }
        }
      }
    }
    if (!found) return null;
    const cells: XZ[] = [];
    for (let c = gIdx; c !== -1; c = this.parent[c]) {
      const i = c % W;
      cells.push(this.toWorld(i, (c - i) / W));
    }
    cells.reverse();
    cells[0] = this.isFree(from[0], from[1]) ? [from[0], from[1]] : cells[0];
    return this.smooth(cells);
  }

  private smooth(path: XZ[]): XZ[] {
    if (path.length <= 2) return path;
    const out: XZ[] = [path[0]];
    let anchor = 0;
    for (let k = 2; k < path.length; k++) {
      if (!this.lineOfSight(path[anchor], path[k])) {
        out.push(path[k - 1]);
        anchor = k - 1;
      }
    }
    out.push(path[path.length - 1]);
    return out;
  }

  /** Total walkable cells - used by tests and debug overlay. */
  freeCount() {
    let n = 0;
    for (let k = 0; k < this.blocked.length; k++) if (!this.blocked[k]) n++;
    return n;
  }
}

export function pathLength(p: XZ[]) {
  let d = 0;
  for (let k = 1; k < p.length; k++) d += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]);
  return d;
}
