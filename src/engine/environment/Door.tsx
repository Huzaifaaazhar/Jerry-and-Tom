/**
 * Hinged door with a pet flap. Hunters and guardians open/close it (player with E, AI
 * automatically when walking through); the mouse slips through the flap at the bottom.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import type { OpeningSpec, WallSpec } from './types';
import { wallDir } from './geometry';
import { groups } from '../core/physics';
import { toon } from '../style/materials';
import { palette } from '../style/palette';
import { interactions } from '../interaction/registry';
import { world } from '../core/world';
import { audio } from '../audio/audio';
import { dampAngle } from '../core/math';

const FLAP_W = 0.62;
const FLAP_H = 0.68;
const OPEN_ANGLE = 1.7;

export function Door({ id, wall, opening }: { id: string; wall: WallSpec; opening: OpeningSpec }) {
  const body = useRef<RapierRigidBody>(null);
  const flap = useRef<THREE.Group>(null);
  const [dx, dz] = wallDir(wall);
  const baseYaw = Math.atan2(-dz, dx);
  const pw = opening.width - 0.06;
  const ph = opening.height - 0.04;
  const hinge = useMemo(
    () => new THREE.Vector3(wall.from[0] + dx * (opening.at - opening.width / 2 + 0.03), 0, wall.from[1] + dz * (opening.at - opening.width / 2 + 0.03)),
    [wall, dx, dz, opening],
  );
  const center = useMemo(() => new THREE.Vector3(wall.from[0] + dx * opening.at, 1, wall.from[1] + dz * opening.at), [wall, dx, dz, opening]);
  const flapWorld = useMemo(() => new THREE.Vector3(center.x, 0.3, center.z), [center]);
  const state = useRef({ open: !!opening.startOpen, angle: opening.startOpen ? OPEN_ANGLE * (opening.swing ?? 1) : 0, flap: 0, slamUntil: 0, autoLock: 0 });
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => {
    const setOpen = (open: boolean, agentId?: string) => {
      if (state.current.open === open) return;
      state.current.open = open;
      handle.open = open;
      audio.play('door', { pitch: open ? 1 : 0.85 });
      world.emitNoise(center, 5, 'door', agentId);
      world.events.emit({ type: 'door', doorId: id, open, agentId });
    };
    const slam = (agentId: string) => {
      if (!state.current.open) return;
      state.current.slamUntil = world.time + 0.6;
      state.current.autoLock = world.time + 2.5; // AI won't immediately reopen it
      setOpen(false, agentId);
      audio.play('crash', { gain: 0.6 });
      world.events.emit({ type: 'slam', agentId, doorId: id });
      // Whoever was charging through the doorway eats the door.
      for (const a of world.agents.values()) {
        if (a.id === agentId || a.archetype === 'prey' || a.status.hiddenIn) continue;
        const d = Math.hypot(a.position.x - center.x, a.position.z - center.z);
        const speed = Math.hypot(a.velocity.x, a.velocity.z);
        if (d < 2.4 && (speed > 1.5 || d < 1.2)) {
          world.stun(a, 'splat', 2.2);
          world.flashExpression(a, 'dizzy', 2.2);
          a.body?.setLinvel({ x: -a.velocity.x * 0.3, y: 2, z: -a.velocity.z * 0.3 }, true);
          audio.play('pummel', { gain: 0.7 });
          world.events.emit({ type: 'splat', agentId: a.id, cause: 'door', position: a.position.toArray() as [number, number, number] });
        }
      }
    };
    const handle = { id, center, open: state.current.open, setOpen, slam };
    const offDoor = interactions.registerDoor(handle);
    const offInt = interactions.register({
      id: `door-${id}`,
      kind: 'door',
      position: center,
      radius: 1.5,
      prompt: (a) => {
        if (a.archetype === 'prey') {
          if (!state.current.open) return null;
          const hunterNear = [...world.agents.values()].some((h) => h.archetype === 'hunter' && h.position.distanceTo(center) < 7);
          return hunterNear ? 'Slam the door!' : null;
        }
        return state.current.open ? 'Close door' : 'Open door';
      },
      interact: (a) => {
        world.playOneShot(a, 'interact', 0.35);
        if (a.archetype === 'prey') slam(a.id);
        else setOpen(!state.current.open, a.id);
      },
    });
    return () => {
      offDoor();
      offInt();
    };
  }, [id, center]);

  useFrame((_, dt) => {
    const s = state.current;
    // AI hunters / guardians push doors open as they walk through.
    if (!s.open && world.time > s.autoLock) {
      for (const a of world.agents.values()) {
        if (a.isPlayer || a.archetype === 'prey' || a.status.hiddenIn) continue;
        if (a.position.distanceTo(center) < 1.9 && a.velocity.lengthSq() > 0.5) {
          interactions.doors.get(id)?.setOpen(true, a.id);
          break;
        }
      }
    }
    const target = s.open ? OPEN_ANGLE * (opening.swing ?? 1) : 0;
    s.angle = dampAngle(s.angle, target, s.slamUntil > world.time ? 22 : 7, dt);
    q.setFromAxisAngle(up, baseYaw + s.angle);
    body.current?.setNextKinematicRotation(q);
    // Pet flap swings when someone small passes.
    let near = false;
    for (const a of world.agents.values()) if (a.archetype === 'prey' && a.position.distanceTo(flapWorld) < 0.9) near = true;
    s.flap = THREE.MathUtils.damp(s.flap, near ? 1.2 : 0, 10, dt);
    if (flap.current) flap.current.rotation.x = s.flap * (Math.sin(world.time * 9) > 0 ? 1 : 0.85);
  });

  const side = (pw - FLAP_W) / 2;
  const doorColor = palette.cream;
  const panelMat = toon(doorColor);
  return (
    <RigidBody ref={body} type="kinematicPosition" position={hinge} rotation={[0, baseYaw + state.current.angle, 0]} colliders={false}>
      <CuboidCollider args={[side / 2, ph / 2, 0.06]} position={[side / 2, ph / 2, 0]} collisionGroups={groups.door} />
      <CuboidCollider args={[side / 2, ph / 2, 0.06]} position={[pw - side / 2, ph / 2, 0]} collisionGroups={groups.door} />
      <CuboidCollider args={[FLAP_W / 2, (ph - FLAP_H) / 2, 0.06]} position={[pw / 2, FLAP_H + (ph - FLAP_H) / 2, 0]} collisionGroups={groups.door} />
      <mesh position={[side / 2, ph / 2, 0]} material={panelMat} castShadow>
        <boxGeometry args={[side, ph, 0.1]} />
      </mesh>
      <mesh position={[pw - side / 2, ph / 2, 0]} material={panelMat} castShadow>
        <boxGeometry args={[side, ph, 0.1]} />
      </mesh>
      <mesh position={[pw / 2, FLAP_H + (ph - FLAP_H) / 2, 0]} material={panelMat} castShadow>
        <boxGeometry args={[FLAP_W, ph - FLAP_H, 0.1]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[pw / 2, ph * 0.72, 0.056 * s]} material={toon(palette.teal)}>
            <boxGeometry args={[pw * 0.62, ph * 0.3, 0.01]} />
          </mesh>
          <mesh position={[pw / 2, ph * 0.38, 0.056 * s]} material={toon(palette.teal)}>
            <boxGeometry args={[pw * 0.62, ph * 0.2, 0.01]} />
          </mesh>
          <mesh position={[pw - 0.18, 1.3, 0.09 * s]} material={toon(palette.mustard)}>
            <sphereGeometry args={[0.07, 12, 10]} />
          </mesh>
        </group>
      ))}
      <group ref={flap} position={[pw / 2, FLAP_H, 0]}>
        <mesh position={[0, -FLAP_H / 2, 0]} material={toon(palette.woodDark)}>
          <boxGeometry args={[FLAP_W - 0.06, FLAP_H - 0.04, 0.04]} />
        </mesh>
      </group>
    </RigidBody>
  );
}
