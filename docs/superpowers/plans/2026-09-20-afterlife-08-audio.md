# Audio (Plan 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game sound effects and an office ambience loop, synthesised in code, with Sound and Music toggles in Settings.

**Architecture:** One platform module, `src/platform/audio.ts`, owns a Web Audio graph and exposes `play(name)`, `setEnabled(...)`, `unlock()`, `suspend()/resume()`. The store gets an `audio` dependency (like `ads`, `cloudSave`) and calls `play` at the action sites; settings carry two booleans that the store forwards to the module. Nothing else in the UI knows about audio except the Settings rows and a one-time unlock listener in `App`.

**Tech Stack:** Web Audio API (OscillatorNode, AudioBufferSourceNode for noise, GainNode envelopes); vitest with a hand-rolled fake `AudioContext`; zustand store deps; Capacitor Android WebView.

**Spec:** `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` (§10 style: parchment office, retro; §12 settings). This plan adds §15 Audio to the spec in Task 4.

## Global Constraints

- No audio files: every sound is generated; nothing to license, nothing to bundle.
- Default both toggles **on**; they travel with the save like `settings.theme` (no save version bump: `sanitizeSettings` fills defaults).
- jsdom has no `AudioContext`: the module is a no-op there and every test injects a fake.
- Audio may only start after a user gesture (WebView autoplay policy): `unlock()` from the first pointerdown/keydown.
- Music stops when the app is backgrounded (the store's existing pause hook) and resumes on return.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Push after each commit.
- Style: smallest diff, reuse helpers, one behavioural test per item, `// ponytail:` on deliberate corners.

---

### Task 1: Audio module

**Files:**
- Create: `src/platform/audio.ts`
- Test: `src/platform/audio.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SfxName = 'stamp' | 'hire' | 'upgrade' | 'pull' | 'reveal-temp' | 'reveal-fulltime' | 'reveal-senior' | 'reveal-executive' | 'equip' | 'achievement' | 'audit' | 'report' | 'tick';
  export interface Audio {
    play(name: SfxName): void;
    setEnabled(flags: { sfx: boolean; music: boolean }): void;
    unlock(): void;      // first user gesture: create/resume the context, start music if enabled
    suspend(): void;     // app backgrounded
    resume(): void;      // app foregrounded
  }
  export function createAudio(ctxFactory?: () => AudioContext | null): Audio;
  export function pickAudio(): Audio; // createAudio() with window.AudioContext, or the no-op when absent
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/platform/audio.test.ts
import { createAudio } from './audio';

/** The smallest fake graph that records what the module asked for. */
function fakeContext() {
  const started: string[] = [];
  const node = (kind: string) => ({
    kind, connect: () => {}, start: () => started.push(kind), stop: () => {},
    frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    type: 'sine', buffer: null, loop: false, Q: { value: 0 },
  });
  const ctx = {
    state: 'suspended' as 'suspended' | 'running',
    currentTime: 0,
    destination: {},
    sampleRate: 44100,
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    suspend: vi.fn(async () => { ctx.state = 'suspended'; }),
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => node('noise'),
    started,
  };
  return ctx;
}

describe('audio', () => {
  it('is a silent no-op when the platform has no AudioContext', () => {
    const audio = createAudio(() => null);
    expect(() => { audio.unlock(); audio.play('stamp'); audio.suspend(); audio.resume(); }).not.toThrow();
  });

  it('plays nothing before unlock, then plays after the first gesture', () => {
    const ctx = fakeContext();
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.play('stamp');
    expect(ctx.started).toHaveLength(0);
    audio.unlock();
    audio.play('stamp');
    expect(ctx.started.length).toBeGreaterThan(0);
  });

  it('honours the sfx flag and keeps music separate', () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.setEnabled({ sfx: false, music: true });
    audio.unlock();
    audio.play('hire');
    expect(ctx.started.filter((k) => k === 'osc')).toHaveLength(2); // the ambience hum's two oscillators only
    // The ambience scheduler is running: within 4 s at least one typewriter clack (noise) fires.
    vi.advanceTimersByTime(4000);
    expect(ctx.started.filter((k) => k === 'noise').length).toBeGreaterThan(0);
    audio.setEnabled({ sfx: false, music: false });
    const before = ctx.started.length;
    vi.advanceTimersByTime(10_000);
    expect(ctx.started.length).toBe(before);
    vi.useRealTimers();
  });

  it('suspends the context in the background and resumes it', () => {
    const ctx = fakeContext();
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.unlock();
    audio.suspend();
    expect(ctx.suspend).toHaveBeenCalled();
    audio.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(2); // once at unlock, once on resume
  });

  it('has a recipe for every SfxName', () => {
    const ctx = fakeContext();
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.setEnabled({ sfx: true, music: false });
    audio.unlock();
    const names = ['stamp', 'hire', 'upgrade', 'pull', 'reveal-temp', 'reveal-fulltime', 'reveal-senior', 'reveal-executive', 'equip', 'achievement', 'audit', 'report', 'tick'] as const;
    for (const n of names) {
      const before = ctx.started.length;
      audio.play(n);
      expect(ctx.started.length, n).toBeGreaterThan(before);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/platform/audio.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/platform/audio.ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/platform/audio.test.ts`
Expected: PASS (5 tests). The fake counts `started` on every `start()` call, and every recipe calls at least one.

- [ ] **Step 5: Commit**

```bash
git add src/platform/audio.ts src/platform/audio.test.ts
git commit -m "feat(audio): synthesised sound effects and office ambience module

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Settings fields and store wiring

**Files:**
- Modify: `src/engine/state.ts` (Settings interface ~line 76–81; `createInitialState` settings literal ~line 190; `sanitizeSettings` ~line 389–401)
- Modify: `src/engine/state.test.ts` (the two `expect(s.settings).toEqual(...)` at ~197 and ~204: add `sfx: true, music: true`)
- Modify: `src/store/game.ts` (`StoreDeps` ~252; deps pick ~276–280; `GameStore` interface ~226; `setTheme` neighbour ~1103; action sites: `stamp` ~1012, `hire` ~1020, `upgrade` ~1027, `pull` ~1078, `equip` ~1085; `apply` ~398–408 for achievements; the audit action where `lastAudit` is set; where `pendingOffline` is set non-null on boot/resume; pause/resume hooks ~938/950; boot after `ready: true`)
- Test: `src/store/game.test.ts`

**Interfaces:**
- Consumes: `Audio`, `SfxName`, `pickAudio` from Task 1.
- Produces: `Settings.sfx: boolean`, `Settings.music: boolean`; store action `setSound(flags: Partial<{ sfx: boolean; music: boolean }>): void`; `StoreDeps.audio?: Audio`; store slice field `audio: Audio`.

- [ ] **Step 1: Write the failing tests**

In `src/engine/state.test.ts`, change the two settings equality assertions to include `sfx: true, music: true`, and add:

```ts
  it('defaults sfx and music to on and coerces garbage to booleans', () => {
    const raw = { ...saveV5, settings: { ...saveV5.settings, sfx: 'nope', music: 0 } };
    const s = deserialize(JSON.stringify(raw), content);
    expect(s.settings.sfx).toBe(true);
    expect(s.settings.music).toBe(false);
  });
```

In `src/store/game.test.ts`, add a fake audio next to `make`:

```ts
function fakeAudio() {
  const played: string[] = [];
  const enabled: { sfx: boolean; music: boolean }[] = [];
  return {
    played, enabled,
    play: (n: string) => { played.push(n); },
    setEnabled: (f: { sfx: boolean; music: boolean }) => { enabled.push(f); },
    unlock: vi.fn(), suspend: vi.fn(), resume: vi.fn(),
  };
}
async function makeWithAudio(wall = 1_000_000) {
  const audio = fakeAudio();
  const store = createGameStore({ content, storage: memoryStorage(), clock: fakeClock({ wall, mono: 0 }), tickMs: 1_000_000, autosaveMs: 1_000_000, audio });
  await store.getState().boot();
  return { store, audio };
}
```

and, inside `describe('game store')`:

```ts
  it('plays a sound for each action that deserves one', async () => {
    const { store, audio } = await makeWithAudio();
    expect(audio.enabled.at(-1)).toEqual({ sfx: true, music: true });
    store.getState().stamp();
    expect(audio.played).toContain('stamp');
    for (let i = 0; i < 20; i++) store.getState().stamp();
    store.getState().hire('dave', 1);
    expect(audio.played).toContain('hire');
    store.getState().hire('dave', 1000); // unaffordable: no sound
    expect(audio.played.filter((n) => n === 'hire')).toHaveLength(1);
    store.getState().setSound({ sfx: false });
    expect(store.getState().state.settings.sfx).toBe(false);
    expect(audio.enabled.at(-1)).toEqual({ sfx: false, music: true });
    store.getState().stopLoop();
  });

  it('plays the achievement bell when an achievement settles', async () => {
    const { store, audio } = await makeWithAudio();
    for (let i = 0; i < 1000; i++) store.getState().stamp(); // "First Thousand" (a-souls-1)
    expect(audio.played).toContain('achievement');
    store.getState().stopLoop();
  });

  it('plays the reveal sting for the best rarity in a pull', async () => {
    const { store, audio } = await makeWithAudio(0); // wall 0 seeds an executive in the ten-pull (see PersonnelScreen.test)
    store.setState({ state: { ...store.getState().state, vouchers: 90 } });
    store.getState().pull(10);
    expect(audio.played).toContain('pull');
    expect(audio.played).toContain('reveal-executive');
    store.getState().stopLoop();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/engine/state.test.ts src/store/game.test.ts`
Expected: FAIL (settings shape, `audio` not a dep, `setSound` missing).

- [ ] **Step 3: Implement**

`src/engine/state.ts`:

```ts
  theme: 'light' | 'dark' | 'system';
  /** Sound effects and the office ambience loop; both travel with the save like the theme. */
  sfx: boolean;
  music: boolean;
}
```

`createInitialState` literal: `settings: { notifOptIn: 'unasked', notifDate: '', notifsSent: 0, theme: 'light', sfx: true, music: true },`

`sanitizeSettings`: add `const flag = (v: unknown) => (v === undefined ? true : Boolean(v));` and return `sfx: flag(raw.sfx), music: flag(raw.music),` (missing → on; `'nope'` → true; `0`/`false` → off).

`src/store/game.ts`:

```ts
import { pickAudio, type Audio, type SfxName } from '../platform/audio';
// StoreDeps
  audio?: Audio;
// after the cloudSave pick
  const audio = deps.audio ?? pickAudio();
  const sfx = (name: SfxName) => audio.play(name);
  const applySoundSettings = (s: GameState) => audio.setEnabled({ sfx: s.settings.sfx, music: s.settings.music });
// GameStore interface (next to setTheme)
  audio: Audio;
  setSound(flags: Partial<{ sfx: boolean; music: boolean }>): void;
// initial slice: `audio,`
// action (next to setTheme)
      setSound(flags) {
        const settings = { ...get().state.settings, ...flags };
        apply({ ...get().state, settings });
        applySoundSettings(get().state);
        void get().save();
      },
```

Action sites, one line each:
- `stamp()`: after `apply(...)`: `sfx('stamp');`
- `hire()`: after `apply(...)`: `if (next !== s) sfx('hire');`
- `upgrade()`: `const s = get().state; const next = buyUpgrade(s, content, upgradeId); apply(next); if (next !== s) sfx('upgrade');`
- `pull(count)`: after the apply that sets `pendingPull`: `sfx('pull'); const best = (['executive', 'senior', 'fulltime', 'temp'] as const).find((rar) => r.results.some((x) => x.rarity === rar)) ?? 'temp'; sfx(('reveal-' + best) as SfxName);`
- `equip(cardId)`: `const s = get().state; const next = equipCard(s, content, cardId); apply(next); if (next !== s) sfx('equip');`
- `apply()`: after `set(...)`: `if (r.unlockedAch.length) sfx('achievement');`
- the audit action, where `lastAudit` is set: `sfx('audit');`
- where boot/resume sets `pendingOffline` to a non-null report: `sfx('report');` (the boot one fires before unlock, so it is silent; the resume one is heard)
- boot, right after `ready: true` is set: `applySoundSettings(get().state);` and the same call at the end of `takeCloud` and the save-code import path (whole-state replacements).
- pause hook (~938/950, where `syncCloud('pause')` runs): `audio.suspend();` and in the resume/foreground branch: `audio.resume();`.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. If `PersonnelScreen.test`, `SettingsSheet.test` or `cloud.test` seed a settings literal, add `sfx: true, music: true` there too.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/state.test.ts src/store/game.ts src/store/game.test.ts
git commit -m "feat(audio): sound settings in the save, and the store plays each action

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Settings rows and the unlock gesture

**Files:**
- Modify: `src/ui/overlays/SettingsSheet.tsx` (~line 32 selectors; theme row ~112–123: add two rows after it)
- Modify: `src/ui/overlays/SettingsSheet.test.tsx` (next to the theme test ~52)
- Modify: `src/ui/App.tsx` (~line 31 phase state; add a `useEffect` that registers the unlock listener)
- Modify: `src/ui/App.test.tsx` (one test)

**Interfaces:**
- Consumes: `useGame((s) => s.state.settings.sfx / .music)`, `useGame((s) => s.setSound)`, `useGame.getState().audio.unlock()` from Task 2.

- [ ] **Step 1: Write the failing tests**

`SettingsSheet.test.tsx`:

```ts
  it('renders sound toggles and calls setSound', () => {
    seed('no');
    const setSound = vi.fn();
    useGame.setState({ setSound });
    render(<SettingsSheet open onClose={() => {}} onGoToOdds={() => {}} onSaveCode={() => {}} />);
    const sfx = screen.getByRole('checkbox', { name: 'Sound effects' });
    const music = screen.getByRole('checkbox', { name: 'Music' });
    expect(sfx).toBeChecked();
    expect(music).toBeChecked();
    fireEvent.click(music);
    expect(setSound).toHaveBeenCalledWith({ music: false });
  });
```

`App.test.tsx` (use that file's existing render/boot helper):

```ts
  it('unlocks audio on the first pointer down, once', () => {
    const unlock = vi.fn();
    useGame.setState({ audio: { unlock, play: () => {}, setEnabled: () => {}, suspend: () => {}, resume: () => {} } });
    render(<App />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(document.body);
    expect(unlock).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/ui/overlays/SettingsSheet.test.tsx src/ui/App.test.tsx`
Expected: FAIL (no checkboxes; no listener).

- [ ] **Step 3: Implement**

`SettingsSheet.tsx`, after the Theme row:

```tsx
      <div className="settings-row">
        <span>Sound effects</span>
        <input type="checkbox" aria-label="Sound effects" checked={sfx} onChange={(e) => setSound({ sfx: e.target.checked })} />
      </div>
      <div className="settings-row">
        <span>Music</span>
        <input type="checkbox" aria-label="Music" checked={music} onChange={(e) => setSound({ music: e.target.checked })} />
      </div>
```

with selectors `const sfx = useGame((s) => s.state.settings.sfx); const music = useGame((s) => s.state.settings.music); const setSound = useGame((s) => s.setSound);`.

`App.tsx`:

```tsx
  // Web Audio may only start from a user gesture; the first tap anywhere is that gesture.
  useEffect(() => {
    const unlock = () => { useGame.getState().audio.unlock(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
```

(`unlock()` is idempotent, so a key after a tap is harmless; the test's "once" holds for two pointerdowns because the listener is `{ once: true }`.)

- [ ] **Step 4: Run the tests and the build**

Run: `npm test && npm run build`
Expected: PASS, build green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/overlays/SettingsSheet.tsx src/ui/overlays/SettingsSheet.test.tsx src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat(audio): sound and music toggles, unlock on the first tap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: Spec, listing note, and the phone pass

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-afterlife-bureaucracy-design.md` (append §15)
- Modify: `docs/store/listing.md` (What's new block: add "Sound effects and office ambience, with toggles in Settings.")
- Modify: `docs/release.md` (Manual device pass list: add the audio line)

- [ ] **Step 1: Append §15 to the spec**

```markdown
## 15. Audio

Every sound is synthesised with Web Audio at play time; the app ships no audio files. Sound
effects: stamp, hire, upgrade, pull, one reveal sting per rarity, equip, achievement bell,
audit slam, backlog-report shuffle, UI tick. Ambience: a low office hum with random typewriter
clacks and an occasional desk bell. Settings carry `sfx` and `music` booleans (default on) that
travel with the save. Audio starts on the first user gesture and suspends while the app is in
the background. Volume is fixed (master 0.5, ambience 0.18); a slider is a v1.1 item.
```

- [ ] **Step 2: Add the device-pass line to `docs/release.md`**

Under "Manual device pass": `- Sound: stamp thud on tap with no noticeable lag; ambience audible on the title screen after the first tap; both toggles in Settings silence their half; audio stops when the app is backgrounded and returns on resume; phone media volume controls it.`

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: audio section in the spec, listing note, device-pass line

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: Phone pass (controller, not the implementer)**

`npm run cap:sync && cd android && ./gradlew assembleDebug`, install on ZP7DHY8XB6AIJJ7T, and run the release.md line. Record findings in the ledger; a laggy stamp is a fix-wave item (drop the noise layer from the stamp recipe first, keep the tone).

---

## Self-review

- Spec coverage: SFX list, ambience, toggles, gesture unlock, background suspend, no files: Tasks 1–3; spec text: Task 4.
- Placeholders: none; every code step is written out.
- Type consistency: `SfxName` union in Task 1 matches the strings the store emits in Task 2 (`'reveal-' + best` covers `temp | fulltime | senior | executive`, the `PullResult.rarity` values); `setSound(Partial<{sfx, music}>)` in Task 2 is what Task 3 calls; `audio` on the store slice (Task 2) is what Task 3's App reads.
