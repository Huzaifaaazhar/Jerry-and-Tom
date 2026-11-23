import { Box, Cyl, Ball, Legs } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import type { PropPlacement } from '@engine/environment/types';
import { box, opt, C } from './common';

function Bed({ placement }: { placement: PropPlacement }) {
  const quilt = opt(placement, 'quilt', C.blue);
  return (
    <group>
      <Box p={[0, 0.7, 0.1]} s={[2.4, 0.22, 3.4]} color={C.woodDark} />
      <Box p={[0, 0.88, 0.1]} s={[2.3, 0.2, 3.3]} color={C.white} radius={0.08} />
      <Box p={[0, 0.98, 0.45]} s={[2.42, 0.14, 2.7]} color={quilt} radius={0.06} outline />
      {[-0.5, 0.5].map((x) => (
        <Box key={x} p={[x, 1.1, -1.2]} s={[0.85, 0.22, 0.55]} color={C.cream} radius={0.1} />
      ))}
      <Box p={[0, 1.3, -1.72]} s={[2.5, 2.2, 0.16]} color={C.woodDark} radius={0.06} outline />
      <Box p={[0, 1.4, -1.63]} s={[1.9, 1.2, 0.02]} color={C.wood} shadow={false} />
      <Box p={[0, 0.85, 1.85]} s={[2.5, 1.0, 0.14]} color={C.woodDark} radius={0.05} outline />
      <Legs w={2.4} d={3.6} h={0.6} t={0.14} color={C.woodDark} taper={0.9} />
    </group>
  );
}
registerProp({
  id: 'bed',
  label: 'Bed',
  Render: Bed,
  colliders: () => [box([0, 0.85, 0.1], [2.4, 0.5, 3.5]), box([0, 1.2, -1.72], [2.5, 2.4, 0.16]), box([0, 0.95, 1.85], [2.5, 0.7, 0.14])],
  hideSpot: { offset: [0, 0.25, 0.2], exit: [1.6, 0.1, 0.6], archetypes: ['prey'], label: 'Hide under the bed' },
});

function Wardrobe({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.wood);
  return (
    <group>
      <Box p={[0, 1.65, 0]} s={[2.0, 3.1, 1.0]} color={color} radius={0.05} outline />
      <Box p={[0, 3.25, 0]} s={[2.15, 0.14, 1.1]} color={C.woodDark} />
      <Box p={[-0.49, 1.75, 0.51]} s={[0.92, 2.6, 0.02]} color={C.woodLight} shadow={false} />
      <Box p={[0.49, 1.75, 0.51]} s={[0.92, 2.6, 0.02]} color={C.woodLight} shadow={false} />
      <Ball p={[-0.1, 1.7, 0.55]} rad={0.06} color={C.mustard} />
      <Ball p={[0.1, 1.7, 0.55]} rad={0.06} color={C.mustard} />
      <Legs w={1.9} d={0.9} h={0.12} t={0.12} color={C.woodDark} />
    </group>
  );
}
registerProp({
  id: 'wardrobe',
  label: 'Wardrobe',
  Render: Wardrobe,
  colliders: () => [box([0, 1.65, 0], [2.0, 3.3, 1.0])],
  hideSpot: { offset: [0, 0.4, 0], exit: [0, 0.1, 1.0], archetypes: ['prey', 'hunter'], label: 'Hide in the wardrobe' },
});

function AlarmClock({ broken }: { broken: boolean }) {
  if (broken) return null;
  return (
    <group>
      <Cyl p={[0, 0, 0]} r={[Math.PI / 2, 0, 0]} rt={0.17} h={0.12} color={C.sofa} outline />
      <Cyl p={[0, 0, 0.065]} r={[Math.PI / 2, 0, 0]} rt={0.13} h={0.01} color={C.cream} />
      <Ball p={[-0.12, 0.17, 0]} rad={0.07} color={C.mustard} />
      <Ball p={[0.12, 0.17, 0]} rad={0.07} color={C.mustard} />
    </group>
  );
}
function Dresser() {
  return (
    <group>
      <Box p={[0, 0.78, 0]} s={[2.0, 1.4, 0.8]} color={C.woodLight} radius={0.05} outline />
      {[0.4, 0.8, 1.2].map((y) => (
        <group key={y}>
          <Box p={[0, y, 0.405]} s={[1.85, 0.34, 0.02]} color={C.wood} shadow={false} />
          <Ball p={[-0.4, y, 0.43]} rad={0.05} color={C.chrome} />
          <Ball p={[0.4, y, 0.43]} rad={0.05} color={C.chrome} />
        </group>
      ))}
      <Box p={[0.6, 2.1, -0.3]} s={[0.9, 1.1, 0.06]} color={C.woodDark} radius={0.04} />
      <Box p={[0.6, 2.1, -0.26]} s={[0.75, 0.95, 0.01]} color={C.sky} shadow={false} />
    </group>
  );
}
registerProp({
  id: 'dresser',
  label: 'Dresser',
  Render: Dresser,
  colliders: () => [box([0, 0.75, 0], [2.0, 1.5, 0.8])],
  knockable: { label: 'Knock off the alarm clock', offset: [-0.5, 1.68, 0.1], size: [0.4, 0.36, 0.2], noiseRadius: 20, Render: AlarmClock },
});

function Nightstand() {
  return (
    <group>
      <Box p={[0, 0.5, 0]} s={[0.8, 0.9, 0.7]} color={C.woodLight} radius={0.04} outline />
      <Box p={[0, 0.6, 0.355]} s={[0.65, 0.3, 0.02]} color={C.wood} shadow={false} />
      <Cyl p={[0, 1.15, 0]} rt={0.1} rb={0.15} h={0.4} color={C.mustard} />
      <Cyl p={[0, 1.5, 0]} rt={0.18} rb={0.3} h={0.35} color={C.cream} outline />
    </group>
  );
}
registerProp({ id: 'nightstand', label: 'Nightstand', Render: Nightstand, colliders: () => [box([0, 0.48, 0], [0.8, 0.96, 0.7])] });

function ToyBox() {
  return (
    <group>
      <Box p={[0, 0.45, 0]} s={[1.4, 0.9, 0.9]} color={C.mustard} radius={0.06} outline />
      <Box p={[0, 0.94, -0.05]} r={[-0.15, 0, 0]} s={[1.45, 0.1, 0.95]} color={C.sofa} radius={0.04} />
      <Ball p={[-0.3, 0.5, 0.46]} rad={0.15} s={[1, 1, 0.2]} color={C.blue} />
      <Box p={[0.3, 0.5, 0.46]} s={[0.25, 0.25, 0.04]} color={C.teal} />
    </group>
  );
}
registerProp({
  id: 'toyBox',
  label: 'Toy box',
  Render: ToyBox,
  colliders: () => [box([0, 0.5, 0], [1.4, 1.0, 0.9])],
  hideSpot: { offset: [0, 0.35, 0], exit: [0, 0.1, 0.85], archetypes: ['prey'], label: 'Hide in the toy box' },
});
