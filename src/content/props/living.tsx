import { Box, Cyl, Ball, Legs, Cone } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import type { PropPlacement } from '@engine/environment/types';
import { box, opt, C } from './common';
import { useLampFactor } from '@engine/environment/lighting';

function Sofa({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.sofa);
  return (
    <group>
      <Box p={[0, 0.3, 0]} s={[3.2, 0.42, 1.2]} color={C.woodDark} radius={0.06} />
      <Box p={[-0.78, 0.68, 0.06]} s={[1.5, 0.36, 1.05]} color={color} radius={0.14} outline />
      <Box p={[0.78, 0.68, 0.06]} s={[1.5, 0.36, 1.05]} color={color} radius={0.14} outline />
      <Box p={[0, 1.25, -0.45]} s={[3.1, 0.95, 0.32]} color={color} radius={0.16} outline />
      <Box p={[-1.5, 0.85, 0]} s={[0.28, 0.75, 1.2]} color={color} radius={0.12} outline />
      <Box p={[1.5, 0.85, 0]} s={[0.28, 0.75, 1.2]} color={color} radius={0.12} outline />
      <Box p={[-0.9, 1.15, -0.2]} r={[-0.25, 0.2, 0.08]} s={[0.6, 0.55, 0.18]} color={C.cushion} radius={0.1} />
      <Legs w={3.1} d={1.1} h={0.12} t={0.12} color={C.woodDark} />
    </group>
  );
}
registerProp({
  id: 'sofa',
  label: 'Sofa',
  Render: Sofa,
  colliders: () => [box([0, 0.43, 0.04], [3.2, 0.86, 1.15]), box([0, 1.25, -0.45], [3.2, 0.95, 0.32]), box([-1.5, 0.6, 0], [0.28, 1.2, 1.2]), box([1.5, 0.6, 0], [0.28, 1.2, 1.2])],
  hideSpot: { offset: [0.75, 0.55, 0.05], exit: [0.75, 0.1, 1.0], archetypes: ['prey'], label: 'Hide under the cushions' },
});

function Armchair({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.teal);
  return (
    <group>
      <Box p={[0, 0.62, 0.08]} s={[1.05, 0.42, 1.1]} color={color} radius={0.14} outline />
      <Box p={[0, 1.25, -0.48]} r={[-0.12, 0, 0]} s={[1.3, 1.25, 0.3]} color={color} radius={0.15} outline />
      <Box p={[-0.62, 0.78, 0]} s={[0.26, 0.72, 1.25]} color={color} radius={0.12} outline />
      <Box p={[0.62, 0.78, 0]} s={[0.26, 0.72, 1.25]} color={color} radius={0.12} outline />
      <Box p={[0, 0.3, 0]} s={[1.45, 0.3, 1.25]} color={C.woodDark} radius={0.05} />
      <Legs w={1.4} d={1.2} h={0.15} t={0.12} color={C.woodDark} />
    </group>
  );
}
registerProp({
  id: 'armchair',
  label: 'Armchair',
  Render: Armchair,
  colliders: () => [box([0, 0.42, 0.05], [1.5, 0.84, 1.2]), box([0, 1.25, -0.5], [1.4, 1.3, 0.3])],
});

function CoffeeTable({ placement }: { placement: PropPlacement }) {
  const round = opt(placement, 'round', false);
  return (
    <group>
      {round ? <Cyl p={[0, 0.72, 0]} rt={0.8} h={0.1} color={C.wood} outline /> : <Box p={[0, 0.72, 0]} s={[1.8, 0.1, 1.0]} color={C.wood} radius={0.04} outline />}
      <Legs w={round ? 1.1 : 1.7} d={round ? 1.1 : 0.9} h={0.67} t={0.09} color={C.woodDark} inset={0.12} />
      <Box p={[0.3, 0.8, 0.1]} s={[0.5, 0.06, 0.35]} color={C.blue} />
    </group>
  );
}
registerProp({ id: 'coffeeTable', label: 'Coffee table', Render: CoffeeTable, colliders: () => [box([0, 0.72, 0], [1.8, 0.12, 1.0])] });

