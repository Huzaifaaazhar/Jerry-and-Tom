/**
 * Mobile touch layer: floating left stick, swipe-to-look on the right half, and action buttons.
 * Writes into the same InputState as keyboard and gamepad.
 */
import { useRef, useState } from 'react';
import { touchMove, setButton, addLook, type Button } from '@engine/input/input';
import { useGame } from '@engine/core/store';
import { getCharacter } from '@engine/characters/registry';

/** Pointer capture can throw (e.g. pointer already released); input must never depend on it. */
function capture(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* ignore */
  }
}

function HoldButton({ b, label, className = '' }: { b: Button; label: string; className?: string }) {
  return (
    <button
      className={`touch-btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        capture(e.currentTarget, e.pointerId);
        setButton('touch', b, true);
      }}
      onPointerUp={() => setButton('touch', b, false)}
      onPointerCancel={() => setButton('touch', b, false)}
    >
      {label}
    </button>
  );
}

export function TouchControls() {
  const characterId = useGame((s) => s.characterId);
  const prompt = useGame((s) => s.hud.prompt);
  const useLabel = prompt ? (prompt.length > 14 ? prompt.split(' ').slice(0, 2).join(' ') : prompt) : 'Use';
  const def = characterId ? getCharacter(characterId) : null;
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const R = 56;
  return (
    <div className="touch">
      <div
        className="touch-left"
        onPointerDown={(e) => {
          capture(e.currentTarget, e.pointerId);
          stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          setKnob({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
        }}
        onPointerMove={(e) => {
          const s = stick.current;
          if (!s || s.id !== e.pointerId) return;
          let dx = e.clientX - s.x;
          let dy = e.clientY - s.y;
          const len = Math.hypot(dx, dy);
          if (len > R) {
            dx = (dx / len) * R;
            dy = (dy / len) * R;
          }
          touchMove.x = dx / R;
          touchMove.y = -dy / R;
          setButton('touch', 'sprint', len > R * 0.95);
          setKnob({ x: s.x, y: s.y, dx, dy });
        }}
        onPointerUp={() => {
          stick.current = null;
          touchMove.x = touchMove.y = 0;
          setButton('touch', 'sprint', false);
          setKnob(null);
        }}
        onPointerCancel={() => {
          stick.current = null;
          touchMove.x = touchMove.y = 0;
          setKnob(null);
        }}
      >
        {knob && (
          <div className="stick" style={{ left: knob.x, top: knob.y }}>
            <div className="stick-knob" style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
          </div>
        )}
        {!knob && <p className="touch-hint">Drag to move</p>}
      </div>
      <div
        className="touch-right"
        onPointerDown={(e) => {
          capture(e.currentTarget, e.pointerId);
          look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const l = look.current;
          if (!l || l.id !== e.pointerId) return;
          addLook((e.clientX - l.x) * 2.2, (e.clientY - l.y) * 2.2);
          l.x = e.clientX;
          l.y = e.clientY;
        }}
        onPointerUp={() => (look.current = null)}
        onPointerCancel={() => (look.current = null)}
      />
      <div className="touch-buttons">
        <HoldButton b="jump" label="Jump" className="big" />
        <HoldButton b="interact" label={useLabel} className={`big ${prompt ? 'ready' : ''}`} />
        <HoldButton b="sprint" label="Run" />
        <HoldButton b="sneak" label="Sneak" />
        {def?.trap && <HoldButton b="trap" label="Trap" />}
        {def?.ability && <HoldButton b="ability" label={def.ability === 'pounce' ? 'Pounce' : 'Taunt'} />}
      </div>
    </div>
  );
}
