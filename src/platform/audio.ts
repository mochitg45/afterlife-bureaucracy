/**
 * Every sound the game makes, synthesised on the spot with Web Audio: nothing to bundle or
 * license, and the retro-office character comes from the recipes below rather than samples.
 *
 * Two rules the WebView imposes: a context may only start after a user gesture (`unlock`),
 * and it should be suspended while the app is in the background (`suspend`/`resume`). jsdom has
 * no AudioContext at all, so `createAudio(() => null)` is a complete no-op.
 */
export type SfxName =
  | 'stamp' | 'hire' | 'upgrade' | 'pull'
  | 'reveal-temp' | 'reveal-fulltime' | 'reveal-senior' | 'reveal-executive'
  | 'equip' | 'achievement' | 'audit' | 'report' | 'tick';

export interface Audio {
  play(name: SfxName): void;
  setEnabled(flags: { sfx: boolean; music: boolean }): void;
  unlock(): void;
  suspend(): void;
  resume(): void;
}

const MASTER = 0.5;
const MUSIC = 0.18;

export function createAudio(ctxFactory?: () => AudioContext | null): Audio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfxOn = true;
  let musicOn = true;
  let unlocked = false;
  let ambience: ReturnType<typeof setTimeout> | null = null;
  let hum: { stop(): void } | null = null;

  const ensure = (): AudioContext | null => {
    if (ctx) return ctx;
    const made = ctxFactory ? ctxFactory() : null;
    if (!made) return null;
    ctx = made;
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = MUSIC;
    music.connect(master);
    return ctx;
  };

  /** A decaying tone: `freq` Hz (optionally sliding to `to`), `dur` seconds, into `out`. */
  const tone = (out: AudioNode, freq: number, dur: number, opts: { type?: OscillatorType; to?: number; gain?: number; at?: number } = {}) => {
    const c = ctx!;
    const t = c.currentTime + (opts.at ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(opts.gain ?? 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  /** A burst of filtered noise: paper, thumps, clacks. */
  const noise = (out: AudioNode, dur: number, opts: { cutoff?: number; type?: BiquadFilterType; gain?: number; at?: number } = {}) => {
    const c = ctx!;
    const t = c.currentTime + (opts.at ?? 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.value = opts.cutoff ?? 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  const RECIPES: Record<SfxName, (out: AudioNode) => void> = {
    // Rubber stamp: a low thud with a paper slap on top.
    stamp: (o) => { noise(o, 0.06, { cutoff: 900, gain: 0.7 }); tone(o, 110, 0.12, { to: 45, gain: 0.8 }); },
    // Cash-drawer ding: two rising tones.
    hire: (o) => { tone(o, 880, 0.12, { type: 'triangle', gain: 0.4 }); tone(o, 1320, 0.18, { type: 'triangle', gain: 0.35, at: 0.08 }); },
    upgrade: (o) => { tone(o, 660, 0.1, { type: 'square', gain: 0.15 }); tone(o, 990, 0.14, { type: 'square', gain: 0.12, at: 0.07 }); },
    // Pulling a form from the tray: a paper flick.
    pull: (o) => { noise(o, 0.18, { type: 'bandpass', cutoff: 2500, gain: 0.5 }); },
    'reveal-temp': (o) => { tone(o, 523, 0.12, { type: 'triangle', gain: 0.3 }); },
    'reveal-fulltime': (o) => { tone(o, 523, 0.1, { type: 'triangle', gain: 0.3 }); tone(o, 659, 0.16, { type: 'triangle', gain: 0.3, at: 0.09 }); },
    'reveal-senior': (o) => { [523, 659, 784].forEach((f, i) => tone(o, f, 0.16, { type: 'triangle', gain: 0.32, at: i * 0.09 })); },
    'reveal-executive': (o) => { [523, 659, 784, 1047].forEach((f, i) => tone(o, f, 0.22, { type: 'triangle', gain: 0.35, at: i * 0.1 })); tone(o, 1047, 0.5, { type: 'sine', gain: 0.25, at: 0.42 }); },
    equip: (o) => { noise(o, 0.05, { cutoff: 3000, gain: 0.3 }); tone(o, 740, 0.08, { type: 'triangle', gain: 0.25, at: 0.03 }); },
    // Desk bell.
    achievement: (o) => { tone(o, 1760, 0.6, { type: 'sine', gain: 0.35 }); tone(o, 2637, 0.4, { type: 'sine', gain: 0.15, at: 0.01 }); },
    // Ledger slammed shut, then a gong.
    audit: (o) => { noise(o, 0.12, { cutoff: 500, gain: 0.9 }); tone(o, 80, 0.3, { to: 40, gain: 0.9 }); tone(o, 196, 1.2, { type: 'sine', gain: 0.35, at: 0.15 }); },
    // Paper shuffle for the backlog report.
    report: (o) => { noise(o, 0.12, { type: 'bandpass', cutoff: 1800, gain: 0.4 }); noise(o, 0.14, { type: 'bandpass', cutoff: 2200, gain: 0.35, at: 0.12 }); },
    tick: (o) => { noise(o, 0.03, { cutoff: 4000, gain: 0.25 }); },
  };

  /** Office ambience: a soft hum plus typewriter clacks at random, a desk bell now and then. */
  const startAmbience = () => {
    if (!ctx || !music || ambience || !musicOn) return;
    const c = ctx;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o1.frequency.value = 55;
    o2.frequency.value = 110.5; // the half-cycle offset makes the hum breathe
    g.gain.value = 0.12;
    o1.connect(g); o2.connect(g); g.connect(music);
    o1.start(); o2.start();
    hum = { stop() { o1.stop(); o2.stop(); } };
    const clack = () => {
      if (!ambience) return;
      const burst = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < burst; i++) noise(music!, 0.03, { cutoff: 3500, gain: 0.35, at: i * (0.09 + Math.random() * 0.06) });
      if (Math.random() < 0.06) tone(music!, 1760, 0.5, { gain: 0.12 });
      ambience = setTimeout(clack, 600 + Math.random() * 2400);
    };
    ambience = setTimeout(clack, 400);
  };

  const stopAmbience = () => {
    if (ambience) clearTimeout(ambience);
    ambience = null;
    hum?.stop();
    hum = null;
  };

  return {
    play(name) {
      if (!unlocked || !sfxOn) return;
      const c = ensure();
      if (!c || !master) return;
      try { RECIPES[name](master); } catch { /* a dead context is silence, not a crash */ }
    },
    setEnabled({ sfx, music: m }) {
      sfxOn = sfx;
      musicOn = m;
      if (!m) stopAmbience();
      else if (unlocked) startAmbience();
    },
    unlock() {
      if (unlocked) return;
      const c = ensure();
      if (!c) return;
      unlocked = true;
      void c.resume().catch(() => {});
      startAmbience();
    },
    suspend() {
      stopAmbience();
      void ctx?.suspend().catch(() => {});
    },
    resume() {
      if (!ctx || !unlocked) return;
      void ctx.resume().catch(() => {});
      startAmbience();
    },
  };
}

export function pickAudio(): Audio {
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  return createAudio(Ctor ? () => new Ctor() : () => null);
}
