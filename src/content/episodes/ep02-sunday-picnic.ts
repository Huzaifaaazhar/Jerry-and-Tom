import type { EpisodeDefinition } from '@engine/episode/types';

const P = Math.PI;

/** Episode 2 - daytime picnic heist in the backyard. Same engine, same house, new rules. */
const episode: EpisodeDefinition = {
  id: 'ep02-sunday-picnic',
  number: 2,
  title: 'Sunday Picnic',
  tagline: 'Sandwiches unattended. Bulldog on patrol.',
  description: 'The picnic is laid out in the backyard. Pip wants the sandwiches, Barnaby wants Pip, and Brick is wide awake and walking the lawn.',
  thumbnail: { motif: 'sun', sky: '#9fd8e6', ground: '#6fb34a' },
  environment: 'classic-house',
  lighting: 'day',
  cast: [
    { characterId: 'pip', playable: true, spawn: { position: [-13, 0, 29.5], facing: P / 2 }, respawn: { position: [-14.5, 0, 26.5], facing: P / 2 } },
    { characterId: 'barnaby', playable: true, spawn: { position: [0, 0, 10], facing: 0 }, respawn: { position: [0, 0, 10], facing: 0 } },
    { characterId: 'brick', playable: false, spawn: { position: [5, 0, 21], facing: P }, npc: { mode: 'patrol', home: [5, 24], leash: 8 } },
  ],
  sides: {
    pip: {
      brief: 'Swipe 3 picnic sandwiches and stash them back in the flower garden.',
      timeLimit: 240,
      charges: { bananaPeel: 4 },
      opponentAi: { skill: 0.75 },
      objectives: [
        { id: 'sandwiches', label: 'Swipe sandwiches', type: 'collect', itemType: 'sandwich', count: 3 },
        { id: 'stash', label: 'Stash them in the flower garden', type: 'reach', zoneId: 'garden', after: ['sandwiches'] },
        { id: 'taunt', label: 'Taunt Barnaby while he sees stars', type: 'count', event: 'taunt', who: 'player', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 2, reason: 'Caught twice!' }],
    },
    barnaby: {
      brief: 'Pip is pinching the picnic! Catch Pip twice - and stay out of Brick’s way.',
      timeLimit: 240,
      charges: { mousetrap: 2 },
      opponentAi: { skill: 0.7, collects: ['sandwich'], homeZone: 'garden' },
      objectives: [
        { id: 'catch', label: 'Catch Pip', type: 'count', event: 'catch', who: 'player', count: 2 },
        { id: 'sneaky', label: "Don't get walloped by Brick", type: 'avoid', event: 'pummeled', who: 'player', max: 0, optional: true },
      ],
      lose: [
        { type: 'opponentGoal', itemType: 'sandwich', count: 3, zoneId: 'garden', reason: 'Pip stashed the sandwiches.' },
        { type: 'count', event: 'pummeled', who: 'player', max: 2, reason: 'Brick walloped you twice.' },
      ],
    },
  },
  pickups: [
    { id: 'sw-grass', type: 'sandwich', position: [1.4, 0.05, 26.0] },
    { id: 'sw-bench', type: 'sandwich', position: [5.2, 0.8, 26.95] },
    { id: 'sw-tree', type: 'sandwich', position: [-1.2, 0.05, 22.6] },
    { id: 'sw-table', type: 'sandwich', position: [3.0, 1.42, 28.0] },
  ],
  events: [
    { id: 'open-back', when: { type: 'time', at: 0.2 }, do: [{ type: 'door', doorId: 'back-door', open: true }] },
    { id: 'brick-guard', sides: ['barnaby'], when: { type: 'time', at: 6 }, do: [{ type: 'toast', text: 'Brick is guarding the picnic. Keep your distance!', tone: 'gag' }] },
    { id: 'garden-home', sides: ['pip'], when: { type: 'objective', id: 'sandwiches' }, do: [{ type: 'toast', text: 'Lunch secured! Run for the flower garden!', tone: 'good' }, { type: 'music', intensity: 1 }] },
    { id: 'thirty', when: { type: 'time', at: 210 }, do: [{ type: 'toast', text: '30 seconds!', tone: 'bad' }] },
  ],
  audio: {
    music: { tempo: 126, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], motif: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 6, 6, -1] },
  },
  ending: {
    win: {
      pip: { title: 'Picnic for one', caption: 'Pip lounges among the tulips with a three-sandwich stack.' },
      barnaby: { title: 'Picnic protected', caption: 'Barnaby saved lunch. Nobody thanked him, but he knows.' },
    },
    lose: {
      pip: { title: 'Lunch interrupted', caption: 'Barnaby caught the sandwich bandit. Use the hedges and the bulldog next time.' },
      barnaby: { title: 'Sandwich heist', caption: 'Pip got away with lunch while Barnaby dodged a very awake bulldog.' },
    },
  },
};
export default episode;
