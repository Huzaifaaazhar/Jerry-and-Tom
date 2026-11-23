/**
 * Builds a playable 3D environment from an EnvironmentDefinition: floors, walls with real openings,
 * wallpapered room faces, doors with pet flaps, windows, mouse-hole arches, and every prop with its
 * physics. One fixed rigid body holds all static colliders.
 */
import { useEffect, useMemo } from 'react';
import { buildStaticBatches } from './staticBatch';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { BoxSpec, EnvironmentDefinition, LightingPreset, PropPlacement, WallSpec } from './types';
import { wallBoxes, wallDir } from './geometry';
import { getPropType } from './propRegistry';
import { placementBoxes } from './collect';
import { toon, floorTexture } from '../style/materials';
import { palette } from '../style/palette';
import { groups } from '../core/physics';
import { Door } from './Door';
import { Breakable } from './Breakable';
import { MergedStatic } from './MergedStatic';
import { Knockable } from './Knockable';
import { HideSpotRegistrar } from './HideSpotRegistrar';
import { Lighting, LampProvider } from './lighting';


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

function StaticBatches({ env }: { env: EnvironmentDefinition }) {
  const batches = useMemo(() => buildStaticBatches(env), [env]);
  useEffect(() => () => batches.forEach((b) => b.geometry.dispose()), [batches]);
  return (
    <>
      {batches.map((b) => (
        <mesh key={b.key} geometry={b.geometry} material={b.material} castShadow={b.castShadow} receiveShadow />
      ))}
    </>
  );
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
      <StaticBatches env={env} />
      {env.walls
        .filter((w) => w.kind === 'fence')
        .map((w, i) => (
          <Fence key={i} wall={w} />
        ))}
      {doors.map((d) => (
        <Door key={d.key} id={d.key} wall={d.wall} opening={d.o} />
      ))}
      <MergedStatic>
        {props.map((p, i) => {
          const t = getPropType(p.type);
          const id = p.id ?? `${p.type}-${i}`;
          if (t?.breakable || t?.pushable) return null;
          return <PropInstance key={id} p={p} />;
        })}
      </MergedStatic>
      {props.map((p, i) => {
        const t = getPropType(p.type);
        const id = p.id ?? `${p.type}-${i}`;
        if (t?.breakable) return <Breakable key={id} id={id} placement={p} def={t.breakable} type={t} />;
        if (t?.pushable) return <PropInstance key={id} p={p} />;
        return null;
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
