import { describe, expect, it } from 'vitest';
import '../../src/content';
import { allEpisodes } from '../../src/engine/episode/registry';
import { validateEpisode } from '../../src/engine/episode/validate';
import { allCharacters } from '../../src/engine/characters/registry';

describe('registered content', () => {
  it('registers at least one episode and the core cast', () => {
    expect(allEpisodes().length).toBeGreaterThanOrEqual(2);
    expect(allCharacters().map((c) => c.id).sort()).toEqual(['barnaby', 'brick', 'pip']);
  });

  for (const ep of allEpisodes()) {
    it(`episode "${ep.id}" passes validation (references, spawns, reachability)`, () => {
      expect(validateEpisode(ep)).toEqual([]);
    });
  }

  it('episode numbers are unique', () => {
    const nums = allEpisodes().map((e) => e.number);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
