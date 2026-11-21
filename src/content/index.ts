/**
 * Content registration. Everything game-specific lives under src/content and is registered here.
 * Episodes are discovered automatically: drop a new file in ./episodes exporting an
 * EpisodeDefinition as default and it appears in the episode menu.
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

const modules = import.meta.glob<{ default: EpisodeDefinition }>('./episodes/*.ts', { eager: true });
for (const m of Object.values(modules)) registerEpisode(m.default);
