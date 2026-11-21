/**
 * Global (cross-episode) character achievements, driven by lifetime statistics. Content registers
 * them; the progress system evaluates them after every run.
 */
export interface LifetimeAchievement {
  id: string;
  title: string;
  description: string;
  characterId: string;
  stat: string;
  count: number;
}

const registry = new Map<string, LifetimeAchievement>();
export const registerAchievement = (a: LifetimeAchievement) => registry.set(a.id, a);
export const allLifetimeAchievements = () => [...registry.values()];
