import { Box, Cyl, Ball, Cone, Legs, Torus } from '@engine/environment/parts';
import { registerProp } from '@engine/environment/propRegistry';
import type { PropPlacement } from '@engine/environment/types';
import { box, opt, C } from './common';

function Doghouse({ placement }: { placement: PropPlacement }) {
  const color = opt(placement, 'color', C.sofa);
  return (
    <group>
      <Box p={[0, 1.0, 0]} s={[2.2, 2.0, 2.4]} color={color} outline />
      <Box p={[-0.62, 2.35, 0]} r={[0, 0, 0.7]} s={[1.7, 0.16, 2.7]} color={C.woodDark} outline />
      <Box p={[0.62, 2.35, 0]} r={[0, 0, -0.7]} s={[1.7, 0.16, 2.7]} color={C.woodDark} outline />
      <Box p={[0, 2.25, 1.2]} r={[0, 0, Math.PI / 4]} s={[1.55, 1.55, 0.02]} color={color} shadow={false} />
      <Box p={[0, 0.7, 1.205]} s={[1.0, 1.3, 0.02]} color="#2b140c" shadow={false} />
      <Ball p={[0, 1.35, 1.206]} rad={0.5} s={[1, 1, 0.02]} color="#2b140c" shadow={false} />
      <Box p={[0, 1.75, 1.22]} s={[0.9, 0.24, 0.03]} color={C.cream} shadow={false} />
    </group>
  );
}
registerProp({ id: 'doghouse', label: 'Doghouse', Render: Doghouse, colliders: () => [box([0, 1.2, 0], [2.2, 2.4, 2.4])] });

function DogBowl() {
  return (
    <group>
      <Cyl p={[0, 0.1, 0]} rt={0.35} rb={0.28} h={0.2} color={C.blue} outline />
      <Cyl p={[0, 0.19, 0]} rt={0.28} h={0.02} color="#8a5a35" />
    </group>
  );
}
registerProp({ id: 'dogBowl', label: 'Dog bowl', Render: DogBowl, colliders: () => [] });

function Tree({ placement }: { placement: PropPlacement }) {
  const s = opt(placement, 'size', 1);
  return (
    <group scale={s}>
      <Cyl p={[0, 2, 0]} rt={0.35} rb={0.5} h={4} color="#7a4b2a" outline />
      <Ball p={[0, 4.8, 0]} rad={2.0} color={C.green} outline />
      <Ball p={[1.3, 4.2, 0.4]} rad={1.3} color={C.leaf} outline />
      <Ball p={[-1.2, 4.4, -0.3]} rad={1.4} color={C.greenDark} outline />
      <Ball p={[0.2, 5.9, 0.3]} rad={1.2} color={C.leaf} />
      {[0, 1, 2, 3].map((k) => (
        <Ball key={k} p={[Math.cos(k * 1.7) * 1.6, 4.0 + (k % 2) * 0.8, Math.sin(k * 1.7) * 1.6]} rad={0.15} color={C.sofa} />
      ))}
    </group>
  );
}
registerProp({ id: 'tree', label: 'Apple tree', Render: Tree, colliders: (p) => [box([0, 2, 0], [0.9 * opt(p, 'size', 1), 4, 0.9 * opt(p, 'size', 1)])] });

function Hedge({ placement }: { placement: PropPlacement }) {
  const w = opt(placement, 'w', 3);
  const h = opt(placement, 'h', 1.6);
  const n = Math.max(2, Math.round(w / 0.9));
  return (
    <group>
      <Box p={[0, h / 2 - 0.1, 0]} s={[w, h - 0.2, 0.9]} color={C.greenDark} radius={0.3} />
      {Array.from({ length: n }).map((_, k) => (
        <Ball key={k} p={[-w / 2 + (w / n) * (k + 0.5), h - 0.25, 0]} rad={0.55} s={[1, 0.75, 0.9]} color={k % 2 ? C.green : C.leaf} outline />
      ))}
    </group>
  );
}
registerProp({ id: 'hedge', label: 'Hedge', Render: Hedge, colliders: (p) => [box([0, opt(p, 'h', 1.6) / 2, 0], [opt(p, 'w', 3), opt(p, 'h', 1.6), 0.9])] });

function FlowerBed({ placement }: { placement: PropPlacement }) {
  const w = opt(placement, 'w', 3);
  const d = opt(placement, 'd', 1.2);
  const colors = [C.sofa, C.mustard, C.pink, C.plum, C.cream];
  const n = Math.round(w * 2.5);
  return (
    <group>
      <Box p={[0, 0.08, 0]} s={[w, 0.16, d]} color="#6b4126" shadow={false} />
      {Array.from({ length: n }).map((_, k) => {
        const x = -w / 2 + ((k + 0.5) / n) * w;
        const z = ((k * 37) % 10) / 10 - 0.5;
        return (
          <group key={k} position={[x, 0, z * d * 0.7]}>
            <Cyl p={[0, 0.3, 0]} rt={0.02} h={0.45} color={C.greenDark} shadow={false} />
            <Ball p={[0, 0.55, 0]} rad={0.11} color={colors[k % colors.length]} shadow={false} />
          </group>
        );
      })}
    </group>
  );
}
registerProp({ id: 'flowerBed', label: 'Flower bed', Render: FlowerBed, colliders: () => [] });

