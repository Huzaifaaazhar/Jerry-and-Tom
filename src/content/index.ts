/**
 * Content registration. Everything game-specific lives under src/content and is registered here.
 * Episodes are discovered automatically: add a folder in ./episodes whose index.ts
 * default-exports an EpisodeDefinition and it appears in the episode library.
 */
import './props';
import './items';
import { registerCharacter } from '@engine/characters/registry';
import { registerEnvironment, registerEpisode } from '@engine/episode/registry';
import type { EpisodeDefinition } from '@engine/episode/types';
import barnaby from './characters/barnaby';
import pip from './characters/pip';
import brick from './characters/brick';
import { classicHouse } from './environments/classicHouse';

registerCharacter(pip);
registerCharacter(barnaby);
registerCharacter(brick);
registerEnvironment(classicHouse);

import './achievements';

// Every folder in ./episodes with an index.ts is an episode package (folders starting with "_" are
// templates and are ignored). Packages may register their own environments, props and items.
const modules = import.meta.glob<{ default: EpisodeDefinition }>(['./episodes/*/index.ts', '!./episodes/_*/index.ts'], { eager: true });
for (const m of Object.values(modules)) registerEpisode(m.default);
