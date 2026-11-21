import { createContext, useContext } from 'react';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { Bounds, LightingPreset } from './types';

const LampContext = createContext(1);
/** Props with light sources scale their intensity by the episode's lamp factor. */
export const useLampFactor = () => useContext(LampContext);
export const LampProvider = LampContext.Provider;

export function Lighting({ preset, bounds }: { preset: LightingPreset; bounds: Bounds }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(preset.sky);
    scene.fog = new THREE.Fog(preset.fog, 40, 95);
    gl.toneMappingExposure = preset.exposure;
  }, [preset, scene, gl]);
  const cx = (bounds[0] + bounds[2]) / 2;
  const cz = (bounds[1] + bounds[3]) / 2;
  const half = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 2 + 2;
  const [sx, sy, sz] = preset.sun.position;
  return (
    <>
      <ambientLight intensity={preset.ambient} />
      <hemisphereLight args={[preset.hemi[0], preset.hemi[1], preset.hemi[2]]} />
      <directionalLight
        color={preset.sun.color}
        intensity={preset.sun.intensity}
        position={[cx + sx, sy, cz + sz]}
        target-position={[cx, 0, cz]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
    </>
  );
}
