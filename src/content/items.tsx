/** Collectable items and placeable traps used by episodes. */
import * as THREE from 'three';
import { useMemo } from 'react';
import { registerItem, registerTrap } from '@engine/interaction/items';
import { Box, Cyl, Ball, Torus } from '@engine/environment/parts';
import { toon } from '@engine/style/materials';

function Cheese() {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.42, 0);
    s.lineTo(0.42, 0.24);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    g.center();
    return g;
  }, []);
  return (
    <group scale={1.1}>
      <mesh geometry={geo} material={toon('#f5c542')} castShadow />
      {[
        [0.05, 0.0, 0.12],
        [0.12, -0.05, -0.12],
        [-0.04, -0.06, 0.12],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} material={toon('#d9a21f')}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}
registerItem({ id: 'cheese', label: 'Cheese', collectors: ['prey'], Render: Cheese });

function Sandwich() {
  return (
    <group scale={0.9} rotation={[0.1, 0, 0]}>
      <Box p={[0, -0.06, 0]} s={[0.4, 0.06, 0.4]} color="#e9c27a" radius={0.02} />
      <Box p={[0, -0.02, 0]} s={[0.44, 0.03, 0.44]} color="#76b94e" shadow={false} />
      <Cyl p={[0.06, 0.01, 0.04]} rt={0.1} h={0.03} color="#e0452b" shadow={false} />
      <Box p={[0, 0.04, 0]} s={[0.4, 0.06, 0.4]} color="#e9c27a" radius={0.02} />
    </group>
  );
}
registerItem({ id: 'sandwich', label: 'Sandwich', collectors: ['prey'], Render: Sandwich });

function Mousetrap({ sprung }: { sprung: boolean }) {
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[0.36, 0.05, 0.6]} color="#d89b5f" />
      <mesh position={[0, 0.07, sprung ? 0.15 : -0.15]} rotation={[0, 0, Math.PI / 2]} material={toon('#c9d3d6')}>
        <torusGeometry args={[0.16, 0.012, 6, 16, Math.PI]} />
      </mesh>
      {!sprung && <Ball p={[0, 0.08, 0.12]} rad={0.05} color="#f5c542" />}
    </group>
  );
}
registerTrap({ id: 'mousetrap', label: 'Mousetrap', affects: ['prey', 'hunter'], stunKind: 'trap', stunSeconds: 2.6, sound: 'snap', radius: 0.32, Render: Mousetrap });

function BananaPeel({ sprung }: { sprung: boolean }) {
  return (
    <group rotation={[0, sprung ? 1.2 : 0, 0]}>
      <Ball p={[0, 0.04, 0]} rad={0.07} s={[1, 0.6, 1]} color="#f5d142" />
      {[0, 1, 2, 3].map((k) => (
        <Ball key={k} p={[Math.cos(k * 1.57) * 0.13, 0.02, Math.sin(k * 1.57) * 0.13]} r={[0, -k * 1.57, 0]} rad={0.12} s={[1, 0.15, 0.45]} color={k % 2 ? '#f5d142' : '#e8c234'} />
      ))}
      <Cyl p={[0, 0.1, 0]} rt={0.02} h={0.08} color="#6b4a1f" />
    </group>
  );
}
registerTrap({ id: 'bananaPeel', label: 'Banana peel', affects: ['hunter', 'guardian'], stunKind: 'slip', stunSeconds: 2.2, sound: 'slip', radius: 0.45, Render: BananaPeel });

function Crumb() {
  return (
    <group scale={0.8}>
      <Box p={[0, 0, 0]} s={[0.32, 0.08, 0.32]} color="#e2b26a" radius={0.02} />
      {[-0.08, 0.08].map((x) => [-0.08, 0.08].map((z) => <Ball key={`${x}${z}`} p={[x, 0.045, z]} rad={0.018} color="#b07a3a" />))}
    </group>
  );
}
registerItem({ id: 'crumb', label: 'Cracker crumb', collectors: ['prey'], Render: Crumb });

function BigCheese() {
  return (
    <group scale={1.3}>
      <Cyl p={[0, 0, 0]} rt={0.32} h={0.22} color="#f5c542" seg={28} outline />
      <Cyl p={[0, 0.115, 0]} rt={0.3} h={0.01} color="#fbe08a" seg={28} shadow={false} />
      {[0, 2, 4].map((k) => (
        <Ball key={k} p={[Math.cos(k) * 0.33, Math.sin(k) * 0.05, Math.sin(k) * 0.33]} rad={0.045} color="#d99a12" />
      ))}
    </group>
  );
}
registerItem({ id: 'bigCheese', label: 'Big cheese', collectors: ['prey'], Render: BigCheese });

/** Kitchen-floor puddle: anyone hurrying across it goes for a ride. */
function Puddle({ sprung }: { sprung: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={toon('#9fd8e6', { opacity: 0.75, key: 'puddle' })}>
        <circleGeometry args={[0.85, 24]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, sprung ? 0.5 : 0]} position={[0.3, 0.015, -0.2]} material={toon('#ffffff', { opacity: 0.6, key: 'puddle-shine' })}>
        <circleGeometry args={[0.18, 12]} />
      </mesh>
    </group>
  );
}
registerTrap({ id: 'puddle', label: 'Puddle', affects: ['hunter', 'guardian'], stunKind: 'slip', stunSeconds: 1.8, sound: 'slip', radius: 0.75, Render: Puddle, persistent: true, minSpeed: 4.2 });

/** Garden rake: step on the tines and the handle swings up to say hello. */
function Rake({ sprung }: { sprung: boolean }) {
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[0.6, 0.04, 0.08]} color="#8b969b" />
      {[-0.25, -0.12, 0, 0.12, 0.25].map((x) => (
        <Box key={x} p={[x, 0.05, 0.05]} s={[0.03, 0.03, 0.12]} color="#8b969b" shadow={false} />
      ))}
      <group rotation={[sprung ? -1.3 : -0.06, 0, 0]}>
        <Box p={[0, 0.05, -0.8]} s={[0.05, 0.05, 1.6]} color="#b5733f" />
      </group>
    </group>
  );
}
registerTrap({ id: 'rake', label: 'Garden rake', affects: ['hunter', 'guardian'], stunKind: 'dizzy', stunSeconds: 1.8, sound: 'snap', radius: 0.45, Render: Rake, persistent: true });

/** Hidden collectible: a golden thimble. Either character can find it; it stays found in the save. */
function GoldenThimble() {
  return (
    <group scale={0.9}>
      <Cyl p={[0, 0, 0]} rt={0.12} rb={0.16} h={0.26} color="#f5b92e" seg={18} outline />
      <Ball p={[0, 0.13, 0]} rad={0.12} s={[1, 0.5, 1]} color="#f5b92e" />
      {[0.05, -0.05].map((y) => (
        <Torus key={y} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} rad={0.145} tube={0.012} color="#d99a12" />
      ))}
    </group>
  );
}
registerItem({ id: 'goldenThimble', label: 'Golden thimble', collectors: ['prey', 'hunter'], Render: GoldenThimble });
