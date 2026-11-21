/**
 * Gameplay rules shared by player and AI: abilities (pounce, taunt), trap placement and
 * triggering, catching prey, guardians pummelling hunters, pickups and room/zone tracking.
 */
import * as THREE from 'three';
import { world, type AgentState } from '../core/world';
import type { CharacterDefinition } from '../characters/types';
import { getCharacter } from '../characters/registry';
import { useItems, getTrap, getItem } from '../interaction/items';
import { audio } from '../audio/audio';
import { roomAt } from '../environment/geometry';
import type { EnvironmentDefinition } from '../environment/types';

let trapSeq = 0;

export function processAbilities(agent: AgentState, def: CharacterDefinition) {
  const it = agent.intent;
  const now = world.time;
  if (world.isStunned(agent) || agent.status.hiddenIn || world.finished) return;
  if (it.ability && def.ability && (agent.cooldowns.ability ?? 0) < now) {
    if (def.ability === 'pounce' && agent.grounded) {
      agent.status.action = 'pounce';
      agent.status.actionUntil = now + 0.42;
      agent.cooldowns.ability = now + 1.4;
      audio.play('whoosh');
      world.events.emit({ type: 'pounce', agentId: agent.id });
    } else if (def.ability === 'taunt') {
      agent.status.action = 'taunt';
      agent.status.actionUntil = now + 1.3;
      agent.cooldowns.ability = now + 4;
      audio.play('laugh', { pitch: def.voice.pitch });
      world.emitNoise(agent.position, 14, 'taunt', agent.id);
      world.events.emit({ type: 'taunt', agentId: agent.id, position: agent.position.toArray() as [number, number, number] });
    }
  }
  if (it.trap && def.trap && (agent.charges[def.trap.kind] ?? 0) > 0 && agent.grounded && (agent.cooldowns.trap ?? 0) < now) {
    agent.charges[def.trap.kind]--;
    agent.cooldowns.trap = now + 0.6;
    const back = new THREE.Vector3(-Math.sin(agent.facing), 0, -Math.cos(agent.facing)).multiplyScalar(agent.radius + 0.35);
    const pos = agent.position.clone().add(back);
    pos.y = agent.position.y - agent.height / 2 + 0.02;
    useItems.getState().addTrap({ id: `trap-${++trapSeq}`, kind: def.trap.kind, position: [pos.x, pos.y, pos.z], ownerId: agent.id, placedAt: now, sprung: false });
    world.playOneShot(agent, 'interact', 0.35);
    audio.play('place');
    world.events.emit({ type: 'trapPlaced', agentId: agent.id, trapKind: def.trap.kind, position: [pos.x, pos.y, pos.z] });
  }
  if (agent.status.actionUntil < now) agent.status.action = null;
}

