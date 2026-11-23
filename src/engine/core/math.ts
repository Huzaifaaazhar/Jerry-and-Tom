/** Small, dependency-free math helpers shared by every system. */
export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing factor. */
export const dampFactor = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, dampFactor(lambda, dt));
export const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const dampAngle = (a: number, b: number, lambda: number, dt: number) => a + wrapAngle(b - a) * dampFactor(lambda, dt);
export const approach = (v: number, target: number, maxDelta: number) =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);
export const dist2D = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Deterministic PRNG (mulberry32) so AI and procedural content can be seeded in tests. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Vec2 = { x: number; z: number };
export type Vec3Tuple = [number, number, number];
