/**
 * Procedural animation for the cartoon rig: locomotion cycles (walk, run, sneak tiptoe), airborne
 * poses (anticipation, stretch, flail), gags (banana slip, trap squash, dizzy stars, belly laugh,
 * "take" double-take), squash & stretch, secondary motion (tail, ears) and facial animation
 * (blinks, eye tracking, expressions). Each bone damps toward a per-state target pose.
 */
import * as THREE from 'three';
import type { Rig } from '../rig/buildRig';
import type { AgentState } from '../../core/world';
import type { AnimState } from '../../core/types';
import { EXPRESSIONS, lerpFace, type FacePose } from './expressions';
import { clamp, dampFactor } from '../../core/math';

type Euler3 = [number, number, number];
interface Pose {
  hipsY: number;
  hipsRot: Euler3;
  spine: Euler3;
  head: Euler3;
  shL: Euler3;
  shR: Euler3;
  elL: number;
  elR: number;
  thL: Euler3;
  thR: Euler3;
  knL: number;
  knR: number;
  anL: number;
  anR: number;
}

const zero = (): Euler3 => [0, 0, 0];
const basePose = (): Pose => ({
  hipsY: 0,
  hipsRot: zero(),
  spine: zero(),
  head: zero(),
  shL: [0, 0, -0.18],
  shR: [0, 0, 0.18],
  elL: -0.25,
  elR: -0.25,
  thL: zero(),
  thR: zero(),
  knL: 0,
  knR: 0,
  anL: 0,
  anR: 0,
});

const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();

export class ProceduralAnimator {
  private phase = 0;
  private t = 0;
  private squash = 1;
  private squashVel = 0;
  private face: FacePose = { ...EXPRESSIONS.neutral };
  private blinkTimer = 2;
  private blink = 0;
  private lookYaw = 0;
  private idleLook = 0;
  private idleLookTimer = 3;
  private prevState: AnimState = 'idle';
  private stateTime = 0;
  private wasGrounded = true;
  private tailSwing = 0;
  private pupil = new THREE.Vector2();
  // Body dynamics for follow-through: smoothed acceleration and turn rate.
  private prevVel = new THREE.Vector2();
  private prevFacing = 0;
  private accel = new THREE.Vector2();
  private turnRate = 0;
  private lastStep = 0;
  private fidget: { kind: 'tap' | 'stretch' | 'shrug' | null; until: number } = { kind: null, until: 0 };
  private nextFidget = 4 + Math.random() * 4;

  constructor(private rig: Rig, private seed = Math.random() * 10) {}

