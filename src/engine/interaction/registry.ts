/**
 * Interaction system registry. Anything the player (or AI) can act on registers here: doors,
 * hiding places, knockable objects, pickups. The player controller asks for the best candidate in
 * range each frame (drives the HUD prompt) and calls `interact` on E / tap.
 */
import * as THREE from 'three';
import type { AgentState } from '../core/world';
import type { Archetype } from '../core/types';

export type InteractKind = 'door' | 'hide' | 'knock' | 'catch' | 'search';

export interface Interactable {
  id: string;
  kind: InteractKind;
  position: THREE.Vector3;
  radius: number;
  /** Return the prompt text if this agent may use it right now, else null. */
  prompt: (agent: AgentState) => string | null;
  interact: (agent: AgentState) => void;
  priority?: number;
}

export interface HideSpot {
  id: string;
  label: string;
  position: THREE.Vector3;
  exit: THREE.Vector3;
  archetypes: Archetype[];
  occupant: string | null;
  /** False for places hunters can't reach into (a mouse's own hole). */
  searchable?: boolean;
}

export interface DoorHandle {
  id: string;
  center: THREE.Vector3;
  open: boolean;
  setOpen: (open: boolean, agentId?: string) => void;
  /** Slam shut: anyone hunting through the doorway gets a face full of door. */
  slam: (agentId: string) => void;
}

class InteractionRegistry {
  readonly items = new Map<string, Interactable>();
  readonly hideSpots = new Map<string, HideSpot>();
  readonly doors = new Map<string, DoorHandle>();

  register(i: Interactable) {
    this.items.set(i.id, i);
    return () => {
      if (this.items.get(i.id) === i) this.items.delete(i.id);
    };
  }

  registerHideSpot(h: HideSpot) {
    this.hideSpots.set(h.id, h);
    return () => {
      if (this.hideSpots.get(h.id) === h) this.hideSpots.delete(h.id);
    };
  }

  registerDoor(d: DoorHandle) {
    this.doors.set(d.id, d);
    return () => {
      if (this.doors.get(d.id) === d) this.doors.delete(d.id);
    };
  }

  /** Best interactable for an agent: closest in range, weighted by whether it is in front. */
  best(agent: AgentState): { item: Interactable; prompt: string } | null {
    let best: { item: Interactable; prompt: string; score: number } | null = null;
    const fx = Math.sin(agent.facing);
    const fz = Math.cos(agent.facing);
    for (const item of this.items.values()) {
      const dx = item.position.x - agent.position.x;
      const dz = item.position.z - agent.position.z;
      const dy = Math.abs(item.position.y - agent.position.y);
      const d = Math.hypot(dx, dz);
      // Small characters get a little extra reach so prompts don't need pixel-perfect positioning.
      const reach = agent.archetype === 'prey' ? 0.4 : 0.15;
      if (d > item.radius + agent.radius + reach || dy > 2.2) continue;
      const prompt = item.prompt(agent);
      if (!prompt) continue;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = d - facing * 0.6 - (item.priority ?? 0);
      if (!best || score < best.score) best = { item, prompt, score };
    }
    return best ? { item: best.item, prompt: best.prompt } : null;
  }

  reset() {
    this.items.clear();
    this.hideSpots.clear();
    this.doors.clear();
  }
}

export const interactions = new InteractionRegistry();
