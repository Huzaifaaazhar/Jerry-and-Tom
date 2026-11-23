/**
 * The in-game canvas plus the desktop input bridge (keyboard, pointer lock, mouse look, wheel).
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '@engine/core/store';
import { getEpisode } from '@engine/episode/registry';
import { GameSession } from '@engine/game/GameSession';
import { handleKey, addLook, input, resetInput, setButton } from '@engine/input/input';
import { world } from '@engine/core/world';
import { audio } from '@engine/audio/audio';

function Ready() {
  useEffect(() => {
    const t = setTimeout(() => useGame.getState().setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function GameView() {
  const episodeId = useGame((s) => s.episodeId);
  const characterId = useGame((s) => s.characterId);
  const runId = useGame((s) => s.runId);
  const startStage = useGame((s) => s.startStage);
  const quality = useGame((s) => s.settings.quality);
  const maxDpr = quality === 'low' ? 1 : quality === 'high' ? 2 : 1.75;
  const [dpr, setDpr] = useState(Math.min(maxDpr, window.devicePixelRatio || 1));
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const store = useGame;
    const onKey = (e: KeyboardEvent) => {
      const s = store.getState();
      if (s.screen !== 'playing') return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && e.type === 'keydown') {
        if (!world.finished) s.setPaused(!s.paused);
        e.preventDefault();
        return;
      }
      if (s.paused) return;
      if (handleKey(e.code, e.type === 'keydown')) e.preventDefault();
    };
    const onLock = () => {
      const locked = document.pointerLockElement === wrap.current?.querySelector('canvas');
      const s = store.getState();
      s.setPointerLocked(locked);
      if (!locked && s.screen === 'playing' && !s.paused && !world.finished) s.setPaused(true);
    };
    const onMove = (e: MouseEvent) => {
      if (store.getState().paused) return;
      if (document.pointerLockElement) addLook(e.movementX, e.movementY);
      else if (drag.current) {
        addLook(e.clientX - drag.current.x, e.clientY - drag.current.y);
        drag.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = () => (drag.current = null);
    const onBlur = () => {
      resetInput();
      const s = store.getState();
      if (s.screen === 'playing' && !world.finished) s.setPaused(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      document.removeEventListener('pointerlockchange', onLock);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  // Resume => recapture the mouse.
  const paused = useGame((s) => s.paused);
  useEffect(() => {
    if (!paused) resetInput();
  }, [paused]);

  if (!episodeId || !characterId) return null;
  const ep = getEpisode(episodeId);
  return (
    <div
      ref={wrap}
      className="game-view"
      onContextMenu={(e) => e.preventDefault()}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') return;
        setButton('keyboard', 'interact', false);
        setButton('keyboard', 'ability', false);
      }}
      onPointerDown={(e) => {
        audio.unlock();
        if (e.pointerType !== 'mouse') return;
        const canvas = wrap.current?.querySelector('canvas');
        const s = useGame.getState();
        // With the mouse captured: left click = interact / grab, right click = ability.
        if (document.pointerLockElement && s.screen === 'playing' && !s.paused) {
          if (e.button === 0) setButton('keyboard', 'interact', true);
          if (e.button === 2) setButton('keyboard', 'ability', true);
          return;
        }
        if (canvas && !document.pointerLockElement && s.screen === 'playing' && !s.paused) {
          try {
            const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
            p?.catch?.(() => undefined);
          } catch {
            /* pointer lock unavailable: drag-to-look still works */
          }
        }
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onWheel={(e) => (input.zoom += e.deltaY)}
    >
      <Canvas
        key={runId}
        shadows={quality !== 'low'}
        dpr={dpr}
        camera={{ fov: 60, near: 0.05, far: 160, position: [0, 6, 10] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
      >
        {quality === 'auto' && (
          // Adaptive resolution: drop pixel ratio on struggling devices, raise it again when smooth.
          <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))} />
        )}
        <Suspense fallback={null}>
          <GameSession episode={ep} playerCharacterId={characterId} runId={runId} startStage={startStage} />
          <Ready />
        </Suspense>
      </Canvas>
    </div>
  );
}
