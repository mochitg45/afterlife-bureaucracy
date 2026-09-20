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
    vi.advanceTimersByTime(4000);
    expect(ctx.started.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('stops the orphaned hum when a clack throws, and starts exactly one new hum after recovery', () => {
    vi.useFakeTimers();
    const ctx = fakeContext();
    const oscStops: string[] = [];
    const workingCreateOscillator = ctx.createOscillator;
    ctx.createOscillator = () => {
      const n = workingCreateOscillator();
      const origStop = n.stop;
      n.stop = () => { oscStops.push('osc'); origStop(); };
      return n;
    };
    const audio = createAudio(() => ctx as unknown as AudioContext);

    // Hum starts cleanly: two live oscillators, nothing stopped yet.
    audio.unlock();
    expect(ctx.started.filter((k) => k === 'osc')).toHaveLength(2);
    expect(oscStops).toHaveLength(0);

    // Now the context breaks mid-ambience: the next clack's noise() throws.
    const workingCreateBufferSource = ctx.createBufferSource;
    ctx.createBufferSource = () => { throw new Error('context closed'); };
    vi.advanceTimersByTime(1000); // past the 400ms initial clack delay
    // The orphaned hum's two oscillators must have been stopped, not just dropped.
    expect(oscStops).toHaveLength(2);

    // Recovery: restore the fake, and a later setEnabled restarts exactly one new hum.
    ctx.createBufferSource = workingCreateBufferSource;
    audio.setEnabled({ sfx: true, music: true });
    vi.advanceTimersByTime(1000);
    const oscStarts = ctx.started.filter((k) => k === 'osc').length;
    expect(oscStarts - oscStops.length).toBe(2);
    vi.useRealTimers();
  });
});
