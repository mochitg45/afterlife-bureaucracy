/**
 * Every sound the game makes, synthesised on the spot with Web Audio: nothing to bundle or
 * license, and the retro-office character comes from the recipes below rather than samples.
 *
 * Two rules the WebView imposes: a context may only start after a user gesture (`unlock`),
 * and it should be suspended while the app is in the background (`suspend`/`resume`). jsdom has
 * no AudioContext at all, so `createAudio(() => null)` is a complete no-op.
 */
import { THEMES, themeFor, type MusicTheme, type PercKind } from './musicThemes';

export type SfxName =
  | 'stamp' | 'hire' | 'upgrade' | 'pull'
  | 'reveal-temp' | 'reveal-fulltime' | 'reveal-senior' | 'reveal-executive'
  | 'equip' | 'achievement' | 'audit' | 'report';

export interface Audio {
  play(name: SfxName): void;
  setEnabled(flags: { sfx: boolean; music: boolean }): void;
  /** Swap the background music to an event's theme (null = the office loop), crossfading over ~1 s. */
  setMusicTheme(id: string | null): void;
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
   * The music: a data-driven loop (see musicThemes.ts). The default theme is the slow lo-fi
   * office loop: Cmaj7 / Am7 / Dm7 / G7 at 80 BPM with soft triangle pads, a sine bass, a brushed
   * hi-hat and an occasional typewriter clack. Event screens swap in their own theme with a ~1 s
   * crossfade. Each theme is scheduled a bar at a time from a setTimeout so a suspend() between
   * bars stops it cleanly; every theme plays through its own gain node so it can be faded out.
   */
  const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const FADE = 1;
  type Player = { out: GainNode; timer: ReturnType<typeof setTimeout> | null };
  let current: Player | null = null;
  let themeId: string | null = null;

  /** One melodic note: osc -> optional lowpass -> envelope, `t` in context seconds. */
  const note = (out: AudioNode, t: number, freq: number, dur: number, v: { type: OscillatorType; gain: number; attack?: number; cutoff?: number }) => {
    const c = ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = v.type;
    o.frequency.value = freq;
    if (v.cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = v.cutoff;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v.gain, t + (v.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  };

  const PERC: Record<PercKind, (o: AudioNode, g: number, at: number, beat: number) => void> = {
    hat: (o, g, at, beat) => noise(o, 0.05, { type: 'highpass', cutoff: 6000, gain: beat % 2 === 1 ? g * 1.6 : g, at }),
    shaker: (o, g, at) => noise(o, 0.05, { type: 'highpass', cutoff: 7000, gain: g, at }),
    kick: (o, g, at) => tone(o, 110, 0.15, { to: 45, gain: g, at }),
    tom: (o, g, at) => tone(o, 160, 0.28, { to: 80, gain: g, at }),
    snare: (o, g, at) => noise(o, 0.1, { type: 'bandpass', cutoff: 1800, gain: g, at }),
    rim: (o, g, at) => noise(o, 0.03, { type: 'bandpass', cutoff: 2500, gain: g, at }),
    jingle: (o, g, at) => {
      noise(o, 0.08, { type: 'highpass', cutoff: 8000, gain: g, at });
      tone(o, 3136, 0.15, { gain: g * 0.5, at });
      tone(o, 4186, 0.12, { gain: g * 0.35, at });
    },
  };

  const scheduleBar = (th: MusicTheme, out: AudioNode, at: number, bar: number) => {
    const c = ctx!;
    const beat = 60 / th.bpm;
    const BAR = beat * th.beats;
    const chord = th.chords[bar % th.chords.length];
    const rel = at - c.currentTime;
    // Off-beat eighths lean late by `swing`; every pitched or percussive hit is placed through this.
    const pos = (b: number) => at + (b + (th.swing && b % 1 === 0.5 ? th.swing : 0)) * beat;
    const pick = (idx: number, sc?: { root: number; degrees: number[] }) => {
      if (sc) return sc.root + sc.degrees[idx % sc.degrees.length] + 12 * Math.floor(idx / sc.degrees.length);
      return chord.notes[idx % chord.notes.length] + 12 * Math.floor(idx / chord.notes.length);
    };
    // Pad: held chord, slow attack; optional filter / tremolo / reverse swell.
    const p = th.pad;
    let padOut: AudioNode = out;
    if (p.trem || p.cutoff) {
      const bus = c.createGain();
      bus.connect(out);
      padOut = bus;
      if (p.trem) {
        bus.gain.value = 1 - p.trem.depth;
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = p.trem.rate;
        depth.gain.value = p.trem.depth;
        lfo.connect(depth); depth.connect(bus.gain);
        lfo.start(at); lfo.stop(at + BAR + 0.2);
      }
      if (p.cutoff) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = p.cutoff;
        f.connect(bus);
        padOut = f;
      }
    }
    for (const n of chord.notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = p.type;
      o.frequency.value = midiHz(n);
      g.gain.setValueAtTime(0.0001, at);
      if (p.swell) {
        g.gain.exponentialRampToValueAtTime(p.gain, at + BAR - 0.05);
      } else {
        g.gain.exponentialRampToValueAtTime(p.gain, at + p.attack);
        g.gain.setValueAtTime(p.gain, at + BAR - p.release);
      }
      g.gain.exponentialRampToValueAtTime(0.0001, at + BAR + 0.1);
      o.connect(g); g.connect(padOut);
      o.start(at); o.stop(at + BAR + 0.15);
    }
    if (th.drone) {
      const d = th.drone;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = d.cutoff;
      f.connect(out);
      for (const [semis, k] of [[0, 1], [7, 0.5]] as const) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = d.type;
        o.frequency.value = midiHz(d.note + semis);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(d.gain * k, at + 0.5);
        g.gain.setValueAtTime(d.gain * k, at + BAR - 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, at + BAR + 0.1);
        o.connect(g); g.connect(f);
        o.start(at); o.stop(at + BAR + 0.15);
      }
    }
    // Bass: the chord's root (or fifth / octave) as short plucks.
    const b = th.bass;
    for (const [bt, mult] of b.steps) note(out, pos(bt), midiHz(chord.bass) * mult, b.dur * beat, { ...b, attack: 0.005 });
    if (th.comp) for (const bt of th.comp.beats) for (const n of chord.notes) note(out, pos(bt), midiHz(n), th.comp.dur * beat, th.comp);
    if (th.lead) {
      const l = th.lead;
      l.steps.forEach((bt, i) => note(out, pos(bt), midiHz(pick(l.contour[(bar * l.steps.length + i) % l.contour.length], l.scale) + l.octave), l.dur * beat, l));
    }
    if (th.sparkle) {
      const s = th.sparkle;
      s.steps.forEach((bt, i) => note(out, pos(bt), midiHz(pick(i) + s.octave), s.dur * beat, s));
    }
    for (const h of th.perc) for (const bt of h.beats) PERC[h.kind](out, h.gain, pos(bt) - c.currentTime, bt);
    // The office, still in the room: a typewriter clack on a random off-beat.
    if (th.clack && Math.random() < th.clack) {
      const off = (Math.floor(Math.random() * th.beats) + 0.5) * beat;
      noise(out, 0.03, { cutoff: 3500, gain: 0.2, at: rel + off });
    }
  };