  update(agent: AgentState, dt: number, time: number) {
    const r = this.rig;
    this.t = time + this.seed;
    const state = agent.anim.state;
    if (state !== this.prevState) {
      this.stateTime = 0;
      if (state === 'jump') this.kick(-0.35); // anticipation squash then stretch
      if (state === 'react') this.kick(0.6);
      this.prevState = state;
    } else this.stateTime += dt;

    // Landing squash
    if (agent.grounded && !this.wasGrounded) this.kick(-clamp(agent.anim.impact * 0.06, 0.12, 0.45));
    agent.anim.impact = 0;
    this.wasGrounded = agent.grounded;

    const hidden = state === 'hidden';
    r.root.visible = !hidden;
    if (hidden) return;

    const speed = Math.hypot(agent.velocity.x, agent.velocity.z);
    // Acceleration in the character's local frame (x = sideways, y = forward) and turn rate.
    if (dt > 0) {
      const ax = (agent.velocity.x - this.prevVel.x) / dt;
      const az = (agent.velocity.z - this.prevVel.y) / dt;
      const sf = Math.sin(agent.facing);
      const cf = Math.cos(agent.facing);
      const fwd = ax * sf + az * cf;
      const side = ax * cf - az * sf;
      this.accel.x += (clamp(side, -40, 40) - this.accel.x) * dampFactor(10, dt);
      this.accel.y += (clamp(fwd, -40, 40) - this.accel.y) * dampFactor(10, dt);
      let dYaw = agent.facing - this.prevFacing;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      this.turnRate += (clamp(dYaw / dt, -12, 12) - this.turnRate) * dampFactor(8, dt);
    }
    this.prevVel.set(agent.velocity.x, agent.velocity.z);
    this.prevFacing = agent.facing;
    const pose = basePose();
    const T = this.t;
    let cadence = 0;

    switch (state) {
      case 'idle':
      case 'celebrate':
      case 'defeat':
        this.idle(pose, agent, dt, state);
        break;
      case 'walk':
      case 'run':
      case 'sneak': {
        const stride = state === 'run' ? 1.0 : state === 'sneak' ? 0.55 : 0.7;
        cadence = (state === 'run' ? 2.3 : state === 'sneak' ? 1.4 : 1.9) * Math.max(0.6, speed / (agent.height * 1.9)) * Math.PI;
        this.phase += cadence * dt;
        this.locomotion(pose, state, stride);
        break;
      }
      case 'jump':
        pose.hipsRot[0] = 0.12;
        pose.thL = [-1.0, 0, 0];
        pose.thR = [-0.4, 0, 0];
        pose.knL = 1.4;
        pose.knR = 0.9;
        pose.shL = [-2.5, 0, -0.5];
        pose.shR = [-2.5, 0, 0.5];
        pose.elL = pose.elR = -0.2;
        pose.head[0] = -0.2;
        break;
      case 'fall':
        pose.thL = [-0.6 + Math.sin(T * 18) * 0.5, 0, -0.1];
        pose.thR = [-0.6 - Math.sin(T * 18) * 0.5, 0, 0.1];
        pose.knL = pose.knR = 0.8;
        pose.shL = [-2.2 + Math.sin(T * 22) * 0.6, 0, -0.9];
        pose.shR = [-2.2 - Math.sin(T * 22) * 0.6, 0, 0.9];
        pose.elL = pose.elR = -0.4;
        pose.head[0] = 0.15;
        break;
      case 'slip':
        this.slip(pose, agent);
        break;
      case 'stunned':
        this.stunned(pose, agent);
        break;
      case 'splat':
        // Flattened pancake, arms and legs splayed like a starfish.
        pose.hipsY = -0.25;
        pose.shL = [-0.2, 0, -1.5];
        pose.shR = [-0.2, 0, 1.5];
        pose.elL = pose.elR = 0;
        pose.thL = [0, 0, -0.7];
        pose.thR = [0, 0, 0.7];
        pose.head = [0, 0, Math.sin(this.t * 10) * 0.1];
        break;
      case 'ouch': {
        // Hopping on one foot, clutching the other.
        const hop = Math.abs(Math.sin(this.t * 11));
        pose.hipsY = hop * 0.22;
        pose.hipsRot[2] = Math.sin(this.t * 5.5) * 0.15;
        pose.thL = [-1.3, 0, 0];
        pose.knL = 1.9;
        pose.thR = [0.1, 0, 0.05];
        pose.shL = [-0.9, 0, -0.3];
        pose.shR = [-0.9, 0, 0.3];
        pose.elL = pose.elR = -1.4;
        pose.spine[0] = 0.35;
        pose.head = [-0.4, 0, Math.sin(this.t * 7) * 0.2];
        break;
      }
      case 'laugh':
        pose.hipsY = Math.abs(Math.sin(T * 16)) * 0.025;
        pose.spine[0] = -0.25 + Math.sin(T * 16) * 0.08;
        pose.head[0] = -0.35;
        pose.shL = [-0.7, 0, -0.55];
        pose.shR = [-0.7, 0, 0.55];
        pose.elL = pose.elR = -1.6;
        pose.thL[2] = -0.12;
        pose.thR[2] = 0.12;
        break;
      case 'react':
        pose.hipsY = Math.max(0, Math.sin(Math.min(this.stateTime * 6, Math.PI))) * 0.25;
        pose.shL = [-0.4, 0, -1.4];
        pose.shR = [-0.4, 0, 1.4];
        pose.elL = pose.elR = -0.1;
        pose.head[0] = -0.25;
        pose.thL[2] = -0.25;
        pose.thR[2] = 0.25;
        break;
      case 'grab':
      case 'pounce':
        pose.hipsRot[0] = state === 'pounce' ? 0.95 : 0.45;
        pose.spine[0] = 0.25;
        pose.head[0] = -0.7;
        pose.shL = [-1.7, 0, -0.25];
        pose.shR = [-1.7, 0, 0.25];
        pose.elL = pose.elR = -0.1;
        pose.thL = [state === 'pounce' ? 0.9 : -0.6, 0, 0];
        pose.thR = [state === 'pounce' ? 0.6 : 0.4, 0, 0];
        pose.knL = pose.knR = 0.5;
        break;
      case 'interact':
        pose.spine[0] = 0.35;
        pose.shR = [-1.3 + Math.sin(T * 14) * 0.2, 0, 0.2];
        pose.elR = -0.3;
        pose.shL = [-0.3, 0, -0.3];
        pose.head[0] = 0.25;
        break;
      case 'sleep':
        pose.hipsY = -0.86;
        pose.thL = [-1.45, 0, -0.25];
        pose.thR = [-1.45, 0, 0.25];
        pose.knL = pose.knR = 0.2;
        pose.spine[0] = 0.35 + Math.sin(T * 1.4) * 0.04;
        pose.head = [0.55, 0, 0.3];
        pose.shL = [-0.3, 0, -0.35];
        pose.shR = [-0.3, 0, 0.35];
        pose.elL = pose.elR = -1.2;
        break;
      case 'land':
        break;
    }

    // Lean into speed and acceleration, bank into turns (cartoon weight and momentum).
    const moving = state === 'walk' || state === 'run' || state === 'sneak' || state === 'idle';
    if (moving && agent.grounded) {
      pose.hipsRot[0] += clamp(speed * 0.04, 0, 0.36) + clamp(this.accel.y * 0.012, -0.28, 0.3);
      const bank = clamp(-this.turnRate * Math.min(speed, 7) * 0.022, -0.4, 0.4) + clamp(-this.accel.x * 0.008, -0.2, 0.2);
      pose.hipsRot[2] += bank;
      pose.head[2] -= bank * 0.6; // keep the eyes level-ish
      // Look where we're turning.
      pose.head[1] += clamp(this.turnRate * 0.12, -0.5, 0.5);
    }
    // Footfall bounce: a tiny squash every step while running.
    if (state === 'run' && agent.grounded) {
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        this.kick(-0.07);
      }
    }
    this.applyPose(pose, dt, state === 'slip' || state === 'react' || state === 'splat' ? 22 : 15);

