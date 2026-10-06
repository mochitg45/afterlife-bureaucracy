/**
 * Data for the synthesised background music: one MusicTheme per event (plus the office default),
 * played by the generic bar scheduler in audio.ts. Pitches are MIDI note numbers, positions are
 * beats inside the bar, durations are beats. Gains are per voice and kept at or below the office
 * loop's levels (pad 0.09 x4, bass 0.35, hat 0.1-0.16) so every theme sits at the same loudness.
 */
export interface Chord { notes: number[]; bass: number }

/** A plucked/held voice. `gain` is the peak, `dur` beats, `attack` seconds, `cutoff` an optional lowpass. */
export interface Voice { type: OscillatorType; gain: number; dur: number; attack?: number; cutoff?: number }

export type PercKind = 'hat' | 'kick' | 'tom' | 'snare' | 'rim' | 'jingle' | 'shaker';
export interface PercHit { kind: PercKind; beats: number[]; gain: number }

export interface MusicTheme {
  bpm: number;
  /** Beats per bar (3 = waltz). */
  beats: number;
  /** Beats added to every off-beat eighth (0.1-0.17 is a lazy jazz swing). */
  swing?: number;
  /** One chord per bar, cycling. */
  chords: Chord[];
  /** Held chord bed. `swell` = reverse-swell (rises through the bar, cuts at the end); `trem` = slow tremolo. */
  pad: { type: OscillatorType; gain: number; attack: number; release: number; cutoff?: number; trem?: { rate: number; depth: number }; swell?: boolean };
  /** Bass hits: [beat, multiplier of the chord's bass root]. */
  bass: Voice & { steps: [number, number][] };
  /** Chord chops (skank, harpsichord "pah", synth stabs, e-piano comping). */
  comp?: Voice & { beats: number[] };
  /** Melody: arpeggiates `contour` indices over the chord tones, or over `scale` when given. */
  lead?: Voice & { steps: number[]; contour: number[]; octave: number; scale?: { root: number; degrees: number[] } };
  /** Signature ornament: bells / sparkle arpeggio climbing the chord tones. */
  sparkle?: Voice & { steps: number[]; octave: number };
  /** A held low drone (root + fifth), e.g. a horn. */
  drone?: { note: number; type: OscillatorType; gain: number; cutoff: number };
  perc: PercHit[];
  /** Chance per bar of a typewriter clack (the office, still in the room). */
  clack?: number;
}

/** Chord qualities as semitones above the root (9ths are rootless; the bass carries the root). */
const Q = {
  M: [0, 4, 7, 12], m: [0, 3, 7, 12], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10],
  M6: [0, 4, 7, 9], dim: [0, 3, 6, 12], M9: [4, 7, 11, 14], m9: [3, 7, 10, 14], d9: [4, 7, 10, 14],
} as const;

/** Pitch class (0 = C) + quality -> a pad voicing around C4 and a bass root around C2. */
const ch = (pc: number, q: keyof typeof Q): Chord => ({
  notes: Q[q].map((i) => 60 + (pc > 6 ? pc - 12 : pc) + i),
  bass: 36 + (pc > 6 ? pc - 12 : pc),
});
const prog = (...c: [number, keyof typeof Q][]): Chord[] => c.map(([pc, q]) => ch(pc, q));

const PAD: MusicTheme['pad'] = { type: 'triangle', gain: 0.09, attack: 0.6, release: 0.5 };
const steady = (type: OscillatorType = 'sine', gain = 0.35, dur = 0.5): MusicTheme['bass'] => ({ type, gain, dur, steps: [[0, 1], [2, 1], [3, 1.5]] });

/** The office loop, exactly as it always sounded: Cmaj7 / Am7 / Dm7 / G7 at 80 BPM. */
const OFFICE: MusicTheme = {
  bpm: 80, beats: 4,
  chords: [
    { notes: [60, 64, 67, 71], bass: 36 }, // Cmaj7
    { notes: [57, 60, 64, 67], bass: 33 }, // Am7
    { notes: [62, 65, 69, 72], bass: 38 }, // Dm7
    { notes: [59, 62, 65, 67], bass: 31 }, // G7 (3rd-7th-9th voicing, low G bass)
  ],
  pad: PAD,
  bass: { type: 'sine', gain: 0.35, dur: 11 / 15, steps: [[0, 1], [2, 1], [3, 1.5]] }, // 0.55 s at 80 BPM
  perc: [{ kind: 'hat', beats: [0, 1, 2, 3], gain: 0.1 }],
  clack: 0.33,
};