function Bookshelf() {
  const books = [C.sofa, C.blue, C.mustard, C.teal, C.plum, C.green, C.pink, C.cream];
  return (
    <group>
      <Box p={[0, 1.5, 0]} s={[2.0, 3.0, 0.6]} color={C.woodDark} />
      {[0.35, 1.1, 1.85, 2.6].map((y, row) => (
        <group key={y}>
          <Box p={[0, y - 0.32, 0.06]} s={[1.84, 0.62, 0.5]} color="#4a2a17" shadow={false} />
          {Array.from({ length: 9 }).map((_, k) => (
            <Box key={k} p={[-0.8 + k * 0.19 + (row % 2) * 0.05, y - 0.32 + (k % 3) * 0.03 - 0.03, 0.1]} s={[0.15, 0.5 - (k % 3) * 0.06, 0.4]} color={books[(k + row * 3) % books.length]} shadow={false} />
          ))}
        </group>
      ))}
    </group>
  );
}
registerProp({ id: 'bookshelf', label: 'Bookshelf', Render: Bookshelf, colliders: () => [box([0, 1.5, 0], [2.0, 3.0, 0.6])] });

function FloorLamp({ placement }: { placement: PropPlacement }) {
  const on = opt(placement, 'lit', true);
  const lamp = useLampFactor();
  return (
    <group>
      <Cyl p={[0, 0.05, 0]} rt={0.3} h={0.1} color={C.black} />
      <Cyl p={[0, 1.2, 0]} rt={0.04} h={2.3} color={C.metal} />
      <Cyl p={[0, 2.45, 0]} rt={0.28} rb={0.5} h={0.55} color={C.cream} outline />
      {on && lamp > 0.05 && <pointLight position={[0, 2.2, 0]} color="#ffc47a" intensity={6 * lamp} distance={10} decay={1.5} />}
    </group>
  );
}
registerProp({ id: 'floorLamp', label: 'Floor lamp', Render: FloorLamp, colliders: () => [box([0, 1.3, 0], [0.4, 2.6, 0.4])] });

function Vase({ broken }: { broken: boolean }) {
  if (broken) return null;
  return (
    <group>
      <Ball p={[0, 0.2, 0]} rad={0.22} s={[1, 1.1, 1]} color={C.blue} outline />
      <Cyl p={[0, 0.48, 0]} rt={0.1} rb={0.14} h={0.22} color={C.blue} />
      <Ball p={[0, 0.66, 0]} rad={0.12} color={C.pink} />
      <Ball p={[0.08, 0.72, 0.05]} rad={0.08} color={C.mustard} />
    </group>
  );
}
function SideTable() {
  return (
    <group>
      <Cyl p={[0, 1.05, 0]} rt={0.4} h={0.08} color={C.wood} outline />
      <Cyl p={[0, 0.52, 0]} rt={0.06} h={1.0} color={C.woodDark} />
      <Cyl p={[0, 0.04, 0]} rt={0.3} h={0.08} color={C.woodDark} />
    </group>
  );
}
registerProp({
  id: 'sideTableVase',
  label: 'Side table with vase',
  Render: SideTable,
  colliders: () => [box([0, 1.05, 0], [0.8, 0.1, 0.8]), box([0, 0.5, 0], [0.18, 1.0, 0.18])],
  knockable: { label: 'Knock over the vase', offset: [0, 1.36, 0], size: [0.44, 0.5, 0.44], noiseRadius: 16, Render: Vase },
});

function Radio() {
  return (
    <group>
      <Box p={[0, 0.7, 0]} s={[2.0, 1.1, 0.7]} color={C.woodDark} radius={0.12} outline />
      <Box p={[-0.45, 0.75, 0.36]} s={[0.8, 0.6, 0.02]} color="#d9c49a" />
      {[0, 1, 2, 3].map((k) => (
        <Box key={k} p={[-0.45, 0.55 + k * 0.13, 0.375]} s={[0.78, 0.03, 0.01]} color={C.woodDark} shadow={false} />
      ))}
      <Ball p={[0.45, 0.85, 0.36]} rad={0.1} s={[1, 1, 0.4]} color={C.mustard} />
      <Ball p={[0.75, 0.85, 0.36]} rad={0.1} s={[1, 1, 0.4]} color={C.mustard} />
      <Legs w={1.9} d={0.6} h={0.16} t={0.08} color={C.black} />
    </group>
  );
}
registerProp({ id: 'radio', label: 'Console radio', Render: Radio, colliders: () => [box([0, 0.65, 0], [2.0, 1.3, 0.7])] });

