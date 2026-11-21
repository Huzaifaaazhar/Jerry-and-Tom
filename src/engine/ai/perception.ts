/** Vision (cone + line of sight raycast) and hearing for AI agents. */
import type { World as RapierWorld } from '@dimforge/rapier3d-compat';
import type RAPIER from '@dimforge/rapier3d-compat';
import { world, type AgentState, type Noise } from '../core/world';
import type { CharacterDefinition } from '../characters/types';
import { groups } from '../core/physics';
import { wrapAngle } from '../core/math';

export interface PhysicsQuery {
  world: RapierWorld;
  rapier: typeof RAPIER;
}

export function lineOfSight(q: PhysicsQuery, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  const ray = new q.rapier.Ray(from, { x: dx / d, y: dy / d, z: dz / d });
  const hit = q.world.castRay(ray, d, true, undefined, groups.rayNoDoors);
  if (hit && hit.timeOfImpact < d - 0.25) return false;
  // Closed doors block sight too.
  const hitDoor = q.world.castRay(ray, d, true, undefined, groups.ray);
  return !(hitDoor && hitDoor.timeOfImpact < d - 0.25);
}

export function canSee(q: PhysicsQuery, self: AgentState, def: CharacterDefinition, target: AgentState): boolean {
  if (target.status.hiddenIn || target.status.respawnAt !== null) return false;
  const dx = target.position.x - self.position.x;
  const dz = target.position.z - self.position.z;
  const d = Math.hypot(dx, dz);
  let range = def.perception.viewDistance;
  if (target.sneaking) range *= 0.55;
  if (d > range) return false;
  if (d > 1.6) {
    const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - self.facing));
    if (ang > ((def.perception.fov * Math.PI) / 180) / 2) return false;
  }
  const eye = { x: self.position.x, y: self.position.y + self.height * 0.3, z: self.position.z };
  const tgt = { x: target.position.x, y: target.position.y, z: target.position.z };
  return lineOfSight(q, eye, tgt);
}

export function hear(self: AgentState, def: CharacterDefinition, filter?: (n: Noise) => boolean): Noise | null {
  let best: Noise | null = null;
  let bestScore = 0;
  for (const n of world.noises) {
    if (n.sourceId === self.id || world.time - n.time > 0.5) continue;
    if (filter && !filter(n)) continue;
    const d = n.position.distanceTo(self.position);
    const reach = n.radius * def.perception.hearing;
    if (d > reach) continue;
    const score = reach - d;
    if (score > bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}