/** A themed variant: starts from the office but silent on the optional layers. */
const t = (o: Partial<MusicTheme>): MusicTheme => ({ ...OFFICE, perc: [], clack: 0, ...o });

const WALTZ = [0, 1, 2];
const EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

export const THEMES: Record<string, MusicTheme> = {
  // ---- specials ----
  // Playful Addams-style waltz in C minor: oom-pah-pah harpsichord, tremolo organ pad.
  halloween: t({
    bpm: 96, beats: 3,
    chords: prog([0, 'm'], [5, 'm'], [7, 'd7'], [0, 'm']),
    pad: { type: 'triangle', gain: 0.07, attack: 0.3, release: 0.4, cutoff: 1400, trem: { rate: 3.2, depth: 0.35 } },
    bass: { type: 'sine', gain: 0.32, dur: 0.6, steps: [[0, 1]] },
    comp: { type: 'sawtooth', gain: 0.03, dur: 0.3, cutoff: 2400, beats: [1, 2] },
    lead: { type: 'sawtooth', gain: 0.07, dur: 0.5, cutoff: 2600, steps: WALTZ, octave: 12, contour: [2, 1, 0, 1, 2, 3, 2, 1, 2, 4, 3, 2] },
    sparkle: { type: 'sine', gain: 0.03, dur: 0.5, steps: [2.5], octave: 24 },
  }),
  // Warm major, sleigh-bell shaker and a celesta/music-box lead.
  christmas: t({
    bpm: 88,
    chords: prog([0, 'M7'], [5, 'M7'], [9, 'm7'], [7, 'd7']),
    lead: { type: 'triangle', gain: 0.08, dur: 0.6, cutoff: 3500, steps: [0, 1, 2, 3], octave: 12, contour: [4, 2, 4, 5, 4, 2, 0, 2, 3, 2, 1, 2] },
    sparkle: { type: 'sine', gain: 0.03, dur: 0.8, steps: [0.5, 2.5], octave: 24 },
    perc: [{ kind: 'jingle', beats: [0, 1, 1.5, 2, 3, 3.5], gain: 0.07 }],
  }),
  // Upbeat D major: synth stabs, soft four-on-the-floor, sparkle arpeggio.
  newyear: t({
    bpm: 116,
    chords: prog([2, 'M7'], [9, 'M'], [11, 'm7'], [7, 'M7']),
    pad: { type: 'triangle', gain: 0.07, attack: 0.3, release: 0.4 },
    bass: { type: 'sine', gain: 0.3, dur: 0.4, steps: [[0, 1], [0.5, 2], [1, 1], [1.5, 2], [2, 1], [2.5, 2], [3, 1], [3.5, 2]] },
    comp: { type: 'sawtooth', gain: 0.035, dur: 0.25, cutoff: 2800, beats: [0.5, 1.5, 2.5, 3.5] },
    sparkle: { type: 'sine', gain: 0.035, dur: 0.4, steps: EIGHTHS, octave: 24 },
    perc: [{ kind: 'kick', beats: [0, 1, 2, 3], gain: 0.35 }, { kind: 'hat', beats: [0.5, 1.5, 2.5, 3.5], gain: 0.08 }],
  }),
  // Soft jazz ballad in F: maj9/m9 chords, gentle electric piano.
  valentine: t({
    bpm: 72, swing: 0.12,
    chords: prog([5, 'M9'], [2, 'm9'], [7, 'm9'], [0, 'd9']),
    pad: { type: 'sine', gain: 0.07, attack: 0.8, release: 0.6 },
    bass: { type: 'sine', gain: 0.32, dur: 1, steps: [[0, 1], [1.5, 1.5], [2, 1], [3, 1.5]] },
    comp: { type: 'triangle', gain: 0.045, dur: 1.2, cutoff: 1800, attack: 0.01, beats: [0.5, 2.5] },
    lead: { type: 'triangle', gain: 0.09, dur: 1.4, cutoff: 2000, attack: 0.01, steps: [0, 1.5, 2.5], octave: 12, contour: [2, 3, 1, 3, 2, 0, 1, 2, 3] },
    perc: [{ kind: 'hat', beats: [0.5, 1.5, 2.5, 3.5], gain: 0.05 }],
  }),
  // Bright pastoral G major: pentatonic flute, light pizzicato.
  easter: t({
    bpm: 100,
    chords: prog([7, 'M7'], [4, 'm7'], [0, 'M7'], [2, 'd7']),
    pad: { type: 'triangle', gain: 0.07, attack: 0.5, release: 0.5 },
    bass: { type: 'sine', gain: 0.3, dur: 0.3, steps: [[0, 1], [2, 1.5]] },
    comp: { type: 'triangle', gain: 0.045, dur: 0.2, beats: [1, 3] },
    lead: { type: 'sine', gain: 0.12, dur: 1, attack: 0.05, cutoff: 3000, steps: [0, 1, 2.5, 3], octave: 0, scale: { root: 67, degrees: [0, 2, 4, 7, 9] }, contour: [2, 3, 4, 3, 2, 1, 2, 4, 5, 4, 3, 2] },
    perc: [{ kind: 'shaker', beats: [1, 3], gain: 0.04 }],
  }),
  // Tropical F: marimba/steel-drum lead, one-drop reggae with an offbeat skank.
  summer: t({
    bpm: 100,
    chords: prog([5, 'M6'], [2, 'm7'], [7, 'm7'], [0, 'd7']),
    pad: { type: 'triangle', gain: 0.06, attack: 0.4, release: 0.4 },
    bass: { type: 'sine', gain: 0.36, dur: 0.5, steps: [[0, 1], [1.5, 1.5], [2, 1], [3, 1.5], [3.5, 2]] },
    comp: { type: 'triangle', gain: 0.05, dur: 0.18, cutoff: 2500, beats: [0.5, 1.5, 2.5, 3.5] },
    lead: { type: 'sine', gain: 0.13, dur: 0.5, steps: [0, 0.75, 1.5, 2.5, 3], octave: 12, contour: [2, 3, 4, 3, 2, 4, 5, 3, 2, 1] },
    perc: [{ kind: 'kick', beats: [2], gain: 0.3 }, { kind: 'rim', beats: [2], gain: 0.08 }, { kind: 'hat', beats: [0.5, 1.5, 2.5, 3.5], gain: 0.06 }],
  }),

  // ---- weekly: quirky office family ----
  'great-backlog': t({
    bpm: 92,
    chords: prog([9, 'm7'], [2, 'm7'], [7, 'd7'], [0, 'M7']),
    bass: steady('sine', 0.33, 0.4),
    lead: { type: 'square', gain: 0.035, dur: 0.3, cutoff: 1500, steps: EIGHTHS, octave: 12, contour: [0, 1, 2, 1, 0, 2, 3, 2] },
    perc: [{ kind: 'hat', beats: EIGHTHS, gain: 0.07 }, { kind: 'rim', beats: [1, 3], gain: 0.07 }],
    clack: 0.8,
  }),
  'tax-season': t({
    bpm: 84,
    chords: prog([2, 'm7'], [7, 'd7'], [0, 'M7'], [9, 'd7']),
    comp: { type: 'square', gain: 0.025, dur: 0.2, cutoff: 1800, beats: [1, 3] },
    lead: { type: 'square', gain: 0.035, dur: 0.25, cutoff: 1800, steps: [0, 0.5, 2, 2.5], octave: 12, contour: [3, 3, 2, 0, 3, 2, 1, 0] },
    perc: [{ kind: 'rim', beats: [0, 1, 2, 3], gain: 0.06 }],
    clack: 0.5,
  }),
  'lost-socks': t({
    bpm: 76,
    chords: prog([0, 'M7'], [4, 'm7'], [5, 'M7'], [7, 'd7']),
    bass: { type: 'sine', gain: 0.3, dur: 0.3, steps: [[0, 1], [1.5, 1.5], [2, 1], [3, 1.5]] },
    lead: { type: 'triangle', gain: 0.1, dur: 0.25, steps: [0, 1.5, 2, 3.5], octave: 0, scale: { root: 72, degrees: [0, 2, 4, 7, 9] }, contour: [2, 4, 3, 1, 3, 5, 4, 2] },
    perc: [{ kind: 'shaker', beats: [1, 3], gain: 0.04 }],
  }),
  // Spooky organ over a diminished turn.
  'printer-exorcism': t({
    bpm: 76,
    chords: prog([2, 'm'], [11, 'dim'], [9, 'd7'], [2, 'm']),
    pad: { type: 'square', gain: 0.045, attack: 0.3, release: 0.5, cutoff: 1000, trem: { rate: 5.5, depth: 0.25 } },
    bass: { type: 'sine', gain: 0.33, dur: 1.5, steps: [[0, 1], [2, 1]] },
    lead: { type: 'sawtooth', gain: 0.05, dur: 1, cutoff: 1500, attack: 0.03, steps: [0, 1.5, 3], octave: 12, contour: [2, 1, 0, 2, 3, 1] },
    perc: [{ kind: 'rim', beats: [0, 0.25, 0.5, 1.5, 2, 3, 3.25], gain: 0.06 }],
  }),
  // Laid-back bossa in G.
  'casual-friday': t({
    bpm: 92, swing: 0.1,
    chords: prog([7, 'M9'], [4, 'm9'], [9, 'm9'], [2, 'd9']),
    pad: { type: 'sine', gain: 0.07, attack: 0.6, release: 0.5 },
    bass: { type: 'sine', gain: 0.33, dur: 0.6, steps: [[0, 1], [1.5, 1.5], [2, 1], [3.5, 1.5]] },
    comp: { type: 'triangle', gain: 0.04, dur: 0.5, cutoff: 2200, beats: [1, 2.5] },
    lead: { type: 'triangle', gain: 0.08, dur: 0.7, cutoff: 2200, steps: [0, 1.5, 2, 3.5], octave: 12, contour: [2, 3, 1, 2, 3, 4, 2, 1] },
    perc: [{ kind: 'hat', beats: EIGHTHS, gain: 0.05 }, { kind: 'rim', beats: [0, 1.5, 3], gain: 0.06 }],
  }),
  // Dreamy reverse-swell pads that rise through each bar and cut off.
  retrograde: t({
    bpm: 66,
    chords: prog([10, 'M9'], [7, 'm9'], [3, 'M9'], [5, 'd9']),
    pad: { type: 'sine', gain: 0.11, attack: 0, release: 0, swell: true },
    bass: { type: 'sine', gain: 0.3, dur: 3, steps: [[0, 1]] },
    lead: { type: 'sine', gain: 0.07, dur: 2, attack: 0.3, steps: [1], octave: 12, contour: [3, 2, 4, 1] },
    sparkle: { type: 'sine', gain: 0.025, dur: 1.5, steps: [3], octave: 24 },
  }),
  // Nordic drums + horn-like drone, D dorian.
  'valhalla-feast': t({
    bpm: 100,
    chords: prog([2, 'm'], [0, 'M'], [7, 'M'], [2, 'm']),
    pad: { type: 'triangle', gain: 0.06, attack: 0.5, release: 0.5, cutoff: 1200 },
    bass: { type: 'sine', gain: 0.33, dur: 1, steps: [[0, 1], [2, 1]] },
    drone: { note: 38, type: 'sawtooth', gain: 0.05, cutoff: 420 },
    lead: { type: 'sawtooth', gain: 0.06, dur: 1.5, cutoff: 900, attack: 0.08, steps: [0, 2], octave: 0, scale: { root: 62, degrees: [0, 2, 3, 5, 7, 9, 10] }, contour: [4, 6, 5, 4, 2, 4, 3, 2] },
    perc: [{ kind: 'tom', beats: [0, 1, 2, 2.5, 3], gain: 0.4 }],
  }),

  // ---- weekly: the seven sins ----
  // Regal fanfare in Bb.
  'sin-pride': t({
    bpm: 96,
    chords: prog([10, 'M'], [3, 'M'], [5, 'M'], [10, 'M']),
    pad: { type: 'triangle', gain: 0.07, attack: 0.4, release: 0.4 },
    lead: { type: 'sawtooth', gain: 0.055, dur: 0.6, cutoff: 1800, attack: 0.02, steps: [0, 0.5, 1, 2.5, 3], octave: 12, contour: [0, 2, 4, 2, 4, 6, 4, 2, 4, 5] },
    perc: [{ kind: 'tom', beats: [0, 2], gain: 0.35 }],
  }),
  // Slinky jazz, walking bass, a coin ping each bar.
  'sin-greed': t({
    bpm: 84, swing: 0.15,
    chords: prog([0, 'm7'], [5, 'd7'], [10, 'M7'], [3, 'M7']),
    bass: { type: 'sine', gain: 0.33, dur: 0.6, steps: [[0, 1], [1, 1.5], [2, 2], [3, 1.5]] },
    lead: { type: 'sawtooth', gain: 0.045, dur: 0.8, cutoff: 1100, attack: 0.03, steps: [0.5, 1.5, 2.5], octave: 12, contour: [2, 3, 1, 2, 4, 3, 1, 0] },
    sparkle: { type: 'triangle', gain: 0.03, dur: 0.6, steps: [3.5], octave: 24 },
    perc: [{ kind: 'hat', beats: [0.5, 1.5, 2.5, 3.5], gain: 0.06 }],
  }),
  // Driving low drums, still cute.
  'sin-wrath': t({
    bpm: 112,
    chords: prog([4, 'm'], [0, 'M'], [2, 'M'], [4, 'm']),
    bass: { type: 'sine', gain: 0.33, dur: 0.4, steps: [[0, 1], [0.5, 1], [1, 1], [1.5, 1], [2, 1], [2.5, 1], [3, 1], [3.5, 1.5]] },
    lead: { type: 'square', gain: 0.035, dur: 0.3, cutoff: 1400, steps: [0, 1.5, 3], octave: 12, contour: [2, 0, 2, 3, 2, 0] },
    perc: [{ kind: 'kick', beats: [0, 1, 2, 3], gain: 0.38 }, { kind: 'tom', beats: [1.5, 3.5], gain: 0.3 }, { kind: 'snare', beats: [1, 3], gain: 0.18 }],
  }),
  // Sly pizzicato in A harmonic minor.
  'sin-envy': t({
    bpm: 100,
    chords: prog([9, 'm7'], [2, 'd7'], [7, 'm7'], [4, 'd7']),
    pad: { type: 'triangle', gain: 0.06, attack: 0.5, release: 0.5 },
    bass: { type: 'sine', gain: 0.33, dur: 0.25, steps: [[0, 1], [1, 1.5], [2, 1], [3, 1.5]] },
    comp: { type: 'triangle', gain: 0.045, dur: 0.15, beats: [0.5, 1.5, 3.5] },
    lead: { type: 'triangle', gain: 0.1, dur: 0.2, steps: [0, 0.5, 1.5, 2, 3.5], octave: 0, scale: { root: 69, degrees: [0, 2, 3, 5, 7, 8, 11] }, contour: [2, 3, 4, 3, 2, 6, 4, 5, 3, 2] },
  }),
  // Bouncy oom-pah with a tuba-ish bass.
  'sin-gluttony': t({
    bpm: 108,
    chords: prog([0, 'M'], [5, 'M'], [7, 'd7'], [0, 'M']),
    pad: { type: 'triangle', gain: 0.06, attack: 0.4, release: 0.4 },
    bass: { type: 'sawtooth', gain: 0.2, dur: 0.35, cutoff: 420, steps: [[0, 1], [1, 1.5], [2, 1], [3, 1.5]] },
    comp: { type: 'triangle', gain: 0.045, dur: 0.2, beats: [1, 3] },
    lead: { type: 'sine', gain: 0.1, dur: 0.4, steps: [0, 0.5, 1.5, 2, 3], octave: 12, contour: [2, 3, 4, 2, 3, 1, 2, 0] },
    perc: [{ kind: 'snare', beats: [1, 3], gain: 0.09 }],
  }),
  // Very slow sleepy lullaby in 3/4 with a breathing pad.
  'sin-sloth': t({
    bpm: 58, beats: 3,
    chords: prog([5, 'M7'], [2, 'm7'], [10, 'M7'], [0, 'd7']),
    pad: { type: 'sine', gain: 0.1, attack: 1.2, release: 1, trem: { rate: 0.6, depth: 0.2 } },
    bass: { type: 'sine', gain: 0.28, dur: 2.5, steps: [[0, 1]] },
    lead: { type: 'sine', gain: 0.07, dur: 2, attack: 0.02, steps: WALTZ, octave: 12, contour: [4, 3, 2, 3, 2, 1, 2, 1, 0] },
  }),
  // Smooth lounge: vibes lead, rhodes comping, brushes.
  'sin-lust': t({
    bpm: 76, swing: 0.12,
    chords: prog([3, 'M9'], [0, 'm9'], [5, 'm9'], [10, 'd9']),
    pad: { type: 'sine', gain: 0.07, attack: 0.8, release: 0.6 },
    bass: { type: 'sine', gain: 0.32, dur: 1, steps: [[0, 1], [2, 1.5], [3, 1]] },
    comp: { type: 'triangle', gain: 0.045, dur: 1, cutoff: 1600, attack: 0.01, beats: [0, 2.5] },
    lead: { type: 'sine', gain: 0.1, dur: 1.5, attack: 0.01, steps: [0.5, 2, 3.5], octave: 12, contour: [3, 2, 1, 2, 3, 4, 2, 1] },
    perc: [{ kind: 'hat', beats: [1, 3], gain: 0.06 }],
  }),
};

export const DEFAULT_THEME = OFFICE;

/** The theme for an event id; null/unknown means the office loop. */
export const themeFor = (id: string | null): MusicTheme => (id && THEMES[id]) || OFFICE;
