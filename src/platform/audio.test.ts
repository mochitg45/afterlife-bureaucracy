import { createAudio } from './audio';

/** The smallest fake graph that records what the module asked for. */
function fakeContext() {
  const started: string[] = [];
  const node = (kind: string) => ({
    kind, connect: (_to?: { kind?: string }) => {}, start: () => started.push(kind), stop: () => {},
    frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    type: 'sine', buffer: null, loop: false, Q: { value: 0 },
  });
  const ctx = {
    state: 'suspended' as 'suspended' | 'running' | 'closed',
    currentTime: 0,
    destination: {},
    sampleRate: 44100,
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    suspend: vi.fn(async () => { ctx.state = 'suspended'; }),
    createOscillator: () => node('osc'),
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
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
    expect(ctx.started).toHaveLength(0); // sfx off: the hire tones never start; the loop waits for its timer
    // The music scheduler fires: a bar has pads and bass (oscillators) and hi-hats (noise).
    vi.advanceTimersByTime(10);
    expect(ctx.started.filter((k) => k === 'osc').length).toBeGreaterThanOrEqual(7);
    expect(ctx.started.filter((k) => k === 'noise').length).toBeGreaterThanOrEqual(4);
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
    const names = ['stamp', 'hire', 'upgrade', 'pull', 'reveal-temp', 'reveal-fulltime', 'reveal-senior', 'reveal-executive', 'equip', 'achievement', 'audit', 'report'] as const;
    for (const n of names) {
      const before = ctx.started.length;
      audio.play(n);
      expect(ctx.started.length, n).toBeGreaterThan(before);
    }
  });

  it('recovers ambience after a closed-context throw during unlock', () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    const workingCreateOscillator = ctx.createOscillator;
    ctx.createOscillator = () => { throw new DOMException('closed', 'InvalidStateError'); };
    const audio = createAudio(() => ctx as unknown as AudioContext);
    expect(() => audio.unlock()).not.toThrow();
    expect(ctx.started).toHaveLength(0);

    ctx.createOscillator = workingCreateOscillator;
    audio.setEnabled({ sfx: true, music: true });
    vi.advanceTimersByTime(9000);
    expect(ctx.started.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('stops the loop when a bar throws mid-music, and restarts it once after recovery', () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.unlock();
    vi.advanceTimersByTime(10);
    const firstBar = ctx.started.length;
    expect(firstBar).toBeGreaterThan(0);

    // The context breaks: the next bar's hi-hat noise() throws. The scheduler must stop, not loop on errors.
    const workingCreateBufferSource = ctx.createBufferSource;
    ctx.createBufferSource = () => { throw new Error('context closed'); };
    ctx.currentTime = 10; // the clock moved on, so the next tick tries to schedule a bar
    vi.advanceTimersByTime(2000);
    const afterThrow = ctx.started.length;
    vi.advanceTimersByTime(10_000);
    expect(ctx.started.length).toBe(afterThrow); // dead: no further scheduling

    // Recovery: restore the fake; setEnabled restarts the loop and one bar schedules again.
    ctx.createBufferSource = workingCreateBufferSource;
    ctx.currentTime = 20;
    audio.setEnabled({ sfx: true, music: true });
    vi.advanceTimersByTime(10);
    expect(ctx.started.length).toBeGreaterThan(afterThrow);
    vi.useRealTimers();
  });

  it('resumes again on every play while the context is still not running', () => {
    const ctx = fakeContext();
    ctx.resume = vi.fn(async () => { /* the WebView refuses: state stays suspended */ });
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    audio.play('stamp');
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(audio.isRunning()).toBe(false);
  });

  it('builds a fresh context after the old one closes', () => {
    const made: ReturnType<typeof fakeContext>[] = [];
    const audio = createAudio(() => { const c = fakeContext(); made.push(c); return c as unknown as AudioContext; });
    audio.unlock();
    expect(made).toHaveLength(1);
    made[0].state = 'closed';
    audio.play('stamp');
    expect(made).toHaveLength(2);
  });

  it('runs the master through a limiter when the context has one', () => {
    const ctx = fakeContext();
    const connections: string[] = [];
    const workingCreateGain = ctx.createGain;
    ctx.createGain = () => {
      const n = workingCreateGain();
      n.connect = (to?: { kind?: string }) => { connections.push(`${n.kind}->${to?.kind ?? 'destination'}`); };
      return n;
    };
    (ctx as Record<string, unknown>).createDynamicsCompressor = () => ({
      kind: 'limiter', connect: () => { connections.push('limiter->destination'); },
      threshold: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    });
    const audio = createAudio(() => ctx as unknown as AudioContext);
    audio.unlock();
    expect(connections).toContain('gain->limiter');
    expect(connections).toContain('limiter->destination');
    expect(connections).not.toContain('gain->destination');
  });
});
