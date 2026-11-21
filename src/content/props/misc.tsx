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
registerProp({
  id: 'mouseHome',
  label: 'Mouse hole',
  Render: MouseHome,
  colliders: () => [],
  // The mouse's own front door: a safe place no cat paw can reach into.
  hideSpot: { offset: [0, 0.25, -0.1], exit: [0, 0.1, 0.75], archetypes: ['prey'], label: 'Duck into your mouse hole', searchable: false },
});

/** A barricade of crates and planks. Cats can smash it; until then the hallway is blocked. */
function Barricade() {
  const crate = (x: number, y: number, z: number, r = 0) => (
    <group key={`${x}${y}${z}`} position={[x, y, z]} rotation={[0, r, 0]}>
      <Box p={[0, 0, 0]} s={[0.9, 0.9, 0.9]} color={C.woodLight} outline />
      <Box p={[0, 0, 0.455]} s={[0.8, 0.14, 0.01]} color={C.wood} shadow={false} />
      <Box p={[0, 0, -0.455]} s={[0.8, 0.14, 0.01]} color={C.wood} shadow={false} />
    </group>
  );
  return (
    <group>
      {crate(-1.35, 0.45, 0, 0.1)}
      {crate(-0.4, 0.45, 0.05, -0.08)}
      {crate(0.55, 0.45, -0.05, 0.05)}
      {crate(1.4, 0.45, 0, -0.12)}
      {crate(-0.9, 1.35, 0, 0.2)}
      {crate(0.9, 1.35, 0.02, -0.15)}
      <Box p={[0, 1.2, 0.5]} r={[0, 0, 0.35]} s={[3.6, 0.16, 0.06]} color={C.woodDark} outline />
      <Box p={[0, 1.0, 0.5]} r={[0, 0, -0.3]} s={[3.6, 0.16, 0.06]} color={C.woodDark} outline />
      <Box p={[0, 1.95, 0]} s={[0.5, 0.3, 0.5]} color={C.sofa} radius={0.05} />
    </group>
  );
}
registerProp({
  id: 'barricade',
  label: 'Barricade',
  Render: Barricade,
  colliders: () => [{ center: [0, 1.0, 0], size: [3.7, 2.0, 1.0] }],
  breakable: { label: 'Smash the barricade', hits: 3, archetypes: ['hunter', 'guardian'], debris: [[-1.2, 0.5, 0.4], [0, 0.5, 0.6], [1.2, 0.5, 0.3], [-0.6, 1.4, 0], [0.7, 1.4, 0]] },
});

/** A wobbly stack of books - a handy step for small climbers. */
function BookStack() {
  const colors = [C.sofa, C.blue, C.mustard, C.teal, C.plum];
  return (
    <group>
      {colors.map((c, i) => (
        <Box key={i} p={[((i * 37) % 5) * 0.02 - 0.04, 0.05 + i * 0.1, 0]} r={[0, i * 0.15 - 0.3, 0]} s={[0.62 - i * 0.03, 0.1, 0.46]} color={c} outline={i === 4} />
      ))}
    </group>
  );
}
registerProp({ id: 'bookStack', label: 'Stack of books', Render: BookStack, colliders: () => [{ center: [0, 0.25, 0], size: [0.6, 0.5, 0.46] }] });
