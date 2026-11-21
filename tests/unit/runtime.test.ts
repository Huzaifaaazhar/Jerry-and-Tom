import { describe, expect, it, vi } from 'vitest';
import { EpisodeRuntime } from '../../src/engine/episode/runtime';
import type { EpisodeDefinition } from '../../src/engine/episode/types';

const ep: EpisodeDefinition = {
  id: 'test',
  number: 99,
  title: 'Test',
  tagline: '',
  description: '',
  thumbnail: { motif: 'sun', sky: '#fff', ground: '#0f0' },
  environment: 'x',
  lighting: 'day',
  cast: [
    { characterId: 'mouse', playable: true, spawn: { position: [0, 0, 0] } },
    { characterId: 'cat', playable: true, spawn: { position: [5, 0, 0] } },
    { characterId: 'dog', playable: false, spawn: { position: [9, 0, 0] } },
  ],
  sides: {
    mouse: {
      brief: '',
      timeLimit: 60,
      objectives: [
        { id: 'cheese', label: 'Cheese', type: 'collect', itemType: 'cheese', count: 2 },
        { id: 'home', label: 'Home', type: 'reach', zoneId: 'hole', after: ['cheese'] },
        { id: 'slip', label: 'Slip', type: 'count', event: 'slipped', who: 'opponent', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 2, reason: 'caught' }],
    },
    cat: {
      brief: '',
      timeLimit: 60,
      objectives: [
        { id: 'catch', label: 'Catch', type: 'count', event: 'catch', who: 'player', count: 2 },
        { id: 'calm', label: 'No wallop', type: 'avoid', event: 'pummeled', who: 'player', max: 0, optional: true },
      ],
      lose: [{ type: 'opponentGoal', itemType: 'cheese', count: 2, zoneId: 'hole', reason: 'escaped' }],
    },
  },
  pickups: [],
  events: [
    { id: 'warn', when: { type: 'time', at: 30 }, do: [{ type: 'toast', text: 'half' }] },
    { id: 'dog', when: { type: 'event', event: 'enterRoom', who: 'player', roomId: 'yard' }, do: [{ type: 'wake', characterId: 'dog' }] },
  ],
  audio: { music: { tempo: 100, root: 60, scale: [0, 2, 4], motif: [0] } },
  ending: { win: {}, lose: {} },
};

const hooksFor = (player: string) => ({
  whoIs: (id: string) => ({ who: (id === player ? 'player' : id === 'dog' ? 'npc' : 'opponent') as 'player' | 'opponent' | 'npc', characterId: id }),
});

describe('EpisodeRuntime', () => {
  it('requires prerequisites before a reach objective counts', () => {
    const rt = new EpisodeRuntime(ep, 'mouse', hooksFor('mouse'));
    rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    expect(rt.objectiveViews().find((o) => o.id === 'home')!.done).toBe(false);
    rt.handleEvent({ type: 'pickup', agentId: 'mouse', pickupId: 'a', itemType: 'cheese' });
    rt.handleEvent({ type: 'pickup', agentId: 'mouse', pickupId: 'b', itemType: 'cheese' });
    expect(rt.result).toBeNull();
    rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    expect(rt.result?.outcome).toBe('win');
  });

  it('ignores pickups made by the opponent for player objectives', () => {
    const rt = new EpisodeRuntime(ep, 'mouse', hooksFor('mouse'));
    rt.handleEvent({ type: 'pickup', agentId: 'cat', pickupId: 'a', itemType: 'cheese' });
    expect(rt.progress(ep.sides.mouse.objectives[0]).progress).toBe(0);
  });

  it('loses when caught too many times', () => {
    const rt = new EpisodeRuntime(ep, 'mouse', hooksFor('mouse'));
    rt.handleEvent({ type: 'caught', catcherId: 'cat', targetId: 'mouse', position: [0, 0, 0] });
    expect(rt.result).toBeNull();
    rt.handleEvent({ type: 'caught', catcherId: 'cat', targetId: 'mouse', position: [0, 0, 0] });
    expect(rt.result).toEqual({ outcome: 'lose', reason: 'caught' });
  });

  it('counts catches for the catcher side', () => {
    const rt = new EpisodeRuntime(ep, 'cat', hooksFor('cat'));
    rt.handleEvent({ type: 'caught', catcherId: 'cat', targetId: 'mouse', position: [0, 0, 0] });
    rt.handleEvent({ type: 'caught', catcherId: 'cat', targetId: 'mouse', position: [0, 0, 0] });
    expect(rt.result?.outcome).toBe('win');
    expect(rt.bonusSummary()).toEqual([{ label: 'No wallop', done: true }]);
  });

  it('loses when the opponent collects everything and gets home afterwards', () => {
    const rt = new EpisodeRuntime(ep, 'cat', hooksFor('cat'));
    rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    rt.handleEvent({ type: 'pickup', agentId: 'mouse', pickupId: 'a', itemType: 'cheese' });
    rt.handleEvent({ type: 'pickup', agentId: 'mouse', pickupId: 'b', itemType: 'cheese' });
    expect(rt.result).toBeNull();
    rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    expect(rt.result?.outcome).toBe('lose');
  });

  it('fails avoid objectives once exceeded', () => {
    const rt = new EpisodeRuntime(ep, 'cat', hooksFor('cat'));
    rt.handleEvent({ type: 'pummeled', agentId: 'cat', byId: 'dog', position: [0, 0, 0] });
    expect(rt.objectiveViews().find((o) => o.id === 'calm')!.failed).toBe(true);
  });

  it('resolves the timer as a loss when required goals are missing', () => {
    const rt = new EpisodeRuntime(ep, 'mouse', hooksFor('mouse'));
    for (let i = 0; i < 61; i++) rt.tick(1);
    expect(rt.result?.outcome).toBe('lose');
    expect(rt.timeLeft).toBe(0);
  });

  it('fires timed and event-driven chase events exactly once', () => {
    const onAction = vi.fn();
    const rt = new EpisodeRuntime(ep, 'mouse', { ...hooksFor('mouse'), onAction });
    rt.tick(29);
    expect(onAction).not.toHaveBeenCalled();
    rt.tick(2);
    rt.tick(2);
    expect(onAction).toHaveBeenCalledTimes(1);
    rt.handleEvent({ type: 'enterRoom', agentId: 'mouse', roomId: 'yard' });
    rt.tick(0.1);
    rt.tick(0.1);
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction.mock.calls[1][0]).toEqual({ type: 'wake', characterId: 'dog' });
  });
});
