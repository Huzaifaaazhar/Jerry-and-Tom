import { describe, expect, it } from 'vitest';
import { splitWall, wallBoxes, roomFaces, roomAt, transformBox } from '../../src/engine/environment/geometry';

describe('wall geometry', () => {
  it('splits a wall around a door into side pieces and a lintel', () => {
    const pieces = splitWall(10, 3.6, [{ at: 5, width: 2, height: 2.8, kind: 'door' }]);
    expect(pieces).toEqual([
      { u0: 0, u1: 4, y0: 0, y1: 3.6 },
      { u0: 4, u1: 6, y0: 2.8, y1: 3.6 },
      { u0: 6, u1: 10, y0: 0, y1: 3.6 },
    ]);
  });

  it('gives windows a sill, a glass pane and a lintel', () => {
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const pieces = splitWall(6, 3.6, [{ at: 3, width: 2, height: 1.4, kind: 'window', sill: 1.2 }]).map((p) => ({ ...p, y0: round(p.y0), y1: round(p.y1) }));
    expect(pieces.filter((p) => p.u0 === 2)).toEqual([
      { u0: 2, u1: 4, y0: 0, y1: 1.2 },
      { u0: 2, u1: 4, y0: 1.2, y1: 2.6, glass: true },
      { u0: 2, u1: 4, y0: 2.6, y1: 3.6 },
    ]);
  });

  it('keeps a low lintel above a mouse hole', () => {
    const pieces = splitWall(4, 3.6, [{ at: 2, width: 0.5, height: 0.6, kind: 'mousehole' }]);
    expect(pieces.find((p) => p.u0 === 1.75)).toEqual({ u0: 1.75, u1: 2.25, y0: 0.6, y1: 3.6 });
  });

  it('orients wall boxes along the wall direction', () => {
    const [b] = wallBoxes({ from: [0, 0], to: [0, 4] }, 3);
    expect(b.center[0]).toBeCloseTo(0);
    expect(b.center[2]).toBeCloseTo(2);
    expect(b.size[0]).toBeCloseTo(4);
    expect(Math.abs(Math.cos(b.rotation!))).toBeCloseTo(0);
  });

  it('finds the inward side of walls for each room', () => {
    const rooms = [
      { id: 'a', name: 'A', bounds: [0, 0, 4, 4] as [number, number, number, number], floor: 'wood' as const },
      { id: 'b', name: 'B', bounds: [0, 4, 4, 8] as [number, number, number, number], floor: 'wood' as const },
    ];
    const faces = roomFaces(rooms, [{ from: [0, 4], to: [4, 4] }]);
    const a = faces.find((f) => f.roomId === 'a')!;
    const b = faces.find((f) => f.roomId === 'b')!;
    // Left normal of a +x wall points to -z, where room A is.
    expect(a.side).toBe(1);
    expect(b.side).toBe(-1);
  });

  it('prefers the smallest room when areas overlap', () => {
    const rooms = [
      { id: 'yard', name: 'Yard', bounds: [0, 0, 20, 20] as [number, number, number, number], floor: 'grass' as const },
      { id: 'patio', name: 'Patio', bounds: [0, 0, 5, 5] as [number, number, number, number], floor: 'patio' as const },
    ];
    expect(roomAt(rooms, 2, 2)?.id).toBe('patio');
    expect(roomAt(rooms, 10, 10)?.id).toBe('yard');
  });

  it('transforms local boxes by yaw', () => {
    const b = transformBox({ center: [1, 0, 0], size: [1, 1, 1] }, [10, 0, 10], Math.PI / 2);
    expect(b.center[0]).toBeCloseTo(10);
    expect(b.center[2]).toBeCloseTo(9);
  });
});
