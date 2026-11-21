/**
 * A breakable object sitting on furniture. Knock it (E) or bump it and it topples, crashes and
 * makes a loud noise that AI investigates - the classic distraction gag.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import type { KnockableDef } from './propRegistry';
import type { PropPlacement } from './types';
import { groups } from '../core/physics';
import { interactions } from '../interaction/registry';
import { world } from '../core/world';
import { audio } from '../audio/audio';
import { toon } from '../style/materials';

export function Knockable({ id, placement, def }: { id: string; placement: PropPlacement; def: KnockableDef }) {
  const body = useRef<RapierRigidBody>(null);
  const start = useMemo(() => {
    const v = new THREE.Vector3(...def.offset).multiplyScalar(placement.scale ?? 1);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotation ?? 0);
    return v.add(new THREE.Vector3(...placement.position));
  }, [placement, def]);
  const st = useRef({ knocked: false, at: 0, broken: false, by: '' });
  const [broken, setBroken] = useState<THREE.Vector3 | null>(null);
  const live = useMemo(() => start.clone(), [start]);

  useEffect(() => {
    return interactions.register({
      id: `knock-${id}`,
      kind: 'knock',
      position: live,
      radius: 1.4,
      prompt: () => (st.current.knocked ? null : def.label),
      interact: (agent) => {
        const b = body.current;
        if (!b || st.current.knocked) return;
        st.current.knocked = true;
        st.current.at = world.time;
        st.current.by = agent.id;
        const dir = live.clone().sub(agent.position).setY(0).normalize();
        b.wakeUp();
        b.applyImpulse({ x: dir.x * 1.2, y: 0.8, z: dir.z * 1.2 }, true);
        b.applyTorqueImpulse({ x: dir.z * 0.08, y: 0, z: -dir.x * 0.08 }, true);
        world.playOneShot(agent, 'interact', 0.4);
        world.emitNoise(live, 4, 'knock', agent.id);
      },
    });
  }, [id, def, live]);

  useFrame(() => {
    const b = body.current;
    const s = st.current;
    if (!b || s.broken) return;
    const t = b.translation();
    live.set(t.x, t.y, t.z);
    const v = b.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (!s.knocked && speed > 1.2) {
      s.knocked = true;
      s.at = world.time;
      let nearest = '';
      let nd = Infinity;
      world.agents.forEach((a) => {
        const d = a.position.distanceTo(live);
        if (d < nd) {
          nd = d;
          nearest = a.id;
        }
      });
      s.by = nearest;
    }
    if (s.knocked && world.time - s.at > 0.3 && (t.y < start.y - 0.6 || world.time - s.at > 1.6) && speed < 3.5) {
      s.broken = true;
      audio.play('crash');
      world.emitNoise(live, def.noiseRadius, 'crash', s.by);
      world.events.emit({ type: 'knocked', agentId: s.by, objectId: id, position: [t.x, t.y, t.z] });
      setBroken(new THREE.Vector3(t.x, 0.02, t.z));
    }
  });

  if (broken) return <Shards at={broken} />;
  const { Render } = def;
  return (
    <RigidBody ref={body} type="dynamic" position={start} rotation={[0, placement.rotation ?? 0, 0]} colliders={false} mass={0.4} canSleep collisionGroups={groups.prop}>
      <CuboidCollider args={[def.size[0] / 2, def.size[1] / 2, def.size[2] / 2]} collisionGroups={groups.prop} friction={0.6} restitution={0.2} />
      <group position={[0, -def.size[1] / 2 + 0.02, 0]}>
        <Render broken={false} />
      </group>
    </RigidBody>
  );
}

function Shards({ at }: { at: THREE.Vector3 }) {
  const shards = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => ({ x: Math.cos(i * 2.4) * (0.2 + (i % 3) * 0.18), z: Math.sin(i * 2.4) * (0.2 + (i % 2) * 0.22), r: i * 0.9, s: 0.08 + (i % 3) * 0.04 })),
    [],
  );
  return (
    <group position={at}>
      {shards.map((s, i) => (
        <mesh key={i} position={[s.x, 0.02, s.z]} rotation={[0, s.r, 0]} material={toon(i % 2 ? '#5c8fc9' : '#fff6dc')}>
          <boxGeometry args={[s.s * 1.6, 0.03, s.s]} />
        </mesh>
      ))}
    </group>
  );
}
