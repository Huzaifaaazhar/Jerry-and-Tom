/** Gather every static obstacle box of an environment (walls + prop colliders) in world space. */
import { wallBoxes, transformBox } from './geometry';
import { getPropType } from './propRegistry';
import type { BoxSpec, EnvironmentDefinition, PropPlacement } from './types';

export function placementBoxes(p: PropPlacement): BoxSpec[] {
  const def = getPropType(p.type);
  if (!def) return [];
  return def.colliders(p).map((b) => transformBox(b, p.position, p.rotation ?? 0, p.scale ?? 1));
}

/** Stable id for a placed prop (explicit id or type + index). */
export const placementId = (p: PropPlacement, index: number) => p.id ?? `${p.type}-${index}`;

export function collectObstacleBoxes(env: EnvironmentDefinition, extraProps: PropPlacement[] = [], removed: Set<string> = new Set()): BoxSpec[] {
  const boxes: BoxSpec[] = [];
  for (const w of env.walls) boxes.push(...wallBoxes(w, env.wallHeight));
  [...env.props, ...extraProps].forEach((p, i) => {
    if (!removed.has(placementId(p, i))) boxes.push(...placementBoxes(p));
  });
  return boxes;
}
