import type { CharacterDefinition } from './types';

const characters = new Map<string, CharacterDefinition>();

export function registerCharacter(def: CharacterDefinition) {
  characters.set(def.id, def);
}

export function getCharacter(id: string): CharacterDefinition {
  const c = characters.get(id);
  if (!c) throw new Error(`Character "${id}" is not registered`);
  return c;
}

export function hasCharacter(id: string) {
  return characters.has(id);
}

export function allCharacters() {
  return [...characters.values()];
}

/**
 * Optional asset manifest (public/models/manifest.json) listing artist-made GLBs. When an entry
 * exists for a character id, the GLB replaces the procedural rig - no code change needed.
 */
export interface ModelManifest {
  characters?: Record<string, { url: string; scale?: number; yOffset?: number; clips: Record<string, string> }>;
}

let manifest: ModelManifest = {};
export async function loadModelManifest(): Promise<ModelManifest> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models/manifest.json`, { cache: 'no-cache' });
    if (res.ok) manifest = (await res.json()) as ModelManifest;
  } catch {
    manifest = {};
  }
  for (const [id, spec] of Object.entries(manifest.characters ?? {})) {
    const c = characters.get(id);
    if (c) c.model = { url: spec.url, scale: spec.scale, yOffset: spec.yOffset, clips: spec.clips };
  }
  return manifest;
}

/**
 * Apply an episode costume to a shared character. Only cosmetic extras (hat, accessory) can change;
 * proportions, colours, rig and movement always come from the shared library definition.
 */
export function withVariant(def: CharacterDefinition, variant?: { hat?: CharacterDefinition['look']['hat']; accessory?: CharacterDefinition['look']['accessory'] }): CharacterDefinition {
  if (!variant || (!variant.hat && !variant.accessory)) return def;
  return { ...def, look: { ...def.look, ...(variant.hat ? { hat: variant.hat } : {}), ...(variant.accessory ? { accessory: variant.accessory } : {}) } };
}
