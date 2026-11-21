/** Picnic and laundry assets for the shared library. */
import { Box, Cyl, Ball, Cone, Torus, Legs } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import type { PropPlacement } from '@engine/environment/types';
import { box, opt, C } from './common';

function PicnicBlanket({ placement }: { placement: PropPlacement }) {
  const w = opt(placement, 'w', 3.2);
  const d = opt(placement, 'd', 2.4);
  const n = 6;
  return (
    <group>
      <Box p={[0, 0.012, 0]} s={[w, 0.02, d]} color={C.cream} shadow={false} />
      {Array.from({ length: n }).map((_, i) => (
        <Box key={`a${i}`} p={[-w / 2 + (w / n) * (i + 0.5), 0.02, 0]} s={[w / n / 2, 0.02, d]} color={C.sofa} shadow={false} opacity={0.85} />
      ))}
      {Array.from({ length: n }).map((_, i) => (
        <Box key={`b${i}`} p={[0, 0.022, -d / 2 + (d / n) * (i + 0.5)]} s={[w, 0.02, d / n / 2]} color={C.sofa} shadow={false} opacity={0.6} />
      ))}
    </group>
  );
}
registerProp({ id: 'picnicBlanket', label: 'Picnic blanket', Render: PicnicBlanket, colliders: () => [] });

function PicnicBasket() {
  return (
    <group>
      <Box p={[0, 0.35, 0]} s={[1.0, 0.7, 0.7]} color="#d6a35c" radius={0.08} outline />
      {[0.15, 0.35, 0.55].map((y) => (
        <Box key={y} p={[0, y, 0.355]} s={[0.96, 0.05, 0.01]} color="#b07a3a" shadow={false} />
      ))}
      <Box p={[0, 0.74, 0]} s={[1.04, 0.08, 0.74]} color="#c58f4a" radius={0.04} />
      <Torus p={[0, 0.8, 0]} r={[0, Math.PI / 2, 0]} rad={0.36} tube={0.035} arc={Math.PI} color="#8a5a35" />
    </group>
  );
}
registerProp({
  id: 'picnicBasket',
  label: 'Picnic basket',
  Render: PicnicBasket,
  colliders: () => [box([0, 0.38, 0], [1.0, 0.76, 0.7])],
  hideSpot: { offset: [0, 0.3, 0], exit: [0, 0.1, 0.7], archetypes: ['prey'], label: 'Hide in the picnic basket' },
});

function PatioUmbrella({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.mustard);
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} rt={0.4} h={0.16} color={C.metal} />
      <Cyl p={[0, 1.4, 0]} rt={0.05} h={2.7} color={C.cream} />
      <Cone p={[0, 2.85, 0]} rad={1.9} h={0.7} seg={8} color={color} outline />
      <Ball p={[0, 3.25, 0]} rad={0.08} color={C.sofa} />
    </group>
  );
}
registerProp({ id: 'patioUmbrella', label: 'Patio umbrella', Render: PatioUmbrella, colliders: () => [box([0, 1.4, 0], [0.3, 2.8, 0.3])] });

function LawnChair({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.teal);
  return (
    <group>
      <Box p={[0, 0.55, 0.1]} s={[0.8, 0.08, 0.8]} color={color} outline />
      <Box p={[0, 1.0, -0.35]} r={[-0.3, 0, 0]} s={[0.8, 0.9, 0.08]} color={color} outline />
      {[-0.35, 0.35].map((x) => [0.4, -0.3].map((z) => <Box key={`${x}${z}`} p={[x, 0.27, z]} s={[0.05, 0.55, 0.05]} color={C.chrome} />))}
    </group>
  );
}
registerProp({ id: 'lawnChair', label: 'Lawn chair', Render: LawnChair, colliders: () => [box([0, 0.57, 0.1], [0.8, 0.1, 0.8]), box([0, 1.0, -0.35], [0.8, 0.9, 0.12])] });

function LaundryBasket() {
  return (
    <group>
      <Cyl p={[0, 0.35, 0]} rt={0.5} rb={0.42} h={0.7} color={C.blue} outline />
      <Ball p={[0.1, 0.7, 0.05]} rad={0.32} s={[1.2, 0.5, 1]} color={C.cream} />
      <Ball p={[-0.15, 0.75, -0.1]} rad={0.2} s={[1.4, 0.5, 1]} color={C.pink} />
    </group>
  );
}
registerProp({
  id: 'laundryBasket',
  label: 'Laundry basket',
  Render: LaundryBasket,
  colliders: () => [box([0, 0.36, 0], [0.95, 0.72, 0.95])],
  hideSpot: { offset: [0, 0.3, 0], exit: [0, 0.1, 0.8], archetypes: ['prey'], label: 'Hide in the laundry' },
});

function GardenBench() {
  return (
    <group>
      <Box p={[0, 0.72, 0]} s={[2.2, 0.1, 0.7]} color={C.wood} outline />
      <Box p={[0, 1.2, -0.32]} s={[2.2, 0.6, 0.08]} color={C.wood} outline />
      <Legs w={2.0} d={0.6} h={0.7} t={0.1} color={C.black} taper={1} />
    </group>
  );
}
registerProp({ id: 'gardenBench', label: 'Garden bench', Render: GardenBench, colliders: () => [box([0, 0.72, 0], [2.2, 0.12, 0.7]), box([0, 1.2, -0.32], [2.2, 0.6, 0.1])] });
