import type { EpisodeDefinition } from '@engine/episode/types';

const P = Math.PI;

/** Episode 1 - a night-time cheese raid across the whole house. */
const episode: EpisodeDefinition = {
  id: 'ep01-midnight-snack',
  number: 1,
  title: 'Midnight Snack',
  tagline: 'The house is asleep. The cheese is not safe.',
  description: 'Pip plans a five-course cheese raid while Barnaby stands guard. Out back, Brick snores by his doghouse - one loud crash and he is up.',
  thumbnail: { motif: 'moon', sky: '#18243f', ground: '#2f8a84' },
  environment: 'classic-house',
  lighting: 'night',
  cast: [
    { characterId: 'pip', playable: true, spawn: { position: [-16.3, 0, 10.5], facing: P / 2 }, respawn: { position: [-16.3, 0, 10.5], facing: P / 2 } },
    { characterId: 'barnaby', playable: true, spawn: { position: [11, 0, 8.6], facing: -P / 2 }, respawn: { position: [11, 0, 8.6], facing: -P / 2 } },
    { characterId: 'brick', playable: false, spawn: { position: [12, 0, 24.2], facing: P }, npc: { mode: 'sleep', home: [12, 24.2], leash: 12 } },
  ],
  sides: {
    pip: {
      brief: 'Grab 5 cheese wedges around the house, then scurry home to your mouse hole.',
      timeLimit: 300,
      charges: { bananaPeel: 3 },
      opponentAi: { skill: 0.65 },
      objectives: [
        { id: 'cheese', label: 'Collect cheese', type: 'collect', itemType: 'cheese', count: 5 },
        { id: 'home', label: 'Get back to the mouse hole', type: 'reach', zoneId: 'mouse-home', after: ['cheese'] },
        { id: 'slips', label: 'Make Barnaby slip twice', type: 'count', event: 'slipped', who: 'opponent', count: 2, optional: true },
        { id: 'wallop', label: 'Get Barnaby walloped by Brick', type: 'count', event: 'pummeled', who: 'opponent', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 3, reason: 'Caught three times!' }],
    },
    barnaby: {
      brief: 'Pip is raiding the cheese! Catch that mouse 3 times before it gets home with the goods.',
      timeLimit: 300,
      charges: { mousetrap: 3 },
      opponentAi: { skill: 0.7, collects: ['cheese'], homeZone: 'mouse-home' },
      objectives: [
        { id: 'catch', label: 'Catch Pip', type: 'count', event: 'catch', who: 'player', count: 3 },
        { id: 'noWallop', label: "Don't get walloped by Brick", type: 'avoid', event: 'pummeled', who: 'player', max: 0, optional: true },
        { id: 'snap', label: 'Snap Pip in a mousetrap', type: 'count', event: 'trapped', who: 'opponent', count: 1, optional: true },
      ],
      lose: [
        { type: 'opponentGoal', itemType: 'cheese', count: 5, zoneId: 'mouse-home', reason: 'Pip made it home with all the cheese.' },
        { type: 'count', event: 'pummeled', who: 'player', max: 3, reason: 'Brick walloped you three times.' },
      ],
    },
  },
  pickups: [
    { id: 'cheese-kitchen', type: 'cheese', position: [14.6, 0.05, 10.3] },
    { id: 'cheese-dining', type: 'cheese', position: [0.4, 0.05, 5.2] },
    { id: 'cheese-armchair', type: 'cheese', position: [-15.5, 0.9, 7.5] },
    { id: 'cheese-bedroom', type: 'cheese', position: [-9.4, 0.05, -12.6] },
    { id: 'cheese-yard', type: 'cheese', position: [10.2, 0.05, 23.4] },
  ],
  events: [
    { id: 'yard-warning', sides: ['barnaby'], when: { type: 'event', event: 'enterRoom', who: 'player', roomId: 'yard' }, do: [{ type: 'toast', text: 'Shh… Brick is asleep out here. Tiptoe (Ctrl) past him!', tone: 'gag' }] },
    { id: 'kitchen-hint', sides: ['pip'], when: { type: 'event', event: 'enterRoom', who: 'player', roomId: 'kitchen' }, do: [{ type: 'toast', text: 'Something cheesy by the fridge…' }] },
    { id: 'all-cheese', sides: ['pip'], when: { type: 'objective', id: 'cheese' }, do: [{ type: 'toast', text: "That's the lot! Back to the mouse hole!", tone: 'good' }, { type: 'music', intensity: 1 }] },
    { id: 'brick-up', when: { type: 'event', event: 'npcState', who: 'npc:brick', state: 'alert' }, do: [{ type: 'toast', text: 'Brick is awake… and grumpy.', tone: 'bad' }, { type: 'shake', amount: 0.25 }] },
    { id: 'one-minute', when: { type: 'time', at: 240 }, do: [{ type: 'toast', text: 'One minute left!', tone: 'bad' }, { type: 'music', intensity: 0.8 }] },
  ],
  audio: {
    music: { tempo: 108, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], motif: [0, 2, 4, -1, 3, 2, 0, -1, 4, 5, 4, 2, -1, 0, -1, -1] },
  },
  ending: {
    win: {
      pip: { title: 'Home sweet hole', caption: 'Pip feasts on a midnight cheese platter while Barnaby explains the mess to nobody.' },
      barnaby: { title: 'Top cat', caption: 'The cheese is safe, the house is quiet, and Barnaby naps like a champion.' },
    },
    lose: {
      pip: { title: 'Cornered!', caption: 'Barnaby finally got his paws on the cheese thief. Try a sneakier route through the mouse holes.' },
      barnaby: { title: 'Outsmarted by a mouse', caption: 'Pip made it home with the goods. Barnaby will be sweeping crumbs all week.' },
    },
  },
};
export default episode;
