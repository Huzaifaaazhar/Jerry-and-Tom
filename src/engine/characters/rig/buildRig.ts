/**
 * Procedural cartoon character rig. Builds a bone hierarchy (THREE.Groups) with sculpted toon
 * meshes, ink outlines (inverted hulls), expressive eyes with lids/brows/pupils and a mouth that
 * can smile, frown and open. Driven by ProceduralAnimator. Modelled in unit space, then scaled.
 *
 * This is the engine's built-in stand-in for artist-made rigged GLBs: it is a real rig with a real
 * animation set, but it is not a sculpted production model. See docs/ASSET_PIPELINE.md.
 */
import * as THREE from 'three';
import type { ProceduralLook } from '../types';
import { toon, basic, makeCanvasTexture } from '../../style/materials';
import { palette } from '../../style/palette';

export interface EyeRig {
  group: THREE.Group;
  pupil: THREE.Group;
  upperLid: THREE.Mesh;
  lowerLid: THREE.Mesh;
  brow: THREE.Group;
  side: 1 | -1;
  baseY: number;
  browBaseY: number;
}

export interface Rig {
  root: THREE.Group;
  /** Squash & stretch container (scale only). */
  squash: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  ankleL: THREE.Group;
  ankleR: THREE.Group;
  tail: THREE.Group[];
  earL: THREE.Group;
  earR: THREE.Group;
  eyes: [EyeRig, EyeRig];
  mouth: { group: THREE.Group; smile: THREE.Mesh; open: THREE.Group; teeth: THREE.Object3D | null };
  stars: THREE.Group;
  zzz: THREE.Group;
  sweat: THREE.Mesh;
  /** Unit-space layout numbers the animator needs. */
  dims: { legLength: number; hipsY: number; headR: number; unitScale: number; earType: ProceduralLook['ears']['type'] };
}

const ink = () => basic(palette.ink, { key: 'outline' });
const SPHERE = new THREE.SphereGeometry(1, 28, 20);
const SPHERE_LO = new THREE.SphereGeometry(1, 16, 12);
const TOP_CAP = new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const BOTTOM_CAP = new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);

function outlineFor(mesh: THREE.Mesh, t: number, ext: THREE.Vector3) {
  const hull = new THREE.Mesh(mesh.geometry, ink());
  (hull.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
  hull.scale.set(1 + t / Math.max(ext.x, 1e-3), 1 + t / Math.max(ext.y, 1e-3), 1 + t / Math.max(ext.z, 1e-3));
  hull.castShadow = false;
  hull.userData.outline = true;
  mesh.add(hull);
}

function ellipsoid(parent: THREE.Object3D, r: [number, number, number], pos: [number, number, number], mat: THREE.Material, outline = 0, lo = false) {
  const m = new THREE.Mesh(lo ? SPHERE_LO : SPHERE, mat);
  m.scale.set(...r);
  m.position.set(...pos);
  m.castShadow = true;
  if (outline > 0) outlineFor(m, outline, new THREE.Vector3(...r).multiplyScalar(1));
  parent.add(m);
  return m;
}

function capsule(parent: THREE.Object3D, radius: number, length: number, mat: THREE.Material, outline = 0) {
  const geo = new THREE.CapsuleGeometry(radius, length, 6, 14);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -length / 2 - radius * 0.3;
  m.castShadow = true;
  if (outline > 0) {
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(radius + outline, length + outline * 0.5, 6, 14), ink());
    (hull.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
    hull.userData.outline = true;
    m.add(hull);
  }
  parent.add(m);
  return m;
}

function group(parent: THREE.Object3D, pos: [number, number, number] = [0, 0, 0], name = '') {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.name = name;
  parent.add(g);
  return g;
}

function furTexture(look: ProceduralLook, part: 'body' | 'head') {
  return makeCanvasTexture(`fur|${part}|${look.fur}|${look.furDark}|${look.stripes ? 1 : 0}`, 256, 128, (g) => {
    g.fillStyle = look.fur;
    g.fillRect(0, 0, 256, 128);
    // Soft fur strokes
    g.globalAlpha = 0.12;
    g.strokeStyle = look.furDark;
    g.lineWidth = 1.5;
    for (let i = 0; i < 260; i++) {
      const x = (i * 97) % 256;
      const y = (i * 53) % 128;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 2, y + 3, x + 1, y + 7);
      g.stroke();
    }
    g.globalAlpha = 1;
    if (!look.stripes) return;
    g.fillStyle = look.furDark;
    if (part === 'body') {
      // Bands across the back (u 0.55..0.95), tapering towards the sides.
      for (let k = 0; k < 6; k++) {
        const y = 18 + k * 17;
        g.beginPath();
        g.moveTo(150, y);
        g.quadraticCurveTo(192, y - 6, 238, y + 1);
        g.quadraticCurveTo(192, y + 7, 150, y + 4);
        g.fill();
      }
    } else {
      // Forehead marks above the eyes (u ~0.25) and stripes over the back of the skull.
      for (const dx of [-10, 0, 10]) {
        g.beginPath();
        g.moveTo(64 + dx - 3, 8);
        g.lineTo(64 + dx + 3, 8);
        g.lineTo(64 + dx, 34);
        g.fill();
      }
      for (let k = 0; k < 4; k++) {
        const y = 14 + k * 14;
        g.beginPath();
        g.moveTo(160, y);
        g.quadraticCurveTo(192, y - 4, 224, y);
        g.quadraticCurveTo(192, y + 6, 160, y + 3);
        g.fill();
      }
    }
  });
}

