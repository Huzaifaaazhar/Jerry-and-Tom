/**
 * Audio system. Every sound has a procedural WebAudio recipe (cartoon boings, slide whistles,
 * crashes) so the game is fully playable with zero audio files. Any sound id or music theme can be
 * overridden with a real file via `registerSoundFile` - that is the replacement pipeline for
 * recorded foley and an orchestral score.
 */
export type SoundId =
  | 'step'
  | 'jump'
  | 'land'
  | 'slip'
  | 'snap'
  | 'crash'
  | 'pickup'
  | 'door'
  | 'hide'
  | 'search'
  | 'caught'
  | 'pummel'
  | 'squeak'
  | 'yowl'
  | 'bark'
  | 'laugh'
  | 'whoosh'
  | 'ui'
  | 'uiBack'
  | 'win'
  | 'lose'
  | 'place'
  | 'snore';

export interface MusicTheme {
  /** Beats per minute of the calm groove; chase doubles the drive. */
  tempo: number;
  /** Root note as MIDI number. */
  root: number;
  /** Scale degrees (semitones) used for the walking bass and melody. */
  scale: number[];
  /** Short melodic motif in scale-degree indices (-1 = rest). */
  motif: number[];
  /** Optional recorded loops that replace the synth score. */
  files?: { calm?: string; chase?: string };
}

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private files = new Map<string, AudioBuffer>();
  private pendingFiles = new Map<string, string>();
  private noiseBuf: AudioBuffer | null = null;
  private music: { theme: MusicTheme; nextTime: number; step: number; intensity: number; timer: number } | null = null;
  private lastPlay = new Map<string, number>();
  sfxVolume = 0.8;
  musicVolume = 0.55;

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.applyVolumes();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.pendingFiles.forEach((url, id) => void this.loadFile(id, url));
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxVolume;
    this.musicBus.gain.value = this.musicVolume * 0.5;
  }

  registerSoundFile(id: string, url: string) {
    this.pendingFiles.set(id, url);
    if (this.ctx) void this.loadFile(id, url);
  }

  private async loadFile(id: string, url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.files.set(id, buf);
    } catch {
      /* missing file: keep procedural fallback */
    }
  }

  /** Play a sound effect. `gain` 0..1, `pitch` multiplier, `pan` -1..1. Rate-limited per id. */
  play(id: SoundId, opts: { gain?: number; pitch?: number; pan?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const minGap = id === 'step' ? 0.06 : 0.04;
    if ((this.lastPlay.get(id) ?? -1) > now - minGap) return;
    this.lastPlay.set(id, now);
    const out = ctx.createGain();
    out.gain.value = opts.gain ?? 1;
    const dest: AudioNode = out;
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      out.connect(p);
      p.connect(this.sfxBus);
    } else out.connect(this.sfxBus);
    const file = this.files.get(id);
    if (file) {
      const src = ctx.createBufferSource();
      src.buffer = file;
      src.playbackRate.value = opts.pitch ?? 1;
      src.connect(dest);
      src.start();
      return;
    }
    recipes[id]?.(this, ctx, dest, now, opts.pitch ?? 1);
  }

  tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dest: AudioNode, t: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- Music: a small procedural "cartoon jazz" sequencer ----------
  startMusic(theme: MusicTheme) {
    if (!this.ctx) return;
    this.stopMusic();
    this.music = { theme, nextTime: this.ctx.currentTime + 0.1, step: 0, intensity: 0, timer: 0 };
    this.music.timer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  setMusicIntensity(v: number) {
    if (this.music) this.music.intensity = v;
  }

  stopMusic() {
    if (this.music) window.clearInterval(this.music.timer);
    this.music = null;
  }

  private scheduleMusic() {
    const m = this.music;
    const ctx = this.ctx;
    if (!m || !ctx) return;
    const chase = m.intensity > 0.5;
    const bpm = m.theme.tempo * (chase ? 1.6 : 1);
    const stepDur = 60 / bpm / 2; // eighth notes
    while (m.nextTime < ctx.currentTime + 0.25) {
      this.musicStep(m.theme, m.step, m.nextTime, stepDur, chase);
      m.nextTime += stepDur * (m.step % 2 === 0 ? 1.18 : 0.82); // swing
      m.step++;
    }
  }

  private musicStep(th: MusicTheme, step: number, t: number, dur: number, chase: boolean) {
    const bus = this.musicBus;
    const bar = Math.floor(step / 8) % 4;
    const progression = [0, 3, 4, 0]; // I - IV - V - I in scale degrees
    const chordRoot = th.root + th.scale[progression[bar] % th.scale.length];
    // walking bass on quarter notes
    if (step % 2 === 0) {
      const walk = [0, 2, 4, 5][(step / 2) % 4];
      const note = chordRoot - 12 + (th.scale[walk % th.scale.length] - th.scale[0]);
      this.tone(bus, 'triangle', midiToHz(note), midiToHz(note) * 0.98, t, dur * 1.6, 0.22);
    }
    // brushed snare / hat
    if (step % 2 === 1) this.noise(bus, t, 0.05, chase ? 0.08 : 0.04, 'highpass', 6000);
    if (chase && step % 4 === 2) this.noise(bus, t, 0.09, 0.12, 'bandpass', 1800, 0.8);
    // pizzicato motif
    const motif = th.motif[step % th.motif.length];
    if (motif >= 0 && (chase || step % 16 < 12)) {
      const deg = th.scale[motif % th.scale.length] + 12 * Math.floor(motif / th.scale.length);
      const n = chordRoot + 12 + deg - th.scale[0];
      this.tone(bus, chase ? 'square' : 'sine', midiToHz(n), midiToHz(n), t, dur * 0.9, chase ? 0.05 : 0.09, 0.003);
      if (chase) this.tone(bus, 'sawtooth', midiToHz(n + 7), midiToHz(n + 7), t, dur * 0.4, 0.025);
    }
    // stab chord on bar starts
    if (step % 8 === 0) {
      for (const iv of [0, 4, 7]) this.tone(bus, 'sine', midiToHz(chordRoot + iv), midiToHz(chordRoot + iv), t, dur * 3, 0.05, 0.01);
    }
  }
}

