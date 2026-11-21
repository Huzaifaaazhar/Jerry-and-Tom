/**
 * Builds a playable 3D environment from an EnvironmentDefinition: floors, walls with real openings,
 * wallpapered room faces, doors with pet flaps, windows, mouse-hole arches, and every prop with its
 * physics. One fixed rigid body holds all static colliders.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { BoxSpec, EnvironmentDefinition, LightingPreset, OpeningSpec, PropPlacement, WallSpec } from './types';
import { splitWall, wallBoxes, wallDir, roomFaces } from './geometry';
import { getPropType } from './propRegistry';
import { placementBoxes } from './collect';
import { toon, floorTexture, wallpaperTexture } from '../style/materials';
import { palette } from '../style/palette';
import { groups } from '../core/physics';
import { Door } from './Door';
import { Breakable } from './Breakable';
import { Knockable } from './Knockable';
import { HideSpotRegistrar } from './HideSpotRegistrar';
import { Lighting, LampProvider } from './lighting';
import { DEFAULT_WALL_THICKNESS } from './geometry';

const INTERIOR_WALL = '#e8dcc0';
const EXTERIOR_WALL = '#f2e3c2';
const TRIM = palette.woodDark;

function StaticColliders({ boxes }: { boxes: BoxSpec[] }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[80, 0.5, 80]} position={[0, -0.5, 9]} collisionGroups={groups.static} friction={0.8} />
      {boxes.map((b, i) => (
        <CuboidCollider
          key={i}
          args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}
          position={b.center}
          rotation={[0, b.rotation ?? 0, 0]}
          collisionGroups={groups.static}
          friction={0}
        />
      ))}
    </RigidBody>
  );
}

function WallMeshes({ wall, height }: { wall: WallSpec; height: number }) {
  const boxes = useMemo(() => wallBoxes(wall, height), [wall, height]);
  const pieces = useMemo(() => splitWall(Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]), wall.height ?? height, wall.openings), [wall, height]);
  if (wall.kind === 'fence') return <Fence wall={wall} />;
  const mat = toon(wall.kind === 'exterior' ? EXTERIOR_WALL : INTERIOR_WALL);
  return (
    <>
      {boxes.map((b, i) =>
        pieces[i].glass ? (
          <mesh key={i} position={b.center} rotation={[0, b.rotation ?? 0, 0]} material={toon('#bfe6f2', { opacity: 0.28 })}>
            <boxGeometry args={[b.size[0], b.size[1], 0.04]} />
          </mesh>
        ) : (
          <mesh key={i} position={b.center} rotation={[0, b.rotation ?? 0, 0]} material={mat} castShadow receiveShadow>
            <boxGeometry args={b.size} />
          </mesh>
        ),
      )}
      {(wall.openings ?? []).map((o, i) => (
        <OpeningTrim key={i} wall={wall} o={o} height={wall.height ?? height} />
      ))}
    </>
  );
}

/** Frames for windows/doors/arches and the arched trim around mouse holes. */
function OpeningTrim({ wall, o, height }: { wall: WallSpec; o: OpeningSpec; height: number }) {
  const [dx, dz] = wallDir(wall);
  const t = wall.thickness ?? DEFAULT_WALL_THICKNESS;
  const yaw = Math.atan2(-dz, dx);
  const cx = wall.from[0] + dx * o.at;
  const cz = wall.from[1] + dz * o.at;
  const archGeo = useMemo(() => (o.kind === 'mousehole' ? mouseHoleArch(o.width, o.height, t + 0.08) : null), [o.kind, o.width, o.height, t]);
  const trim = toon(TRIM);
  if (o.kind === 'mousehole' && archGeo) {
    return <mesh geometry={archGeo} position={[cx, 0, cz]} rotation={[0, yaw, 0]} material={trim} />;
  }
  const bottom = o.kind === 'window' ? (o.sill ?? 1) : 0;
  const top = Math.min(bottom + o.height, height);
  const fw = 0.14;
  const depth = t + 0.08;
  return (
    <group position={[cx, 0, cz]} rotation={[0, yaw, 0]}>
      <mesh position={[0, top + fw / 2, 0]} material={trim} castShadow>
        <boxGeometry args={[o.width + fw * 2, fw, depth]} />
      </mesh>
      <mesh position={[-o.width / 2 - fw / 2, (bottom + top) / 2, 0]} material={trim}>
        <boxGeometry args={[fw, top - bottom, depth]} />
      </mesh>
      <mesh position={[o.width / 2 + fw / 2, (bottom + top) / 2, 0]} material={trim}>
        <boxGeometry args={[fw, top - bottom, depth]} />
      </mesh>
      {o.kind === 'window' && (
        <>
          <mesh position={[0, bottom - 0.05, 0]} material={trim}>
            <boxGeometry args={[o.width + fw * 3, 0.1, depth + 0.16]} />
          </mesh>
          <mesh position={[0, (bottom + top) / 2, 0]} material={toon(palette.cream)}>
            <boxGeometry args={[0.06, top - bottom, 0.06]} />
          </mesh>
          <mesh position={[0, (bottom + top) / 2, 0]} material={toon(palette.cream)}>
            <boxGeometry args={[o.width, 0.06, 0.06]} />
          </mesh>
        </>
      )}
    </group>
  );
}

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

