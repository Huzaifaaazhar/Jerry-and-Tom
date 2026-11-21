/**
 * EPISODE TEMPLATE - copy this folder to `src/content/episodes/epNN-your-title/` to start a new
 * episode. Folders whose name starts with "_" are ignored by the episode loader, so this template
 * is never shown in the game. Every field is documented in docs/ADDING_AN_EPISODE.md.
 *
 * Checklist:
 *   1. Rename the folder and set `id` (must match the folder name) and `number`.
 *   2. Pick an environment: reuse 'classic-house', or derive one in ./environment.ts.
 *   3. Fill in cast, spawns, stages (missions), pickups, events, audio, ending.
 *   4. `npm test` validates references, spawns and reachability; `npm run dev` to play it.
 */
import type { EpisodeDefinition } from '@engine/episode/types';
// import { registerEnvironment } from '@engine/episode/registry';
// import { myEnvironment } from './environment';
// registerEnvironment(myEnvironment);

const P = Math.PI;

const episode: EpisodeDefinition = {
  id: 'epNN-your-title',
  number: 99,
  title: 'Your Title',
  tagline: 'One line that sells the episode.',
  description: 'Two or three sentences for the episode library.',
  thumbnail: { motif: 'star', sky: '#9fd8e6', ground: '#6fb34a' },
  difficulty: 2,
  estimatedMinutes: 10,
  unlock: { after: ['ep02-sunday-picnic'] },
  environment: 'classic-house',
  lighting: 'day',
  extraProps: [],
  hazards: [],
  cast: [
    { characterId: 'pip', playable: true, spawn: { position: [-16.3, 0, 10.5], facing: P / 2 } },
    { characterId: 'barnaby', playable: true, spawn: { position: [11, 0, 8.6], facing: -P / 2 } },
    { characterId: 'brick', playable: false, spawn: { position: [12, 0, 24.2], facing: P }, npc: { mode: 'sleep', home: [12, 24.2], leash: 12 } },
  ],
  intro: { shots: [{ target: [0, 1, 5], from: [12, 16, 27], duration: 3, caption: 'Episode NN · Your Title' }] },
  sides: {
    pip: {
      brief: 'What the mouse has to do.',
      timeLimit: 480,
      charges: { bananaPeel: 3 },
      opponentAi: { skill: 0.7 },
      stages: [
        {
          id: 'first',
          title: 'First mission',
          brief: 'Shown on the mission banner.',
          objectives: [{ id: 'cheese', label: 'Collect cheese', type: 'collect', itemType: 'cheese', count: 1 }],
        },
      ],
      objectives: [],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 3, reason: 'Caught three times!' }],
    },
    barnaby: {
      brief: 'What the cat has to do.',
      timeLimit: 480,
      charges: { mousetrap: 2 },
      opponentAi: { skill: 0.7, collects: ['cheese'], homeZone: 'mouse-home' },
      stages: [
        {
          id: 'first',
          title: 'First mission',
          brief: 'Shown on the mission banner.',
          objectives: [{ id: 'catch', label: 'Catch Pip', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
      ],
      objectives: [],
      lose: [{ type: 'opponentGoal', itemType: 'cheese', count: 1, zoneId: 'mouse-home', reason: 'Pip got away with the cheese.' }],
    },
  },
  pickups: [{ id: 'cheese-1', type: 'cheese', position: [0.4, 0.05, 5.2] }],
  events: [],
  achievements: [{ id: 'template-win', title: 'Template hero', description: 'Win the episode.', condition: { type: 'win' } }],
  challenges: [],
  audio: { ambience: 'day', music: { tempo: 120, root: 57, scale: [0, 2, 4, 5, 7, 9, 11], motif: [0, 2, 4, 2, 0, -1, 4, -1] } },
  ending: {
    win: { pip: { title: 'Mouse wins', caption: 'Ending card text.' }, barnaby: { title: 'Cat wins', caption: 'Ending card text.' } },
    lose: { pip: { title: 'Mouse loses', caption: 'Ending card text.' }, barnaby: { title: 'Cat loses', caption: 'Ending card text.' } },
  },
};
export default episode;
