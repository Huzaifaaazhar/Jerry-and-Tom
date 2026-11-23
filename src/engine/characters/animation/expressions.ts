import type { Expression } from '../../core/types';

/** Facial pose parameters. Lids 0 = open, 1 = closed. Brow raise -1..1, brow angle + = angry. */
export interface FacePose {
  lidU: number;
  lidL: number;
  lidTilt: number;
  browRaise: number;
  browAngle: number;
  smile: number;
  open: number;
  pupil: number;
  eyeScale: number;
}

export const EXPRESSIONS: Record<Expression, FacePose> = {
  neutral: { lidU: 0.18, lidL: 0.05, lidTilt: 0, browRaise: 0, browAngle: 0, smile: 0.35, open: 0, pupil: 1, eyeScale: 1 },
  happy: { lidU: 0.12, lidL: 0.3, lidTilt: 0, browRaise: 0.35, browAngle: -0.1, smile: 1, open: 0.25, pupil: 1, eyeScale: 1 },
  smug: { lidU: 0.5, lidL: 0.15, lidTilt: 0.1, browRaise: 0.2, browAngle: 0.15, smile: 0.85, open: 0, pupil: 0.95, eyeScale: 0.95 },
  scared: { lidU: 0, lidL: 0, lidTilt: -0.15, browRaise: 1, browAngle: -0.45, smile: -0.7, open: 0.45, pupil: 0.55, eyeScale: 1.12 },
  angry: { lidU: 0.38, lidL: 0.12, lidTilt: 0.35, browRaise: -0.6, browAngle: 0.55, smile: -0.6, open: 0.35, pupil: 0.8, eyeScale: 1 },
  determined: { lidU: 0.32, lidL: 0.1, lidTilt: 0.2, browRaise: -0.35, browAngle: 0.35, smile: 0.15, open: 0, pupil: 0.9, eyeScale: 1 },
  surprised: { lidU: 0, lidL: 0, lidTilt: 0, browRaise: 1.1, browAngle: -0.1, smile: 0, open: 0.85, pupil: 0.6, eyeScale: 1.3 },
  laughing: { lidU: 0.92, lidL: 0.55, lidTilt: -0.1, browRaise: 0.55, browAngle: -0.2, smile: 1, open: 1, pupil: 1, eyeScale: 1 },
  dizzy: { lidU: 0.45, lidL: 0.2, lidTilt: -0.2, browRaise: 0.3, browAngle: -0.3, smile: -0.25, open: 0.3, pupil: 0.8, eyeScale: 1 },
  sleepy: { lidU: 1, lidL: 0.3, lidTilt: 0, browRaise: -0.1, browAngle: 0, smile: 0.1, open: 0.12, pupil: 1, eyeScale: 1 },
  sad: { lidU: 0.42, lidL: 0.1, lidTilt: -0.35, browRaise: 0.45, browAngle: -0.55, smile: -1, open: 0, pupil: 1, eyeScale: 1 },
};

export function lerpFace(out: FacePose, target: FacePose, t: number) {
  for (const k of Object.keys(out) as (keyof FacePose)[]) out[k] += (target[k] - out[k]) * t;
  return out;
}
