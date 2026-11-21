/** Brain contract: an AI reads the world through BrainContext and writes its agent's intent. */
import type { AgentState } from '../core/world';
import type { CharacterDefinition } from '../characters/types';
import type { NavGrid } from './navgrid';
import type { EnvironmentDefinition, XZ } from '../environment/types';
import type { PhysicsQuery } from './perception';

export interface NpcOptions {
  /** guardian: start asleep at home, patrol an area, or guard a point. */
  mode?: 'sleep' | 'patrol' | 'guard' | 'roam';
  home?: XZ;
  /** Radius around home this NPC will not leave (except when chasing). */
  leash?: number;
  /** 0..1 how aggressive / skilled the AI is (episode difficulty). */
  skill?: number;
  /** Pickup types this NPC tries to collect (prey). */
  collects?: string[];
  /** Zone id prey returns to after collecting everything. */
  homeZone?: string;
  /** Seconds at the start of a match during which a hunter ignores its prey. */
  grace?: number;
}

export interface BrainContext {
  self: AgentState;
  def: CharacterDefinition;
  nav: NavGrid;
  env: EnvironmentDefinition;
  physics: PhysicsQuery;
  dt: number;
  options: NpcOptions;
  rng: () => number;
}

export interface Brain {
  update(ctx: BrainContext): void;
}
