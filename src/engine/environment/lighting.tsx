import { createContext, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { world } from '../core/world';
import { useGame } from '../core/store';
import * as THREE from 'three';
import type { Bounds, LightingPreset } from './types';

const LampContext = createContext(1);
/** Props with light sources scale their intensity by the episode's lamp factor. */
export const useLampFactor = () => useContext(LampContext);
export const LampProvider = LampContext.Provider;

/**
 * Cartoon lighting rig: ambient + sky/ground bounce + a key light whose shadow frustum follows the
 * player, so shadows stay crisp in every room without an enormous shadow map.
 */
export function Lighting({ preset, bounds }: { preset: LightingPreset; bounds: Bounds }) {
  const { scene, gl } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const quality = useGame((s) => s.settings.quality);
  const low = quality === 'low';
  useEffect(() => {
    scene.background = new THREE.Color(preset.sky);
    scene.fog = new THREE.Fog(preset.fog, 40, 95);
    gl.toneMappingExposure = preset.exposure;
  }, [preset, scene, gl]);
  const cx = (bounds[0] + bounds[2]) / 2;
  const cz = (bounds[1] + bounds[3]) / 2;
  const half = 17;
  const [sx, sy, sz] = preset.sun.position;
  const focus = useRef(new THREE.Vector3(cx, 0, cz));
  useEffect(() => {
    gl.shadowMap.enabled = !low;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [gl, low]);
  useFrame(() => {
    const l = sun.current;
    const p = world.player;
    if (!l) return;
    if (p) {
      // Snap to a coarse grid so the shadow map doesn't shimmer as the player moves.
      focus.current.set(Math.round(p.position.x / 2) * 2, 0, Math.round(p.position.z / 2) * 2);
    }
    l.position.set(focus.current.x + sx * 0.6, sy * 0.6, focus.current.z + sz * 0.6);
    l.target.position.copy(focus.current);
    l.target.updateMatrixWorld();
  });
  return (
    <>
      <ambientLight intensity={preset.ambient} />
      <hemisphereLight args={[preset.hemi[0], preset.hemi[1], preset.hemi[2]]} />
      <directionalLight
        ref={sun}
        color={preset.sun.color}
        intensity={preset.sun.intensity}
        position={[cx + sx, sy, cz + sz]}
        castShadow={!low}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}
