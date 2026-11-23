/**
 * The one visual identity for every episode. UI CSS mirrors these as custom properties
 * (src/styles/theme.css). Episodes may pick lighting presets but never redefine these.
 */
export const palette = {
  ink: '#2a1a12',
  teal: '#1f6f6b',
  tealDeep: '#134846',
  mustard: '#f5b92e',
  tomato: '#e0452b',
  sky: '#9fd8e6',
  butter: '#fde9a9',
  rose: '#e9a7a0',
  mint: '#bfe3c8',
  wood: '#b5733f',
  woodDark: '#7a4426',
  cream: '#fff6dc',
  grass: '#6fb34a',
  grassDark: '#4d8a35',
} as const;
