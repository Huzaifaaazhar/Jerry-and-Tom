/** Collision layers. Characters never collide with each other (catching is distance based). */
import { interactionGroups } from '@react-three/rapier';

export const G = { STATIC: 0, PROP: 1, CHAR: 2, SENSOR: 3, DOOR: 4, RAY: 5 } as const;

export const groups = {
  static: interactionGroups(G.STATIC),
  prop: interactionGroups(G.PROP),
  door: interactionGroups(G.DOOR),
  character: interactionGroups(G.CHAR, [G.STATIC, G.PROP, G.DOOR]),
  /** Rays for camera collision, line of sight and ground checks. */
  ray: interactionGroups(G.RAY, [G.STATIC, G.PROP, G.DOOR]),
  rayNoDoors: interactionGroups(G.RAY, [G.STATIC, G.PROP]),
};

export const GRAVITY: [number, number, number] = [0, -25, 0];
