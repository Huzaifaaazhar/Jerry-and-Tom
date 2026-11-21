/**
 * Breakable obstacle (e.g. a barricade of crates). Hunters smash it with repeated E presses; it
 * wobbles on each hit, then collapses into loose debris that tumbles across the floor.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { BreakableDef, PropTypeDef } from './propRegistry';
import type { PropPlacement } from './types';
import { groups } from '../core/physics';
import { interactions } from '../interaction/registry';
import { world } from '../core/world';
import { audio } from '../audio/audio';
import { toon } from '../style/materials';
import { transformBox } from './geometry';

export function Breakable({ id, placement, def, type }: { id: string; placement: PropPlacement; def: BreakableDef; type: PropTypeDef }) {
  const [broken, setBroken] = useState(false);
  const hits = useRef(0);
  const wobble = useRef(0);
  const g = useRef<THREE.Group>(null);
  const center = useMemo(() => new THREE.Vector3(placement.position[0], 1, placement.position[2]), [placement]);
  const boxes = useMemo(() => type.colliders(placement).map((b) => transformBox(b, placement.position, placement.rotation ?? 0, placement.scale ?? 1)), [type, placement]);

  useEffect(() => {
    if (broken) return;
    return interactions.register({
      id: `break-${id}`,
      kind: 'knock',
      position: center,
      radius: 2.2,
      priority: 0.3,
      prompt: (a) => (def.archetypes.includes(a.archetype) ? `${def.label} (${def.hits - hits.current} left)` : null),
      interact: (a) => {
        hits.current++;
        wobble.current = 1;
        world.playOneShot(a, 'grab', 0.35);
        audio.play('land', { gain: 0.8, pitch: 0.7 });
        world.emitNoise(center, 9, 'knock', a.id);
        if (hits.current >= def.hits) {
          audio.play('crash');
          world.emitNoise(center, 16, 'crash', a.id);
          world.events.emit({ type: 'broken', agentId: a.id, objectId: id, position: [center.x, center.y, center.z] });
          setBroken(true);
        }
      },
    });
  }, [id, def, center, broken]);

  useFrame((_, dt) => {
    wobble.current = Math.max(0, wobble.current - dt * 3);
    if (g.current) g.current.rotation.z = Math.sin(world.time * 40) * wobble.current * 0.06;
  });

  const { Render } = type;
  if (broken) {
    return (
      <>
        {def.debris.map((d, i) => {
          const v = new THREE.Vector3(...d).applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation ?? 0).add(new THREE.Vector3(...placement.position));
          return (
            <RigidBody key={i} type="dynamic" position={[v.x, v.y + 0.2, v.z]} rotation={[0.3 * i, i, 0.2]} colliders={false} mass={1.5} linearDamping={1.2} angularDamping={1.5} linearVelocity={[(i - 1) * 2.5, 3, 2]} collisionGroups={groups.prop}>
              <CuboidCollider args={[0.4, 0.4, 0.4]} collisionGroups={groups.prop} friction={0.7} />
              <mesh material={toon('#d89b5f')} castShadow>
                <boxGeometry args={[0.8, 0.8, 0.8]} />
              </mesh>
              <mesh material={toon('#b5733f')} position={[0, 0, 0.405]}>
                <boxGeometry args={[0.7, 0.14, 0.01]} />
              </mesh>
            </RigidBody>
          );
        })}
      </>
    );
  }
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {boxes.map((b, i) => (
          <CuboidCollider key={i} args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]} position={b.center} rotation={[0, b.rotation ?? 0, 0]} collisionGroups={groups.static} />
        ))}
      </RigidBody>
      <group position={placement.position} rotation={[0, placement.rotation ?? 0, 0]}>
        <group ref={g}>
          <Render placement={placement} />
        </group>
      </group>
    </>
  );
}
