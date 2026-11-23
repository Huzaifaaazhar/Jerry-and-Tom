/**
 * Lightweight 3D showcase stage used behind menus: a spotlit rug with cast members performing
 * idle/gag animations. Reuses the exact in-game character models (no separate menu assets).
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GameWorld, type AgentState } from '@engine/core/world';
import { getCharacter } from '@engine/characters/registry';
import { ProceduralCharacter } from '@engine/characters/CharacterModel';
import { toon } from '@engine/style/materials';
import { Outlines } from '@react-three/drei';
import type { AnimState, Expression } from '@engine/core/types';

const showWorld = new GameWorld();

interface Slot {
  id: string;
  x: number;
  z: number;
  facing: number;
}

function Performer({ slot, highlight, cycle }: { slot: Slot; highlight: boolean; cycle: { state: AnimState; expr: Expression; at: number }[] }) {
  const def = getCharacter(slot.id);
  const agent = useMemo<AgentState>(() => {
    const a = showWorld.addAgent({
      id: `${slot.id}-${Math.random()}`,
      characterId: slot.id,
      archetype: def.archetype,
      isPlayer: false,
      height: def.body.halfHeight * 2 + def.body.radius * 2,
      radius: def.body.radius,
      spawn: { position: [slot.x, 0, slot.z], facing: slot.facing },
    });
    a.grounded = true;
    return a;
  }, [slot, def]);
  const t = useRef(Math.random() * 4);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    t.current += dt;
    const total = cycle[cycle.length - 1].at;
    const local = t.current % total;
    const step = cycle.find((c) => local < c.at) ?? cycle[0];
    agent.anim.state = step.state;
    agent.anim.expression = highlight && step.state === 'idle' ? 'happy' : step.expr;
    agent.facing = THREE.MathUtils.damp(agent.facing, highlight ? 0 : slot.facing, 4, dt);
    const base = def.look.height < 1 ? 1.7 : 1;
    if (g.current) g.current.scale.setScalar(THREE.MathUtils.damp(g.current.scale.x, base * (highlight ? 1.12 : 1), 6, dt));
  });
  return (
    <group ref={g} position={[slot.x, 0, slot.z]}>
      <ProceduralCharacter def={def} agent={agent} clock="real" />
    </group>
  );
}

const CYCLES: Record<string, { state: AnimState; expr: Expression; at: number }[]> = {
  pip: [
    { state: 'idle', expr: 'smug', at: 3 },
    { state: 'laugh', expr: 'laughing', at: 4.6 },
    { state: 'idle', expr: 'neutral', at: 7 },
    { state: 'sneak', expr: 'smug', at: 9 },
  ],
  barnaby: [
    { state: 'idle', expr: 'determined', at: 4 },
    { state: 'react', expr: 'surprised', at: 4.8 },
    { state: 'idle', expr: 'angry', at: 7 },
    { state: 'grab', expr: 'determined', at: 7.6 },
    { state: 'idle', expr: 'neutral', at: 9.5 },
  ],
  brick: [
    { state: 'sleep', expr: 'sleepy', at: 6 },
    { state: 'react', expr: 'surprised', at: 6.7 },
    { state: 'idle', expr: 'angry', at: 9 },
  ],
};

function StageSet() {
  return (
    <group>
      <mesh position={[0, -0.2, 0]} receiveShadow castShadow material={toon('#b97a45')}>
        <cylinderGeometry args={[4.2, 4.3, 0.4, 64]} />
        <Outlines thickness={0.04} color="#2a1a12" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow material={toon('#8a4f7d')}>
        <circleGeometry args={[3.4, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow material={toon('#f5b92e')}>
        <ringGeometry args={[2.9, 3.1, 48]} />
      </mesh>
    </group>
  );
}

export function Stage({ cast, highlight, camera = [0, 1.4, 6.2], target = [0, 0.75, 0] }: { cast: Slot[]; highlight?: string | null; camera?: [number, number, number]; target?: [number, number, number] }) {
  return (
    <Canvas className="stage-canvas" shadows dpr={[1, 1.5]} camera={{ position: camera, fov: 40 }} onCreated={({ camera: c }) => c.lookAt(...target)} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#ffffff', '#7a4426', 0.8]} />
      <spotLight position={[3, 8, 5]} angle={0.55} penumbra={0.6} intensity={120} castShadow shadow-mapSize={[1024, 1024]} color="#fff1d0" />
      <StageSet />
      {cast.map((s) => (
        <Performer key={s.id} slot={s} highlight={highlight === s.id} cycle={CYCLES[s.id] ?? CYCLES.barnaby} />
      ))}
    </Canvas>
  );
}
