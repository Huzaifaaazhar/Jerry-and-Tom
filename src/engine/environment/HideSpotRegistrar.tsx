import { useEffect } from 'react';
import * as THREE from 'three';
import type { HideSpotDef } from './propRegistry';
import type { PropPlacement } from './types';
import { interactions } from '../interaction/registry';
import { hidePrompt, useHideSpot } from '../interaction/hiding';

function toWorld(local: [number, number, number], p: PropPlacement) {
  const v = new THREE.Vector3(...local).multiplyScalar(p.scale ?? 1);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation ?? 0);
  return v.add(new THREE.Vector3(...p.position));
}

/** Registers a prop's hiding place with the interaction system (no visuals). */
export function HideSpotRegistrar({ id, placement, def }: { id: string; placement: PropPlacement; def: HideSpotDef }) {
  useEffect(() => {
    const spot = {
      id,
      label: def.label,
      position: toWorld(def.offset, placement),
      exit: toWorld(def.exit, placement),
      archetypes: def.archetypes,
      occupant: null as string | null,
    };
    const offSpot = interactions.registerHideSpot(spot);
    const offInt = interactions.register({
      id,
      kind: 'hide',
      position: new THREE.Vector3(spot.exit.x, spot.position.y, spot.exit.z).lerp(spot.position, 0.5),
      radius: 1.3,
      prompt: (a) => hidePrompt(a, spot),
      interact: (a) => useHideSpot(a, spot),
      priority: 0.2,
    });
    return () => {
      offSpot();
      offInt();
    };
  }, [id, placement, def]);
  return null;
}
