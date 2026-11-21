/**
 * Item & trap registries plus their live instances. Content registers item types (cheese,
 * sandwiches...) and trap types (mousetrap, banana peel...). Episodes spawn instances.
 */
import type { ComponentType } from 'react';
import { create } from 'zustand';
import type { Archetype, StunKind } from '../core/types';
import type { Vec3Tuple } from '../core/math';

export interface ItemDef {
  id: string;
  label: string;
  /** Archetypes that can collect it. */
  collectors: Archetype[];
  Render: ComponentType;
}

export interface TrapDef {
  id: string;
  label: string;
  affects: Archetype[];
  stunKind: StunKind;
  stunSeconds: number;
  sound: 'slip' | 'snap';
  radius: number;
  Render: ComponentType<{ sprung: boolean }>;
}

const itemDefs = new Map<string, ItemDef>();
const trapDefs = new Map<string, TrapDef>();
export const registerItem = (d: ItemDef) => itemDefs.set(d.id, d);
export const registerTrap = (d: TrapDef) => trapDefs.set(d.id, d);
export const getItem = (id: string) => itemDefs.get(id);
export const getTrap = (id: string) => trapDefs.get(id);

export interface PickupInstance {
  id: string;
  type: string;
  position: Vec3Tuple;
  collected: boolean;
}

export interface TrapInstance {
  id: string;
  kind: string;
  position: Vec3Tuple;
  ownerId: string;
  placedAt: number;
  sprung: boolean;
}

interface LiveItems {
  pickups: PickupInstance[];
  traps: TrapInstance[];
  setPickups: (p: PickupInstance[]) => void;
  collect: (id: string) => void;
  addTrap: (t: TrapInstance) => void;
  springTrap: (id: string) => void;
  removeTrap: (id: string) => void;
  reset: () => void;
}

export const useItems = create<LiveItems>((set) => ({
  pickups: [],
  traps: [],
  setPickups: (pickups) => set({ pickups }),
  collect: (id) => set((s) => ({ pickups: s.pickups.map((p) => (p.id === id ? { ...p, collected: true } : p)) })),
  addTrap: (t) => set((s) => ({ traps: [...s.traps, t] })),
  springTrap: (id) => set((s) => ({ traps: s.traps.map((t) => (t.id === id ? { ...t, sprung: true } : t)) })),
  removeTrap: (id) => set((s) => ({ traps: s.traps.filter((t) => t.id !== id) })),
  reset: () => set({ pickups: [], traps: [] }),
}));
