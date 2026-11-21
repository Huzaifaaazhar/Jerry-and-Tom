/**
 * Third-person chase camera: orbit (mouse/touch/gamepad), zoom, gentle auto-follow behind the
 * character, collision against walls and furniture (never clips through), chase FOV punch and
 * trauma-based screen shake for gags.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { world } from '../core/world';
import { consumeLook, consumeZoom, input } from '../input/input';
import { groups } from '../core/physics';
import { clamp, dampAngle, dampFactor } from '../core/math';
import { useGame } from '../core/store';
import { getCharacter } from '../characters/registry';

/** Shared camera state: the player controller reads yaw to make movement camera-relative. */
export const cameraState = {
  yaw: Math.PI,
  pitch: 0.38,
  zoom: 1,
  trauma: 0,
  lastLook: 0,
  /** Optional scripted override (ending sequence / intro). */
  cinematic: null as null | { target: THREE.Vector3; orbitSpeed: number; distance: number; height: number; from?: THREE.Vector3 },
};

export function addTrauma(v: number) {
  cameraState.trauma = Math.min(1, cameraState.trauma + v);
}

export function ThirdPersonCamera() {
  const { camera } = useThree();
  const { world: rworld, rapier } = useRapier();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const smoothTarget = useRef<THREE.Vector3 | null>(null);
  const dist = useRef(5);
  const fov = useRef(62);
  /** Extra pitch applied automatically when the camera is squeezed against a wall. */
  const boost = useRef(0);
  /** Smooth hand-off from a cinematic shot back to gameplay. */
  const blend = useRef({ t: 1, from: new THREE.Vector3(), wasCine: false });

  useEffect(() => {
    const off = [
      world.events.on('caught', () => addTrauma(0.55)),
      world.events.on('pummeled', () => addTrauma(0.7)),
      world.events.on('slipped', () => addTrauma(0.35)),
      world.events.on('trapped', () => addTrauma(0.3)),
      world.events.on('knocked', (e) => {
        const p = world.player;
        if (p && p.position.distanceTo(new THREE.Vector3(...e.position)) < 10) addTrauma(0.3);
      }),
      world.events.on('land', (e) => {
        if (e.agentId === world.playerId && e.impact > 11) addTrauma(0.15);
      }),
    ];
    return () => off.forEach((f) => f());
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const player = world.player;
    const settings = useGame.getState().settings;
    const cam = camera as THREE.PerspectiveCamera;
    const cine = cameraState.cinematic;

    if (cine) blend.current.wasCine = true;
    else if (blend.current.wasCine) {
      blend.current.wasCine = false;
      blend.current.t = 0;
      blend.current.from.copy(cam.position);
    }
    if (cine && cine.from) {
      target.copy(cine.target);
      cam.position.lerp(cine.from, dampFactor(2.5, dt));
      cam.lookAt(target);
      return;
    }
    if (cine) {
      cameraState.yaw += cine.orbitSpeed * dt;
      target.copy(cine.target);
      const dirC = tmp.set(Math.sin(cameraState.yaw) * cine.distance, cine.height, Math.cos(cameraState.yaw) * cine.distance);
      const lenC = dirC.length();
      dirC.normalize();
      const rayC = new rapier.Ray({ x: target.x, y: target.y, z: target.z }, { x: dirC.x, y: dirC.y, z: dirC.z });
      const hitC = rworld.castRay(rayC, lenC, true, undefined, groups.ray);
      const dC = hitC ? Math.max(0.8, hitC.timeOfImpact - 0.3) : lenC;
      desired.copy(dirC).multiplyScalar(dC).add(target);
      cam.position.lerp(desired, dampFactor(hitC ? 8 : 3, dt));
      cam.lookAt(target);
      return;
    }
    if (!player) return;
    const def = getCharacter(player.characterId);

    if (!world.paused) {
      const look = consumeLook();
      const sens = 0.0024 * settings.mouseSensitivity;
      if (look.x || look.y) cameraState.lastLook = world.time;
      cameraState.yaw -= look.x * sens;
      cameraState.pitch = clamp(cameraState.pitch + look.y * sens * (settings.invertY ? -1 : 1), -0.2, 1.25);
      cameraState.zoom = clamp(cameraState.zoom * (1 + consumeZoom() * 0.0012), 0.55, 1.7);
      // Auto-follow behind the character while running and not steering the camera.
      const moving = Math.hypot(player.velocity.x, player.velocity.z) > 1;
      if (moving && world.time - cameraState.lastLook > 1.6 && input.source !== 'touch') {
        cameraState.yaw = dampAngle(cameraState.yaw, player.facing + Math.PI, 1.1, dt);
      }
    }

    // Follow the interpolated visual (or the hiding place while hidden).
    if (player.visual) player.visual.getWorldPosition(target);
    else target.copy(player.position);
    if (!player.status.hiddenIn && player.body) target.y -= def.body.halfHeight + def.body.radius;
    target.y += def.camera.height;
    if (!smoothTarget.current) smoothTarget.current = target.clone();
    smoothTarget.current.x += (target.x - smoothTarget.current.x) * dampFactor(18, dt);
    smoothTarget.current.z += (target.z - smoothTarget.current.z) * dampFactor(18, dt);
    smoothTarget.current.y += (target.y - smoothTarget.current.y) * dampFactor(8, dt);
    const t = smoothTarget.current;

    const wantDist = def.camera.distance * cameraState.zoom;
    const pitch = Math.min(1.35, cameraState.pitch + boost.current);
    const cp = Math.cos(pitch);
    const dir = tmp.set(Math.sin(cameraState.yaw) * cp, Math.sin(pitch), Math.cos(cameraState.yaw) * cp).normalize();

    // Camera collision: spherecast-ish with a few rays.
    let allowed = wantDist;
    const ray = new rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = rworld.castRay(ray, wantDist + 0.3, true, undefined, groups.ray);
    if (hit) allowed = Math.max(0.35, hit.timeOfImpact - 0.3);
    // Squeezed against a wall? Swing up over the character instead of staring into its face.
    const boostTarget = allowed < wantDist * 0.45 ? 0.85 : allowed > wantDist * 0.85 ? 0 : boost.current;
    boost.current += (boostTarget - boost.current) * dampFactor(3, dt);
    if (allowed < dist.current) dist.current = allowed;
    else dist.current += (allowed - dist.current) * dampFactor(3.5, dt);

    desired.copy(dir).multiplyScalar(dist.current).add(t);
    if (desired.y < 0.25) desired.y = 0.25;
    if (blend.current.t < 1) {
      blend.current.t = Math.min(1, blend.current.t + dt / 0.9);
      const k = 1 - Math.pow(1 - blend.current.t, 3);
      cam.position.lerpVectors(blend.current.from, desired, k);
    } else cam.position.copy(desired);

    // Shake
    cameraState.trauma = Math.max(0, cameraState.trauma - dt * 1.4);
    const shake = settings.reducedMotion ? 0 : cameraState.trauma ** 2;
    if (shake > 0) {
      const tt = world.time * 40;
      cam.position.x += Math.sin(tt * 1.1) * shake * 0.25;
      cam.position.y += Math.sin(tt * 1.7) * shake * 0.2;
    }
    cam.lookAt(t);

    const chase = useGame.getState().hud.chase;
    const targetFov = 60 + (player.sprinting ? 5 : 0) + (settings.reducedMotion ? 0 : chase * 7);
    fov.current += (targetFov - fov.current) * dampFactor(3, dt);
    if (Math.abs(cam.fov - fov.current) > 0.01) {
      cam.fov = fov.current;
      cam.updateProjectionMatrix();
    }
  }, 0);
  return null;
}