/** Returns the prey agent the hunter can grab right now, if any. */
export function grabbable(hunter: AgentState, reach = 0.75): AgentState | null {
  if (hunter.archetype !== 'hunter' || world.isStunned(hunter) || hunter.status.hiddenIn) return null;
  let best: AgentState | null = null;
  let bestD = Infinity;
  for (const a of world.agents.values()) {
    if (a.archetype !== 'prey' || a.status.hiddenIn || a.status.respawnAt !== null) continue;
    if (a.status.invulnerableUntil > world.time) continue;
    const dy = Math.abs(a.position.y - a.height / 2 - (hunter.position.y - hunter.height / 2));
    const d = Math.hypot(a.position.x - hunter.position.x, a.position.z - hunter.position.z);
    if (dy < 1.3 && d < hunter.radius + a.radius + reach && d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

export function performCatch(hunter: AgentState, prey: AgentState) {
  world.playOneShot(hunter, 'celebrate', 1.1);
  world.flashExpression(hunter, 'happy', 1.6);
  world.playOneShot(prey, 'react', 1.0);
  world.flashExpression(prey, 'scared', 1.2);
  prey.status.respawnAt = world.time + 1.3;
  prey.status.invulnerableUntil = world.time + 4.3;
  audio.play('caught');
  audio.play(getCharacter(prey.characterId).voice.sound, { pitch: getCharacter(prey.characterId).voice.pitch });
  world.events.emit({ type: 'caught', catcherId: hunter.id, targetId: prey.id, position: prey.position.toArray() as [number, number, number] });
}

export function processRules(env: EnvironmentDefinition, onRespawn: (a: AgentState) => void) {
  const now = world.time;
  if (world.finished) return;
  const items = useItems.getState();

  for (const a of world.agents.values()) {
    // Respawn caught prey
    if (a.status.respawnAt !== null && a.status.respawnAt <= now) {
      a.status.respawnAt = null;
      onRespawn(a);
    }
    if (a.status.hiddenIn || a.status.respawnAt !== null) continue;

    // Pounce auto-catch on contact
    if (a.archetype === 'hunter' && a.status.action === 'pounce' && a.status.actionUntil > now) {
      const prey = grabbable(a, 0.9);
      if (prey) {
        a.status.actionUntil = now;
        performCatch(a, prey);
      }
    }

    // Guardian pummels hunters it is chasing
    if (a.archetype === 'guardian' && a.aiState === 'chase' && !world.isStunned(a)) {
      for (const h of world.agents.values()) {
        if (h.archetype !== 'hunter' || h.status.hiddenIn || h.status.invulnerableUntil > now) continue;
        if (h.position.distanceTo(a.position) < a.radius + h.radius + 0.55) {
          world.stun(h, 'pummel', 2.8);
          h.status.invulnerableUntil = now + 6;
          world.flashExpression(h, 'dizzy', 3);
          world.playOneShot(a, 'celebrate', 1.0);
          world.flashExpression(a, 'smug', 2);
          const push = h.position.clone().sub(a.position).setY(0).normalize().multiplyScalar(9);
          h.body?.setLinvel({ x: push.x, y: 6, z: push.z }, true);
          audio.play('pummel');
          audio.play('bark', { pitch: 0.8 });
          world.events.emit({ type: 'pummeled', agentId: h.id, byId: a.id, position: h.position.toArray() as [number, number, number] });
          a.aiState = 'satisfied';
        }
      }
    }

    // Traps
    for (const t of items.traps) {
      if (t.sprung) continue;
      const def = getTrap(t.kind);
      if (!def || !def.affects.includes(a.archetype)) continue;
      if (a.id === t.ownerId) continue;
      const feetY = a.position.y - a.height / 2;
      const d = Math.hypot(a.position.x - t.position[0], a.position.z - t.position[2]);
      if (d < def.radius + a.radius * 0.6 && Math.abs(feetY - t.position[1]) < 0.4 && !world.isStunned(a)) {
        items.springTrap(t.id);
        setTimeout(() => useItems.getState().removeTrap(t.id), 1500);
        world.stun(a, def.stunKind, def.stunSeconds);
        world.flashExpression(a, def.stunKind === 'slip' ? 'surprised' : 'dizzy', def.stunSeconds);
        audio.play(def.sound);
        audio.play(getCharacter(a.characterId).voice.sound, { pitch: getCharacter(a.characterId).voice.pitch });
        if (def.stunKind === 'slip') {
          const v = a.velocity;
          a.body?.setLinvel({ x: v.x * 1.4, y: 7, z: v.z * 1.4 }, true);
        }
        world.emitNoise(a.position, 10, def.sound, a.id);
        const ev = { agentId: a.id, position: [a.position.x, a.position.y, a.position.z] as [number, number, number] };
        if (def.stunKind === 'slip') world.events.emit({ type: 'slipped', ...ev });
        world.events.emit({ type: 'trapped', trapKind: t.kind, ...ev });
        // Everyone nearby on the other side laughs at the gag.
        for (const o of world.agents.values()) {
          if (o.id !== a.id && o.archetype !== a.archetype && o.position.distanceTo(a.position) < 12 && !o.isPlayer && !world.isStunned(o)) {
            world.playOneShot(o, 'laugh', 1.4);
          }
        }
      }
    }

    // Pickups
    for (const p of items.pickups) {
      if (p.collected) continue;
      const def = getItem(p.type);
      if (!def || !def.collectors.includes(a.archetype)) continue;
      const d = Math.hypot(a.position.x - p.position[0], a.position.z - p.position[2]);
      const dy = p.position[1] - (a.position.y - a.height / 2);
      if (d < a.radius + 0.55 && dy < 1.05 && dy > -0.6) {
        items.collect(p.id);
        audio.play('pickup', { pitch: 1 + Math.random() * 0.1 });
        world.flashExpression(a, 'happy', 1);
        world.events.emit({ type: 'pickup', agentId: a.id, pickupId: p.id, itemType: p.type });
      }
    }

    // Rooms & zones
    const room = roomAt(env.rooms, a.position.x, a.position.z);
    const rid = room?.id ?? null;
    if (rid !== a.roomId) {
      a.roomId = rid;
      if (rid) world.events.emit({ type: 'enterRoom', agentId: a.id, roomId: rid });
    }
    for (const z of env.zones) {
      const inside = Math.hypot(a.position.x - z.center[0], a.position.z - z.center[2]) < z.radius;
      const key = `zone:${z.id}`;
      const was = (a.cooldowns[key] ?? 0) > 0;
      if (inside && !was) world.events.emit({ type: 'enterZone', agentId: a.id, zoneId: z.id });
      a.cooldowns[key] = inside ? 1 : 0;
    }
  }
}