function Fireplace() {
  const lamp = useLampFactor();
  return (
    <group>
      <Box p={[0, 1.2, 0]} s={[2.8, 2.4, 0.8]} color={C.brick} />
      <Box p={[0, 2.45, 0.05]} s={[3.1, 0.18, 0.95]} color={C.woodDark} outline />
      <Box p={[0, 0.65, 0.3]} s={[1.5, 1.2, 0.3]} color="#2b140c" shadow={false} />
      <Cone p={[0, 0.5, 0.32]} rad={0.35} h={0.7} color={C.fire} shadow={false} />
      <Cone p={[0.25, 0.4, 0.34]} rad={0.2} h={0.45} color={C.mustard} shadow={false} />
      <pointLight position={[0, 0.8, 1.0]} color="#ff8a3d" intensity={2 + 3 * lamp} distance={8} decay={1.6} />
    </group>
  );
}
registerProp({ id: 'fireplace', label: 'Fireplace', Render: Fireplace, colliders: () => [box([0, 1.2, 0], [2.8, 2.4, 0.8])] });

function Piano() {
  return (
    <group>
      <Box p={[0, 1.25, -0.1]} s={[2.4, 2.1, 0.7]} color="#3a1f12" radius={0.05} outline />
      <Box p={[0, 1.0, 0.35]} s={[2.3, 0.12, 0.55]} color={C.white} />
      {Array.from({ length: 14 }).map((_, k) => (
        <Box key={k} p={[-1.0 + k * 0.155, 1.08, 0.3]} s={[0.07, 0.06, 0.3]} color={C.black} shadow={false} />
      ))}
      <Box p={[0, 0.5, 0.45]} s={[0.25, 1.0, 0.25]} color="#3a1f12" />
      <Box p={[0, 1.8, 0.27]} s={[1.0, 0.4, 0.05]} color={C.cream} />
    </group>
  );
}
registerProp({ id: 'piano', label: 'Upright piano', Render: Piano, colliders: () => [box([0, 1.25, -0.1], [2.4, 2.5, 0.7]), box([0, 0.95, 0.35], [2.3, 0.2, 0.55])] });

function Rug({ placement }: { placement: PropPlacement }) {
  const w = opt(placement, 'w', 4);
  const d = opt(placement, 'd', 3);
  const color = opt(placement, 'color', C.plum);
  const round = opt(placement, 'round', false);
  if (round)
    return (
      <group>
        <Cyl p={[0, 0.015, 0]} rt={w / 2} h={0.02} color={color} seg={40} shadow={false} />
        <Cyl p={[0, 0.02, 0]} rt={w / 2 - 0.25} h={0.02} color={C.cushion} seg={40} shadow={false} />
        <Cyl p={[0, 0.025, 0]} rt={w / 2 - 0.4} h={0.02} color={color} seg={40} shadow={false} />
      </group>
    );
  return (
    <group>
      <Box p={[0, 0.015, 0]} s={[w, 0.02, d]} color={color} shadow={false} />
      <Box p={[0, 0.02, 0]} s={[w - 0.4, 0.02, d - 0.4]} color={C.cushion} shadow={false} />
      <Box p={[0, 0.025, 0]} s={[w - 0.6, 0.02, d - 0.6]} color={color} shadow={false} />
    </group>
  );
}
registerProp({ id: 'rug', label: 'Rug', Render: Rug, colliders: () => [] });

