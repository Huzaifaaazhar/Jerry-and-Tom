/**
 * Static geometry batching: walls, opening trims, window panes and every wallpaper/wainscot panel
 * are baked into world-space geometry and merged per material. Hundreds of meshes become a dozen
 * draw calls without changing how environments are authored.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnvironmentDefinition, OpeningSpec, WallSpec } from './types';
import { DEFAULT_WALL_THICKNESS, roomFaces, splitWall, wallBoxes, wallDir } from './geometry';
import { toon, wallpaperTexture } from '../style/materials';
import { palette } from '../style/palette';

const INTERIOR_WALL = '#e8dcc0';
const EXTERIOR_WALL = '#f2e3c2';
const TRIM = palette.woodDark;

export interface Batch {
  key: string;
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
}

class Collector {
  private groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; castShadow: boolean }>();
  add(key: string, material: THREE.Material, geo: THREE.BufferGeometry, m: THREE.Matrix4, castShadow = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    let entry = this.groups.get(key);
    if (!entry) this.groups.set(key, (entry = { material, geos: [], castShadow }));
    entry.geos.push(g);
  }
  build(): Batch[] {
    const out: Batch[] = [];
    for (const [key, e] of this.groups) {
      const merged = mergeGeometries(e.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      out.push({ key, material: e.material, geometry: merged, castShadow: e.castShadow });
      e.geos.forEach((g) => g.dispose());
    }
    return out;
  }
}

const tmpQ = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const mat = (x: number, y: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ.setFromAxisAngle(Y, yaw).clone(), new THREE.Vector3(1, 1, 1));

function mouseHoleArch(w: number, h: number, depth: number) {
  const s = new THREE.Shape();
  const ow = w / 2 + 0.12;
  s.moveTo(-ow, 0);
  s.lineTo(ow, 0);
  s.lineTo(ow, h + 0.1);
  s.lineTo(-ow, h + 0.1);
  s.closePath();
  const r = w / 2;
  const hole = new THREE.Path();
  hole.moveTo(-r, 0);
  hole.lineTo(r, 0);
  hole.lineTo(r, h - r);
  hole.absarc(0, h - r, r, 0, Math.PI, false);
  hole.lineTo(-r, 0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function addTrim(c: Collector, wall: WallSpec, o: OpeningSpec, height: number) {
  const [dx, dz] = wallDir(wall);
  const t = wall.thickness ?? DEFAULT_WALL_THICKNESS;
  const yaw = Math.atan2(-dz, dx);
  const cx = wall.from[0] + dx * o.at;
  const cz = wall.from[1] + dz * o.at;
  const trim = toon(TRIM);
  const base = mat(cx, 0, cz, yaw);
  if (o.kind === 'mousehole') {
    c.add('trim', trim, mouseHoleArch(o.width, o.height, t + 0.08), base);
    return;
  }
  const bottom = o.kind === 'window' ? (o.sill ?? 1) : 0;
  const top = Math.min(bottom + o.height, height);
  const fw = 0.14;
  const depth = t + 0.08;
  const piece = (w: number, h: number, d: number, x: number, y: number, key = 'trim', m: THREE.Material = trim) =>
    c.add(key, m, new THREE.BoxGeometry(w, h, d), base.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, 0)));
  piece(o.width + fw * 2, fw, depth, 0, top + fw / 2);
  piece(fw, top - bottom, depth, -o.width / 2 - fw / 2, (bottom + top) / 2);
  piece(fw, top - bottom, depth, o.width / 2 + fw / 2, (bottom + top) / 2);
  if (o.kind === 'window') {
    piece(o.width + fw * 3, 0.1, depth + 0.16, 0, bottom - 0.05);
    const cream = toon(palette.cream);
    piece(0.06, top - bottom, 0.06, 0, (bottom + top) / 2, 'cream', cream);
    piece(o.width, 0.06, 0.06, 0, (bottom + top) / 2, 'cream', cream);
  }
}

const paperMats = new Map<string, THREE.Material>();
function paperMaterial(wp: NonNullable<EnvironmentDefinition['rooms'][number]['wallpaper']>) {
  const key = `${wp.base}${wp.accent}${wp.pattern}`;
  let m = paperMats.get(key);
  if (!m) {
    m = toon('#ffffff', { map: wallpaperTexture(wp), key: `paper-${key}` });
    paperMats.set(key, m);
  }
  return m;
}

function panel(w: number, y0: number, y1: number) {
  const g = new THREE.PlaneGeometry(w, y1 - y0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 1.4, (uv.getY(i) * (y1 - y0) + y0) / 1.4);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

export function buildStaticBatches(env: EnvironmentDefinition): Batch[] {
  const c = new Collector();
  const glass = toon('#bfe6f2', { opacity: 0.28 });
  for (const wall of env.walls) {
    if (wall.kind === 'fence') continue;
    const h = wall.height ?? env.wallHeight;
    const pieces = splitWall(Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]), h, wall.openings);
    const boxes = wallBoxes(wall, env.wallHeight);
    const wallMat = toon(wall.kind === 'exterior' ? EXTERIOR_WALL : INTERIOR_WALL);
    boxes.forEach((b, i) => {
      const m = mat(b.center[0], b.center[1], b.center[2], b.rotation ?? 0);
      if (pieces[i].glass) c.add('glass', glass, new THREE.BoxGeometry(b.size[0], b.size[1], 0.04), m, false);
      else c.add(`wall-${wall.kind}`, wallMat, new THREE.BoxGeometry(...b.size), m);
    });
    for (const o of wall.openings ?? []) addTrim(c, wall, o, h);
  }
  // Room-facing wallpaper, wainscot, chair rail and baseboard.
  const rooms = new Map(env.rooms.map((r) => [r.id, r]));
  const trim = toon(TRIM);
  for (const f of roomFaces(env.rooms, env.walls)) {
    const room = rooms.get(f.roomId)!;
    const wp = room.wallpaper;
    if (!wp) continue;
    const len = Math.hypot(f.wall.to[0] - f.wall.from[0], f.wall.to[1] - f.wall.from[1]);
    const [dx, dz] = wallDir(f.wall);
    const t = f.wall.thickness ?? DEFAULT_WALL_THICKNESS;
    const nx = dz * f.side;
    const nz = -dx * f.side;
    const yaw = Math.atan2(nx, nz);
    for (const p of splitWall(len, f.wall.height ?? env.wallHeight, f.wall.openings)) {
      if (p.glass) continue;
      const u0 = Math.max(p.u0, f.u0);
      const u1 = Math.min(p.u1, f.u1);
      if (u1 - u0 < 0.02) continue;
      const mid = (u0 + u1) / 2;
      const w = u1 - u0;
      const base = mat(f.wall.from[0] + dx * mid + nx * (t / 2 + 0.006), 0, f.wall.from[1] + dz * mid + nz * (t / 2 + 0.006), yaw);
      const split = wp.wainscot ? 1.05 : 0;
      const paperBottom = Math.max(p.y0, split);
      if (p.y1 > paperBottom + 0.01) c.add(`paper-${wp.base}${wp.accent}${wp.pattern}`, paperMaterial(wp), panel(w, paperBottom, p.y1), base, false);
      if (wp.wainscot && p.y0 < split) {
        const top = Math.min(split, p.y1);
        c.add(`wainscot-${wp.wainscot}`, toon(wp.wainscot), panel(w, p.y0, top), base, false);
        if (top >= split - 0.001) c.add('trim', trim, new THREE.BoxGeometry(w, 0.08, 0.05), base.clone().multiply(new THREE.Matrix4().makeTranslation(0, split, 0.02)));
      }
      if (p.y0 < 0.01) c.add('trim', trim, new THREE.BoxGeometry(w, 0.18, 0.05), base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.09, 0.025)), false);
    }
  }
  return c.build();
}
