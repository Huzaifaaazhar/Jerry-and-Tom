/**
 * Tiny JSX vocabulary for authoring cartoon props from shaped primitives. Every part shares the
 * toon material cache; `outline` adds an inked silhouette (inverted hull via drei Outlines).
 */
import { RoundedBox, Outlines } from '@react-three/drei';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { toon } from '../style/materials';
import { palette } from '../style/palette';
import type { Vec3Tuple } from '../core/math';

interface PartProps {
  p?: Vec3Tuple;
  r?: Vec3Tuple;
  color: string;
  outline?: boolean;
  shadow?: boolean;
  map?: THREE.Texture;
  children?: ReactNode;
  opacity?: number;
}

const ink = palette.ink;
const OUTLINE = 0.025;

/** Small trim parts don't need to cast shadows - saves a draw call each in the shadow pass. */
const castsShadow = (shadow: boolean | undefined, size: number) => (shadow === undefined ? size > 0.22 : shadow);

export function Box({ p = [0, 0, 0], r, s, color, radius = 0, outline, shadow, map, opacity }: PartProps & { s: Vec3Tuple; radius?: number }) {
  const mat = toon(color, { map, key: map ? map.uuid : '', opacity });
  const cast = castsShadow(shadow, Math.max(...s));
  if (radius > 0) {
    return (
      <RoundedBox args={s} radius={Math.min(radius, Math.min(...s) / 2 - 0.001)} smoothness={3} position={p} rotation={r} material={mat} castShadow={cast} receiveShadow>
        {outline && <Outlines thickness={OUTLINE} color={ink} />}
      </RoundedBox>
    );
  }
  return (
    <mesh position={p} rotation={r} material={mat} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      {outline && <Outlines thickness={OUTLINE} color={ink} />}
    </mesh>
  );
}

export function Cyl({ p = [0, 0, 0], r, rt, rb, h, color, seg = 20, outline, shadow, opacity }: PartProps & { rt: number; rb?: number; h: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} material={toon(color, { opacity })} castShadow={castsShadow(shadow, Math.max(rt * 2, h))} receiveShadow>
      <cylinderGeometry args={[rt, rb ?? rt, h, seg]} />
      {outline && <Outlines thickness={OUTLINE} color={ink} />}
    </mesh>
  );
}

export function Ball({ p = [0, 0, 0], r, s = [1, 1, 1], rad, color, outline, shadow, seg = 20 }: PartProps & { rad: number; s?: Vec3Tuple; seg?: number }) {
  return (
    <mesh position={p} rotation={r} scale={s} material={toon(color)} castShadow={castsShadow(shadow, rad * 2 * Math.max(...s))} receiveShadow>
      <sphereGeometry args={[rad, seg, Math.round(seg * 0.75)]} />
      {outline && <Outlines thickness={OUTLINE} color={ink} />}
    </mesh>
  );
}

export function Torus({ p = [0, 0, 0], r, rad, tube, arc = Math.PI * 2, color, shadow = false }: PartProps & { rad: number; tube: number; arc?: number }) {
  return (
    <mesh position={p} rotation={r} material={toon(color)} castShadow={shadow}>
      <torusGeometry args={[rad, tube, 10, 28, arc]} />
    </mesh>
  );
}

export function Cone({ p = [0, 0, 0], r, rad, h, color, seg = 16, outline, shadow }: PartProps & { rad: number; h: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} material={toon(color)} castShadow={castsShadow(shadow, Math.max(rad * 2, h))}>
      <coneGeometry args={[rad, h, seg]} />
      {outline && <Outlines thickness={OUTLINE} color={ink} />}
    </mesh>
  );
}

/** Four legs at the corners of a w x d footprint. */
export function Legs({ w, d, h, t = 0.08, color, inset = 0.08, taper = 0.7, y = 0 }: { w: number; d: number; h: number; t?: number; color: string; inset?: number; taper?: number; y?: number }) {
  const xs = [-w / 2 + inset, w / 2 - inset];
  const zs = [-d / 2 + inset, d / 2 - inset];
  return (
    <>
      {xs.flatMap((x) =>
        zs.map((z) => <Cyl key={`${x}${z}`} p={[x, y + h / 2, z]} rt={t * 0.5} rb={t * 0.5 * taper} h={h} color={color} seg={10} />),
      )}
    </>
  );
}
