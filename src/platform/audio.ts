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
  | 'equip' | 'achievement' | 'audit' | 'report';

export interface Audio {
  play(name: SfxName): void;
  setEnabled(flags: { sfx: boolean; music: boolean }): void;
  unlock(): void;
  suspend(): void;
  resume(): void;
  /** Whether the context is actually running -- the only proof a gesture unlocked it. */
  isRunning(): boolean;
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
    // A closed context never comes back: drop the whole graph and build a fresh one. The page
    // keeps its sticky user activation from the original gesture, so `unlocked` stays true and
    // wake() resumes the new context without asking the player to tap again.
    if (ctx?.state === 'closed') {
      stopAmbience();
      ctx = null;
      master = null;
      music = null;
    }
    if (ctx) return ctx;
    const made = ctxFactory ? ctxFactory() : null;
    if (!made) return null;
    ctx = made;
    master = ctx.createGain();
    master.gain.value = MASTER;
    // A limiter so a stamp during the reveal fanfare cannot clip; older WebViews without
    // DynamicsCompressor just get the master straight through.
    if (typeof ctx.createDynamicsCompressor === 'function') {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      master.connect(limiter);
      limiter.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    music = ctx.createGain();
    music.gain.value = MUSIC;
    music.connect(master);
    return ctx;
  };

  /** The WebView can suspend a context behind our back; every path that makes sound rearms it. */
  const wake = (c: AudioContext) => {
    if (c.state !== 'running') void c.resume().catch(() => {});
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
  };

  /**
   * The music: a slow lo-fi loop, four bars of Cmaj7 / Am7 / Dm7 / G7 at 80 BPM. Soft
   * triangle pads hold each chord, a sine bass walks the roots, a brushed hi-hat (short
   * noise) marks the beats, and a typewriter clack lands on a random off-beat now and then
   * so the office is still in the room. Scheduled a bar at a time from a setTimeout so a
   * suspend() between bars stops it cleanly.
   * ponytail: one fixed progression and tempo; variations or a second loop are a v1.1 item.
   */
  const BPM = 80;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;
  // Chord tones in Hz (C4-based voicings) and the bass root an octave or two below.
  const CHORDS: { pad: number[]; bass: number }[] = [
    { pad: [261.63, 329.63, 392.0, 493.88], bass: 65.41 }, // Cmaj7
    { pad: [220.0, 261.63, 329.63, 392.0], bass: 55.0 },   // Am7
    { pad: [293.66, 349.23, 440.0, 523.25], bass: 73.42 }, // Dm7
    { pad: [246.94, 293.66, 349.23, 392.0], bass: 49.0 },  // G7 (3rd-7th-9th voicing, low G bass)
  ];
  let bar = 0;

  const scheduleBar = (at: number) => {
    const out = music!;
    const chord = CHORDS[bar % CHORDS.length];
    // Pads: four soft triangles with a slow attack, held for the bar.
    for (const f of chord.pad) {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.09, at + 0.6);
      g.gain.setValueAtTime(0.09, at + BAR - 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, at + BAR + 0.1);
      o.connect(g); g.connect(out);
      o.start(at); o.stop(at + BAR + 0.15);
    }
    // Bass: root on beats 1 and 3, the fifth on beat 4, each a short sine pluck.
    const fifth = chord.bass * 1.5;
    for (const [beat, f] of [[0, chord.bass], [2, chord.bass], [3, fifth]] as const) {
      tone(out, f, 0.55, { type: 'sine', gain: 0.35, at: at - ctx!.currentTime + beat * BEAT });
    }
    // Brushed hi-hat on every beat, a touch louder on 2 and 4.
    for (let beat = 0; beat < 4; beat++) {
      noise(out, 0.05, { type: 'highpass', cutoff: 6000, gain: beat % 2 ? 0.16 : 0.1, at: at - ctx!.currentTime + beat * BEAT });
    }
    // The office, still in the room: a typewriter clack on a random off-beat, one bar in three.
    if (Math.random() < 0.33) {
      const off = (Math.floor(Math.random() * 4) + 0.5) * BEAT;
      noise(out, 0.03, { cutoff: 3500, gain: 0.2, at: at - ctx!.currentTime + off });
    }
    bar += 1;
  };

  const startAmbience = () => {
    if (!ctx || !music || ambience || !musicOn) return;
    const c = ctx;
    // Sentinel so the scheduler knows it is live; stopAmbience clears it.
    hum = { stop() { /* per-bar nodes stop themselves */ } };
    let next = c.currentTime + 0.1;
    const tick = () => {
      if (!ambience) return;
      try {
        // Keep one bar scheduled ahead of the clock.
        while (next < c.currentTime + BAR) {
          scheduleBar(next);
          next += BAR;
        }
      } catch {
        // a dead context is silence, not a crash; clear so a later start can retry
        stopAmbience();
        return;
      }
      ambience = setTimeout(tick, (BAR * 1000) / 2);
    };
    ambience = setTimeout(tick, 0);
  };

  const stopAmbience = () => {
    if (ambience) clearTimeout(ambience);
    ambience = null;
    try { hum?.stop(); } catch { /* a dead context can't stop what it already dropped */ }
    hum = null;
  };

  return {
    play(name) {
      if (!unlocked || !sfxOn) return;
      const c = ensure();
      if (!c || !master) return;
      wake(c);
      try { RECIPES[name](master); } catch { /* a dead context is silence, not a crash */ }
    },
    setEnabled({ sfx, music: m }) {
      sfxOn = sfx;
      musicOn = m;
      if (!m) stopAmbience();
      else if (unlocked) startAmbience();
    },
    unlock() {
      const c = ensure();
      if (!c) return;
      unlocked = true;
      wake(c);
      startAmbience();
    },
    suspend() {
      stopAmbience();
      void ctx?.suspend().catch(() => {});
    },
    resume() {
      if (!ctx || !unlocked) return;
      wake(ctx);
      startAmbience();
    },
    isRunning: () => ctx?.state === 'running',
  };
}

export function pickAudio(): Audio {
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  return createAudio(Ctor ? () => new Ctor() : () => null);
}