function makeStar() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
}

export function buildRig(look: ProceduralLook): Rig {
  const L = look.legLength;
  const T = look.torso;
  const H = look.head;
  const E = look.eyes;
  const unitHeight = L + T.h * 1.8 + H.r * (0.95 + H.squash);
  const unitScale = look.height / unitHeight;
  const ol = (0.024 / Math.sqrt(look.height)) * (look.outline ?? 1);

  const furMat = toon('#ffffff', { map: furTexture(look, 'body'), key: `fur-body-${look.fur}-${look.stripes}` });
  const headMat = toon('#ffffff', { map: furTexture(look, 'head'), key: `fur-head-${look.fur}-${look.stripes}` });
  const fur = toon(look.fur);
  const furDark = toon(look.furDark);
  const belly = toon(look.belly);
  const muzzle = toon(look.muzzle);
  const nose = toon(look.nose);
  const innerEar = toon(look.innerEar);
  const white = toon('#fffdf6');
  const black = toon('#1a0f0a');
  const mouthDark = toon('#4a1a14');
  const tongue = toon('#e86a6a');

  const root = new THREE.Group();
  root.name = 'character';
  const squash = group(root, [0, 0, 0], 'squash');
  const scaled = group(squash, [0, 0, 0], 'unit');
  scaled.scale.setScalar(unitScale);

  // ----- Hips & torso -----
  const hips = group(scaled, [0, L, 0], 'hips');
  ellipsoid(hips, [T.w * 1.05, T.h * 0.62, T.d * 1.05], [0, T.h * 0.42, 0], furMat, ol);
  ellipsoid(hips, [T.w, T.h, T.d], [0, T.h * 0.9, 0], furMat, ol);
  ellipsoid(hips, [T.w * 0.74, T.h * 0.78, T.d * 0.55], [0, T.h * 0.75, T.d * 0.52 + T.belly * 0.2], belly);

  const spine = group(hips, [0, T.h * 1.1, 0], 'spine');
  const neck = group(spine, [0, T.h * 0.62, 0], 'neck');
  ellipsoid(neck, [T.w * 0.55, T.h * 0.35, T.d * 0.55], [0, 0, 0], fur);

  // ----- Head -----
  const head = group(neck, [0, H.r * 0.95, H.r * 0.06], 'head');
  const hr: [number, number, number] = [H.r * 1.08, H.r * H.squash, H.r * 0.98];
  ellipsoid(head, hr, [0, 0, 0], headMat, ol);
  if (H.cheekFluff) {
    for (const s of [-1, 1]) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(H.r * 0.22, H.r * 0.5, 8), fur);
      tuft.position.set(s * H.r * 1.02, -H.r * 0.25, -H.r * 0.05);
      tuft.rotation.z = s * -2.0;
      tuft.castShadow = true;
      head.add(tuft);
    }
  }
  if (H.jowls) {
    for (const s of [-1, 1]) ellipsoid(head, [H.r * 0.42, H.r * 0.4, H.r * 0.38], [s * H.r * 0.42, -H.r * 0.55, H.r * 0.62], muzzle, ol);
  }

  // Muzzle
  const M = H.muzzle;
  const surfZ = (x: number, y: number) => Math.sqrt(Math.max(0.02, 1 - (x / hr[0]) ** 2 - (y / hr[1]) ** 2)) * hr[2];
  const muzzleY = -H.r * 0.32;
  for (const s of [-1, 1]) ellipsoid(head, [M * 0.78, M * 0.62, M * 0.6], [s * M * 0.62, muzzleY, surfZ(s * M * 0.62, muzzleY) + M * 0.08], muzzle, ol * 0.8);
  ellipsoid(head, [M * 0.55, M * 0.45, M * 0.45], [0, muzzleY - M * 0.55, surfZ(0, muzzleY - M * 0.55) + M * 0.02], muzzle, ol * 0.8);
  const noseMesh = ellipsoid(head, [M * 0.34, M * 0.26, M * 0.26], [0, muzzleY + M * 0.42, surfZ(0, muzzleY + M * 0.42) + M * 0.32], nose, ol * 0.7);
  noseMesh.castShadow = false;

  // Whiskers
  if (look.whiskers) {
    const wMat = basic(palette.ink, { key: 'whisker' });
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(H.r * 0.75, 0.006, 0.006), wMat);
        w.position.set(s * (M * 1.15 + H.r * 0.3), muzzleY + M * 0.1 - k * M * 0.18, surfZ(M, muzzleY) + M * 0.15);
        w.rotation.z = s * (0.18 - k * 0.18);
        w.rotation.y = s * -0.3;
        head.add(w);
      }
  }

  // Mouth
  const mouthG = group(head, [0, muzzleY - M * 0.28, surfZ(0, muzzleY - M * 0.28) + M * 0.52], 'mouth');
  const smile = new THREE.Mesh(new THREE.TorusGeometry(M * 0.55, M * 0.075, 8, 20, Math.PI), black);
  smile.rotation.z = Math.PI;
  mouthG.add(smile);
  const open = group(mouthG, [0, -M * 0.25, -M * 0.05], 'mouthOpen');
  ellipsoid(open, [M * 0.5, M * 0.45, M * 0.18], [0, 0, 0], mouthDark, ol * 0.6, true);
  ellipsoid(open, [M * 0.32, M * 0.18, M * 0.12], [0, -M * 0.22, M * 0.06], tongue, 0, true);
  open.scale.y = 0.01;
  open.visible = false;
  let teeth: THREE.Object3D | null = null;
  if (look.teeth === 'buck') {
    const tg = group(mouthG, [0, -M * 0.08, M * 0.05]);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(M * 0.26, M * 0.32, M * 0.08), white);
      t.position.set(s * M * 0.14, -M * 0.12, 0);
      tg.add(t);
    }
    teeth = tg;
  } else if (look.teeth === 'underbite') {
    const tg = group(mouthG, [0, -M * 0.05, M * 0.05]);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(M * 0.12, M * 0.32, 6), white);
      t.position.set(s * M * 0.4, M * 0.05, 0);
      tg.add(t);
    }
    teeth = tg;
  } else if (look.teeth === 'fangs') {
    const tg = group(open, [0, M * 0.32, M * 0.1]);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(M * 0.08, M * 0.22, 6), white);
      t.rotation.x = Math.PI;
      t.position.set(s * M * 0.22, -M * 0.08, 0);
      tg.add(t);
    }
  }

  // Eyes
  const eyes: EyeRig[] = [];
  const lidMat = toon(look.fur);
  for (const side of [-1, 1] as const) {
    const ex = side * E.spacing;
    const ey = E.y;
    const eg = group(head, [ex, ey, surfZ(ex, ey) - E.w * 0.25], side < 0 ? 'eyeL' : 'eyeR');
    eg.rotation.y = side * 0.18;
    const er: [number, number, number] = [E.w, E.h, E.w * 0.62];
    ellipsoid(eg, er, [0, 0, 0], white, ol * 0.7);
    const pupil = group(eg, [0, 0, er[2] * 0.82], 'pupil');
    if (E.irisRing) ellipsoid(pupil, [E.w * E.pupil * 1.25, E.h * E.pupil * 1.15, E.w * 0.16], [0, 0, 0], toon(look.iris), 0, true);
    ellipsoid(pupil, [E.w * E.pupil * (E.irisRing ? 0.55 : 0.85), E.h * E.pupil * (E.irisRing ? 0.85 : 0.9), E.w * 0.18], [0, 0, E.w * 0.04], black, 0, true);
    ellipsoid(pupil, [E.w * 0.12, E.w * 0.12, E.w * 0.06], [E.w * 0.14, E.h * 0.18, E.w * 0.14], white, 0, true);
    const upper = new THREE.Mesh(TOP_CAP, lidMat);
    upper.scale.set(...er);
    upper.rotation.x = -1.2;
    eg.add(upper);
    const lower = new THREE.Mesh(BOTTOM_CAP, lidMat);
    lower.scale.set(...er);
    lower.rotation.x = 1.2;
    eg.add(lower);
    const brow = group(head, [ex, ey + E.h * 1.18, surfZ(ex, ey + E.h * 1.1) + 0.005], 'brow');
    const bm = new THREE.Mesh(new THREE.CapsuleGeometry(E.w * 0.13, E.w * 1.05, 4, 8), look.head.brow === false ? lidMat : toon(look.furDark));
    bm.rotation.z = Math.PI / 2;
    brow.add(bm);
    eyes.push({ group: eg, pupil, upperLid: upper, lowerLid: lower, brow, side, baseY: ey, browBaseY: ey + E.h * 1.18 });
  }

  // Ears
  const ears: THREE.Group[] = [];
  const ES = look.ears.size;
  for (const side of [-1, 1] as const) {
    let eg: THREE.Group;
    if (look.ears.type === 'pointed') {
      eg = group(head, [side * hr[0] * 0.52, hr[1] * 0.72, -H.r * 0.05]);
      eg.rotation.z = side * -0.38;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(ES * 0.5, ES, 14), fur);
      outer.scale.z = 0.45;
      outer.position.y = ES * 0.42;
      outer.castShadow = true;
      outlineFor(outer, ol, new THREE.Vector3(ES * 0.5, ES * 0.5, ES * 0.22));
      eg.add(outer);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(ES * 0.32, ES * 0.7, 12), innerEar);
      inner.scale.z = 0.3;
      inner.position.set(0, ES * 0.34, ES * 0.08);
      eg.add(inner);
    } else if (look.ears.type === 'round') {
      // Tall oval ears set low on the sides of the head and swept back.
      eg = group(head, [side * hr[0] * 0.86, hr[1] * 0.38, -H.r * 0.18]);
      eg.rotation.z = side * -1.0;
      eg.rotation.y = side * -0.45;
      const outer = ellipsoid(eg, [ES * 0.7, ES, ES * 0.18], [0, ES * 0.9, 0], fur, ol);
      outer.castShadow = true;
      ellipsoid(eg, [ES * 0.5, ES * 0.78, ES * 0.1], [0, ES * 0.9, ES * 0.09], innerEar);
    } else {
      eg = group(head, [side * hr[0] * 0.86, hr[1] * 0.45, -H.r * 0.05]);
      eg.rotation.z = side * 0.25;
      ellipsoid(eg, [ES * 0.42, ES, ES * 0.18], [side * ES * 0.12, -ES * 0.65, 0], furDark, ol);
    }
    ears.push(eg);
  }
  if (look.head.tuft || (look.ears.type === 'pointed' && look.head.cheekFluff)) {
    // tuft of fur on top of the head
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(H.r * 0.12, H.r * 0.35, 8), fur);
    tuft.position.set(0, hr[1] * 0.98, H.r * 0.15);
    tuft.rotation.x = 0.4;
    head.add(tuft);
  }

  // Dizzy stars + Zzz + sweat drop
  const stars = group(head, [0, hr[1] * 1.25, 0], 'stars');
  const starGeo = makeStar();
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(starGeo, toon(palette.mustard));
    const a = (k / 4) * Math.PI * 2;
    s.position.set(Math.cos(a) * H.r * 0.9, 0, Math.sin(a) * H.r * 0.9);
    s.scale.setScalar(H.r * 0.18);
    stars.add(s);
  }
  stars.visible = false;
  const zzz = group(head, [H.r * 0.6, hr[1] * 1.2, 0], 'zzz');
  for (let k = 0; k < 3; k++) {
    const z = new THREE.Group();
    const sz = H.r * (0.2 + k * 0.08);
    const bar = (y: number, rot = 0, w = sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, sz * 0.2, sz * 0.2), toon(palette.cream));
      m.position.y = y;
      m.rotation.z = rot;
      z.add(m);
    };
    bar(sz / 2);
    bar(-sz / 2);
    bar(0, 0.85, sz * 1.25);
    z.position.set(k * H.r * 0.35, k * H.r * 0.45, 0);
    zzz.add(z);
  }
  zzz.visible = false;
  const sweat = ellipsoid(head, [H.r * 0.08, H.r * 0.13, H.r * 0.06], [hr[0] * 0.75, hr[1] * 0.55, H.r * 0.45], toon('#9fd8e6'));
  sweat.visible = false;

  // ----- Arms -----
  const A = look.arms;
  const mkArm = (side: 1 | -1) => {
    const sh = group(spine, [side * T.w * 0.92, T.h * 0.38, 0], side < 0 ? 'shoulderL' : 'shoulderR');
    ellipsoid(sh, [A.thickness * 1.25, A.thickness * 1.25, A.thickness * 1.25], [0, 0, 0], fur);
    capsule(sh, A.thickness, A.length * 0.42, furMat, ol);
    const el = group(sh, [0, -A.length * 0.5, 0], side < 0 ? 'elbowL' : 'elbowR');
    capsule(el, A.thickness * 0.92, A.length * 0.36, fur, ol);
    const hand = group(el, [0, -A.length * 0.46, 0]);
    ellipsoid(hand, [A.hand, A.hand * 0.9, A.hand * 0.85], [0, -A.hand * 0.4, A.hand * 0.1], muzzle, ol);
    ellipsoid(hand, [A.hand * 0.38, A.hand * 0.38, A.hand * 0.38], [-side * A.hand * 0.75, -A.hand * 0.1, A.hand * 0.3], muzzle);
    return { sh, el };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // ----- Legs -----
  const LG = look.legs;
  const mkLeg = (side: 1 | -1) => {
    const th = group(hips, [side * T.w * 0.5, T.h * 0.15, 0], side < 0 ? 'thighL' : 'thighR');
    capsule(th, LG.thickness * 1.15, L * 0.38, furMat, ol);
    const kn = group(th, [0, -L * 0.48, 0], side < 0 ? 'kneeL' : 'kneeR');
    capsule(kn, LG.thickness, L * 0.32, fur, ol);
    const an = group(kn, [0, -L * 0.42, 0], side < 0 ? 'ankleL' : 'ankleR');
    ellipsoid(an, [LG.foot * 0.55, L * 0.11, LG.foot], [0, -L * 0.05, LG.foot * 0.45], fur, ol);
    ellipsoid(an, [LG.foot * 0.5, L * 0.09, LG.foot * 0.45], [0, -L * 0.06, LG.foot * 1.0], muzzle);
    return { th, kn, an };
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // ----- Tail -----
  const tail: THREE.Group[] = [];
  const TL = look.tail;
  const segs = TL.type === 'stub' ? 1 : TL.type === 'thin' ? 10 : 8;
  const segLen = TL.length / segs;
  let parent: THREE.Object3D = group(hips, [0, T.h * 0.35, -T.d * 0.85], 'tailBase');
  const tailMat = TL.type === 'thin' ? toon(look.innerEar) : furMat;
  for (let k = 0; k < segs; k++) {
    const g = group(parent, k === 0 ? [0, 0, 0] : [0, 0, -segLen], `tail${k}`);
    const r = TL.thickness * (TL.type === 'long' ? 1 - (k / segs) * 0.35 : TL.type === 'thin' ? 1 - (k / segs) * 0.7 : 1.4);
    const geo = new THREE.CapsuleGeometry(r, segLen * 0.9, 4, 10);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, k === segs - 1 && look.stripes ? furDark : tailMat);
    m.position.z = -segLen / 2;
    m.castShadow = true;
    if (ol > 0 && TL.type !== 'thin') {
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(r + ol, segLen * 0.9, 4, 10).rotateX(Math.PI / 2), ink());
      (hull.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
      hull.userData.outline = true;
      m.add(hull);
    }
    g.add(m);
    tail.push(g);
    parent = g;
  }

  // ----- Accessory -----
  const acc = look.accessory;
  if (acc) {
    const am = toon(acc.color);
    if (acc.type === 'scarf' || acc.type === 'collar') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(T.w * 0.62, acc.type === 'scarf' ? T.w * 0.16 : T.w * 0.09, 10, 24), am);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -T.h * 0.12;
      neck.add(ring);
      outlineFor(ring, ol * 0.6, new THREE.Vector3(T.w * 0.75, T.w * 0.75, T.w * 0.2));
      if (acc.type === 'scarf') {
        const tailS = new THREE.Mesh(new THREE.BoxGeometry(T.w * 0.32, T.h * 0.7, T.w * 0.08), am);
        tailS.position.set(T.w * 0.35, -T.h * 0.45, T.d * 0.5);
        tailS.rotation.z = 0.25;
        neck.add(tailS);
      } else {
        const tag = ellipsoid(neck, [T.w * 0.14, T.w * 0.14, T.w * 0.04], [0, -T.h * 0.3, T.d * 0.58], toon(acc.tag ?? palette.mustard), ol * 0.5);
        tag.castShadow = false;
      }
    } else {
      const bow = group(neck, [0, -T.h * 0.1, T.d * 0.55]);
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(T.w * 0.22, T.w * 0.4, 4), am);
        c.rotation.z = (s * Math.PI) / 2;
        c.position.x = s * T.w * 0.2;
        bow.add(c);
      }
      ellipsoid(bow, [T.w * 0.09, T.w * 0.09, T.w * 0.09], [0, 0, 0.01], am);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.outline) o.receiveShadow = false;
  });

  return {
    root,
    squash,
    hips,
    spine,
    neck,
    head,
    shoulderL: armL.sh,
    shoulderR: armR.sh,
    elbowL: armL.el,
    elbowR: armR.el,
    thighL: legL.th,
    thighR: legR.th,
    kneeL: legL.kn,
    kneeR: legR.kn,
    ankleL: legL.an,
    ankleR: legR.an,
    tail,
    earL: ears[0],
    earR: ears[1],
    eyes: eyes as [EyeRig, EyeRig],
    mouth: { group: mouthG, smile, open, teeth },
    stars,
    zzz,
    sweat,
    dims: { legLength: L, hipsY: L, headR: H.r, unitScale, earType: look.ears.type },
  };
}
