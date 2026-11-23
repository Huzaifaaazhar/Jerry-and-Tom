import { describe, expect, it } from 'vitest';
import { NavGrid, pathLength } from '../../src/engine/ai/navgrid';
import { wallBoxes } from '../../src/engine/environment/geometry';

const bounds: [number, number, number, number] = [-6, -6, 6, 6];
// Two rooms split by a wall at z=0 with only a mouse hole at x=0.
const walls = wallBoxes({ from: [-6, 0], to: [6, 0], openings: [{ at: 6, width: 0.55, height: 0.62, kind: 'mousehole' }] }, 3);
const mouse = new NavGrid(bounds, 0.25, { id: 'small', radius: 0.12, height: 0.56 }, walls);
const cat = new NavGrid(bounds, 0.25, { id: 'large', radius: 0.46, height: 1.5 }, walls);

describe('NavGrid', () => {
  it('lets a mouse path through a mouse hole', () => {
    const path = mouse.findPath([-3, -3], [3, 3]);
    expect(path).not.toBeNull();
    expect(path!.some(([x, z]) => Math.abs(x) < 0.4 && Math.abs(z) < 0.6)).toBe(true);
  });

  it('blocks a cat at the same mouse hole', () => {
    expect(cat.findPath([-3, -3], [3, 3])).toBeNull();
  });

  it('routes around obstacles and smooths straight runs', () => {
    const grid = new NavGrid(bounds, 0.25, { id: 'c', radius: 0.3, height: 1.5 }, [{ center: [0, 1, 0], size: [2, 2, 6] }]);
    const p = grid.findPath([-4, 0], [4, 0])!;
    expect(p).not.toBeNull();
    expect(pathLength(p)).toBeGreaterThan(8);
    expect(p.length).toBeLessThan(8);
    for (let i = 1; i < p.length; i++) expect(grid.lineOfSight(p[i - 1], p[i])).toBe(true);
  });

  it('ignores flat rugs and overhead objects for agents that fit under them', () => {
    const table = { center: [0, 1.62, 0] as [number, number, number], size: [3, 0.14, 2] as [number, number, number] };
    const rug = { center: [2, 0.02, 2] as [number, number, number], size: [3, 0.02, 2] as [number, number, number] };
    const g = new NavGrid(bounds, 0.25, { id: 'cat', radius: 0.46, height: 1.5 }, [table, rug]);
    expect(g.isFree(0, 0)).toBe(true);
    expect(g.isFree(2, 2)).toBe(true);
  });

  it('snaps blocked targets to the nearest free cell', () => {
    const g = new NavGrid(bounds, 0.25, { id: 'c', radius: 0.3, height: 1.5 }, [{ center: [0, 1, 0], size: [2, 2, 2] }]);
    const f = g.nearestFree(0, 0, 3)!;
    expect(g.isFree(f[0], f[1])).toBe(true);
  });
});