    // Squash & stretch: spring toward 1, plus stretch while rising.
    let target = 1;
    if (!agent.grounded && state !== 'slip') target = 1 + clamp(agent.velocity.y * 0.03, -0.12, 0.22);
    if (agent.status.stunKind === 'trap' && agent.status.stunnedUntil > 0 && state === 'stunned' && this.stateTime < 1.2) target = 0.35;
    if (state === 'splat') target = 0.38;
    const k = 260;
    const c = 14;
    this.squashVel += ((target - this.squash) * k - this.squashVel * c) * dt;
    this.squash += this.squashVel * dt;
    const s = clamp(this.squash, 0.3, 1.6);
    const sxz = 1 / Math.sqrt(s);
    r.squash.scale.set(sxz, s, sxz);

    this.hands(state, dt);
    this.secondary(agent, dt, speed, cadence, state);
    const expr = this.updateFace(agent, dt, state);

    r.stars.visible = state === 'stunned' || state === 'slip' || state === 'splat';
    if (r.stars.visible) r.stars.rotation.y += dt * 5;
    r.zzz.visible = state === 'sleep';
    if (r.zzz.visible) {
      r.zzz.children.forEach((z, i) => {
        const p = ((T * 0.5 + i / 3) % 1) * 1;
        z.position.y = (i * 0.45 + p * 0.6) * this.rig.dims.headR;
        z.scale.setScalar(0.6 + p * 0.6);
      });
    }
    r.sweat.visible = expr === 'scared' && Math.sin(T * 3) > -0.3;
  }

  private kick(amount: number) {
    this.squashVel += amount * 30;
  }

  private idle(pose: Pose, _agent: AgentState, dt: number, state: AnimState) {
    const T = this.t;
    const breathe = Math.sin(T * 2.1);
    pose.spine[0] = breathe * 0.03;
    pose.hipsY = breathe * 0.004;
    pose.shL = [Math.sin(T * 1.3) * 0.06, 0, -0.18 - breathe * 0.03];
    pose.shR = [-Math.sin(T * 1.3) * 0.06, 0, 0.18 + breathe * 0.03];
    pose.hipsRot[2] = Math.sin(T * 0.7) * 0.025;
    this.idleLookTimer -= dt;
    if (this.idleLookTimer < 0) {
      this.idleLookTimer = 2 + Math.random() * 3;
      this.idleLook = (Math.random() - 0.5) * 1.2;
    }
    pose.head[1] = this.idleLook;
    pose.head[2] = Math.sin(T * 0.9) * 0.07;
    // Weight shift from foot to foot.
    const shift = Math.sin(T * 0.55);
    pose.hipsRot[2] += shift * 0.05;
    pose.thL[2] = -0.06 + shift * 0.04;
    pose.thR[2] = 0.06 + shift * 0.04;
    pose.knL = Math.max(0, shift) * 0.18;
    pose.knR = Math.max(0, -shift) * 0.18;
    // Occasional fidgets so nobody ever stands frozen.
    if (state === 'idle') {
      this.nextFidget -= dt;
      if (this.nextFidget <= 0) {
        const kinds = ['tap', 'stretch', 'shrug'] as const;
        this.fidget = { kind: kinds[Math.floor(Math.random() * kinds.length)], until: T + 1.6 };
        this.nextFidget = 5 + Math.random() * 6;
      }
      if (this.fidget.kind && T < this.fidget.until) {
        const k = Math.sin(((this.fidget.until - T) / 1.6) * Math.PI);
        if (this.fidget.kind === 'tap') {
          pose.thR = [-0.25 * k, 0, 0.08];
          pose.anR = -0.5 * k + Math.max(0, Math.sin(T * 18)) * 0.5 * k;
        } else if (this.fidget.kind === 'stretch') {
          pose.shL = [-2.6 * k, 0, -0.5 * k];
          pose.shR = [-2.6 * k, 0, 0.5 * k];
          pose.spine[0] = -0.25 * k;
          pose.head[0] = -0.3 * k;
        } else {
          pose.shL[2] = -0.18 - 0.35 * k;
          pose.shR[2] = 0.18 + 0.35 * k;
          pose.elL = pose.elR = -1.2 * k - 0.25;
          pose.head[2] = 0.2 * k;
        }
      } else this.fidget.kind = null;
    }
    if (state === 'celebrate') {
      pose.hipsY = Math.abs(Math.sin(T * 7)) * 0.12;
      pose.shL = [-2.8, 0, -0.4 + Math.sin(T * 14) * 0.2];
      pose.shR = [-2.8, 0, 0.4 - Math.sin(T * 14) * 0.2];
      pose.elL = pose.elR = -0.3;
      pose.head[0] = -0.25;
    } else if (state === 'defeat') {
      pose.spine[0] = 0.45;
      pose.head[0] = 0.5;
      pose.shL = [0.1, 0, -0.05];
      pose.shR = [0.1, 0, 0.05];
      pose.elL = pose.elR = 0;
      pose.hipsY = -0.02;
    }
  }

  private locomotion(pose: Pose, state: AnimState, stride: number) {
    const p = this.phase;
    const s = Math.sin(p);
    const c = Math.cos(p);
    const legA = stride * (state === 'run' ? 1.2 : 0.8);
    // Front leg reaches, back leg kicks up behind - a springy cartoon gait.
    pose.thL = [-s * legA, 0, -0.04];
    pose.thR = [s * legA, 0, 0.04];
    pose.knL = Math.max(0, -c) * legA * (state === 'run' ? 1.9 : 1.4) + 0.12;
    pose.knR = Math.max(0, c) * legA * (state === 'run' ? 1.9 : 1.4) + 0.12;
    pose.anL = -pose.thL[0] * 0.45 - pose.knL * 0.55;
    pose.anR = -pose.thR[0] * 0.45 - pose.knR * 0.55;
    // Bounce twice per stride (each footfall), with the head counter-bobbing.
    const bounce = Math.abs(Math.cos(p));
    pose.hipsY = bounce * (state === 'run' ? 0.11 : 0.045) - 0.015;
    pose.hipsRot[1] = s * (state === 'run' ? 0.2 : 0.14);
    pose.spine[1] = -s * (state === 'run' ? 0.28 : 0.2);
    pose.hipsRot[2] = c * (state === 'run' ? 0.05 : 0.07);
    pose.spine[0] = (1 - bounce) * 0.06;
    pose.head[0] = -(1 - bounce) * 0.08;
    if (state === 'run') {
      pose.shL = [s * 1.45, 0, -0.3];
      pose.shR = [-s * 1.45, 0, 0.3];
      pose.elL = -1.25 - Math.max(0, -s) * 0.4;
      pose.elR = -1.25 - Math.max(0, s) * 0.4;
      pose.head[0] -= 0.1;
    } else if (state === 'sneak') {
      // Classic cartoon tiptoe: crouched, knees high, paws up by the chin.
      pose.hipsY = -0.12 + Math.abs(Math.sin(p)) * 0.05;
      pose.hipsRot[0] = 0.32;
      pose.spine[0] = 0.15;
      pose.thL = [-0.45 - Math.max(0, s) * 1.0, 0, -0.05];
      pose.thR = [-0.45 - Math.max(0, -s) * 1.0, 0, 0.05];
      pose.knL = 0.7 + Math.max(0, s) * 0.9;
      pose.knR = 0.7 + Math.max(0, -s) * 0.9;
      pose.anL = -0.4 + Math.max(0, s) * 0.5;
      pose.anR = -0.4 + Math.max(0, -s) * 0.5;
      pose.shL = [-1.35, 0.2, -0.35];
      pose.shR = [-1.35, -0.2, 0.35];
      pose.elL = pose.elR = -1.1;
      pose.head = [-0.35, Math.sin(this.t * 1.7) * 0.5, 0];
    } else {
      pose.shL = [s * 0.8, 0, -0.22];
      pose.shR = [-s * 0.8, 0, 0.22];
      pose.elL = -0.35 - Math.max(0, s) * 0.45;
      pose.elR = -0.35 - Math.max(0, -s) * 0.45;
    }
  }

  private slip(pose: Pose, agent: AgentState) {
    const st = this.stateTime;
    const remaining = agent.status.stunnedUntil - (this.t - this.seed);
    const flip = clamp(st / 0.35, 0, 1);
    const lying = flip >= 1;
    const gettingUp = remaining < 0.35;
    const k = gettingUp ? clamp(remaining / 0.35, 0, 1) : 1;
    pose.hipsRot[0] = -1.5 * flip * k;
    pose.hipsY = (st < 0.35 ? Math.sin(flip * Math.PI) * 0.6 : 0) - 0.62 * flip * k;
    pose.thL = [-1.5 * flip * k + (lying ? Math.sin(this.t * 8) * 0.15 : 0), 0, -0.2];
    pose.thR = [-1.2 * flip * k, 0, 0.2];
    pose.knL = pose.knR = 0.3;
    pose.shL = [-0.6 * k, 0, -1.3 * k];
    pose.shR = [-0.6 * k, 0, 1.3 * k];
    pose.head[0] = 0.4 * k;
  }

  private stunned(pose: Pose, agent: AgentState) {
    const T = this.t;
    pose.hipsRot[2] = Math.sin(T * 4.5) * 0.14;
    pose.hipsRot[0] = Math.cos(T * 4.5) * 0.08;
    pose.head = [Math.cos(T * 6) * 0.2, 0, Math.sin(T * 6) * 0.25];
    pose.shL = [0.1, 0, -0.5 + Math.sin(T * 5) * 0.2];
    pose.shR = [0.1, 0, 0.5 - Math.sin(T * 5) * 0.2];
    pose.elL = pose.elR = -0.1;
    pose.knL = pose.knR = 0.35;
    pose.thL = [-0.2, 0, -0.1];
    pose.thR = [-0.2, 0, 0.1];
    pose.hipsY = -0.04;
    if (agent.status.stunKind === 'pummel') pose.spine[0] = 0.3;
  }

  /**
   * Blend bones toward the pose. Different joints settle at different speeds - legs snap (they carry
   * the weight), the torso follows, the head and arms trail behind - which gives overlapping action
   * instead of a stiff, all-at-once pose change.
   */
  private applyPose(pose: Pose, dt: number, lambda: number) {
    const r = this.rig;
    const legs = dampFactor(lambda * 1.5, dt);
    const body = dampFactor(lambda, dt);
    const spine = dampFactor(lambda * 0.7, dt);
    const head = dampFactor(lambda * 0.55, dt);
    const arms = dampFactor(lambda * 0.8, dt);
    const fore = dampFactor(lambda * 0.6, dt);
    const L = r.dims.hipsY;
    const set = (g: THREE.Object3D, e: Euler3, f: number) => {
      g.rotation.x += (e[0] - g.rotation.x) * f;
      g.rotation.y += (e[1] - g.rotation.y) * f;
      g.rotation.z += (e[2] - g.rotation.z) * f;
    };
    r.hips.position.y += (L + pose.hipsY * L - r.hips.position.y) * legs;
    set(r.hips, pose.hipsRot, body);
    set(r.spine, pose.spine, spine);
    set(r.head, [pose.head[0], pose.head[1] + this.lookYaw, pose.head[2]], head);
    set(r.shoulderL, pose.shL, arms);
    set(r.shoulderR, pose.shR, arms);
    r.elbowL.rotation.x += (pose.elL - r.elbowL.rotation.x) * fore;
    r.elbowR.rotation.x += (pose.elR - r.elbowR.rotation.x) * fore;
    set(r.thighL, pose.thL, legs);
    set(r.thighR, pose.thR, legs);
    r.kneeL.rotation.x += (pose.knL - r.kneeL.rotation.x) * legs;
    r.kneeR.rotation.x += (pose.knR - r.kneeR.rotation.x) * legs;
    r.ankleL.rotation.x += (pose.anL - r.ankleL.rotation.x) * legs;
    r.ankleR.rotation.x += (pose.anR - r.ankleR.rotation.x) * legs;
  }

  /** Finger curl per pose: fists when running, open splayed hands for grabs and double-takes. */
  private hands(state: AnimState, dt: number) {
    const curl: Partial<Record<AnimState, number>> = {
      run: 1.4,
      walk: 0.6,
      sneak: 1.0,
      laugh: 0.9,
      interact: 0.2,
      grab: -0.25,
      pounce: -0.25,
      react: -0.35,
      celebrate: 1.2,
      fall: -0.2,
      jump: 0.3,
      sleep: 0.8,
      defeat: 0.3,
      ouch: 1.1,
    };
    const spread = state === 'react' || state === 'grab' || state === 'pounce' || state === 'fall' ? 1.6 : 1;
    const target = -(curl[state] ?? 0.45);
    const f = dampFactor(16, dt);
    const r = this.rig;
    for (const list of [r.fingersL, r.fingersR]) {
      list.forEach((g, k) => {
        g.rotation.x += (target - g.rotation.x) * f;
        g.rotation.z += ((k - 1) * 0.16 * spread - g.rotation.z) * f;
      });
    }
  }

  private secondary(agent: AgentState, dt: number, speed: number, _cadence: number, state: AnimState) {
    const r = this.rig;
    const T = this.t;
    const excited = state === 'run' || agent.anim.expression === 'angry' || agent.anim.expression === 'scared';
    this.tailSwing += dt * (excited ? 9 : state === 'sleep' ? 1 : 2.5);
    const n = r.tail.length;
    const lift = state === 'run' ? 0.1 : state === 'sneak' ? 0.5 : -0.35;
    for (let i = 0; i < n; i++) {
      const g = r.tail[i];
      const wave = Math.sin(this.tailSwing - i * 0.6) * (excited ? 0.28 : 0.16);
      const tx = i === 0 ? lift + (speed > 0.5 ? 0.15 : 0) : -0.12 - (n > 8 ? 0.02 : 0) * i;
      g.rotation.x += (tx - g.rotation.x) * dampFactor(8, dt);
      g.rotation.y = wave * (i === 0 && n === 1 ? 3 : 1);
    }
    // Ears flop / perk
    const earBase = r.dims.earType === 'floppy' ? Math.sin(T * 9) * Math.min(0.25, speed * 0.04) : 0;
    const perk = agent.anim.expression === 'surprised' || agent.anim.expression === 'scared' ? 0.25 : agent.anim.expression === 'sad' || agent.anim.expression === 'sleepy' ? -0.35 : 0;
    r.earL.rotation.x = earBase - perk * 0.5;
    r.earR.rotation.x = -earBase - perk * 0.5;
    r.earL.scale.setScalar(1 + perk * 0.25);
    r.earR.scale.setScalar(1 + perk * 0.25);
  }

  private updateFace(agent: AgentState, dt: number, state: AnimState) {
    const r = this.rig;
    const ov = agent.anim.expressionOverride;
    let expr = ov && ov.until > this.t - this.seed ? ov.expression : agent.anim.expression;
    if (state === 'laugh') expr = 'laughing';
    else if (state === 'stunned' || state === 'slip' || state === 'splat') expr = 'dizzy';
    else if (state === 'ouch') expr = 'angry';
    else if (state === 'sleep') expr = 'sleepy';
    else if (state === 'react') expr = 'surprised';
    lerpFace(this.face, EXPRESSIONS[expr], dampFactor(12, dt));
    const f = this.face;

    // Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const blink = Math.sin(this.blink * Math.PI);

    // Look target (head yaw + pupils)
    let targetYaw = 0;
    let px = 0;
    let py = 0;
    if (agent.anim.lookAt) {
      r.head.updateWorldMatrix(true, false);
      tmpM.copy(r.head.matrixWorld).invert();
      tmpV.copy(agent.anim.lookAt).applyMatrix4(tmpM).normalize();
      targetYaw = clamp(Math.atan2(tmpV.x, tmpV.z) * 0.6, -0.9, 0.9);
      px = clamp(tmpV.x * 1.6, -1, 1);
      py = clamp(tmpV.y * 1.6, -1, 1);
    } else if (state === 'sneak') {
      px = Math.sin(this.t * 1.7);
    }
    this.lookYaw += (targetYaw - this.lookYaw) * dampFactor(6, dt);
    if (expr === 'dizzy') {
      px = Math.cos(this.t * 9);
      py = Math.sin(this.t * 9);
    }
    this.pupil.x += (px - this.pupil.x) * dampFactor(14, dt);
    this.pupil.y += (py - this.pupil.y) * dampFactor(14, dt);

    for (const eye of r.eyes) {
      const tilt = f.lidTilt * -eye.side;
      const lidU = clamp(Math.max(f.lidU, blink), 0, 1);
      eye.upperLid.rotation.x = -1.25 + lidU * 2.75;
      eye.upperLid.rotation.z = tilt;
      eye.lowerLid.rotation.x = 1.25 - f.lidL * 1.4;
      eye.group.scale.setScalar(f.eyeScale);
      const ew = eye.group.children[0].scale;
      eye.pupil.position.x = this.pupil.x * ew.x * 0.38;
      eye.pupil.position.y = this.pupil.y * ew.y * 0.32;
      eye.pupil.scale.setScalar(f.pupil);
      eye.pupil.visible = lidU < 0.85;
      eye.brow.position.y = eye.browBaseY + f.browRaise * ew.y * 0.45;
      eye.brow.rotation.z = f.browAngle * eye.side * -1;
    }
    const m = r.mouth;
    m.smile.scale.y = f.smile >= 0 ? Math.max(0.15, f.smile) : Math.min(-0.15, f.smile);
    m.smile.position.y = f.smile >= 0 ? 0 : -r.dims.headR * 0.05;
    m.smile.visible = f.open < 0.5;
    const talk = state === 'laugh' ? 0.6 + Math.abs(Math.sin(this.t * 16)) * 0.4 : 1;
    const open = f.open * talk;
    m.open.visible = open > 0.06;
    m.open.scale.set(0.7 + open * 0.4, Math.max(0.01, open), 1);
    if (m.teeth) m.teeth.visible = open < 0.7;
    return expr;
  }
}
