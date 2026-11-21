import * as THREE from 'three';
import { useMemo } from 'react';
import { Box, Ball } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import { toon, basic } from '@engine/style/materials';
import { C } from './common';

/** The mouse's front door: an arched hole with a tiny welcome mat and a warm light inside. */
function MouseHome() {
  const arch = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.42, 0);
    s.lineTo(0.42, 0);
    s.lineTo(0.42, 0.82);
    s.lineTo(-0.42, 0.82);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.3, 0);
    hole.lineTo(0.3, 0);
    hole.lineTo(0.3, 0.42);
    hole.absarc(0, 0.42, 0.3, 0, Math.PI, false);
    hole.lineTo(-0.3, 0);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  }, []);
  const inner = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0);
    s.lineTo(0.3, 0);
    s.lineTo(0.3, 0.42);
    s.absarc(0, 0.42, 0.3, 0, Math.PI, false);
    s.lineTo(-0.3, 0);
    return new THREE.ShapeGeometry(s, 16);
  }, []);
  return (
    <group>
      <mesh geometry={inner} position={[0, 0.001, 0.005]} material={basic('#1a0d07')} />
      <mesh geometry={arch} position={[0, 0, 0]} material={toon('#5a2f18')} />
      <Box p={[0, 0.012, 0.32]} s={[0.55, 0.02, 0.32]} color={C.sofa} shadow={false} />
      <Ball p={[0, 0.25, -0.05]} rad={0.05} color="#ffcf6a" shadow={false} />
      <pointLight position={[0, 0.3, 0.3]} color="#ffb84d" intensity={1.2} distance={2.2} />
    </group>
  );
}
registerProp({ id: 'mouseHome', label: 'Mouse hole', Render: MouseHome, colliders: () => [] });
