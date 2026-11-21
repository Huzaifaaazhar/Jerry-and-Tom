/**
 * Prop type registry. Content registers furniture/garden asset types once; environments and
 * episodes then place them by id. A prop type declares its render component, colliders (shared
 * with navigation) and optional gameplay affordances (hide spot, knockable, pushable, surface).
 */
import type { ComponentType } from 'react';
import type { Archetype } from '../core/types';
import type { Vec3Tuple } from '../core/math';
import type { BoxSpec, PropPlacement } from './types';

export interface HideSpotDef {
  /** Where the hidden character sits (local). */
  offset: Vec3Tuple;
  /** Where they pop out (local). */
  exit: Vec3Tuple;
  archetypes: Archetype[];
  label: string;
}

export interface KnockableDef {
  label: string;
  /** Local position of the knockable object's centre. */
  offset: Vec3Tuple;
  size: Vec3Tuple;
  noiseRadius: number;
  Render: ComponentType<{ broken: boolean }>;
}

export interface PropTypeDef {
  id: string;
  label: string;
  Render: ComponentType<{ placement: PropPlacement }>;
  /** Static colliders in local space. */
  colliders: (p: PropPlacement) => BoxSpec[];
  hideSpot?: HideSpotDef;
  knockable?: KnockableDef;
  /** Whole prop is a dynamic rigid body that characters can shove. */
  pushable?: { mass: number };
  /** Optional local point AI and pickups can use as an elevated surface. */
  castShadow?: boolean;
}

const registry = new Map<string, PropTypeDef>();

export function registerProp(def: PropTypeDef) {
  registry.set(def.id, def);
}

export function getPropType(id: string): PropTypeDef | undefined {
  return registry.get(id);
}

export function allPropTypes() {
  return [...registry.values()];
}
