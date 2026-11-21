/**
 * Optional: an episode-specific environment derived from a shared one. Uncomment the import and
 * registerEnvironment call in index.ts and set `environment: 'my-environment-id'`.
 */
import { deriveEnvironment } from '@engine/environment/derive';
import { classicHouse } from '../../environments/classicHouse';

export const myEnvironment = deriveEnvironment(classicHouse, {
  id: 'my-environment-id',
  name: 'The Classic House - My Variation',
  removeProps: ['hall-barricade'],
  addProps: [{ type: 'laundryBasket', position: [-4.8, 0, 14.9] }],
  addZones: [{ id: 'my-zone', label: 'My zone', center: [0, 0, 20], radius: 2 }],
});
