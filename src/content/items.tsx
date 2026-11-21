/** Collectable items and placeable traps used by episodes. */
import * as THREE from 'three';
import { useMemo } from 'react';
import { registerItem, registerTrap } from '@engine/interaction/items';
import { Box, Cyl, Ball } from '@engine/environment/parts';
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
registerTrap({ id: 'mousetrap', label: 'Mousetrap', affects: ['prey'], stunKind: 'trap', stunSeconds: 2.6, sound: 'snap', radius: 0.32, Render: Mousetrap });

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
