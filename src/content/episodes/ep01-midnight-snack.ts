import type { EpisodeDefinition } from '@engine/episode/types';

const P = Math.PI;

/**
 * Episode 1 - Midnight Snack. A full mission sequence for each side:
 *   intro → first encounter → chase through the rooms → environmental obstacle →
 *   hide-and-seek → final chase → ending.
 */
const episode: EpisodeDefinition = {
  id: 'ep01-midnight-snack',
  number: 1,
  title: 'Midnight Snack',
  tagline: 'The house is asleep. The cheese is not safe.',
  description:
    'Six missions across the whole house. Pip plans a midnight cheese raid; Barnaby is supposed to be on night watch. Out back, Brick snores by his doghouse - one loud crash and he is up.',
  thumbnail: { motif: 'moon', sky: '#18243f', ground: '#2f8a84' },
  environment: 'classic-house',
  lighting: 'night',
  extraProps: [
    { id: 'hall-barricade', type: 'barricade', position: [-5.5, 0, -4], rotation: P / 2 },
    { id: 'climb-books', type: 'bookStack', position: [-7.0, 0, -15.25] },
    { id: 'climb-box', type: 'cardboardBox', position: [-5.9, 0, -15.3] },
  ],
  hazards: [
    { kind: 'puddle', position: [15.6, 0.01, 5.0] },
    { kind: 'rake', position: [7.5, 0.01, 18.8] },
    { kind: 'rake', position: [-10.6, 0.01, 25.6] },
  ],
  cast: [
    { characterId: 'pip', playable: true, spawn: { position: [-16.3, 0, 10.5], facing: P / 2 }, respawn: { position: [-16.3, 0, 10.5], facing: P / 2 } },
    { characterId: 'barnaby', playable: true, spawn: { position: [-13.6, 0, 5.0], facing: P / 2 }, respawn: { position: [11, 0, 8.6], facing: -P / 2 } },
    { characterId: 'brick', playable: false, spawn: { position: [12, 0, 24.2], facing: P }, npc: { mode: 'sleep', home: [12, 24.2], leash: 12 } },
  ],
  intro: {
    shots: [
      { target: [-2, 0.5, 1], from: [12, 17, 27], duration: 3.2, caption: 'Episode 1 · Midnight Snack' },
      { focus: 'barnaby', duration: 2.6, caption: 'Barnaby is on night watch… more or less.' },
      { focus: 'pip', duration: 2.6, caption: 'Pip’s stomach has other plans.' },
    ],
  },
  sides: {
    pip: {
      brief: 'Raid the house for cheese, outwit Barnaby, and make it home to the mouse hole.',
      modeSummary: 'Sneak, hide, climb and trick your way through six missions.',
      timeLimit: 720,
      charges: { bananaPeel: 4 },
      opponentAi: { skill: 0.65, mode: 'sleep', grace: 0 },
      stages: [
        {
          id: 'munchies',
          title: 'Midnight munchies',
          brief: 'Jump onto the piano keys for a cracker crumb, then tiptoe (Ctrl) past Barnaby into the dining room.',
          checkpoint: { position: [-16.3, 0, 10.5], facing: P / 2 },
          objectives: [
            { id: 'crumb', label: 'Grab the crumb on the piano keys', type: 'collect', itemType: 'crumb', count: 1 },
            { id: 'dining', label: 'Sneak into the dining room', type: 'reach', zoneId: 'dining-room', after: ['crumb'] },
          ],
        },
        {
          id: 'encounter',
          title: 'Uh-oh',
          brief: 'Barnaby is awake! Break his line of sight - mouse holes and pet flaps are your friends.',
          checkpoint: { position: [-16.3, 0, 10.5], facing: P / 2 },
          onStart: [
            { type: 'npc', characterId: 'barnaby', command: { type: 'alert' } },
            { type: 'cutscene', shots: [{ focus: 'barnaby', duration: 1.8, caption: 'Barnaby’s eyes snap open…' }] },
            { type: 'music', intensity: 1 },
          ],
          objectives: [{ id: 'shake', label: 'Stay out of Barnaby’s sight', type: 'metric', metric: 'unseen', target: 6 }],
        },
        {
          id: 'cheese-run',
          title: 'Cheese run',
          brief: 'Three wedges are hidden around the house and yard. Grab them while Barnaby prowls.',
          checkpoint: { position: [-16.3, 0, 10.5], facing: P / 2 },
          onStart: [
            { type: 'showPickups', group: 'cheese' },
            { type: 'toast', text: 'Glowing wedges: kitchen, rose bedroom, dining room - and one right next to Brick…', tone: 'gag' },
          ],
          objectives: [{ id: 'wedges', label: 'Collect cheese wedges', type: 'collect', itemType: 'cheese', count: 3 }],
        },
        {
          id: 'big-cheese',
          title: 'The big cheese',
          brief: 'A whole cheese wheel sits on the blue bedroom dresser. The hallway is barricaded - find another way, then climb the books and the box.',
          checkpoint: { position: [-3, 0, -7.2], facing: P },
          onStart: [
            { type: 'showPickups', group: 'big' },
            { type: 'cutscene', shots: [{ target: [-3.7, 1.6, -15.3], from: [-6, 3.4, -10.2], duration: 2.8, caption: 'The big cheese! Books → box → dresser.' }] },
          ],
          objectives: [{ id: 'wheel', label: 'Climb up and grab the cheese wheel', type: 'collect', itemType: 'bigCheese', count: 1 }],
        },
        {
          id: 'hide',
          title: 'Hide!',
          brief: 'Barnaby heard that and he’s on his way. Hide before he sees you, then stay put while he searches.',
          checkpoint: { position: [7, 0, -9.5], facing: P },
          onStart: [
            { type: 'teleport', characterId: 'barnaby', position: [-15.5, 0, -4.2], facing: P / 2 },
            { type: 'npc', characterId: 'barnaby', command: { type: 'goto', at: [-9, -8.5] } },
            { type: 'cutscene', shots: [{ focus: 'barnaby', duration: 1.8, caption: 'Barnaby is coming down the hall…' }] },
          ],
          objectives: [
            { id: 'hidden', label: 'Hide somewhere', type: 'count', event: 'hide', who: 'player', count: 1 },
            { id: 'wait', label: 'Stay hidden while he searches', type: 'metric', metric: 'hiddenSeconds', target: 8 },
          ],
        },
        {
          id: 'final-dash',
          title: 'Final dash',
          brief: 'Barnaby has had enough. Run for the mouse hole in the living room!',
          checkpoint: { position: [7, 0, -9.5], facing: P },
          timeLimit: 70,
          timeoutReason: 'Barnaby cut you off from the mouse hole.',
          onStart: [
            { type: 'npc', characterId: 'barnaby', command: { type: 'hunt' } },
            { type: 'cutscene', shots: [{ focus: 'barnaby', duration: 1.6, caption: 'RUN!' }] },
            { type: 'music', intensity: 1 },
          ],
          objectives: [{ id: 'home', label: 'Reach the mouse hole', type: 'reach', zoneId: 'mouse-home' }],
        },
      ],
      objectives: [
        { id: 'slip', label: 'Make Barnaby slip', type: 'count', event: 'slipped', who: 'opponent', count: 1, optional: true },
        { id: 'slam', label: 'Slam a door in Barnaby’s face', type: 'count', event: 'splat', who: 'opponent', count: 1, optional: true },
        { id: 'wallop', label: 'Get Barnaby walloped by Brick', type: 'count', event: 'pummeled', who: 'opponent', count: 1, optional: true },
      ],
      lose: [{ type: 'count', event: 'caught', who: 'player', max: 3, reason: 'Caught three times!' }],
    },
    barnaby: {
      brief: 'Something is raiding the kitchen. Find the thief, chase it down and stop it escaping.',
      modeSummary: 'Patrol, chase, pounce, smash obstacles and search every hiding place.',
      timeLimit: 720,
      charges: { mousetrap: 3 },
      opponentAi: { skill: 0.7, collects: ['cheese'], homeZone: 'mouse-home' },
      stages: [
        {
          id: 'night-watch',
          title: 'Night watch',
          brief: 'Check the kitchen, then the dining room. Hold Shift to sprint.',
          onStart: [{ type: 'npc', characterId: 'pip', command: { type: 'hideIn', spotId: 'hide-mouse-home-hole' } }],
          objectives: [
            { id: 'kitchen', label: 'Check the kitchen', type: 'reach', zoneId: 'kitchen-room' },
            { id: 'dining', label: 'Check the dining room', type: 'reach', zoneId: 'dining-room', after: ['kitchen'] },
          ],
        },
        {
          id: 'encounter',
          title: 'A thief!',
          brief: 'A crash from the kitchen! Get eyes on the culprit.',
          opponentRespawn: { position: [15, 0, 9.4], facing: P },
          onStart: [
            { type: 'teleport', characterId: 'pip', position: [15, 0, 9.4], facing: P },
            { type: 'npc', characterId: 'pip', command: { type: 'mode', mode: 'forage' } },
            { type: 'showPickups', group: 'cheese' },
            { type: 'noise', position: [15, 1, 9.4], radius: 30, kind: 'crash' },
            { type: 'cutscene', shots: [{ focus: 'pip', duration: 2.2, caption: 'A cheese thief by the fridge!' }] },
          ],
          objectives: [{ id: 'spot', label: 'Spot Pip', type: 'metric', metric: 'seesOpponent', target: 1 }],
        },
        {
          id: 'chase',
          title: 'Chase!',
          brief: 'Catch Pip! Press F to pounce, E to grab. Mice use holes you can’t - cut them off.',
          opponentRespawn: { position: [-12, 0, -9], facing: 0 },
          objectives: [{ id: 'catch1', label: 'Catch Pip', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
        {
          id: 'barricade',
          title: 'Barricade',
          brief: 'Pip slipped away and barricaded the hallway. Smash through it (E, three times).',
          opponentRespawn: { position: [-12, 0, -9], facing: 0 },
          onStart: [
            { type: 'npc', characterId: 'pip', command: { type: 'hideIn', roomId: 'bedroom-blue' } },
            { type: 'cutscene', shots: [{ target: [-5.5, 1, -4], from: [-0.5, 3.2, -4.2], duration: 2.4, caption: 'A barricade! Smash it (E).' }] },
          ],
          objectives: [{ id: 'smash', label: 'Smash the barricade', type: 'count', event: 'broken', who: 'player', count: 1 }],
        },
        {
          id: 'search',
          title: 'Hide and seek',
          brief: 'Pip is hiding in the blue bedroom. Search the furniture (E) until you find them.',
          opponentRespawn: { position: [-12, 0, -9], facing: 0 },
          objectives: [{ id: 'found', label: 'Find Pip’s hiding place', type: 'count', event: 'found', who: 'player', count: 1 }],
        },
        {
          id: 'final-chase',
          title: 'Final chase',
          brief: 'Pip is running for the mouse hole by the back door. Catch them first!',
          timeLimit: 75,
          timeoutReason: 'Pip slipped away into the night.',
          opponentRespawn: { position: [-12, 0, -9], facing: 0 },
          onStart: [
            { type: 'npc', characterId: 'pip', command: { type: 'runTo', zoneId: 'yard-hole' } },
            { type: 'npc', characterId: 'brick', command: { type: 'goto', at: [0, 13.6] } },
            { type: 'music', intensity: 1 },
          ],
          lose: [{ type: 'count', event: 'enterZone', who: 'opponent', zoneId: 'yard-hole', max: 1, reason: 'Pip made it through the mouse hole!' }],
          objectives: [{ id: 'catch2', label: 'Catch Pip before the mouse hole', type: 'count', event: 'catch', who: 'player', count: 1 }],
        },
      ],
      objectives: [
        { id: 'noWallop', label: "Don't get walloped by Brick", type: 'avoid', event: 'pummeled', who: 'player', max: 0, optional: true },
        { id: 'snap', label: 'Snap Pip in a mousetrap', type: 'count', event: 'trapped', who: 'opponent', count: 1, optional: true },
        { id: 'clean', label: 'Never slip or face-plant', type: 'avoid', event: 'splat', who: 'player', max: 0, optional: true },
      ],
      lose: [{ type: 'count', event: 'pummeled', who: 'player', max: 3, reason: 'Brick walloped you three times.' }],
    },
  },
  pickups: [
    { id: 'crumb-piano', type: 'crumb', position: [-6.9, 1.12, 0.6] },
    { id: 'cheese-kitchen', type: 'cheese', position: [14.4, 0.05, 10.4], group: 'cheese' },
    { id: 'cheese-rose', type: 'cheese', position: [3.6, 0.05, -14.1], group: 'cheese' },
    { id: 'cheese-dining', type: 'cheese', position: [0.4, 0.05, 5.2], group: 'cheese' },
    { id: 'cheese-yard', type: 'cheese', position: [10.2, 0.05, 23.4], group: 'cheese' },
    { id: 'cheese-wheel', type: 'bigCheese', position: [-3.7, 1.62, -15.3], group: 'big' },
  ],
  events: [
    { id: 'yard-warning', sides: ['barnaby'], when: { type: 'event', event: 'enterRoom', who: 'player', roomId: 'yard' }, do: [{ type: 'toast', text: 'Shh… Brick is asleep out here. Tiptoe (Ctrl) past him!', tone: 'gag' }] },
    { id: 'brick-up', when: { type: 'event', event: 'npcState', who: 'npc:brick', state: 'alert' }, do: [{ type: 'toast', text: 'Brick is awake… and grumpy.', tone: 'bad' }, { type: 'shake', amount: 0.25 }] },
    { id: 'puddle-tip', sides: ['pip'], when: { type: 'event', event: 'enterRoom', who: 'player', roomId: 'kitchen' }, do: [{ type: 'toast', text: 'Lead Barnaby across the puddle by the sink…', tone: 'info' }] },
    { id: 'two-minutes', when: { type: 'time', at: 600 }, do: [{ type: 'toast', text: 'Two minutes until sunrise!', tone: 'bad' }] },
  ],
  audio: {
    music: { tempo: 108, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], motif: [0, 2, 4, -1, 3, 2, 0, -1, 4, 5, 4, 2, -1, 0, -1, -1] },
  },
  ending: {
    win: {
      pip: { title: 'Home sweet hole', caption: 'Pip feasts on a midnight cheese platter while Barnaby explains the mess to nobody.' },
      barnaby: { title: 'Top cat', caption: 'The thief is caught, the cheese is safe, and Barnaby naps like a champion.' },
    },
    lose: {
      pip: { title: 'Cornered!', caption: 'Barnaby got his paws on the cheese thief. Try a sneakier route through the mouse holes.' },
      barnaby: { title: 'Outsmarted by a mouse', caption: 'Pip got away. Barnaby will be sweeping crumbs all week.' },
    },
  },
};
export default episode;
