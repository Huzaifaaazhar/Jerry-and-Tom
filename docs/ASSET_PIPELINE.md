# Asset pipeline

## Characters

Every character is a `CharacterDefinition` in `src/content/characters/`. Its appearance comes from:

1. **A rigged GLB (preferred for final art).** Put the file in `public/models/characters/` and add an
   entry to `public/models/manifest.json`:

   ```json
   {
     "characters": {
       "barnaby": {
         "url": "/models/characters/barnaby.glb",
         "scale": 1,
         "yOffset": 0,
         "clips": {
           "idle": "Idle", "walk": "Walk", "run": "Run", "sneak": "Sneak",
           "jump": "Jump", "fall": "Fall", "slip": "Slip", "stunned": "Dizzy",
           "laugh": "Laugh", "react": "Take", "grab": "Grab", "pounce": "Pounce",
           "interact": "Interact", "sleep": "Sleep", "celebrate": "Celebrate", "defeat": "Defeat"
         }
       }
     }
   }
   ```

   The manifest is read at startup; `GltfCharacter` replaces the procedural rig and cross-fades
   clips by engine animation state (missing clips fall back sensibly, e.g. `run` → `walk`).
   Model requirements: Y-up, facing +Z, feet at the origin, height roughly matching
   `look.height`, one skinned mesh with a humanoid-ish skeleton, toon-friendly materials.
   Facial expressions in a GLB should be morph targets; wiring them to `Expression` is the next
   pipeline step (Part 2).

2. **The procedural cartoon rig (current default).** `engine/characters/rig/buildRig.ts` builds a
   bone hierarchy with sculpted toon parts, ink outlines, eyelids, brows, pupils and a mouth, and
   `ProceduralAnimator` drives locomotion, gags, squash & stretch and facial expressions. It is a
   functional, fully animated stand-in, **not** a production-quality sculpted model. Replace it
   per character via the manifest when final art exists.

Only use models, textures and audio you have the rights to.

## Props / furniture

Prop types are registered in `src/content/props/*` with a render component, collider boxes (shared
by physics and AI navigation) and optional affordances (`hideSpot`, `knockable`, `pushable`).
To swap a primitive prop for a modelled one, keep the registration and colliders and change the
`Render` component to load a GLB with `useGLTF`.

## Audio

All sounds and music are procedural by default. Episode files can override any sound id with a
recorded file: `audio: { sounds: { crash: '/audio/crash.ogg' } }`. Missing files fall back to the
synth version automatically.