function Fence({ wall }: { wall: WallSpec }) {
  const [dx, dz] = wallDir(wall);
  const len = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]);
  const yaw = Math.atan2(-dz, dx);
  const n = Math.max(1, Math.floor(len / 0.42));
  const picket = useMemo(() => {
    const g = new THREE.BoxGeometry(0.28, 1.9, 0.08);
    return g;
  }, []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(picket, toon('#fbf4e2'), n);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      mtx.makeTranslation((i + 0.5) * (len / n), 0.95 + (i % 2) * 0.06, 0);
      m.setMatrixAt(i, mtx);
    }
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }, [picket, n, len]);
  return (
    <group position={[wall.from[0], 0, wall.from[1]]} rotation={[0, yaw, 0]}>
      <primitive object={mesh} />
      {[0.5, 1.5].map((y) => (
        <mesh key={y} position={[len / 2, y, -0.08]} material={toon('#e9dfc6')}>
          <boxGeometry args={[len, 0.12, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

/** Wallpaper, wainscot, chair rail and baseboard on each wall face inside each room. */
function RoomPanels({ env }: { env: EnvironmentDefinition }) {
  const panels = useMemo(() => {
    const out: { key: string; pos: THREE.Vector3; yaw: number; w: number; y0: number; y1: number; roomId: string }[] = [];
    const faces = roomFaces(env.rooms, env.walls);
    faces.forEach((f, fi) => {
      const len = Math.hypot(f.wall.to[0] - f.wall.from[0], f.wall.to[1] - f.wall.from[1]);
      const [dx, dz] = wallDir(f.wall);
      const t = f.wall.thickness ?? DEFAULT_WALL_THICKNESS;
      const nx = dz * f.side;
      const nz = -dx * f.side;
      const yaw = Math.atan2(nx, nz);
      splitWall(len, f.wall.height ?? env.wallHeight, f.wall.openings).forEach((p, pi) => {
        if (p.glass) return;
        const u0 = Math.max(p.u0, f.u0);
        const u1 = Math.min(p.u1, f.u1);
        if (u1 - u0 < 0.02) return;
        const mid = (u0 + u1) / 2;
        out.push({
          key: `${fi}-${pi}`,
          pos: new THREE.Vector3(f.wall.from[0] + dx * mid + nx * (t / 2 + 0.006), 0, f.wall.from[1] + dz * mid + nz * (t / 2 + 0.006)),
          yaw,
          w: u1 - u0,
          y0: p.y0,
          y1: p.y1,
          roomId: f.roomId,
        });
      });
    });
    return out;
  }, [env]);
  const rooms = useMemo(() => new Map(env.rooms.map((r) => [r.id, r])), [env]);
  return (
    <>
      {panels.map((p) => {
        const room = rooms.get(p.roomId)!;
        const wp = room.wallpaper;
        if (!wp) return null;
        const split = wp.wainscot ? 1.05 : 0;
        const parts: JSX.Element[] = [];
        const paperBottom = Math.max(p.y0, split);
        if (p.y1 > paperBottom + 0.01) parts.push(<Panel key="p" w={p.w} y0={paperBottom} y1={p.y1} material={paperMaterial(wp)} />);
        if (wp.wainscot && p.y0 < split) {
          const top = Math.min(split, p.y1);
          parts.push(<Panel key="w" w={p.w} y0={p.y0} y1={top} material={toon(wp.wainscot)} />);
          if (top >= split - 0.001)
            parts.push(
              <mesh key="r" position={[0, split, 0.02]} material={toon(TRIM)}>
                <boxGeometry args={[p.w, 0.08, 0.05]} />
              </mesh>,
            );
        }
        if (p.y0 < 0.01)
          parts.push(
            <mesh key="b" position={[0, 0.09, 0.025]} material={toon(TRIM)}>
              <boxGeometry args={[p.w, 0.18, 0.05]} />
            </mesh>,
          );
        return (
          <group key={p.key} position={p.pos} rotation={[0, p.yaw, 0]}>
            {parts}
          </group>
        );
      })}
    </>
  );
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

function Panel({ w, y0, y1, material }: { w: number; y0: number; y1: number; material: THREE.Material }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, y1 - y0);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 1.4, (uv.getY(i) * (y1 - y0) + y0) / 1.4);
    return g;
  }, [w, y0, y1]);
  return <mesh geometry={geo} position={[0, (y0 + y1) / 2, 0]} material={material} receiveShadow />;
}

function Floors({ env }: { env: EnvironmentDefinition }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 9]} material={toon(palette.grass, { map: floorTexture('grass', palette.grass), key: 'ground' })} receiveShadow>
        <planeGeometry args={[160, 160]} />
      </mesh>
      {env.rooms.map((r, i) => {
        const [x0, z0, x1, z1] = r.bounds;
        const w = x1 - x0;
        const d = z1 - z0;
        const color = r.floorColor ?? '#b5733f';
        return <FloorPlane key={r.id} w={w} d={d} x={(x0 + x1) / 2} z={(z0 + z1) / 2} y={r.outdoor ? 0.001 + i * 0.0015 : 0.004} color={color} style={r.floor} />;
      })}
    </>
  );
}

