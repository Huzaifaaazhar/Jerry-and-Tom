/**
 * GLB/GLTF character path. Loads a rigged model and maps engine animation states to its clips
 * (configured per character in public/models/manifest.json). Cross-fades between clips.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import type * as THREE from 'three';
import type { CharacterDefinition } from './types';
import type { AgentState } from '../core/world';
import type { AnimState } from '../core/types';

const FALLBACK: Partial<Record<AnimState, AnimState>> = {
  run: 'walk',
  sneak: 'walk',
  fall: 'jump',
  land: 'idle',
  slip: 'stunned',
  stunned: 'idle',
  laugh: 'idle',
  react: 'idle',
  grab: 'idle',
  pounce: 'jump',
  interact: 'idle',
  sleep: 'idle',
  celebrate: 'laugh',
  defeat: 'idle',
};

export function GltfCharacter({ def, agent }: { def: CharacterDefinition; agent: AgentState }) {
  const spec = def.model!;
  const gltf = useGLTF(spec.url);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, group);
  const current = useRef<string | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      o.castShadow = true;
    });
  }, [scene]);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = agent.facing;
    group.current.visible = agent.anim.state !== 'hidden';
    let state: AnimState | undefined = agent.anim.state;
    let clip: string | undefined;
    for (let i = 0; i < 4 && state && !clip; i++) {
      clip = spec.clips[state];
      if (!clip) state = FALLBACK[state];
    }
    clip = clip ?? spec.clips.idle;
    if (clip && clip !== current.current) {
      const next = actions[clip];
      if (next) {
        next.reset().fadeIn(0.18).play();
        if (current.current) actions[current.current]?.fadeOut(0.18);
        current.current = clip;
      }
    }
  });

  return (
    <group ref={group} position={[0, spec.yOffset ?? 0, 0]} scale={spec.scale ?? 1}>
      <primitive object={scene} />
    </group>
  );
}
