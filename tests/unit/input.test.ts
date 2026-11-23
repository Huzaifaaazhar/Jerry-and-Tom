import { describe, expect, it, beforeEach } from 'vitest';
import { handleKey, input, updateInput, consume, resetInput, touchMove } from '../../src/engine/input/input';

describe('input system', () => {
  beforeEach(() => resetInput());

  it('maps WASD to a normalised move vector', () => {
    handleKey('KeyW', true);
    handleKey('KeyD', true);
    updateInput(1 / 60);
    expect(Math.hypot(input.move.x, input.move.y)).toBeCloseTo(1);
    expect(input.move.x).toBeGreaterThan(0);
    expect(input.move.y).toBeGreaterThan(0);
  });

  it('latches button presses until consumed', () => {
    handleKey('Space', true);
    handleKey('Space', false);
    expect(consume('jump')).toBe(true);
    expect(consume('jump')).toBe(false);
  });

  it('combines touch stick with keyboard', () => {
    touchMove.x = -1;
    updateInput(1 / 60);
    expect(input.move.x).toBe(-1);
  });
});
