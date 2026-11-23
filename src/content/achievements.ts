/** Lifetime, character-specific achievements (tracked across every episode). */
import { registerAchievement } from '@engine/progress/achievements';

const list = [
  { id: 'pip-hider', title: 'Hide-and-seek champion', description: 'Hide 15 times as Pip.', characterId: 'pip', stat: 'hide', count: 15 },
  { id: 'pip-close-shave', title: 'Close shave', description: 'Escape Barnaby’s grab at the last second 5 times.', characterId: 'pip', stat: 'nearMiss', count: 5 },
  { id: 'pip-slammer', title: 'Door slammer', description: 'Slam 3 doors in Barnaby’s face.', characterId: 'pip', stat: 'slam', count: 3 },
  { id: 'pip-gourmet', title: 'Gourmet', description: 'Collect 25 snacks as Pip.', characterId: 'pip', stat: 'pickup', count: 25 },
  { id: 'pip-escapist', title: 'Escape artist', description: 'Win 3 episodes as Pip.', characterId: 'pip', stat: 'wins', count: 3 },
  { id: 'barnaby-catcher', title: 'Mouse catcher', description: 'Catch Pip 10 times.', characterId: 'barnaby', stat: 'catch', count: 10 },
  { id: 'barnaby-detective', title: 'Detective', description: 'Find Pip in a hiding place 5 times.', characterId: 'barnaby', stat: 'found', count: 5 },
  { id: 'barnaby-wrecker', title: 'Wrecking ball', description: 'Smash 3 barricades.', characterId: 'barnaby', stat: 'broken', count: 3 },
  { id: 'barnaby-bruised', title: 'Bruised ego', description: 'Get walloped by Brick 5 times. Ouch.', characterId: 'barnaby', stat: 'pummeled', count: 5 },
  { id: 'barnaby-champion', title: 'Top cat', description: 'Win 3 episodes as Barnaby.', characterId: 'barnaby', stat: 'wins', count: 3 },
];
list.forEach(registerAchievement);
