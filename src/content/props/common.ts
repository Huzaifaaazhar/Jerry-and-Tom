import type { BoxSpec, PropPlacement } from '@engine/environment/types';
import type { Vec3Tuple } from '@engine/core/math';

export const box = (center: Vec3Tuple, size: Vec3Tuple): BoxSpec => ({ center, size });
export const opt = <T,>(p: PropPlacement, key: string, fallback: T): T => (p.options?.[key] as T) ?? fallback;

export const C = {
  wood: '#b5733f',
  woodDark: '#7a4426',
  woodLight: '#d89b5f',
  sofa: '#c9473a',
  sofaDark: '#a3362c',
  cushion: '#e7c35a',
  teal: '#2f8a84',
  cream: '#fff6dc',
  white: '#f4efe4',
  chrome: '#c9d3d6',
  metal: '#8b969b',
  black: '#2a1a12',
  brick: '#b4553d',
  green: '#5e9f3f',
  greenDark: '#3f7a2c',
  leaf: '#76b94e',
  pot: '#c8643b',
  pink: '#e9a7a0',
  blue: '#5c8fc9',
  mustard: '#f5b92e',
  plum: '#8a4f7d',
  fire: '#ff9a2e',
  sky: '#9fd8e6',
};
