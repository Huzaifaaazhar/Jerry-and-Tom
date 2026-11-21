import type { EpisodeDefinition } from './types';
import type { EnvironmentDefinition } from '../environment/types';

const episodes = new Map<string, EpisodeDefinition>();
const environments = new Map<string, EnvironmentDefinition>();

export function registerEpisode(ep: EpisodeDefinition) {
  episodes.set(ep.id, ep);
}
export function registerEnvironment(env: EnvironmentDefinition) {
  environments.set(env.id, env);
}
export function getEpisode(id: string) {
  const e = episodes.get(id);
  if (!e) throw new Error(`Episode "${id}" is not registered`);
  return e;
}
export function getEnvironment(id: string) {
  const e = environments.get(id);
  if (!e) throw new Error(`Environment "${id}" is not registered`);
  return e;
}
export function allEpisodes() {
  return [...episodes.values()].sort((a, b) => a.number - b.number);
}
export function allEnvironments() {
  return [...environments.values()];
}
