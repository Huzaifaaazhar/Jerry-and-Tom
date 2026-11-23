/**
 * Shared character locomotion: the same code moves the player and every AI. Reads the agent's
 * ControlIntent, applies cartoon-snappy acceleration, jumping (coyote time + buffer), stamina,
 * stun/slip physics and the pounce lunge, then derives the animation state.
 */
import * as THREE from 'three';
import type { World as RapierWorld } from '@dimforge/rapier3d-compat';
import type RAPIER from '@dimforge/rapier3d-compat';
import { world, type AgentState } from '../core/world';
import type { CharacterDefinition } from '../characters/types';
import { groups } from '../core/physics';
import { clamp, dampAngle } from '../core/math';
import { audio } from '../audio/audio';
import { splat } from './rules';

const GROUND_OFFSETS: [number, number][] = [
  [0, 0],
  [0.6, 0],
  [-0.6, 0],
  [0, 0.6],
  [0, -0.6],
];

export function groundCheck(agent: AgentState, def: CharacterDefinition, rworld: RapierWorld, rapier: typeof RAPIER): boolean {
  if (!agent.body) return false;
  const p = agent.body.translation();
  const reach = def.body.halfHeight + def.body.radius + 0.1;
  for (const [ox, oz] of GROUND_OFFSETS) {
    const ray = new rapier.Ray({ x: p.x + ox * def.body.radius, y: p.y, z: p.z + oz * def.body.radius }, { x: 0, y: -1, z: 0 });
    const hit = rworld.castRay(ray, reach, true, undefined, groups.ray, undefined, agent.body);
    if (hit) return true;
  }
  return false;
}

