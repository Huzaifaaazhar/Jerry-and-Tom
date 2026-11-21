/**
 * Episode validation: catches broken content before players do. Used by unit tests and run in
 * development at startup. Checks references, spawn points and that every required pickup and
 * zone is actually reachable for the characters who need it.
 */
import type { EpisodeDefinition } from './types';
import { getEnvironment, allEpisodes } from './registry';
import { hasCharacter, getCharacter } from '../characters/registry';
import { getItem, getTrap } from '../interaction/items';
import { getPropType } from '../environment/propRegistry';
import { collectObstacleBoxes } from '../environment/collect';
import { NavGrid } from '../ai/navgrid';

export function validateEpisode(ep: EpisodeDefinition): string[] {
  const errors: string[] = [];
  let env;
  try {
    env = getEnvironment(ep.environment);
  } catch {
    return [`${ep.id}: unknown environment "${ep.environment}"`];
  }
  if (!env.lighting[ep.lighting]) errors.push(`${ep.id}: unknown lighting preset "${ep.lighting}"`);
  for (const p of [...env.props, ...(ep.extraProps ?? [])]) if (!getPropType(p.type)) errors.push(`${ep.id}: unknown prop type "${p.type}"`);
  for (const c of ep.cast) if (!hasCharacter(c.characterId)) errors.push(`${ep.id}: unknown character "${c.characterId}"`);
  const playable = ep.cast.filter((c) => c.playable);
  if (playable.length < 1) errors.push(`${ep.id}: needs at least one playable character`);
  for (const c of playable) if (!ep.sides[c.characterId]) errors.push(`${ep.id}: playable "${c.characterId}" has no side config`);
  for (const id of Object.keys(ep.sides)) if (!playable.some((c) => c.characterId === id)) errors.push(`${ep.id}: side "${id}" is not a playable cast member`);
  for (const p of ep.pickups) if (!getItem(p.type)) errors.push(`${ep.id}: unknown item type "${p.type}"`);
  const zoneIds = new Set(env.zones.map((z) => z.id));
  for (const [sideId, side] of Object.entries(ep.sides)) {
    const lists = [side.objectives, ...(side.stages ?? []).map((st) => st.objectives)];
    if (side.stages) {
      const ids = side.stages.map((st) => st.id);
      if (new Set(ids).size !== ids.length) errors.push(`${ep.id}/${sideId}: duplicate stage ids`);
      for (const st of side.stages) {
        if (!st.objectives.some((o) => !o.optional)) errors.push(`${ep.id}/${sideId}: stage "${st.id}" has no required objectives`);
        for (const a of st.onStart ?? []) {
          if ((a.type === 'npc' || a.type === 'teleport' || a.type === 'wake') && !ep.cast.some((c) => c.characterId === a.characterId)) errors.push(`${ep.id}/${sideId}: stage "${st.id}" targets unknown cast member "${a.characterId}"`);
          if (a.type === 'showPickups' && !ep.pickups.some((p) => p.group === a.group)) errors.push(`${ep.id}/${sideId}: stage "${st.id}" reveals empty pickup group "${a.group}"`);
          if (a.type === 'npc' && a.command.type === 'runTo' && !zoneIds.has(a.command.zoneId)) errors.push(`${ep.id}/${sideId}: unknown zone "${a.command.zoneId}"`);
        }
      }
    }
    for (const list of lists) {
    const objIds = new Set(list.map((o) => o.id));
    for (const o of list) {
      if (o.type === 'reach' && !zoneIds.has(o.zoneId)) errors.push(`${ep.id}/${sideId}: objective "${o.id}" uses unknown zone "${o.zoneId}"`);
      if (o.type === 'reach') for (const a of o.after ?? []) if (!objIds.has(a)) errors.push(`${ep.id}/${sideId}: "${o.id}" waits for unknown objective "${a}"`);
      if (o.type === 'collect') {
        const n = ep.pickups.filter((p) => p.type === o.itemType).length;
        if (n < o.count) errors.push(`${ep.id}/${sideId}: needs ${o.count} ${o.itemType} but only ${n} are placed`);
      }
    }
    }
    if (!side.stages?.length && !side.objectives.some((o) => !o.optional)) errors.push(`${ep.id}/${sideId}: no required objectives`);
    for (const k of Object.keys(side.charges ?? {})) if (!getTrap(k)) errors.push(`${ep.id}/${sideId}: unknown trap item "${k}"`);
  }
  // Library metadata
  if (![1, 2, 3].includes(ep.difficulty)) errors.push(`${ep.id}: difficulty must be 1, 2 or 3`);
  if (!(ep.estimatedMinutes > 0)) errors.push(`${ep.id}: estimatedMinutes must be positive`);
  for (const id of ep.unlock?.after ?? []) {
    if (id === ep.id) errors.push(`${ep.id}: cannot unlock after itself`);
    else if (!allEpisodes().some((e) => e.id === id)) errors.push(`${ep.id}: unlock refers to unknown episode "${id}"`);
  }
  const playableIds = new Set(playable.map((c) => c.characterId));
  for (const a of [...(ep.achievements ?? []), ...(ep.challenges ?? [])]) {
    if (a.side && !playableIds.has(a.side)) errors.push(`${ep.id}: achievement "${a.id}" is for non-playable "${a.side}"`);
    if (a.condition.type === 'allCollectibles' && !ep.collectibles?.length) errors.push(`${ep.id}: "${a.id}" needs collectibles`);
  }
  const allIds = [...(ep.achievements ?? []), ...(ep.challenges ?? [])].map((a) => a.id);
  if (new Set(allIds).size !== allIds.length) errors.push(`${ep.id}: duplicate achievement/challenge ids`);
  if (ep.collectibles?.length && !getItem(ep.collectibleType ?? 'goldenThimble')) errors.push(`${ep.id}: unknown collectible type`);
  for (const c of ep.cast) {
    const v = c.variant as Record<string, unknown> | undefined;
    if (v && Object.keys(v).some((k) => k !== 'hat' && k !== 'accessory')) errors.push(`${ep.id}: variants may only change hat/accessory for "${c.characterId}"`);
  }

  for (const ev of ep.events) if (ev.when.type === 'event' && ev.when.zoneId && !zoneIds.has(ev.when.zoneId)) errors.push(`${ep.id}: event "${ev.id}" uses unknown zone`);

  // Reachability on the navigation grid.
  const boxes = collectObstacleBoxes(env, ep.extraProps);
  const navs = new Map<string, NavGrid>();
  const navFor = (charId: string) => {
    const def = getCharacter(charId);
    const key = def.body.radius <= 0.22 ? 'small' : 'large';
    if (!navs.has(key)) navs.set(key, new NavGrid(env.bounds, 0.25, key === 'small' ? { id: key, radius: 0.12, height: 0.56 } : { id: key, radius: 0.46, height: 1.5 }, boxes));
    return navs.get(key)!;
  };
  for (const c of ep.cast) {
    if (!hasCharacter(c.characterId)) continue;
    const nav = navFor(c.characterId);
    const [x, , z] = c.spawn.position;
    if (!nav.isFree(x, z) && !nav.nearestFree(x, z, 0.6)) errors.push(`${ep.id}: spawn of "${c.characterId}" is inside an obstacle`);
  }
  for (const c of playable) {
    if (!hasCharacter(c.characterId)) continue;
    const def = getCharacter(c.characterId);
    const nav = navFor(c.characterId);
    const from: [number, number] = [c.spawn.position[0], c.spawn.position[2]];
    for (const p of ep.pickups) {
      if (!getItem(p.type)?.collectors.includes(def.archetype)) continue;
      const path = nav.findPath(from, [p.position[0], p.position[2]]);
      const end = path?.[path.length - 1];
      if (!end || Math.hypot(end[0] - p.position[0], end[1] - p.position[2]) > 1.2) errors.push(`${ep.id}: pickup "${p.id}" unreachable for ${c.characterId}`);
    }
  }
  // Collectibles must be reachable by at least one playable character.
  for (const col of ep.collectibles ?? []) {
    const reachable = playable.some((c) => {
      if (!hasCharacter(c.characterId)) return true;
      const nav = navFor(c.characterId);
      const path = nav.findPath([c.spawn.position[0], c.spawn.position[2]], [col.position[0], col.position[2]]);
      const end = path?.[path.length - 1];
      return !!end && Math.hypot(end[0] - col.position[0], end[1] - col.position[2]) < 1.2;
    });
    if (!reachable) errors.push(`${ep.id}: collectible "${col.id}" is unreachable`);
  }
  return errors;
}