function PottedPlant({ placement }: { placement: PropPlacement }) {
  const tall = opt(placement, 'tall', false);
  return (
    <group>
      <Cyl p={[0, 0.35, 0]} rt={0.38} rb={0.28} h={0.7} color={C.pot} outline />
      <Cyl p={[0, 0.72, 0]} rt={0.42} h={0.08} color="#a84f2c" />
      {tall ? (
        <>
          <Cyl p={[0, 1.3, 0]} rt={0.04} h={1.2} color={C.greenDark} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Ball key={k} p={[Math.cos(k) * 0.35, 1.2 + k * 0.2, Math.sin(k) * 0.35]} rad={0.3} s={[1, 0.4, 0.6]} r={[0, k, 0.4]} color={k % 2 ? C.leaf : C.green} />
          ))}
        </>
      ) : (
        <>
          <Ball p={[0, 1.05, 0]} rad={0.45} color={C.green} outline />
          <Ball p={[0.25, 1.25, 0.1]} rad={0.25} color={C.leaf} />
        </>
      )}
    </group>
  );
}
registerProp({
  id: 'pottedPlant',
  label: 'Potted plant',
  Render: PottedPlant,
  colliders: () => [box([0, 0.38, 0], [0.76, 0.76, 0.76])],
  hideSpot: { offset: [0, 0.75, 0], exit: [0, 0.1, 0.75], archetypes: ['prey'], label: 'Hide in the plant pot' },
});

function WallFrame({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.mustard);
  const w = opt(placement, 'w', 1.2);
  const h = opt(placement, 'h', 0.9);
  const art = opt<string>(placement, 'art', 'landscape');
  return (
    <group>
      <Box p={[0, 0, 0]} s={[w, h, 0.06]} color={C.woodDark} shadow={false} />
      <Box p={[0, 0, 0.035]} s={[w - 0.16, h - 0.16, 0.01]} color={art === 'portrait' ? C.cream : '#a8d8e6'} shadow={false} />
      {art === 'landscape' ? (
        <>
          <Box p={[0, -h * 0.22, 0.045]} s={[w - 0.16, h * 0.22, 0.01]} color={C.green} shadow={false} />
          <Ball p={[w * 0.2, h * 0.15, 0.045]} rad={0.08} s={[1, 1, 0.1]} color={color} shadow={false} />
        </>
      ) : (
        <Ball p={[0, 0, 0.045]} rad={h * 0.25} s={[0.8, 1, 0.1]} color={color} shadow={false} />
      )}
    </group>
  );
}
registerProp({ id: 'wallFrame', label: 'Picture frame', Render: WallFrame, colliders: () => [] });

function GrandfatherClock() {
  return (
    <group>
      <Box p={[0, 1.5, 0]} s={[0.9, 3.0, 0.55]} color="#5a2f18" radius={0.06} outline />
      <Cyl p={[0, 2.45, 0.29]} r={[Math.PI / 2, 0, 0]} rt={0.32} h={0.04} color={C.cream} />
      <Box p={[0, 2.5, 0.32]} s={[0.03, 0.22, 0.01]} color={C.black} shadow={false} />
      <Box p={[0.08, 2.45, 0.32]} r={[0, 0, 1.2]} s={[0.03, 0.18, 0.01]} color={C.black} shadow={false} />
      <Box p={[0, 1.2, 0.29]} s={[0.5, 1.3, 0.02]} color="#d8b56a" shadow={false} />
      <Ball p={[0, 0.75, 0.3]} rad={0.12} s={[1, 1, 0.3]} color={C.mustard} />
    </group>
  );
}
registerProp({ id: 'grandfatherClock', label: 'Grandfather clock', Render: GrandfatherClock, colliders: () => [box([0, 1.5, 0], [0.9, 3.0, 0.55])] });

function CoatRack() {
  return (
    <group>
      <Cyl p={[0, 1.4, 0]} rt={0.05} h={2.8} color={C.woodDark} />
      <Cyl p={[0, 0.04, 0]} rt={0.35} h={0.08} color={C.woodDark} />
      <Box p={[0.15, 1.9, 0.1]} r={[0.1, 0, -0.1]} s={[0.55, 1.0, 0.25]} color={C.sofaDark} radius={0.1} />
      <Cyl p={[-0.2, 2.75, 0]} r={[0, 0, 0.3]} rt={0.28} rb={0.3} h={0.22} color={C.black} />
    </group>
  );
}
registerProp({ id: 'coatRack', label: 'Coat rack', Render: CoatRack, colliders: () => [box([0, 1.4, 0], [0.4, 2.8, 0.4])] });
