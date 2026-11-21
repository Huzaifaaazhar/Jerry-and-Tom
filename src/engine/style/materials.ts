/**
 * Shared cel-shaded materials and procedural canvas textures. Every mesh in the game goes through
 * these helpers so the look stays consistent and materials are reused (fewer GPU programs).
 */
import * as THREE from 'three';
import type { FloorStyle, WallpaperStyle } from '../environment/types';
import { palette } from './palette';

let gradient: THREE.DataTexture | null = null;
/** 4-step toon ramp: deep shadow, shadow, lit, highlight. */
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export function toon(color: string, opts: { map?: THREE.Texture | null; key?: string; transparent?: boolean; opacity?: number; emissive?: string; emissiveIntensity?: number; side?: THREE.Side } = {}) {
  const key = `${color}|${opts.key ?? ''}|${opts.opacity ?? 1}|${opts.emissive ?? ''}|${opts.side ?? 0}`;
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGradient(),
      map: opts.map ?? null,
      transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0),
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
}

export function basic(color: string, opts: { transparent?: boolean; opacity?: number; key?: string } = {}) {
  const key = `basic|${color}|${opts.opacity ?? 1}|${opts.key ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opts.transparent ?? (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1 });
    cache.set(key, m);
  }
  return m;
}

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

export function wallpaperTexture(w: WallpaperStyle) {
  return canvasTexture(`wp|${w.base}|${w.accent}|${w.pattern}`, 128, 128, (g) => {
    g.fillStyle = w.base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = w.accent;
    g.strokeStyle = w.accent;
    switch (w.pattern) {
      case 'stripes':
        for (let x = 0; x < 128; x += 32) {
          g.fillRect(x + 4, 0, 10, 128);
          g.fillRect(x + 20, 0, 3, 128);
        }
        break;
      case 'diamonds':
        g.lineWidth = 3;
        for (let y = 0; y < 128; y += 32)
          for (let x = 0; x < 128; x += 32) {
            g.beginPath();
            g.moveTo(x + 16, y + 4);
            g.lineTo(x + 28, y + 16);
            g.lineTo(x + 16, y + 28);
            g.lineTo(x + 4, y + 16);
            g.closePath();
            g.stroke();
          }
        break;
      case 'dots':
        for (let y = 0; y < 128; y += 32)
          for (let x = 0; x < 128; x += 32) {
            g.beginPath();
            g.arc(x + ((y / 32) % 2) * 16 + 8, y + 16, 5, 0, Math.PI * 2);
            g.fill();
          }
        break;
      case 'flowers':
        for (let y = 0; y < 128; y += 64)
          for (let x = 0; x < 128; x += 64) {
            const cx = x + ((y / 64) % 2) * 32 + 16;
            const cy = y + 24;
            for (let k = 0; k < 5; k++) {
              g.beginPath();
              g.arc(cx + Math.cos((k / 5) * Math.PI * 2) * 7, cy + Math.sin((k / 5) * Math.PI * 2) * 7, 5, 0, Math.PI * 2);
              g.fill();
            }
            g.fillStyle = palette.mustard;
            g.beginPath();
            g.arc(cx, cy, 4, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = w.accent;
          }
        break;
      default:
        break;
    }
  });
}

export function floorTexture(style: FloorStyle, color: string) {
  return canvasTexture(`floor|${style}|${color}`, 256, 256, (g) => {
    const base = new THREE.Color(color);
    const dark = base.clone().multiplyScalar(0.78).getStyle();
    const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.12).getStyle();
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 256);
    switch (style) {
      case 'wood':
        for (let y = 0; y < 256; y += 32) {
          g.fillStyle = (y / 32) % 2 ? light : color;
          g.fillRect(0, y, 256, 32);
          g.fillStyle = dark;
          g.fillRect(0, y, 256, 2);
          const off = ((y / 32) * 97) % 256;
          g.fillRect(off, y, 2, 32);
          g.fillRect((off + 128) % 256, y, 2, 32);
          g.globalAlpha = 0.25;
          for (let k = 0; k < 3; k++) g.fillRect((off + 30 + k * 60) % 256, y + 10 + k * 5, 40, 1);
          g.globalAlpha = 1;
        }
        break;
      case 'checker':
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            g.fillStyle = (x + y) % 2 ? palette.cream : color;
            g.fillRect(x * 64, y * 64, 64, 64);
          }
        break;
      case 'tile':
        g.fillStyle = dark;
        for (let k = 0; k <= 256; k += 64) {
          g.fillRect(k - 1, 0, 2, 256);
          g.fillRect(0, k - 1, 256, 2);
        }
        break;
      case 'carpet':
        g.globalAlpha = 0.18;
        for (let k = 0; k < 900; k++) {
          g.fillStyle = k % 2 ? dark : light;
          g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
        g.globalAlpha = 1;
        break;
      case 'grass':
        for (let k = 0; k < 1400; k++) {
          g.fillStyle = k % 3 ? dark : light;
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          g.fillRect(x, y, 2, 5);
        }
        break;
      case 'patio':
        g.fillStyle = dark;
        for (let y = 0; y < 256; y += 64) {
          g.fillRect(0, y, 256, 3);
          const off = (y / 64) % 2 ? 32 : 0;
          for (let x = off; x < 256 + 64; x += 64) g.fillRect(x, y, 3, 64);
        }
        break;
    }
  });
}

/** Large soft shadow blob for characters (cheap contact shadow that reads well in cartoons). */
export function blobTexture() {
  return canvasTexture('blob', 64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

export function makeCanvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  return canvasTexture(key, w, h, draw);
}