function PicnicTable() {
  return (
    <group>
      <Box p={[0, 1.3, 0]} s={[3.0, 0.12, 1.4]} color={C.wood} outline />
      {[-0.42, 0, 0.42].map((z) => (
        <Box key={z} p={[0, 1.37, z]} s={[3.02, 0.02, 0.3]} color={C.sofa} shadow={false} />
      ))}
      <Box p={[0, 0.7, 1.05]} s={[3.0, 0.1, 0.45]} color={C.wood} outline />
      <Box p={[0, 0.7, -1.05]} s={[3.0, 0.1, 0.45]} color={C.wood} outline />
      <Legs w={2.6} d={1.2} h={1.25} t={0.12} color={C.woodDark} taper={1} />
      <Legs w={2.6} d={2.5} h={0.66} t={0.1} color={C.woodDark} taper={1} inset={0.3} />
      <Box p={[0.6, 1.55, 0]} s={[0.8, 0.35, 0.55]} color="#d6a35c" radius={0.06} outline />
      <Torus p={[0.6, 1.75, 0]} r={[0, Math.PI / 2, 0]} rad={0.25} tube={0.03} arc={Math.PI} color="#8a5a35" />
    </group>
  );
}
registerProp({
  id: 'picnicTable',
  label: 'Picnic table',
  Render: PicnicTable,
  colliders: () => [box([0, 1.3, 0], [3.0, 0.14, 1.4]), box([0, 0.7, 1.05], [3.0, 0.12, 0.45]), box([0, 0.7, -1.05], [3.0, 0.12, 0.45])],
});

function Birdbath() {
  return (
    <group>
      <Cyl p={[0, 0.6, 0]} rt={0.12} rb={0.2} h={1.2} color="#c8c3b6" />
      <Cyl p={[0, 1.25, 0]} rt={0.55} rb={0.3} h={0.15} color="#c8c3b6" outline />
      <Cyl p={[0, 1.33, 0]} rt={0.45} h={0.02} color={C.sky} />
    </group>
  );
}
registerProp({ id: 'birdbath', label: 'Birdbath', Render: Birdbath, colliders: () => [box([0, 0.65, 0], [0.5, 1.3, 0.5])] });

function Wheelbarrow() {
  return (
    <group>
      <Box p={[0, 0.75, 0]} r={[0.1, 0, 0]} s={[1.0, 0.5, 1.3]} color={C.sofa} radius={0.1} outline />
      <Cyl p={[0, 0.3, 0.85]} r={[0, 0, Math.PI / 2]} rt={0.3} h={0.12} color={C.black} />
      <Box p={[-0.35, 0.6, -0.9]} s={[0.06, 0.06, 0.9]} color={C.woodDark} />
      <Box p={[0.35, 0.6, -0.9]} s={[0.06, 0.06, 0.9]} color={C.woodDark} />
      <Ball p={[0, 1.05, 0]} rad={0.35} s={[1.2, 0.5, 1.5]} color="#6b4126" />
    </group>
  );
}
registerProp({ id: 'wheelbarrow', label: 'Wheelbarrow', Render: Wheelbarrow, colliders: () => [box([0, 0.6, -0.1], [1.0, 1.2, 1.9])] });

function GardenGnome() {
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} rt={0.18} rb={0.25} h={0.6} color={C.blue} />
      <Ball p={[0, 0.72, 0]} rad={0.17} color="#f2c9a0" />
      <Cone p={[0, 1.02, 0]} rad={0.2} h={0.45} color={C.sofa} outline />
      <Cone p={[0, 0.58, 0.1]} r={[Math.PI, 0, 0]} rad={0.14} h={0.3} color={C.cream} />
    </group>
  );
}
registerProp({ id: 'gnome', label: 'Garden gnome', Render: GardenGnome, colliders: () => [box([0, 0.5, 0], [0.5, 1.0, 0.5])] });

function Fountain() {
  return (
    <group>
      <Cyl p={[0, 0.3, 0]} rt={1.3} rb={1.4} h={0.6} color="#c8c3b6" outline />
      <Cyl p={[0, 0.58, 0]} rt={1.15} h={0.04} color={C.sky} />
      <Cyl p={[0, 1.0, 0]} rt={0.15} h={1.0} color="#c8c3b6" />
      <Cyl p={[0, 1.55, 0]} rt={0.5} rb={0.2} h={0.18} color="#c8c3b6" outline />
    </group>
  );
}
registerProp({ id: 'fountain', label: 'Fountain', Render: Fountain, colliders: () => [box([0, 0.4, 0], [2.6, 0.8, 2.6]), box([0, 1.1, 0], [0.4, 1.4, 0.4])] });
