/** Hiding and searching rules, shared by player and AI. */
import * as THREE from 'three';
import { world, type AgentState } from '../core/world';
import { interactions, type HideSpot } from './registry';
import { audio } from '../audio/audio';

export function hideAgent(agent: AgentState, spot: HideSpot) {
  if (spot.occupant || agent.status.hiddenIn) return false;
  spot.occupant = agent.id;
  agent.status.hiddenIn = spot.id;
  agent.position.copy(spot.position);
  agent.velocity.set(0, 0, 0);
  if (agent.body) {
    agent.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    agent.body.setTranslation(spot.position, false);
    agent.body.setEnabled(false);
  }
  world.events.emit({ type: 'hide', agentId: agent.id, spotId: spot.id });
  audio.play('hide', { pitch: agent.archetype === 'prey' ? 1.4 : 0.8 });
  return true;
}

export function unhideAgent(agent: AgentState, flushed = false) {
  const spot = agent.status.hiddenIn ? interactions.hideSpots.get(agent.status.hiddenIn) : undefined;
  agent.status.hiddenIn = null;
  if (!spot) return;
  spot.occupant = null;
  const exit = spot.exit.clone().add(new THREE.Vector3(0, agent.height / 2, 0));
  agent.position.copy(exit);
  if (agent.body) {
    agent.body.setEnabled(true);
    agent.body.setTranslation(exit, true);
    agent.body.setLinvel({ x: 0, y: flushed ? 6 : 2, z: 0 }, true);
  }
  if (flushed) {
    world.playOneShot(agent, 'react', 0.7);
    world.flashExpression(agent, 'scared', 1.2);
    agent.status.invulnerableUntil = Math.max(agent.status.invulnerableUntil, world.time + 2.2);
  }
  world.events.emit({ type: 'unhide', agentId: agent.id, spotId: spot.id, flushed });
}

/** A hunter rummages through a hiding place. Flushes out whoever is inside. */
export function searchSpot(searcher: AgentState, spot: HideSpot) {
  world.playOneShot(searcher, 'interact', 0.6);
  audio.play('search');
  const occupant = spot.occupant ? world.agents.get(spot.occupant) : undefined;
  const found = !!occupant && occupant.archetype !== searcher.archetype;
  if (found && occupant) {
    unhideAgent(occupant, true);
    world.flashExpression(searcher, 'surprised', 0.8);
  }
  world.events.emit({ type: 'searched', agentId: searcher.id, spotId: spot.id, found });
  return found;
}

export function hidePrompt(agent: AgentState, spot: HideSpot): string | null {
  if (agent.status.hiddenIn === spot.id) return 'Come out';
  if (agent.status.hiddenIn) return null;
  if (spot.archetypes.includes(agent.archetype) && !spot.occupant) return spot.label;
  if (agent.archetype === 'hunter' && spot.searchable !== false) return `Search: ${spot.label.replace(/^Hide (in|under) /, '')}`;
  return null;
}

export function useHideSpot(agent: AgentState, spot: HideSpot) {
  if (agent.status.hiddenIn === spot.id) return unhideAgent(agent);
  if (spot.archetypes.includes(agent.archetype) && !spot.occupant) return void hideAgent(agent, spot);
  if (agent.archetype === 'hunter' && spot.searchable !== false) return void searchSpot(agent, spot);
}
