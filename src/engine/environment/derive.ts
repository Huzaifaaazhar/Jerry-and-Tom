/**
 * Build an episode-specific environment from a shared one: rearrange furniture, add new props,
 * remove props by id, add zones or lighting presets. The base environment is never mutated.
 */
import type { EnvironmentDefinition, LightingPreset, PropPlacement, ZoneSpec, XZ } from './types';

export interface EnvironmentPatch {
  id: string;
  name?: string;
  /** Prop placement ids (or `${type}-${index}` for unnamed ones) to remove from the base. */
  removeProps?: string[];
  addProps?: PropPlacement[];
  /** Move existing props by id. */
  moveProps?: Record<string, Partial<Pick<PropPlacement, 'position' | 'rotation'>>>;
  addZones?: ZoneSpec[];
  addPatrolPoints?: XZ[];
  lighting?: Record<string, LightingPreset>;
}

export function deriveEnvironment(base: EnvironmentDefinition, patch: EnvironmentPatch): EnvironmentDefinition {
  const remove = new Set(patch.removeProps ?? []);
  const props = base.props
    .map((p, i) => ({ p, id: p.id ?? `${p.type}-${i}` }))
    .filter(({ id }) => !remove.has(id))
    .map(({ p, id }) => (patch.moveProps?.[id] ? { ...p, ...patch.moveProps[id], id } : p));
  return {
    ...base,
    id: patch.id,
    name: patch.name ?? base.name,
    props: [...props, ...(patch.addProps ?? [])],
    zones: [...base.zones, ...(patch.addZones ?? [])],
    patrolPoints: [...base.patrolPoints, ...(patch.addPatrolPoints ?? [])],
    lighting: { ...base.lighting, ...(patch.lighting ?? {}) },
  };
}
