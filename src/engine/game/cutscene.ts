/**
 * Cutscene director: plays a queue of camera shots with captions. While playing, the world is
 * flagged `cutscene` so input, AI and the mission clock hold still. Skippable with jump / interact.
 */
import * as THREE from 'three';
import type { CutsceneShot } from '../episode/types';
import { world } from '../core/world';
import { cameraState } from '../camera/ThirdPersonCamera';
import { useGame } from '../core/store';
import { consume } from '../input/input';

interface Running {
  shots: CutsceneShot[];
  index: number;
  t: number;
}

let running: Running | null = null;

export function playCutscene(shots: CutsceneShot[]) {
  if (!shots.length) return;
  if (running) running.shots.push(...shots);
  else running = { shots: [...shots], index: -1, t: 0 };
  world.cutscene = true;
  next();
}

export function cutsceneActive() {
  return !!running;
}

export function stopCutscene() {
  running = null;
  world.cutscene = false;
  cameraState.cinematic = null;
  useGame.getState().setCutscene(null);
}

function next() {
  if (!running) return;
  running.index++;
  running.t = 0;
  const shot = running.shots[running.index];
  if (!shot) {
    stopCutscene();
    return;
  }
  const target = shotTarget(shot);
  cameraState.cinematic = {
    target,
    from: shot.from ? new THREE.Vector3(...shot.from) : undefined,
    orbitSpeed: 0.22,
    distance: 4.6,
    height: 2.0,
  };
  if (!shot.from) {
    const p = world.player;
    if (p) cameraState.yaw = Math.atan2(p.position.x - target.x, p.position.z - target.z);
  }
  useGame.getState().setCutscene({ caption: shot.caption ?? null, skippable: true });
}

function shotTarget(shot: CutsceneShot) {
  if (shot.focus) {
    const a = world.agents.get(shot.focus);
    if (a) return a.position.clone().add(new THREE.Vector3(0, a.height * 0.3, 0));
  }
  return new THREE.Vector3(...(shot.target ?? [0, 1, 0]));
}

/** Advance; call once per frame from the simulation. */
export function updateCutscene(dt: number) {
  if (!running) return;
  running.t += dt;
  const shot = running.shots[running.index];
  if (shot?.focus && cameraState.cinematic) cameraState.cinematic.target.copy(shotTarget(shot));
  if (consume('jump') || consume('interact')) {
    stopCutscene();
    return;
  }
  if (shot && running.t >= shot.duration) next();
}
