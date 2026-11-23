/**
 * Mobile touch layer, designed for two thumbs:
 *  - Left thumb: floating analog stick. Push gently to walk, push to the edge to run. A small
 *    sneak toggle sits above it.
 *  - Right thumb: swipe anywhere to look, plus a four-button arc around the thumb - Jump (big),
 *    a contextual action button that relabels itself ("Hide", "Grab Pip!", "Open door"...),
 *    and the character's ability and trap.
 * Everything writes into the same InputState as keyboard and gamepad.
 */
import { useRef, useState } from 'react';
import { touchMove, setButton, addLook, type Button } from '@engine/input/input';
import { useGame } from '@engine/core/store';
import { getCharacter } from '@engine/characters/registry';
import { Bolt, Laugh, ITEM_ICONS } from '../components/Icons';

/** Pointer capture can throw (e.g. pointer already released); input must never depend on it. */
function capture(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* ignore */
  }
}

function HoldButton({ b, label, className = '', children, badge }: { b: Button; label: string; className?: string; children?: React.ReactNode; badge?: number }) {
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
      onContextMenu={(e) => e.preventDefault()}
    >
      {children ?? label}
      {badge !== undefined && <span className="touch-badge">{badge}</span>}
    </button>
  );
}

export function TouchControls() {
  const characterId = useGame((s) => s.characterId);
  const prompt = useGame((s) => s.hud.prompt);
  const charges = useGame((s) => s.hud.charges);
  const def = characterId ? getCharacter(characterId) : null;
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [sneak, setSneak] = useState(false);
  const R = 58;
  const trapKind = def?.trap?.kind;
  const TrapIcon = trapKind ? ITEM_ICONS[trapKind] : null;
  const actionLabel = prompt ? (prompt.length > 16 ? prompt.split(' ').slice(0, 2).join(' ') : prompt) : 'Use';

  const endStick = () => {
    stick.current = null;
    touchMove.x = touchMove.y = 0;
    setButton('touch', 'sprint', false);
    setKnob(null);
  };

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
          // Small dead zone, then analog speed; pushing to the edge breaks into a run.
          const mag = Math.min(1, len / R);
          const k = mag < 0.12 ? 0 : (mag - 0.12) / 0.88 / Math.max(mag, 1e-3);
          touchMove.x = (dx / R) * k;
          touchMove.y = (-dy / R) * k;
          setButton('touch', 'sprint', mag > 0.82);
          setKnob({ x: s.x, y: s.y, dx, dy });
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        {knob ? (
          <div className="stick" style={{ left: knob.x, top: knob.y }}>
            <div className={`stick-knob ${Math.hypot(knob.dx, knob.dy) > R * 0.82 ? 'running' : ''}`} style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
          </div>
        ) : (
          <p className="touch-hint">Drag to move · push further to run</p>
        )}
      </div>
      <button
        className={`touch-sneak ${sneak ? 'on' : ''}`}
        aria-pressed={sneak}
        aria-label="Sneak"
        onPointerDown={(e) => {
          e.stopPropagation();
          const next = !sneak;
          setSneak(next);
          setButton('touch', 'sneak', next);
        }}
      >
        Sneak
      </button>
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
      <div className="touch-arc">
        <HoldButton b="jump" label="Jump" className="arc-jump" />
        <HoldButton b="interact" label={actionLabel} className={`arc-use ${prompt ? 'ready' : ''}`} />
        {def?.ability && (
          <HoldButton b="ability" label={def.ability === 'pounce' ? 'Pounce' : 'Taunt'} className="arc-ability">
            {def.ability === 'pounce' ? <Bolt /> : <Laugh />}
          </HoldButton>
        )}
        {trapKind && (
          <HoldButton b="trap" label={trapKind === 'bananaPeel' ? 'Drop banana peel' : 'Set mousetrap'} className="arc-trap" badge={charges[trapKind] ?? 0}>
            {TrapIcon ? <TrapIcon /> : 'Trap'}
          </HoldButton>
        )}
      </div>
    </div>
  );
}
