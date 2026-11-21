/**
 * Device-agnostic input. Keyboard/mouse, touch and gamepad all write into one InputState;
 * the player controller reads it once per frame. Edge-triggered buttons ("pressed this frame")
 * are latched until consumed so short taps between frames are never lost.
 */
export type Button = 'jump' | 'sprint' | 'sneak' | 'interact' | 'ability' | 'trap' | 'pause';

export interface InputState {
  /** Local move axes: x = right, y = forward. Range -1..1. */
  move: { x: number; y: number };
  look: { x: number; y: number };
  zoom: number;
  held: Record<Button, boolean>;
  pressed: Record<Button, boolean>;
  source: 'keyboard' | 'touch' | 'gamepad';
}

const buttons: Button[] = ['jump', 'sprint', 'sneak', 'interact', 'ability', 'trap', 'pause'];
const blank = () => Object.fromEntries(buttons.map((b) => [b, false])) as Record<Button, boolean>;

export const input: InputState = {
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  zoom: 0,
  held: blank(),
  pressed: blank(),
  source: 'keyboard',
};

/** Separate channels so keyboard, touch stick and gamepad can be combined. */
const keyMove = { x: 0, y: 0 };
export const touchMove = { x: 0, y: 0 };
const padMove = { x: 0, y: 0 };
const heldBy = { keyboard: blank(), touch: blank(), gamepad: blank() };

export function setButton(src: 'keyboard' | 'touch' | 'gamepad', b: Button, down: boolean) {
  const was = input.held[b];
  heldBy[src][b] = down;
  input.held[b] = heldBy.keyboard[b] || heldBy.touch[b] || heldBy.gamepad[b];
  if (input.held[b] && !was) input.pressed[b] = true;
  if (down) input.source = src;
}

export function consume(b: Button): boolean {
  const v = input.pressed[b];
  input.pressed[b] = false;
  return v;
}

export function addLook(dx: number, dy: number) {
  input.look.x += dx;
  input.look.y += dy;
}

export function consumeLook() {
  const l = { ...input.look };
  input.look.x = 0;
  input.look.y = 0;
  return l;
}

export function consumeZoom() {
  const z = input.zoom;
  input.zoom = 0;
  return z;
}

export function resetInput() {
  keyMove.x = keyMove.y = 0;
  touchMove.x = touchMove.y = 0;
  padMove.x = padMove.y = 0;
  for (const src of Object.values(heldBy)) for (const b of buttons) src[b] = false;
  for (const b of buttons) {
    input.held[b] = false;
    input.pressed[b] = false;
  }
  input.move.x = input.move.y = 0;
  input.look.x = input.look.y = 0;
  input.zoom = 0;
  keysDown.clear();
}

/** Default desktop bindings. Exported so the how-to-play screen documents the real mapping. */
export const KEY_BINDINGS: Record<string, Button | 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'sneak',
  KeyC: 'sneak',
  KeyE: 'interact',
  KeyF: 'ability',
  KeyQ: 'trap',
  Escape: 'pause',
  KeyP: 'pause',
};

const keysDown = new Set<string>();

function recomputeKeyMove() {
  keyMove.x = (keysDown.has('right') ? 1 : 0) - (keysDown.has('left') ? 1 : 0);
  keyMove.y = (keysDown.has('up') ? 1 : 0) - (keysDown.has('down') ? 1 : 0);
}

export function handleKey(code: string, down: boolean): boolean {
  const action = KEY_BINDINGS[code];
  if (!action) return false;
  if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
    if (down) keysDown.add(action);
    else keysDown.delete(action);
    recomputeKeyMove();
    if (down) input.source = 'keyboard';
  } else {
    setButton('keyboard', action, down);
  }
  return true;
}

const PAD_BUTTONS: [number, Button][] = [
  [0, 'jump'],
  [2, 'interact'],
  [1, 'trap'],
  [3, 'ability'],
  [10, 'sprint'],
  [7, 'sprint'],
  [6, 'sneak'],
  [9, 'pause'],
];

function pollGamepad(dt: number) {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && Array.from(pads).find((p) => p && p.connected);
  if (!pad) {
    padMove.x = padMove.y = 0;
    return;
  }
  const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
  padMove.x = dz(pad.axes[0] ?? 0);
  padMove.y = -dz(pad.axes[1] ?? 0);
  const lx = dz(pad.axes[2] ?? 0);
  const ly = dz(pad.axes[3] ?? 0);
  if (lx || ly) addLook(lx * 900 * dt, ly * 600 * dt);
  const seen = new Set<Button>();
  for (const [i, b] of PAD_BUTTONS) {
    const down = !!pad.buttons[i]?.pressed;
    if (seen.has(b) && !down) continue;
    seen.add(b);
    setButton('gamepad', b, down);
  }
}

/** Call once per frame before simulation reads `input`. */
export function updateInput(dt: number) {
  pollGamepad(dt);
  let x = keyMove.x + touchMove.x + padMove.x;
  let y = keyMove.y + touchMove.y + padMove.y;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  input.move.x = x;
  input.move.y = y;
}