type Recipe = (a: AudioEngine, ctx: AudioContext, out: AudioNode, t: number, p: number) => void;
const recipes: Partial<Record<SoundId, Recipe>> = {
  step: (a, _c, o, t, p) => a.noise(o, t, 0.05, 0.12, 'lowpass', 900 * p),
  jump: (a, _c, o, t, p) => a.tone(o, 'sine', 260 * p, 720 * p, t, 0.18, 0.35),
  land: (a, _c, o, t, p) => {
    a.tone(o, 'sine', 140 * p, 60, t, 0.12, 0.4);
    a.noise(o, t, 0.08, 0.2, 'lowpass', 500);
  },
  slip: (a, _c, o, t) => {
    a.tone(o, 'sine', 300, 1400, t, 0.35, 0.3);
    a.tone(o, 'sine', 1400, 200, t + 0.35, 0.4, 0.3);
    a.noise(o, t + 0.75, 0.3, 0.6, 'lowpass', 400);
  },
  snap: (a, _c, o, t) => {
    a.noise(o, t, 0.08, 0.9, 'highpass', 2500);
    a.tone(o, 'square', 1800, 300, t, 0.08, 0.2);
  },
  crash: (a, _c, o, t) => {
    a.noise(o, t, 0.6, 0.8, 'bandpass', 3000, 0.6);
    a.noise(o, t + 0.05, 0.4, 0.5, 'highpass', 5000);
    for (let i = 0; i < 4; i++) a.tone(o, 'triangle', 1500 + i * 700, 1400 + i * 650, t + i * 0.04, 0.3, 0.08);
  },
  pickup: (a, _c, o, t, p) => {
    a.tone(o, 'triangle', 880 * p, 880 * p, t, 0.08, 0.25);
    a.tone(o, 'triangle', 1320 * p, 1320 * p, t + 0.07, 0.14, 0.25);
  },
  door: (a, _c, o, t) => {
    a.tone(o, 'sawtooth', 180, 120, t, 0.35, 0.05, 0.05);
    a.noise(o, t + 0.3, 0.08, 0.3, 'lowpass', 300);
  },
  hide: (a, _c, o, t) => a.tone(o, 'sine', 600, 200, t, 0.2, 0.25),
  search: (a, _c, o, t) => {
    a.noise(o, t, 0.15, 0.3, 'bandpass', 1200, 2);
    a.noise(o, t + 0.18, 0.15, 0.3, 'bandpass', 900, 2);
  },
  caught: (a, _c, o, t) => {
    a.tone(o, 'square', 500, 120, t, 0.5, 0.15);
    a.noise(o, t, 0.2, 0.5, 'lowpass', 1500);
  },
  pummel: (a, _c, o, t) => {
    for (let i = 0; i < 6; i++) a.noise(o, t + i * 0.07, 0.07, 0.6, 'lowpass', 600 + Math.random() * 600);
  },
  squeak: (a, _c, o, t, p) => a.tone(o, 'sine', 1800 * p, 2600 * p, t, 0.09, 0.2),
  yowl: (a, _c, o, t, p) => {
    a.tone(o, 'sawtooth', 500 * p, 900 * p, t, 0.25, 0.12, 0.04);
    a.tone(o, 'sawtooth', 900 * p, 300 * p, t + 0.25, 0.35, 0.12);
  },
  bark: (a, _c, o, t, p) => {
    a.tone(o, 'sawtooth', 220 * p, 140 * p, t, 0.14, 0.3);
    a.noise(o, t, 0.12, 0.3, 'bandpass', 800, 1.5);
  },
  laugh: (a, _c, o, t, p) => {
    for (let i = 0; i < 4; i++) a.tone(o, 'sine', 1300 * p, 1000 * p, t + i * 0.11, 0.08, 0.15);
  },
  whoosh: (a, _c, o, t) => a.noise(o, t, 0.25, 0.4, 'bandpass', 1500, 0.7),
  ui: (a, _c, o, t) => a.tone(o, 'triangle', 660, 990, t, 0.09, 0.2),
  uiBack: (a, _c, o, t) => a.tone(o, 'triangle', 660, 440, t, 0.09, 0.2),
  place: (a, _c, o, t) => a.tone(o, 'triangle', 400, 300, t, 0.1, 0.25),
  snore: (a, _c, o, t) => a.noise(o, t, 0.8, 0.08, 'lowpass', 300),
  win: (a, _c, o, t) => [0, 4, 7, 12].forEach((s, i) => a.tone(o, 'triangle', midiToHz(72 + s), midiToHz(72 + s), t + i * 0.12, 0.35, 0.25)),
  lose: (a, _c, o, t) => [0, -1, -2, -6].forEach((s, i) => a.tone(o, 'sawtooth', midiToHz(60 + s), midiToHz(59 + s), t + i * 0.3, 0.4, 0.08)),
};

export const audio = new AudioEngine();
