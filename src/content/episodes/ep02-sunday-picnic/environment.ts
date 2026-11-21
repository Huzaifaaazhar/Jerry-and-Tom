/**
 * Episode-specific environment: the shared classic house, re-dressed for a Sunday picnic.
 * Built with deriveEnvironment so the base house and every shared asset stay untouched.
 */
import { deriveEnvironment } from '@engine/environment/derive';
import { classicHouse } from '../../environments/classicHouse';

export const picnicHouse = deriveEnvironment(classicHouse, {
  id: 'classic-house-picnic',
  name: 'The Classic House - Picnic Day',
  addProps: [
    { id: 'picnic-blanket', type: 'picnicBlanket', position: [-0.5, 0, 24.6], options: { w: 3.6, d: 2.6 } },
    { id: 'picnic-basket', type: 'picnicBasket', position: [0.6, 0, 25.2], rotation: 0.3 },
    { id: 'picnic-umbrella', type: 'patioUmbrella', position: [6.2, 0, 28.6], options: { color: '#e0452b' } },
    { id: 'lawn-chair-1', type: 'lawnChair', position: [-2.4, 0, 14.4], rotation: Math.PI },
    { id: 'lawn-chair-2', type: 'lawnChair', position: [2.6, 0, 14.4], rotation: Math.PI, options: { color: '#f5b92e' } },
    { id: 'laundry', type: 'laundryBasket', position: [-4.8, 0, 14.9] },
    { id: 'garden-bench', type: 'gardenBench', position: [-14.5, 0, 25.4] },
  ],
  addZones: [
    { id: 'picnic', label: 'Picnic', center: [2.5, 0, 26.5], radius: 3.6 },
    { id: 'patio-zone', label: 'Patio', center: [0, 0, 14], radius: 2.5 },
  ],
  addPatrolPoints: [
    [-1, 26],
    [6, 25],
  ],
});