export function stepMovement(agent: AgentState, def: CharacterDefinition, dt: number, rworld: RapierWorld, rapier: typeof RAPIER) {
  const body = agent.body;
  if (!body) return;
  if (agent.status.hiddenIn) {
    agent.anim.state = 'hidden';
    agent.velocity.set(0, 0, 0);
    return;
  }
  const t = body.translation();
  agent.position.set(t.x, t.y, t.z);
  const lv = body.linvel();
  const wasGrounded = agent.grounded;
  const grounded = groundCheck(agent, def, rworld, rapier) && lv.y < 2.5;
  agent.grounded = grounded;
  agent.airTime = grounded ? 0 : agent.airTime + dt;

  if (grounded && !wasGrounded && lv.y < -4) {
    agent.anim.impact = -lv.y;
    // Big drops flatten anyone heavier than a mouse.
    if (-lv.y > 13.5 && agent.archetype !== 'prey') splat(agent, 'fall', 1.4);
    world.events.emit({ type: 'land', agentId: agent.id, impact: -lv.y });
    audio.play('land', { gain: clamp(-lv.y / 14, 0.15, 0.8), pitch: 1.4 - agent.height * 0.3 });
    if (-lv.y > 7) world.emitNoise(agent.position, agent.archetype === 'prey' ? 2.5 : 6, 'land', agent.id);
  }

  const it = agent.intent;
  const now = world.time;
  const stunned = world.isStunned(agent) || world.finished;
  const moveLen = Math.min(1, Math.hypot(it.moveX, it.moveZ));
  agent.sneaking = !stunned && it.sneak && !it.sprint;
  const wantsSprint = !stunned && it.sprint && moveLen > 0.2 && !agent.sneaking;
  if (wantsSprint && agent.stamina > 0.02) {
    agent.stamina = Math.max(0, agent.stamina - def.movement.staminaDrain * dt);
    agent.sprinting = agent.stamina > 0;
  } else {
    agent.sprinting = false;
    agent.stamina = Math.min(1, agent.stamina + def.movement.staminaRegen * dt * (moveLen < 0.1 ? 1.6 : 1));
  }
  const maxSpeed = agent.sneaking ? def.movement.sneak : agent.sprinting ? def.movement.run : def.movement.walk;

  let vx = lv.x;
  let vz = lv.z;
  let vy = lv.y;
  let pouncing = agent.status.action === 'pounce' && agent.status.actionUntil > now;
  if (pouncing && agent.cooldowns.pounceStart === undefined) agent.cooldowns.pounceStart = now;

  // A pounce that slams into something solid ends in a face-plant.
  if (pouncing && (agent.cooldowns.pounceStart ?? 0) < now - 0.15 && Math.hypot(lv.x, lv.z) < 3.5) {
    agent.status.actionUntil = now;
    agent.status.action = null;
    splat(agent, 'wall', 1.5);
  }
  pouncing = agent.status.action === 'pounce' && agent.status.actionUntil > now;
  if (!pouncing) delete agent.cooldowns.pounceStart;
  if (pouncing) {
    const pv = 10.5;
    vx = Math.sin(agent.facing) * pv;
    vz = Math.cos(agent.facing) * pv;
  } else if (stunned) {
    const decay = agent.status.stunKind === 'slip' ? 2.2 : 9;
    vx *= Math.exp(-decay * dt);
    vz *= Math.exp(-decay * dt);
  } else {
    const dx = it.moveX * maxSpeed;
    const dz = it.moveZ * maxSpeed;
    const accel = def.movement.accel * (grounded ? 1 : def.movement.airControl);
    const ddx = dx - vx;
    const ddz = dz - vz;
    const dl = Math.hypot(ddx, ddz);
    const step = accel * dt;
    if (dl <= step) {
      vx = dx;
      vz = dz;
    } else {
      vx += (ddx / dl) * step;
      vz += (ddz / dl) * step;
    }
    if (moveLen > 0.1) agent.facing = dampAngle(agent.facing, Math.atan2(it.moveX, it.moveZ), grounded ? 14 : 6, dt);
  }

  // Jump with coyote time and a short input buffer.
  if (it.jump) agent.cooldowns.jumpBuffer = now + 0.14;
  const canJump = !stunned && (grounded || agent.airTime < 0.12) && (agent.cooldowns.jumpLock ?? 0) < now;
  if (canJump && (agent.cooldowns.jumpBuffer ?? 0) > now) {
    vy = def.movement.jump * (agent.sneaking ? 0.85 : 1);
    agent.cooldowns.jumpBuffer = 0;
    agent.cooldowns.jumpLock = now + 0.25;
    agent.airTime = 1;
    world.events.emit({ type: 'jump', agentId: agent.id });
    audio.play('jump', { gain: 0.5, pitch: agent.archetype === 'prey' ? 1.5 : agent.archetype === 'guardian' ? 0.7 : 1 });
  }
  if (pouncing && grounded && (agent.cooldowns.pounceLift ?? 0) < now) {
    vy = 4.5;
    agent.cooldowns.pounceLift = agent.status.actionUntil;
  }

  // Ledge assist: if we're airborne, pushing into something whose top is just above our feet,
  // give a little hop so climbing onto furniture doesn't need pixel-perfect jumps.
  if (!grounded && !stunned && agent.airTime > 0.06 && vy < 3 && moveLen > 0.3 && (agent.cooldowns.mantle ?? 0) < now) {
    const fx = Math.sin(agent.facing);
    const fz = Math.cos(agent.facing);
    const feet = t.y - def.body.halfHeight - def.body.radius;
    const reach = def.body.radius + 0.35;
    const low = rworld.castRay(new rapier.Ray({ x: t.x, y: feet + 0.12, z: t.z }, { x: fx, y: 0, z: fz }), reach, true, undefined, groups.ray, undefined, body);
    const high = rworld.castRay(new rapier.Ray({ x: t.x, y: feet + agent.height * 0.9 + 0.25, z: t.z }, { x: fx, y: 0, z: fz }), reach + 0.2, true, undefined, groups.ray, undefined, body);
    if (low && !high) {
      vy = Math.max(vy, 4.8);
      vx += fx * 0.8;
      vz += fz * 0.8;
      agent.cooldowns.mantle = now + 0.45;
    }
  }
  body.setLinvel({ x: vx, y: vy, z: vz }, true);
  agent.velocity.set(vx, vy, vz);

  // Footstep noise (AI hears running, never sneaking).
  const hs = Math.hypot(vx, vz);
  if (grounded && hs > 0.5 && !agent.sneaking) {
    const stepEvery = agent.sprinting ? 0.22 : 0.34;
    if ((agent.cooldowns.step ?? 0) < now) {
      agent.cooldowns.step = now + stepEvery;
      const radius = (agent.sprinting ? 6 : 2.5) * (agent.archetype === 'prey' ? 0.6 : 1);
      world.emitNoise(agent.position, radius, 'step', agent.id);
      if (agent.isPlayer || agent.position.distanceTo(world.player?.position ?? agent.position) < 12)
        audio.play('step', { gain: agent.archetype === 'prey' ? 0.25 : 0.45, pitch: agent.archetype === 'prey' ? 1.8 : 1 });
    }
  }

  agent.anim.state = deriveAnimState(agent, def, hs, grounded, stunned, pouncing);
}

function deriveAnimState(agent: AgentState, def: CharacterDefinition, hs: number, grounded: boolean, stunned: boolean, pouncing: boolean) {
  const now = world.time;
  const one = agent.anim.oneShot;
  if (one && one.until > now) return one.state;
  if (one) agent.anim.oneShot = null;
  if (world.isStunned(agent)) {
    const k = agent.status.stunKind;
    if (k === 'slip') return 'slip';
    if (k === 'ouch') return 'ouch';
    if (k === 'splat' && agent.status.stunnedUntil - now > 0.9) return 'splat';
    return 'stunned';
  }
  if (pouncing) return 'pounce';
  if (agent.status.action === 'taunt' && agent.status.actionUntil > now) return 'laugh';
  if (!grounded && agent.airTime > 0.1) return agent.velocity.y > 0.5 ? 'jump' : 'fall';
  if (stunned) return 'idle';
  if (hs > 0.35) {
    if (agent.sneaking) return 'sneak';
    return hs > def.movement.walk * 1.12 ? 'run' : 'walk';
  }
  return agent.sneaking ? 'sneak' : 'idle';
}

export const _v = new THREE.Vector3();
