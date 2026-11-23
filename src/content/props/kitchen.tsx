import { Box, Cyl, Ball, Legs, Torus } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import type { PropPlacement } from '@engine/environment/types';
import { box, opt, C } from './common';

const CAB = '#e6dcc0';
const CAB_TRIM = '#2f8a84';

function Counter({ placement }: { placement: PropPlacement }) {
  const w = opt(placement, 'w', 3);
  const variant = opt(placement, 'variant', 'plain') as 'plain' | 'sink' | 'stove';
  const doors = Math.max(1, Math.round(w / 1));
  return (
    <group>
      <Box p={[0, 0.78, 0]} s={[w, 1.45, 1.0]} color={CAB} />
      <Box p={[0, 1.55, 0.03]} s={[w + 0.06, 0.1, 1.08]} color={variant === 'stove' ? C.white : C.sofa} outline />
      <Box p={[0, 0.06, 0.45]} s={[w, 0.12, 0.08]} color={C.black} shadow={false} />
      {Array.from({ length: doors }).map((_, k) => {
        const dw = w / doors;
        const x = -w / 2 + dw * (k + 0.5);
        return (
          <group key={k}>
            <Box p={[x, 0.8, 0.51]} s={[dw - 0.08, 1.2, 0.03]} color={CAB} radius={0.01} />
            <Box p={[x, 0.8, 0.525]} s={[dw - 0.24, 1.0, 0.01]} color={CAB_TRIM} shadow={false} />
            <Ball p={[x + dw * 0.3, 1.1, 0.55]} rad={0.05} color={C.chrome} />
          </group>
        );
      })}
      {variant === 'sink' && (
        <>
          <Box p={[0, 1.58, 0.05]} s={[1.1, 0.06, 0.7]} color={C.chrome} />
          <Cyl p={[0, 1.85, -0.35]} rt={0.05} h={0.5} color={C.chrome} />
          <Box p={[0, 2.08, -0.22]} s={[0.08, 0.08, 0.32]} color={C.chrome} />
        </>
      )}
      {variant === 'stove' &&
        [-0.4, 0.4].flatMap((x) =>
          [-0.22, 0.22].map((z) => <Torus key={`${x}${z}`} p={[x, 1.62, z]} r={[Math.PI / 2, 0, 0]} rad={0.14} tube={0.03} color={C.black} />),
        )}
      {variant === 'stove' && <Box p={[0, 0.7, 0.52]} s={[w * 0.7, 0.7, 0.04]} color={C.black} radius={0.02} />}
    </group>
  );
}
registerProp({
  id: 'counter',
  label: 'Kitchen counter',
  Render: Counter,
  colliders: (p) => [box([0, 0.8, 0], [opt(p, 'w', 3) + 0.06, 1.6, 1.05])],
  hideSpot: { offset: [0, 0.4, 0], exit: [0, 0.1, 0.85], archetypes: ['prey'], label: 'Hide in the cupboard' },
});

function Fridge() {
  return (
    <group>
      <Box p={[0, 1.5, 0]} s={[1.3, 2.9, 1.1]} color={C.white} radius={0.28} outline />
      <Box p={[0, 2.05, 0.56]} s={[1.18, 0.02, 0.02]} color="#c9c1b0" shadow={false} />
      <Box p={[0.45, 2.4, 0.58]} s={[0.08, 0.5, 0.08]} color={C.chrome} radius={0.03} />
      <Box p={[0.45, 1.5, 0.58]} s={[0.08, 0.6, 0.08]} color={C.chrome} radius={0.03} />
      <Box p={[0, 0.08, 0.3]} s={[1.0, 0.14, 0.3]} color={C.chrome} />
    </group>
  );
}
registerProp({ id: 'fridge', label: 'Fridge', Render: Fridge, colliders: () => [box([0, 1.5, 0], [1.3, 3.0, 1.1])] });

function TrashCan() {
  return (
    <group>
      <Cyl p={[0, 0.48, 0]} rt={0.42} rb={0.36} h={0.95} color={C.metal} outline />
      {[0.2, 0.5, 0.8].map((y) => (
        <Torus key={y} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} rad={0.4 - y * 0.05 + 0.02} tube={0.02} color="#6f797d" />
      ))}
      <Cyl p={[0, 0.98, 0]} rt={0.46} h={0.06} color={C.metal} outline />
      <Box p={[0, 1.04, 0]} s={[0.3, 0.06, 0.08]} color="#6f797d" />
    </group>
  );
}
registerProp({
  id: 'trashCan',
  label: 'Trash can',
  Render: TrashCan,
  colliders: () => [box([0, 0.5, 0], [0.84, 1.0, 0.84])],
  hideSpot: { offset: [0, 0.6, 0], exit: [0, 0.1, 0.75], archetypes: ['prey', 'hunter'], label: 'Hide in the trash can' },
});

function KitchenTable({ placement }: { placement: PropPlacement }) {
  const cloth = opt(placement, 'cloth', '#e0452b');
  return (
    <group>
      <Box p={[0, 1.6, 0]} s={[2.4, 0.1, 1.5]} color={C.white} outline />
      <Box p={[0, 1.66, 0]} s={[2.42, 0.02, 1.52]} color={cloth} shadow={false} />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Box key={x} p={[x, 1.665, 0]} s={[0.3, 0.025, 1.53]} color={C.cream} shadow={false} />
      ))}
      <Legs w={2.3} d={1.4} h={1.55} t={0.1} color={C.chrome} taper={0.9} />
    </group>
  );
}
registerProp({ id: 'kitchenTable', label: 'Kitchen table', Render: KitchenTable, colliders: () => [box([0, 1.62, 0], [2.4, 0.14, 1.5])] });

