/**
 * Runtime static batching for props. After the furniture mounts, every mesh that uses a shared toon
 * material is baked into one merged mesh per (material, shadow) pair and the originals are hidden.
 * Prop authors keep writing simple JSX; the renderer sees a handful of draw calls.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function MergedStatic({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const [merged, setMerged] = useState<THREE.Mesh[]>([]);
  useLayoutEffect(() => {
    const g = root.current;
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; geos: THREE.BufferGeometry[] }>();
    const hidden: THREE.Object3D[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const mat = m.material as THREE.Material;
      if (Array.isArray(m.material) || mat.type !== 'MeshToonMaterial' || mat.transparent) return;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
      if (!geo.attributes.uv || !geo.attributes.normal) return;
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const key = `${mat.uuid}|${m.castShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: mat, cast: m.castShadow, geos: [] }));
      b.geos.push(geo);
      hidden.push(m);
    });
    const meshes: THREE.Mesh[] = [];
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos, false);
      b.geos.forEach((x) => x.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }
    // Hide originals only once their merged copies exist.
    hidden.forEach((m) => (m.visible = false));
    setMerged(meshes);
    return () => {
      hidden.forEach((m) => (m.visible = true));
      meshes.forEach((m) => m.geometry.dispose());
    };
  }, []);
  return (
    <>
      <group ref={root}>{children}</group>
      {merged.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </>
  );
}
