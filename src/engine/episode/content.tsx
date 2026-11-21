/** In-world rendering for pickups, traps and zone markers (bobbing, spinning, sprung states). */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useItems, getItem, getTrap } from '../interaction/items';
import type { ZoneSpec } from '../environment/types';
import { toon } from '../style/materials';
import { palette } from '../style/palette';
import { world } from '../core/world';
import { useGame } from '../core/store';

function Pickup({ type, position }: { type: string; position: [number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  const seed = useRef(Math.random() * 10);
  useFrame(() => {
    if (!g.current) return;
    g.current.rotation.y = world.time * 1.6 + seed.current;
    g.current.position.y = position[1] + 0.25 + Math.sin(world.time * 3 + seed.current) * 0.07;
  });
  const def = getItem(type);
  if (!def) return null;
  const { Render } = def;
  return (
    <group ref={g} position={position}>
      <Render />
      <pointLight color={palette.mustard} intensity={0.6} distance={1.6} />
    </group>
  );
}

export function Pickups() {
  const pickups = useItems((s) => s.pickups);
  return (
    <>
      {pickups
        .filter((p) => !p.collected)
        .map((p) => (
          <Pickup key={p.id} type={p.type} position={p.position} />
        ))}
    </>
  );
}

export function Traps() {
  const traps = useItems((s) => s.traps);
  return (
    <>
      {traps.map((t) => {
        const def = getTrap(t.kind);
        if (!def) return null;
        const { Render } = def;
        return (
          <group key={t.id} position={t.position}>
            <Render sprung={t.sprung} />
          </group>
        );
      })}
    </>
  );
}

export function ZoneMarker({ zone, objectiveId, after }: { zone: ZoneSpec; objectiveId: string; after: string[] }) {
  const ring = useRef<THREE.Mesh>(null);
  const active = useGame((s) => {
    const obs = s.hud.objectives;
    const self = obs.find((o) => o.id === objectiveId);
    return !!self && !self.done && after.every((id) => obs.find((o) => o.id === id)?.done);
  });
  useFrame(() => {
    if (!ring.current) return;
    const s = 1 + Math.sin(world.time * 4) * 0.08;
    ring.current.scale.set(s, s, 1);
  });
  if (!active) return null;
  return (
    <mesh ref={ring} position={[zone.center[0], 0.03, zone.center[2]]} rotation={[-Math.PI / 2, 0, 0]} material={toon(palette.mustard, { emissive: palette.mustard, emissiveIntensity: 0.6, opacity: 0.85 })}>
      <ringGeometry args={[zone.radius * 0.7, zone.radius * 0.85, 40]} />
    </mesh>
  );
}
