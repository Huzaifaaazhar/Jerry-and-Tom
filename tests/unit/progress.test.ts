import { describe, expect, it } from 'vitest';
import '../../src/content';
import { allEpisodes, getEpisode } from '../../src/engine/episode/registry';
import { emptySave, evaluateRun, isUnlocked, type RunReport } from '../../src/engine/progress/progress';
import { validateEpisode } from '../../src/engine/episode/validate';
import template from '../../src/content/episodes/_template/index';

const run = (over: Partial<RunReport> = {}): RunReport => ({
  episodeId: 'ep01-midnight-snack',
  characterId: 'pip',
  outcome: 'win',
  elapsed: 300,
  furthestStage: 5,
  counts: {},
  bonusAll: false,
  collectiblesFound: [],
  ...over,
});

describe('progress & unlocks', () => {
  it('starts with only Episode One unlocked', () => {
    const save = emptySave();
    expect(isUnlocked(getEpisode('ep01-midnight-snack'), save)).toBe(true);
    expect(isUnlocked(getEpisode('ep02-sunday-picnic'), save)).toBe(false);
  });

  it('completing Episode One unlocks Episode Two and records the run', () => {
    const { save, rewards } = evaluateRun(emptySave(), run(), allEpisodes());
    expect(rewards.unlockedEpisodes).toEqual(['ep02-sunday-picnic']);
    const side = save.episodes['ep01-midnight-snack'].sides.pip;
    expect(side).toMatchObject({ plays: 1, wins: 1, completed: true, bestTime: 300, furthestStage: 5 });
    expect(save.lastPlayed).toEqual({ episodeId: 'ep01-midnight-snack', characterId: 'pip' });
  });

  it('a loss records progress but unlocks nothing', () => {
    const { save, rewards } = evaluateRun(emptySave(), run({ outcome: 'lose', furthestStage: 2 }), allEpisodes());
    expect(rewards.unlockedEpisodes).toEqual([]);
    expect(save.episodes['ep01-midnight-snack'].sides.pip).toMatchObject({ completed: false, losses: 1, furthestStage: 2 });
  });

  it('awards side-specific achievements and challenges only once', () => {
    const first = evaluateRun(emptySave(), run({ elapsed: 200, counts: { 'caught:player': 0 } }), allEpisodes());
    const ids = first.rewards.achievements.map((a) => a.id);
    expect(ids).toContain('pip-win');
    expect(ids).toContain('pip-untouched');
    expect(ids).not.toContain('barnaby-win');
    expect(first.rewards.challenges.map((c) => c.id)).toEqual(['pip-speed']);
    const second = evaluateRun(first.save, run({ elapsed: 150 }), allEpisodes());
    expect(second.rewards.achievements).toEqual([]);
    expect(second.rewards.newBest).toBe(true);
    expect(second.save.episodes['ep01-midnight-snack'].sides.pip.bestTime).toBe(150);
  });

  it('keeps collectibles across runs and awards the full set', () => {
    const ep = getEpisode('ep01-midnight-snack');
    const ids = ep.collectibles!.map((c) => c.id);
    const a = evaluateRun(emptySave(), run({ outcome: 'lose', collectiblesFound: ids.slice(0, 3) }), allEpisodes());
    expect(a.rewards.collectibles).toBe(3);
    const b = evaluateRun(a.save, run({ outcome: 'lose', collectiblesFound: ids.slice(3) }), allEpisodes());
    expect(b.rewards.achievements.map((x) => x.id)).toContain('thimbles');
  });

  it('accumulates lifetime stats and lifetime achievements', () => {
    let save = emptySave();
    for (let i = 0; i < 2; i++) save = evaluateRun(save, run({ characterId: 'barnaby', counts: { 'catch:player': 5 } }), allEpisodes()).save;
    expect(save.stats.barnaby.catch).toBe(10);
    expect(save.achievements).toContain('barnaby-catcher');
  });

  it('the episode template is a valid episode configuration', () => {
    expect(validateEpisode(template)).toEqual([]);
  });
});
