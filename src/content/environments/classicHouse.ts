/**
 * "The Classic House" - the reusable suburban home + backyard every early episode is set in.
 * Pure data: rooms, walls (with doors, arches, windows, mouse holes), prop placements, zones.
 * Episodes add their own pickups, spawns and events on top without touching this file.
 */
import type { EnvironmentDefinition, PropPlacement } from '@engine/environment/types';

const P = Math.PI;
const prop = (type: string, x: number, z: number, rotation = 0, options?: Record<string, unknown>, y = 0, id?: string): PropPlacement => ({
  type,
  position: [x, y, z],
  rotation,
  options,
  id,
});

const DOOR = { width: 1.8, height: 2.8 };
const HOLE = { width: 0.6, height: 0.62 };

export const classicHouse: EnvironmentDefinition = {
  id: 'classic-house',
  name: 'The Classic House',
  bounds: [-21, -17, 21, 35],
  wallHeight: 3.6,
  rooms: [
    { id: 'bedroom-blue', name: 'Blue bedroom', bounds: [-18, -16, 0, -6], floor: 'wood', floorColor: '#c98a52', wallpaper: { base: '#a9cfe0', accent: '#86b4cc', pattern: 'stripes', wainscot: '#f4efe4' } },
    { id: 'bedroom-rose', name: 'Rose bedroom', bounds: [0, -16, 18, -6], floor: 'carpet', floorColor: '#d9b3a8', wallpaper: { base: '#f2d4cc', accent: '#e9a7a0', pattern: 'flowers' } },
    { id: 'hallway', name: 'Hallway', bounds: [-18, -6, 18, -2], floor: 'wood', floorColor: '#b5733f', wallpaper: { base: '#f5e2a8', accent: '#e8c86a', pattern: 'diamonds', wainscot: '#7a4426' } },
    { id: 'living', name: 'Living room', bounds: [-18, -2, -6, 12], floor: 'wood', floorColor: '#b97a45', wallpaper: { base: '#2f8a84', accent: '#3b9c95', pattern: 'diamonds', wainscot: '#f4efe4' } },
    { id: 'dining', name: 'Dining room', bounds: [-6, -2, 6, 12], floor: 'wood', floorColor: '#a8693a', wallpaper: { base: '#f0c46a', accent: '#e8b04a', pattern: 'stripes', wainscot: '#7a4426' } },
    { id: 'kitchen', name: 'Kitchen', bounds: [6, -2, 18, 12], floor: 'checker', floorColor: '#e0452b', wallpaper: { base: '#bfe3c8', accent: '#9fd0ae', pattern: 'dots' } },
    { id: 'yard', name: 'Backyard', bounds: [-20, 12, 20, 34], floor: 'grass', floorColor: '#6fb34a', outdoor: true },
    { id: 'patio', name: 'Patio', bounds: [-6, 12, 6, 16], floor: 'patio', floorColor: '#d9c9a8', outdoor: true },
    { id: 'garden', name: 'Flower garden', bounds: [-20, 24, -6, 34], floor: 'grass', floorColor: '#7cc052', outdoor: true },
  ],
  walls: [
    // Exterior shell
    { from: [-18, -16], to: [18, -16], kind: 'exterior', openings: [
      { at: 9, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
      { at: 27, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
    ] },
    { from: [-18, -16], to: [-18, 12], kind: 'exterior', openings: [
      { at: 5, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
      { at: 22.5, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
    ] },
    { from: [18, -16], to: [18, 12], kind: 'exterior', openings: [
      { at: 5, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
      { at: 21, width: 2.4, height: 1.1, kind: 'window', sill: 1.9 },
    ] },
    { from: [-18, 12], to: [18, 12], kind: 'exterior', openings: [
      { at: 6, width: 2.4, height: 1.4, kind: 'window', sill: 1.3 },
      { at: 15, ...HOLE, kind: 'mousehole' },
      { at: 18, ...DOOR, kind: 'door', id: 'back-door', startOpen: false, swing: -1 },
      { at: 30, ...DOOR, kind: 'door', id: 'kitchen-yard-door', startOpen: true, swing: -1 },
    ] },
    // Hallway north wall (bedrooms)
    { from: [-18, -6], to: [18, -6], kind: 'interior', openings: [
      { at: 9, ...DOOR, kind: 'door', id: 'blue-bedroom-door', startOpen: true, swing: 1 },
      { at: 15, ...HOLE, kind: 'mousehole' },
      { at: 27, ...DOOR, kind: 'door', id: 'rose-bedroom-door', startOpen: false, swing: 1 },
    ] },
    // Bedroom divider
    { from: [0, -16], to: [0, -6], kind: 'interior', openings: [{ at: 5, ...HOLE, kind: 'mousehole' }] },
    // Hallway south wall
    { from: [-18, -2], to: [18, -2], kind: 'interior', openings: [
      { at: 6, ...DOOR, kind: 'door', id: 'living-door', startOpen: true, swing: -1 },
      { at: 18, width: 3.2, height: 2.95, kind: 'arch' },
      { at: 30, ...DOOR, kind: 'door', id: 'kitchen-hall-door', startOpen: false, swing: -1 },
    ] },
    // Living | dining
    { from: [-6, -2], to: [-6, 12], kind: 'interior', openings: [
      { at: 7, width: 3.5, height: 2.95, kind: 'arch' },
      { at: 12, ...HOLE, kind: 'mousehole' },
    ] },
    // Dining | kitchen
    { from: [6, -2], to: [6, 12], kind: 'interior', openings: [
      { at: 5, ...DOOR, kind: 'door', id: 'kitchen-dining-door', startOpen: true, swing: 1 },
      { at: 12, ...HOLE, kind: 'mousehole' },
    ] },
    // Backyard fence
    { from: [-20, 12], to: [-20, 34], kind: 'fence', height: 3.2 },
    { from: [-20, 34], to: [20, 34], kind: 'fence', height: 3.2 },
    { from: [20, 34], to: [20, 12], kind: 'fence', height: 3.2 },
    { from: [-20, 12], to: [-18, 12], kind: 'fence', height: 3.2 },
    { from: [18, 12], to: [20, 12], kind: 'fence', height: 3.2 },
  ],
  props: [
    // Living room
    prop('fireplace', -17.45, 2, P / 2),
    prop('rug', -14.3, 2, 0, { w: 5.2, round: true, color: '#8a4f7d' }),
    prop('coffeeTable', -14.3, 2, P / 2),
    prop('sofa', -11.3, 2, -P / 2, { color: '#c9473a' }),
    prop('sideTableVase', -11.4, 4.6, 0, undefined, 0, 'living-vase'),
    prop('armchair', -15.6, 7.6, P * 0.75, { color: '#2f8a84' }),
    prop('floorLamp', -16.9, -1.0, 0),
    prop('bookshelf', -9.0, 11.6, P),
    prop('piano', -6.55, 0.6, -P / 2),
    prop('pottedPlant', -7.0, 11.2, 0, { tall: true }),
    prop('cardboardBox', -7.3, 8.3, 0.3),
    prop('mouseHome', -17.85, 10.5, P / 2),
    prop('wallFrame', -15.5, -1.84, 0, { color: '#f5b92e', w: 1.4, h: 1.0 }, 2.0),
    prop('wallFrame', -8.6, -1.84, 0, { color: '#e0452b', art: 'portrait', w: 0.9, h: 1.2 }, 2.1),
    // Dining room
    prop('rug', 0, 5, 0, { w: 6.4, d: 4.4, color: '#a3362c' }),
    prop('diningTable', 0, 5, 0),
    prop('chair', -1, 6.4, P),
    prop('chair', 1, 6.4, P),
    prop('chair', -1, 3.6, 0),
    prop('chair', 1, 3.6, 0),
    prop('chair', -2.5, 5, P / 2),
    prop('chair', 2.5, 5, -P / 2),
    prop('sideboard', -3.9, -1.4, 0, undefined, 0, 'dining-plates'),
    prop('pottedPlant', 4.9, -1.0, 0, { tall: true }),
    prop('grandfatherClock', 4.4, 11.5, P),
    prop('wallFrame', -5.84, 9.5, P / 2, { color: '#2f8a84', w: 1.2, h: 0.9 }, 2.0),
    // Kitchen
    prop('counter', 17.45, 0.6, -P / 2, { w: 4.4 }),
    prop('counter', 17.45, 5.0, -P / 2, { w: 4.4, variant: 'sink' }),
    prop('counter', 17.45, 8.4, -P / 2, { w: 2.4, variant: 'stove' }),
    prop('fridge', 17.2, 10.9, -P / 2),
    prop('counter', 15.4, -1.45, 0, { w: 3.6 }),
    prop('kitchenTable', 11.5, 4.2, 0),
    prop('chair', 10.6, 5.4, P, { color: '#f4efe4', seat: '#e0452b' }),
    prop('chair', 12.4, 5.4, P, { color: '#f4efe4', seat: '#e0452b' }),
    prop('chair', 11.5, 3.0, 0, { color: '#f4efe4', seat: '#e0452b' }),
    prop('trashCan', 7.0, 11.2, 0),
    prop('crate', 8.0, -0.6, 0.2, undefined, 0.5),
    // Hallway
    prop('rug', 0, -4, 0, { w: 30, d: 1.7, color: '#2f8a84' }),
    prop('coatRack', -16.9, -4.6, 0),
    prop('pottedPlant', 16.9, -5.1, 0),
    prop('cardboardBox', 5.0, -5.25, 0),
    prop('wallFrame', 3.0, -5.84, P, { color: '#e0452b', w: 1.2, h: 0.9 }, 2.0),
    prop('wallFrame', -3.0, -2.16, P, { color: '#2f8a84', art: 'portrait', w: 0.8, h: 1.1 }, 2.0),
    // Blue bedroom
    prop('rug', -11, -10.2, 0, { w: 5, d: 3.4, color: '#5c8fc9' }),
    prop('bed', -13, -13.85, 0, { quilt: '#5c8fc9' }),
    prop('nightstand', -10.7, -15.35, 0),
    prop('dresser', -4.2, -15.4, 0, undefined, 0, 'blue-clock'),
    prop('wardrobe', -17.3, -9.0, P / 2),
    prop('wallFrame', -13, -15.84, 0, { color: '#f5b92e', w: 1.5, h: 0.6 }, 2.6),
    // Rose bedroom
    prop('rug', 7.5, -10.5, 0, { w: 4.2, round: true, color: '#e9a7a0' }),
    prop('bed', 13, -13.85, 0, { quilt: '#e9a7a0' }),
    prop('nightstand', 10.7, -15.35, 0),
    prop('wardrobe', 17.3, -9.5, -P / 2, { color: '#d89b5f' }),
    prop('toyBox', 3.6, -15.3, 0),
    prop('cardboardBox', 1.6, -7.3, 0.2),
    // Backyard
    prop('doghouse', 12, 27, P),
    prop('dogBowl', 9.8, 24.6, 0),
    prop('tree', -1.5, 21, 0, { size: 1 }),
    prop('tree', 16, 31.5, 0, { size: 0.85 }),
    prop('picnicTable', 3.5, 28, 0),
    prop('birdbath', -9.5, 18, 0),
    prop('wheelbarrow', 17.2, 17, 0.5),
    prop('flowerBed', -3, 13.2, 0, { w: 4, d: 0.9 }),
    prop('flowerBed', 15, 13.2, 0, { w: 4, d: 0.9 }),
    prop('crate', 6.5, 20.5, 0.4, undefined, 0.5),
    prop('crate', 7.2, 21.2, 0.1, undefined, 1.5),
    prop('cardboardBox', -17.5, 14.5, 0.3),
    // Flower garden (hedged)
    prop('hedge', -16, 24, 0, { w: 8 }),
    prop('hedge', -7.5, 24, 0, { w: 3 }),
    prop('flowerBed', -16, 27.5, 0, { w: 6, d: 1.4 }),
    prop('flowerBed', -16, 31.5, 0, { w: 6, d: 1.4 }),
    prop('fountain', -9, 29.5, 0),
    prop('gnome', -12.6, 32.6, 0.4),
    prop('pottedPlant', -6.8, 25.4, 0),
  ],
  zones: [
    { id: 'mouse-home', label: 'Mouse hole', center: [-17.2, 0, 10.5], radius: 1.0, marker: true },
    { id: 'doghouse', label: 'Doghouse', center: [12, 0, 25], radius: 2.5 },
    { id: 'fridge', label: 'Fridge', center: [15.6, 0, 10.9], radius: 1.4 },
    { id: 'garden', label: 'Flower garden', center: [-13, 0, 29], radius: 5 },
  ],
  patrolPoints: [
    [-12, 6], [-9, -1], [0, 9], [0, 1], [11, 8], [11, 0], [-9, -10], [-3, -9], [9, -10], [4, -9],
    [-14, -4], [0, -4], [14, -4], [0, 18], [8, 17], [-12, 16], [2, 31], [-13, 26.5],
  ],
  lighting: {
    night: {
      sky: '#18243f',
      fog: '#18243f',
      ambient: 0.55,
      hemi: ['#8a9fd6', '#4a3420', 0.9],
      sun: { color: '#b6c8ff', intensity: 1.1, position: [-24, 40, 34] },
      lamps: 1,
      exposure: 1.05,
    },
    day: {
      sky: '#9fd8e6',
      fog: '#cbe9ef',
      ambient: 0.75,
      hemi: ['#ffffff', '#b98b5a', 1.0],
      sun: { color: '#fff1d0', intensity: 2.4, position: [28, 46, 30] },
      lamps: 0.25,
      exposure: 1.0,
    },
  },
};
