import { useEffect, useRef } from 'react';
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import type * as THREE from 'three';
import type { AgentState } from '../core/world';
import type { CharacterDefinition } from '../characters/types';
import { CharacterModel } from '../characters/CharacterModel';
import { groups } from '../core/physics';

/** Physics capsule + visual model for one agent (player or AI). */
export function AgentBody({ agent, def }: { agent: AgentState; def: CharacterDefinition }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const { radius, halfHeight, mass } = def.body;
  const [x, y, z] = agent.spawn.position;
  useEffect(() => {
    agent.body = body.current;
    agent.visual = visual.current;
    return () => {
      agent.body = null;
      agent.visual = null;
    };
  }, [agent]);
  return (
    <RigidBody
      ref={body}
      type="dynamic"
      position={[x, y + halfHeight + radius + 0.02, z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      mass={mass}
      ccd
      canSleep={false}
      name={agent.id}
    >
      <CapsuleCollider args={[halfHeight, radius]} collisionGroups={groups.character} friction={0} restitution={0} />
      <group ref={visual} position={[0, -(halfHeight + radius), 0]}>
        <CharacterModel def={def} agent={agent} />
      </group>
    </RigidBody>
  );
}