  const startAmbience = (fadeIn = false) => {
    if (!ctx || !music || current || !musicOn) return;
    const c = ctx;
    const th = themeFor(themeId);
    const BAR = (60 / th.bpm) * th.beats;
    const out = c.createGain();
    if (fadeIn) {
      out.gain.setValueAtTime(0, c.currentTime);
      out.gain.linearRampToValueAtTime(1, c.currentTime + FADE);
    } else out.gain.value = 1;
    out.connect(music);
    const me: Player = { out, timer: null };
    current = me;
    let next = c.currentTime + 0.1;
    let bar = 0;
    const tick = () => {
      if (current !== me) return;
      try {
        // Keep one bar scheduled ahead of the clock.
        while (next < c.currentTime + BAR) {
          scheduleBar(th, out, next, bar++);
          next += BAR;
        }
      } catch {
        // a dead context is silence, not a crash; clear so a later start can retry
        stopAmbience();
        return;
      }
      me.timer = setTimeout(tick, (BAR * 1000) / 2);
    };
    me.timer = setTimeout(tick, 0);
  };

  /** Stop scheduling and fade the current theme out (bars already queued ring out under the fade). */
  const stopAmbience = (fade = 0.05) => {
    const p = current;
    current = null;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    try {
      const now = ctx!.currentTime;
      p.out.gain.setValueAtTime(p.out.gain.value, now);
      p.out.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => { try { p.out.disconnect(); } catch { /* already gone */ } }, (fade + 0.2) * 1000);
    } catch { /* a dead context can't stop what it already dropped */ }
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
    setMusicTheme(id) {
      const next = id && THEMES[id] ? id : null;
      if (next === themeId) return;
      themeId = next;
      if (!current) return; // not playing: the next start picks the new theme up
      stopAmbience(FADE);
      startAmbience(true);
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