function Chair({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.wood);
  const seat = opt(placement, 'seat', C.sofa);
  return (
    <group>
      <Box p={[0, 0.82, 0]} s={[0.8, 0.1, 0.8]} color={color} outline />
      <Box p={[0, 0.9, 0.02]} s={[0.7, 0.08, 0.7]} color={seat} radius={0.03} />
      <Legs w={0.8} d={0.8} h={0.8} t={0.08} color={color} />
      <Box p={[-0.33, 1.35, -0.36]} s={[0.08, 1.0, 0.08]} color={color} />
      <Box p={[0.33, 1.35, -0.36]} s={[0.08, 1.0, 0.08]} color={color} />
      <Box p={[0, 1.7, -0.36]} s={[0.8, 0.3, 0.08]} color={color} radius={0.03} outline />
      <Box p={[0, 1.3, -0.36]} s={[0.6, 0.08, 0.06]} color={color} />
    </group>
  );
}
registerProp({ id: 'chair', label: 'Chair', Render: Chair, colliders: () => [box([0, 0.85, 0], [0.8, 0.14, 0.8]), box([0, 1.35, -0.36], [0.8, 0.9, 0.1])] });

function DiningTable() {
  return (
    <group>
      <Box p={[0, 1.62, 0]} s={[3.6, 0.12, 1.9]} color={C.woodDark} radius={0.04} outline />
      <Box p={[0, 1.69, 0]} s={[1.0, 0.02, 1.95]} color={C.cream} shadow={false} />
      <Legs w={3.4} d={1.7} h={1.56} t={0.14} color={C.woodDark} taper={0.6} />
      <Cyl p={[0, 1.85, 0]} rt={0.18} rb={0.12} h={0.3} color={C.chrome} />
      <Ball p={[0, 2.1, 0]} rad={0.22} color={C.sofa} />
      <Ball p={[0.15, 2.05, 0.1]} rad={0.16} color={C.mustard} />
    </group>
  );
}
registerProp({ id: 'diningTable', label: 'Dining table', Render: DiningTable, colliders: () => [box([0, 1.62, 0], [3.6, 0.14, 1.9])] });

function Plates({ broken }: { broken: boolean }) {
  if (broken) return null;
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Cyl key={k} p={[0, -0.18 + k * 0.07, 0]} rt={0.28} rb={0.2} h={0.05} color={k % 2 ? C.cream : C.blue} />
      ))}
    </group>
  );
}
function Sideboard() {
  return (
    <group>
      <Box p={[0, 0.8, 0]} s={[3.0, 1.4, 0.8]} color={C.wood} radius={0.05} outline />
      {[-1, 0, 1].map((k) => (
        <Box key={k} p={[k * 0.95, 0.8, 0.41]} s={[0.85, 1.1, 0.02]} color={C.woodLight} shadow={false} />
      ))}
      <Legs w={2.9} d={0.7} h={0.1} t={0.1} color={C.woodDark} />
      <Ball p={[-0.9, 1.65, 0]} rad={0.2} s={[1, 1.3, 1]} color={C.teal} />
    </group>
  );
}
registerProp({
  id: 'sideboard',
  label: 'Sideboard',
  Render: Sideboard,
  colliders: () => [box([0, 0.75, 0], [3.0, 1.5, 0.8])],
  knockable: { label: 'Topple the plate stack', offset: [0.8, 1.75, 0], size: [0.56, 0.42, 0.56], noiseRadius: 18, Render: Plates },
});

function Crate() {
  return (
    <group>
      <Box p={[0, 0, 0]} s={[1, 1, 1]} color={C.woodLight} outline />
      {[-0.35, 0, 0.35].map((y) => (
        <Box key={y} p={[0, y, 0.505]} s={[0.96, 0.18, 0.01]} color={C.wood} shadow={false} />
      ))}
      {[-0.35, 0, 0.35].map((y) => (
        <Box key={`b${y}`} p={[0, y, -0.505]} s={[0.96, 0.18, 0.01]} color={C.wood} shadow={false} />
      ))}
    </group>
  );
}
registerProp({ id: 'crate', label: 'Wooden crate', Render: Crate, colliders: () => [box([0, 0, 0], [1, 1, 1])], pushable: { mass: 3 } });

function CardboardBox() {
  return (
    <group>
      <Box p={[0, 0.5, 0]} s={[1.1, 1.0, 1.0]} color="#c89a5c" outline />
      <Box p={[-0.3, 1.03, 0.1]} r={[0, 0, 0.5]} s={[0.55, 0.03, 0.98]} color="#b8894d" />
      <Box p={[0, 0.5, 0.505]} s={[0.9, 0.12, 0.01]} color="#e8d9a8" shadow={false} />
    </group>
  );
}
registerProp({
  id: 'cardboardBox',
  label: 'Cardboard box',
  Render: CardboardBox,
  colliders: () => [box([0, 0.5, 0], [1.1, 1.0, 1.0])],
  hideSpot: { offset: [0, 0.4, 0], exit: [0, 0.1, 0.9], archetypes: ['prey', 'hunter'], label: 'Hide in the box' },
});
