/** Turns device input into the player's ControlIntent (camera-relative) and handles interaction. */
import { input, consume } from '../input/input';
import { cameraState } from '../camera/ThirdPersonCamera';
import type { AgentState } from '../core/world';
import { world } from '../core/world';
import { interactions } from '../interaction/registry';
import { unhideAgent } from '../interaction/hiding';
import { grabbable, performCatch } from './rules';
import { getCharacter } from '../characters/registry';

export function updatePlayerIntent(agent: AgentState): string | null {
  const it = agent.intent;
  const yaw = cameraState.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  it.moveX = fx * input.move.y + rx * input.move.x;
  it.moveZ = fz * input.move.y + rz * input.move.x;
  it.sprint = input.held.sprint;
  it.sneak = input.held.sneak;
  it.jump = consume('jump');
  it.ability = consume('ability');
  it.trap = consume('trap');
  const interact = consume('interact');
  it.interact = interact;

  if (agent.status.hiddenIn) {
    const moving = Math.hypot(input.move.x, input.move.y) > 0.5;
    if (interact || it.jump || (moving && (agent.cooldowns.hideMoveGrace ?? 0) < world.time)) unhideAgent(agent);
    it.moveX = it.moveZ = 0;
    it.jump = false;
    return 'Come out';
  }
  agent.cooldowns.hideMoveGrace = world.time + 0.35;
  if (world.isStunned(agent) || world.finished) return null;

  // Hunters: grabbing prey beats any other interaction.
  const prey = grabbable(agent);
  if (prey) {
    if (interact) {
      world.playOneShot(agent, 'grab', 0.3);
      performCatch(agent, prey);
    }
    return `Grab ${getCharacter(prey.characterId).name}!`;
  }
  const best = interactions.best(agent);
  if (best && interact) best.item.interact(agent);
  return best?.prompt ?? null;
}

/** Player face reacts to the situation (expression system hook). */
export function playerExpression(agent: AgentState) {
  let threat = Infinity;
  for (const a of world.agents.values()) {
    if (a === agent) continue;
    const hostile = (agent.archetype === 'prey' && a.archetype === 'hunter') || (agent.archetype === 'hunter' && a.archetype === 'guardian' && a.aiState === 'chase');
    if (hostile) threat = Math.min(threat, a.position.distanceTo(agent.position));
  }
  if (threat < 5) agent.anim.expression = 'scared';
  else if (agent.sneaking) agent.anim.expression = 'smug';
  else if (agent.sprinting) agent.anim.expression = agent.archetype === 'hunter' ? 'determined' : 'scared';
  else agent.anim.expression = 'neutral';
}