function FloorPlane({ w, d, x, z, y, color, style }: { w: number; d: number; x: number; z: number; y: number; color: string; style: EnvironmentDefinition['rooms'][number]['floor'] }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const tile = style === 'checker' ? 3 : style === 'grass' ? 6 : 4;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
    return g;
  }, [w, d, style]);
  return <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} material={toon('#ffffff', { map: floorTexture(style, color), key: `floor-${style}-${color}` })} receiveShadow />;
}

function PropInstance({ p }: { p: PropPlacement }) {
  const def = getPropType(p.type);
  if (!def) {
    console.warn(`Unknown prop type "${p.type}"`);
    return null;
  }
  const { Render } = def;
  if (def.pushable) {
    const local = def.colliders(p);
    return (
      <RigidBody type="dynamic" position={p.position} rotation={[0, p.rotation ?? 0, 0]} colliders={false} mass={def.pushable.mass} linearDamping={2.5} angularDamping={3} collisionGroups={groups.prop}>
        {local.map((b, i) => (
          <CuboidCollider key={i} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]} position={b.center} collisionGroups={groups.prop} friction={0.6} />
        ))}
        <Render placement={p} />
      </RigidBody>
    );
  }
  return (
    <group position={p.position} rotation={[0, p.rotation ?? 0, 0]} scale={p.scale ?? 1}>
      <Render placement={p} />
    </group>
  );
}

export function EnvironmentView({ env, lighting, extraProps = [] }: { env: EnvironmentDefinition; lighting: LightingPreset; extraProps?: PropPlacement[] }) {
  const props = useMemo(() => [...env.props, ...extraProps], [env, extraProps]);
  const staticBoxes = useMemo(() => {
    const boxes: BoxSpec[] = [];
    for (const w of env.walls) boxes.push(...wallBoxes(w, env.wallHeight));
    for (const p of props) {
      const t = getPropType(p.type);
      if (!t?.pushable && !t?.breakable) boxes.push(...placementBoxes(p));
    }
    return boxes;
  }, [env, props]);
  const doors = useMemo(
    () => env.walls.flatMap((w, wi) => (w.openings ?? []).filter((o) => o.kind === 'door').map((o, oi) => ({ wall: w, o, key: o.id ?? `door-${wi}-${oi}` }))),
    [env],
  );
  return (
    <LampProvider value={lighting.lamps}>
      <Lighting preset={lighting} bounds={env.bounds} />
      <Floors env={env} />
      <StaticColliders boxes={staticBoxes} />
      {env.walls.map((w, i) => (
        <WallMeshes key={i} wall={w} height={env.wallHeight} />
      ))}
      <RoomPanels env={env} />
      {doors.map((d) => (
        <Door key={d.key} id={d.key} wall={d.wall} opening={d.o} />
      ))}
      {props.map((p, i) => {
        const t = getPropType(p.type);
        const id = p.id ?? `${p.type}-${i}`;
        if (t?.breakable) return <Breakable key={id} id={id} placement={p} def={t.breakable} type={t} />;
        return <PropInstance key={id} p={p} />;
      })}
      {props.map((p, i) => {
        const def = getPropType(p.type);
        const id = p.id ?? `${p.type}-${i}`;
        return (
          <group key={`aff-${id}`}>
            {def?.hideSpot && <HideSpotRegistrar id={`hide-${id}`} placement={p} def={def.hideSpot} />}
            {def?.knockable && <Knockable id={id} placement={p} def={def.knockable} />}
          </group>
        );
      })}
    </LampProvider>
  );
}
