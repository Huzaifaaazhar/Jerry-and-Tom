import { describe, expect, it, vi } from 'vitest';
import { EpisodeRuntime } from '../../src/engine/episode/runtime';
import type { EpisodeDefinition, MetricName } from '../../src/engine/episode/types';

const base: Omit<EpisodeDefinition, 'sides'> = {
  id: 'stages',
  number: 98,
  title: 'Stages',
  tagline: '',
  description: '',
  difficulty: 1,
  estimatedMinutes: 5,
  thumbnail: { motif: 'moon', sky: '#000', ground: '#0f0' },
  environment: 'x',
  lighting: 'night',
  cast: [
    { characterId: 'mouse', playable: true, spawn: { position: [0, 0, 0] } },
    { characterId: 'cat', playable: true, spawn: { position: [5, 0, 0] } },
  ],
  pickups: [],
  events: [],
  audio: { music: { tempo: 100, root: 60, scale: [0], motif: [0] } },
  ending: { win: {}, lose: {} },
};

const ep: EpisodeDefinition = {
  ...base,
  sides: {
    cat: {
      brief: '',
      timeLimit: 600,
      stages: [
        {
          id: 'look',
          title: 'Look',
          brief: '',
          onStart: [{ type: 'toast', text: 'stage one' }],
          objectives: [{ id: 'spot', label: 'Spot', type: 'metric', metric: 'seesOpponent', target: 1 }],
        },
        {
          id: 'catch',
          title: 'Catch',
          brief: '',
          onStart: [{ type: 'npc', characterId: 'mouse', command: { type: 'runTo', zoneId: 'hole' } }],
          objectives: [{ id: 'c', label: 'Catch', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
        {
          id: 'final',
          title: 'Final',
          brief: '',
          timeLimit: 20,
          timeoutReason: 'too slow',
          lose: [{ type: 'count', event: 'enterZone', who: 'opponent', zoneId: 'hole', max: 1, reason: 'escaped' }],
          objectives: [{ id: 'c2', label: 'Catch again', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
      ],
      objectives: [{ id: 'bonus', label: 'Bonus', type: 'avoid', event: 'splat', who: 'player', max: 0, optional: true }],
      lose: [],
    },
    mouse: {
      brief: '',
      timeLimit: 600,
      stages: [
        { id: 'go', title: 'Go', brief: '', objectives: [{ id: 'r', label: 'Reach', type: 'reach', zoneId: 'kitchen' }] },
        { id: 'hide', title: 'Hide', brief: '', objectives: [{ id: 'h', label: 'Stay hidden', type: 'metric', metric: 'hiddenSeconds', target: 5 }] },
      ],
      objectives: [],
      lose: [],
    },
  },
};

function make(player: 'cat' | 'mouse', metrics: Partial<Record<MetricName, number>> = {}, zones: Set<string> = new Set()) {
  const onAction = vi.fn();
  const onStage = vi.fn();
  const rt = new EpisodeRuntime(ep, player, {
    whoIs: (id) => ({ who: id === player ? 'player' : 'opponent', characterId: id }),
    onAction,
    onStage,
    metric: (n) => metrics[n] ?? 0,
    inZone: (z) => zones.has(z),
  });
  return { rt, onAction, onStage, metrics, zones };
}

const catchEvent = { type: 'caught' as const, catcherId: 'cat', targetId: 'mouse', position: [0, 0, 0] as [number, number, number] };

describe('mission stages', () => {
  it('starts the first stage on the first tick and fires its actions', () => {
    const { rt, onAction, onStage } = make('cat');
    expect(rt.stageInfo()?.id).toBe('look');
    rt.tick(0.1);
    expect(onStage).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ type: 'toast', text: 'stage one' }, { kind: 'stage', id: 'look' });
  });

  it('advances through stages in order and wins after the last one', () => {
    const m = make('cat');
    m.rt.tick(0.1);
    m.metrics.seesOpponent = 1;
    m.rt.tick(0.1);
    expect(m.rt.stageInfo()?.id).toBe('catch');
    expect(m.onAction).toHaveBeenCalledWith({ type: 'npc', characterId: 'mouse', command: { type: 'runTo', zoneId: 'hole' } }, { kind: 'stage', id: 'catch' });
    m.rt.handleEvent(catchEvent);
    expect(m.rt.stageInfo()?.id).toBe('final');
    // The catch that finished stage 2 must not count for stage 3.
    expect(m.rt.objectiveViews()[0].progress).toBe(0);
    m.rt.handleEvent(catchEvent);
    expect(m.rt.result?.outcome).toBe('win');
    expect(m.rt.stagesCompleted()).toBe(3);
  });

  it('applies stage-only lose conditions with zone filters', () => {
    const m = make('cat');
    m.rt.tick(0.1);
    // Before the final stage, the opponent entering the hole does not matter.
    m.rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    expect(m.rt.result).toBeNull();
    m.rt.skipToStage(2);
    m.rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'elsewhere' });
    expect(m.rt.result).toBeNull();
    m.rt.handleEvent({ type: 'enterZone', agentId: 'mouse', zoneId: 'hole' });
    expect(m.rt.result).toEqual({ outcome: 'lose', reason: 'escaped' });
  });

  it('loses when a stage timer runs out', () => {
    const m = make('cat');
    m.rt.skipToStage(2);
    for (let i = 0; i < 21; i++) m.rt.tick(1);
    expect(m.rt.result).toEqual({ outcome: 'lose', reason: 'too slow' });
  });

  it('completes reach objectives when the player is already standing in the zone', () => {
    const m = make('mouse');
    m.rt.tick(0.1);
    m.zones.add('kitchen');
    m.rt.tick(0.1);
    expect(m.rt.stageInfo()?.id).toBe('hide');
  });

  it('tracks live metrics for progress and latches completion', () => {
    const m = make('mouse');
    m.rt.skipToStage(1);
    m.metrics.hiddenSeconds = 3.4;
    m.rt.tick(0.1);
    expect(m.rt.objectiveViews()[0].progress).toBeCloseTo(3.4);
    m.metrics.hiddenSeconds = 5.2;
    m.rt.tick(0.1);
    expect(m.rt.result?.outcome).toBe('win');
  });

  it('reports global objectives as bonus goals in staged episodes', () => {
    const m = make('cat');
    m.rt.tick(0.1);
    const bonus = m.rt.objectiveViews().find((o) => o.id === 'bonus')!;
    expect(bonus.optional).toBe(true);
    m.rt.handleEvent({ type: 'splat', agentId: 'cat', cause: 'door', position: [0, 0, 0] });
    expect(m.rt.bonusSummary()).toEqual([{ label: 'Bonus', done: false }]);
  });
});
