/**
 * Renders a character from its definition: the GLB model if the asset pipeline provides one,
 * otherwise the procedural cartoon rig. Animation is driven from AgentState each frame.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CharacterDefinition } from './types';
import { buildRig } from './rig/buildRig';
import { ProceduralAnimator } from './animation/ProceduralAnimator';
import type { AgentState } from '../core/world';
import { world } from '../core/world';
import { GltfCharacter } from './GltfCharacter';
import { blobTexture, basic } from '../style/materials';

export function ProceduralCharacter({ def, agent, clock = 'world' }: { def: CharacterDefinition; agent: AgentState; clock?: 'world' | 'real' }) {
  const rig = useMemo(() => buildRig(def.look), [def]);
  const animator = useMemo(() => new ProceduralAnimator(rig), [rig]);
  const t = useRef(0);
  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 20);
    t.current += d;
    rig.root.rotation.y = agent.facing;
    if (world.paused && clock === 'world') return;
    animator.update(agent, d, clock === 'world' ? world.time : t.current);
  });
  useEffect(() => () => void rig.root.removeFromParent(), [rig]);
  return <primitive object={rig.root} />;
}

function BlobShadow({ radius }: { radius: number }) {
  const mat = useMemo(() => {
    const m = basic('#000000', { key: 'blob', transparent: true }).clone() as THREE.MeshBasicMaterial;
    m.map = blobTexture();
    m.transparent = true;
    m.depthWrite = false;
    return m;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={mat} renderOrder={1}>
      <planeGeometry args={[radius * 3, radius * 3]} />
    </mesh>
  );
}

export function CharacterModel({ def, agent, clock }: { def: CharacterDefinition; agent: AgentState; clock?: 'world' | 'real' }) {
  return (
    <>
      <BlobShadow radius={def.body.radius} />
      {def.model ? (
        <Suspense fallback={<ProceduralCharacter def={def} agent={agent} clock={clock} />}>
          <GltfCharacter def={def} agent={agent} />
        </Suspense>
      ) : (
        <ProceduralCharacter def={def} agent={agent} clock={clock} />
      )}
    </>
  );
}
