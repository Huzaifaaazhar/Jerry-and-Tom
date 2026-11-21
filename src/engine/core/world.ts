/**
 * Mutable, per-frame world state shared by the simulation systems (controllers, AI, interaction,
 * camera). Deliberately outside React so 60fps updates do not trigger renders. The UI reads the
 * coarse-grained bits it needs from the zustand store instead.
 */
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { EventBus } from './events';
import type { AgentStatus, AnimState, Archetype, ControlIntent, Expression } from './types';
import { emptyIntent } from './types';
import type { Vec3Tuple } from './math';

export interface AgentState {
  id: string;
  characterId: string;
  archetype: Archetype;
  isPlayer: boolean;
  body: RapierRigidBody | null;
  /** Interpolated visual root (child of the rigid body) - what the camera follows. */
  visual: THREE.Object3D | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  facing: number;
  grounded: boolean;
  /** Collider dimensions, used by AI/perception without touching physics. */
  height: number;
  radius: number;
  status: AgentStatus;
  intent: ControlIntent;
  anim: {
    state: AnimState;
    expression: Expression;
    /** One-shot animation that overrides locomotion until `until`. */
    oneShot: { state: AnimState; until: number } | null;
    expressionOverride: { expression: Expression; until: number } | null;
    lookAt: THREE.Vector3 | null;
    /** Accumulated landing impact for squash, consumed by the animator. */
    impact: number;
  };
  stamina: number;
  charges: Record<string, number>;
  cooldowns: Record<string, number>;
  /** Seconds since the agent left the ground (coyote time / anim). */
  airTime: number;
  roomId: string | null;
  sneaking: boolean;
  sprinting: boolean;
  spawn: { position: Vec3Tuple; facing: number };
  /** Free-form per-brain debug label, shown in dev overlay and tests. */
  aiState: string;
}

export interface Noise {
  position: THREE.Vector3;
  radius: number;
  time: number;
  sourceId?: string;
  kind: string;
}

export class GameWorld {
  readonly events = new EventBus();
  readonly agents = new Map<string, AgentState>();
  noises: Noise[] = [];
  time = 0;
  paused = false;
  /** Set by the episode runtime once the match has a result; simulation freezes gameplay rules. */
  finished = false;
  playerId: string | null = null;

  reset() {
    this.events.clear();
    this.agents.clear();
    this.noises = [];
    this.time = 0;
    this.paused = false;
    this.finished = false;
    this.playerId = null;
  }

  addAgent(init: {
    id: string;
    characterId: string;
    archetype: Archetype;
    isPlayer: boolean;
    height: number;
    radius: number;
    spawn: { position: Vec3Tuple; facing: number };
    charges?: Record<string, number>;
  }): AgentState {
    const agent: AgentState = {
      ...init,
      body: null,
      visual: null,
      position: new THREE.Vector3(...init.spawn.position),
      velocity: new THREE.Vector3(),
      facing: init.spawn.facing,
      grounded: false,
      status: {
        stunnedUntil: 0,
        stunKind: null,
        hiddenIn: null,
        invulnerableUntil: 0,
        respawnAt: null,
        actionUntil: 0,
        action: null,
      },
      intent: emptyIntent(),
      anim: { state: 'idle', expression: 'neutral', oneShot: null, expressionOverride: null, lookAt: null, impact: 0 },
      stamina: 1,
      charges: { ...(init.charges ?? {}) },
      cooldowns: {},
      airTime: 0,
      roomId: null,
      sneaking: false,
      sprinting: false,
      aiState: '',
    };
    this.agents.set(agent.id, agent);
    if (init.isPlayer) this.playerId = agent.id;
    return agent;
  }

  get player(): AgentState | undefined {
    return this.playerId ? this.agents.get(this.playerId) : undefined;
  }

  byArchetype(a: Archetype): AgentState[] {
    const out: AgentState[] = [];
    this.agents.forEach((ag) => ag.archetype === a && out.push(ag));
    return out;
  }

  emitNoise(position: THREE.Vector3 | Vec3Tuple, radius: number, kind: string, sourceId?: string) {
    const p = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
    this.noises.push({ position: p, radius, time: this.time, sourceId, kind });
    this.events.emit({ type: 'noise', position: [p.x, p.y, p.z], radius, sourceId, kind });
  }

  /** Noises from the last `window` seconds audible at `pos`, excluding the listener's own. */
  audibleNoises(pos: THREE.Vector3, listenerId: string, window = 0.6): Noise[] {
    return this.noises.filter(
      (n) => n.sourceId !== listenerId && this.time - n.time <= window && n.position.distanceTo(pos) <= n.radius,
    );
  }

  pruneNoises() {
    if (this.noises.length > 64) this.noises = this.noises.filter((n) => this.time - n.time < 2);
  }

  isStunned(a: AgentState) {
    return a.status.stunnedUntil > this.time;
  }

  stun(a: AgentState, kind: AgentStatus['stunKind'], seconds: number) {
    a.status.stunnedUntil = this.time + seconds;
    a.status.stunKind = kind;
    a.status.invulnerableUntil = Math.max(a.status.invulnerableUntil, this.time + seconds + 0.6);
  }

  playOneShot(a: AgentState, state: AnimState, seconds: number) {
    a.anim.oneShot = { state, until: this.time + seconds };
  }

  flashExpression(a: AgentState, expression: Expression, seconds: number) {
    a.anim.expressionOverride = { expression, until: this.time + seconds };
  }
}

/** The single live world. Systems import it directly; tests can construct their own GameWorld. */
export const world = new GameWorld();
