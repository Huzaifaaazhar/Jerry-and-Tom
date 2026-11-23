import type { EpisodeDefinition } from '@engine/episode/types';
import { registerEnvironment } from '@engine/episode/registry';
import { picnicHouse } from './environment';

registerEnvironment(picnicHouse);

const P = Math.PI;

/** Episode 2 - Sunday Picnic. Daytime backyard heist with a bulldog on patrol. */
const episode: EpisodeDefinition = {
  id: 'ep02-sunday-picnic',
  number: 2,
  title: 'Sunday Picnic',
  tagline: 'Sandwiches unattended. Bulldog on patrol.',
  description: 'The picnic is laid out in the backyard. Pip wants the sandwiches, Barnaby wants Pip, and Brick is wide awake and walking the lawn.',
  thumbnail: { motif: 'sun', sky: '#9fd8e6', ground: '#6fb34a' },
  difficulty: 2,
  estimatedMinutes: 8,
  unlock: { after: ['ep01-midnight-snack'] },
  environment: 'classic-house-picnic',
  lighting: 'day',
  hazards: [
    { kind: 'rake', position: [8.5, 0.01, 22.5] },
    { kind: 'rake', position: [-4.5, 0.01, 20.5] },
  ],
  collectibleType: 'goldenThimble',
  collectibles: [
    { id: 'thimble-yard-corner', position: [19.3, 0.1, 33.3] },
    { id: 'thimble-box', position: [-18.8, 0.1, 13.2] },
    { id: 'thimble-picnic-table', position: [2.2, 1.45, 28.3] },
    { id: 'thimble-bin', position: [8.0, 0.1, 11.4] },
  ],
  cast: [
    {
      characterId: 'pip',
      playable: true,
      variant: { hat: { type: 'sunHat', color: '#f5d142', band: '#e0452b' } },
      spawn: { position: [-13, 0, 29.5], facing: P / 2 },
      respawn: { position: [-14.5, 0, 27], facing: P / 2 },
    },
    { characterId: 'barnaby', playable: true, spawn: { position: [0, 0, 13.4], facing: 0 }, respawn: { position: [0, 0, 13.4], facing: 0 } },
    { characterId: 'brick', playable: false, spawn: { position: [5, 0, 21], facing: P }, npc: { mode: 'patrol', home: [5, 23.5], leash: 7 } },
  ],
  intro: {
    shots: [
      { target: [2, 0.5, 26], from: [-8, 9, 36], duration: 3, caption: 'Episode 2 · Sunday Picnic' },
      { focus: 'brick', duration: 2.4, caption: 'Brick is on picnic patrol.' },
      { focus: 'pip', duration: 2.4, caption: 'Pip is wearing a very sensible sun hat.' },
    ],
  },
  sides: {
    pip: {
      brief: 'Swipe the picnic sandwiches and stash them in the flower garden.',
      modeSummary: 'Dodge a patrolling bulldog and a sun-dozing cat in broad daylight.',
      timeLimit: 480,
      charges: { bananaPeel: 4 },
      opponentAi: { skill: 0.75, mode: 'sleep', grace: 0 },
      stages: [
        {
          id: 'to-picnic',
          title: 'Lunch is served',
          brief: 'Slip out of the garden and reach the picnic blanket. Brick patrols the lawn - he won’t hurt you, but he’s nosy.',
          checkpoint: { position: [-14.5, 0, 27], facing: P / 2 },
          objectives: [{ id: 'picnic', label: 'Reach the picnic', type: 'reach', zoneId: 'picnic' }],
        },
        {
          id: 'swipe',
          title: 'Sandwich swipe',
          brief: 'Grab three sandwiches. Barnaby is napping on the patio - keep it down.',
          checkpoint: { position: [-14.5, 0, 27], facing: P / 2 },
          onStart: [{ type: 'showPickups', group: 'sandwich' }],
          objectives: [{ id: 'sw', label: 'Swipe sandwiches', type: 'collect', itemType: 'sandwich', count: 3 }],
        },
        {
          id: 'nap-over',
          title: 'Nap’s over',
          brief: 'Barnaby smelled the tuna salad. Get out of his sight for a while.',
          checkpoint: { position: [-14.5, 0, 27], facing: P / 2 },
          onStart: [
            { type: 'npc', characterId: 'barnaby', command: { type: 'alert' } },
            { type: 'cutscene', shots: [{ focus: 'barnaby', duration: 1.8, caption: 'Barnaby smells tuna salad…' }] },
          ],
          onResume: [{ type: 'teleport', characterId: 'pip', position: [3, 0, 24], facing: 0 }],
          objectives: [{ id: 'lose', label: 'Stay out of Barnaby’s sight', type: 'metric', metric: 'unseen', target: 7 }],
        },
        {
          id: 'stash',
          title: 'Stash run',
          brief: 'Run the sandwiches back to the flower garden before Barnaby corners you!',
          timeLimit: 60,
          timeoutReason: 'Barnaby blocked the way to the garden.',
          checkpoint: { position: [10, 0, 30], facing: P },
          onStart: [
            { type: 'npc', characterId: 'barnaby', command: { type: 'hunt' } },
            { type: 'music', intensity: 1 },
          ],
          objectives: [{ id: 'garden', label: 'Reach the flower garden', type: 'reach', zoneId: 'garden' }],
        },
      ],
      objectives: [
        { id: 'taunt', label: 'Taunt Barnaby while he sees stars', type: 'count', event: 'taunt', who: 'player', count: 1, optional: true },
        { id: 'wallop', label: 'Get Barnaby walloped by Brick', type: 'count', event: 'pummeled', who: 'opponent', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 2, reason: 'Caught twice!' }],
    },
    barnaby: {
      brief: 'Somebody is pinching the picnic. Catch them - and stay out of Brick’s way.',
      modeSummary: 'Hunt a mouse across an open lawn guarded by a very awake bulldog.',
      timeLimit: 480,
      charges: { mousetrap: 2 },
      opponentAi: { skill: 0.7, collects: ['sandwich'], homeZone: 'garden' },
      stages: [
        {
          id: 'patrol',
          title: 'Sunny patrol',
          brief: 'Stroll out to the picnic. Brick is guarding the lawn - give him room.',
          onStart: [{ type: 'npc', characterId: 'pip', command: { type: 'hideIn', spotId: 'hide-picnic-basket' } }],
          objectives: [{ id: 'picnic', label: 'Check on the picnic', type: 'reach', zoneId: 'picnic' }],
        },
        {
          id: 'thief',
          title: 'Picnic thief',
          brief: 'The basket wobbled! Find the sandwich thief.',
          checkpoint: { position: [2.5, 0, 22], facing: 0 },
          onStart: [
            { type: 'teleport', characterId: 'pip', position: [0.6, 0, 26.2], facing: 0 },
            { type: 'npc', characterId: 'pip', command: { type: 'mode', mode: 'forage' } },
            { type: 'showPickups', group: 'sandwich' },
            { type: 'cutscene', shots: [{ focus: 'pip', duration: 2, caption: 'Somebody’s after the sandwiches!' }] },
          ],
          objectives: [{ id: 'spot', label: 'Spot Pip', type: 'metric', metric: 'seesOpponent', target: 1 }],
        },
        {
          id: 'catch',
          title: 'Catch!',
          brief: 'Catch Pip. Pounce with F - but don’t chase him into Brick.',
          checkpoint: { position: [2.5, 0, 22], facing: 0 },
          opponentRespawn: { position: [12, 0, 31], facing: P },
          onResume: [
            { type: 'teleport', characterId: 'pip', position: [0.6, 0, 26.2], facing: 0 },
            { type: 'npc', characterId: 'pip', command: { type: 'mode', mode: 'forage' } },
            { type: 'showPickups', group: 'sandwich' },
          ],
          objectives: [{ id: 'c1', label: 'Catch Pip', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
        {
          id: 'garden-chase',
          title: 'Garden chase',
          brief: 'Pip is making a run for the flower garden. Catch them first!',
          timeLimit: 60,
          timeoutReason: 'Pip vanished among the tulips.',
          checkpoint: { position: [9, 0, 20.5], facing: P / 2 },
          opponentRespawn: { position: [17, 0, 15], facing: -P / 2 },
          onStart: [
            { type: 'teleport', characterId: 'pip', position: [17, 0, 15], facing: -P / 2 },
            { type: 'teleport', characterId: 'barnaby', position: [9, 0, 20.5], facing: P / 2 },
            { type: 'npc', characterId: 'pip', command: { type: 'runTo', zoneId: 'garden' } },
            { type: 'cutscene', shots: [{ focus: 'pip', duration: 1.8, caption: 'Pip makes a break for the flower garden!' }] },
            { type: 'music', intensity: 1 },
          ],
          lose: [{ type: 'count', event: 'enterZone', who: 'opponent', zoneId: 'garden', max: 1, reason: 'Pip reached the flower garden.' }],
          objectives: [{ id: 'c2', label: 'Catch Pip before the garden', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
      ],
      objectives: [
        { id: 'sneaky', label: "Don't get walloped by Brick", type: 'avoid', event: 'pummeled', who: 'player', max: 0, optional: true },
        { id: 'snap', label: 'Snap Pip in a mousetrap', type: 'count', event: 'trapped', who: 'opponent', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'pummeled', who: 'player', max: 2, reason: 'Brick walloped you twice.' }],
    },
  },
  achievements: [
    { id: 'pip-picnic', title: 'Picnic for one', description: 'Finish Sunday Picnic as Pip.', side: 'pip', condition: { type: 'win' } },
    { id: 'barnaby-picnic', title: 'Lunch guard', description: 'Finish Sunday Picnic as Barnaby.', side: 'barnaby', condition: { type: 'win' } },
    { id: 'dodged-dog', title: 'Dodged the dog', description: 'Win as Barnaby without Brick walloping you.', side: 'barnaby', condition: { type: 'winWithout', event: 'pummeled', who: 'player' } },
    { id: 'picnic-thimbles', title: 'Lawn detective', description: 'Find all four golden thimbles around the yard.', condition: { type: 'allCollectibles' } },
  ],
  challenges: [
    { id: 'pip-picnic-speed', title: 'Fast food', description: 'Win as Pip in under 4 minutes.', side: 'pip', condition: { type: 'winUnder', seconds: 240 } },
    { id: 'barnaby-picnic-speed', title: 'Lightning lunch', description: 'Win as Barnaby in under 3 minutes 20.', side: 'barnaby', condition: { type: 'winUnder', seconds: 200 } },
    { id: 'picnic-perfect', title: 'Perfect picnic', description: 'Win with every bonus goal ticked.', condition: { type: 'allBonus' } },
  ],
  pickups: [
    { id: 'sw-grass', type: 'sandwich', position: [1.4, 0.05, 23.6], group: 'sandwich' },
    { id: 'sw-bench', type: 'sandwich', position: [5.2, 0.8, 26.95], group: 'sandwich' },
    { id: 'sw-tree', type: 'sandwich', position: [-1.2, 0.05, 22.6], group: 'sandwich' },
    { id: 'sw-table', type: 'sandwich', position: [3.0, 1.42, 28.0], group: 'sandwich' },
  ],
  events: [
    { id: 'open-back', when: { type: 'time', at: 0.2 }, do: [{ type: 'door', doorId: 'back-door', open: true }] },
    { id: 'thirty', when: { type: 'time', at: 450 }, do: [{ type: 'toast', text: '30 seconds until the picnic’s over!', tone: 'bad' }] },
  ],
  audio: {
    ambience: 'day',
    music: { tempo: 126, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], motif: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 6, 6, -1] },
  },
  ending: {
    win: {
      pip: { title: 'Picnic for one', caption: 'Pip lounges among the tulips with a three-sandwich stack and a sun hat.' },
      barnaby: { title: 'Picnic protected', caption: 'Barnaby saved lunch. Nobody thanked him, but he knows.' },
    },
    lose: {
      pip: { title: 'Lunch interrupted', caption: 'Barnaby caught the sandwich bandit. Use the hedges - and the bulldog - next time.' },
      barnaby: { title: 'Sandwich heist', caption: 'Pip got away with lunch while Barnaby dodged a very awake bulldog.' },
    },
  },
};
export default episode;
