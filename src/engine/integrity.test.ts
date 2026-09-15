import {
  assessGap,
  MAX_OFFLINE_DAYS,
  MAX_OFFLINE_SECONDS,
  FORWARD_JUMP_TOLERANCE_MS,
  BACKWARDS_TOLERANCE_MS,
} from './integrity';

const T = 1_700_000_000_000;

/** A save written 1 000 ms into the process that wrote it. */
const saved = { lastSeenWallClock: T, uptimeAtSave: 1_000, processId: 'p1' };

describe('assessGap', () => {
  it('credits an honest gap in full', () => {
    expect(assessGap(saved, { wall: T + 120_000, mono: 121_000, processId: 'p1' })).toEqual({
      creditSec: 120,
      suspect: false,
      allowRollover: true,
      reason: 'ok',
    });
  });

  it('treats a wall clock moved well backwards as suspect and credits nothing', () => {
    expect(assessGap(saved, { wall: T - 90_000, mono: 91_000, processId: 'p2' })).toEqual({
      creditSec: 0,
      suspect: true,
      allowRollover: false,
      reason: 'backwards',
    });
  });

  it('tolerates a small backwards drift rather than calling it cheating', () => {
    // 30 s back is inside the 60 s tolerance: an NTP correction, not a rewound clock.
    const r = assessGap(saved, { wall: T - 30_000, mono: 31_000, processId: 'p2' });
    expect(r.reason).toBe('ok');
    expect(r.suspect).toBe(false);
    expect(r.allowRollover).toBe(true);
    expect(r.creditSec).toBe(-30);
  });

  it('calls the boundary of the backwards tolerance honest', () => {
    const r = assessGap(saved, { wall: T - BACKWARDS_TOLERANCE_MS, mono: 61_000, processId: 'p2' });
    expect(r.reason).toBe('ok');
  });

  it('credits only the monotonic gap when the wall clock jumps forward mid-process', () => {
    // Same process, 60 s of real uptime, but the wall clock claims an hour passed.
    expect(assessGap(saved, { wall: T + 3_600_000, mono: 61_000, processId: 'p1' })).toEqual({
      creditSec: 60,
      suspect: true,
      allowRollover: false,
      reason: 'forward-jump',
    });
  });

  it('never credits negative time on a forward jump with a rewound monotonic clock', () => {
    const r = assessGap(saved, { wall: T + 3_600_000, mono: 0, processId: 'p1' });
    expect(r.reason).toBe('forward-jump');
    expect(r.creditSec).toBe(0);
  });

  it('allows a forward jump inside the tolerance', () => {
    const mono = 1_000 + 60_000;
    const r = assessGap(saved, { wall: T + 60_000 + FORWARD_JUMP_TOLERANCE_MS, mono, processId: 'p1' });
    expect(r.reason).toBe('ok');
    expect(r.creditSec).toBe(360);
  });

  it('does not apply the forward-jump rule across processes', () => {
    // A different process means the app was closed; wall time legitimately outruns uptime.
    expect(assessGap(saved, { wall: T + 3_600_000, mono: 61_000, processId: 'p2' })).toEqual({
      creditSec: 3600,
      suspect: false,
      allowRollover: true,
      reason: 'ok',
    });
  });

  it('caps a gap longer than thirty days', () => {
    expect(assessGap(saved, { wall: T + 60 * 86_400_000, mono: 61_000, processId: 'p2' })).toEqual({
      creditSec: MAX_OFFLINE_SECONDS,
      suspect: false,
      allowRollover: true,
      reason: 'capped',
    });
    expect(MAX_OFFLINE_SECONDS).toBe(MAX_OFFLINE_DAYS * 86_400);
  });

  it('credits exactly thirty days without calling it capped', () => {
    const r = assessGap(saved, { wall: T + 30 * 86_400_000, mono: 61_000, processId: 'p2' });
    expect(r.reason).toBe('ok');
    expect(r.creditSec).toBe(MAX_OFFLINE_SECONDS);
  });

  it('prefers the backwards verdict over the cap', () => {
    const r = assessGap({ ...saved, lastSeenWallClock: T + 60 * 86_400_000 }, { wall: T, mono: 61_000, processId: 'p1' });
    expect(r.reason).toBe('backwards');
    expect(r.creditSec).toBe(0);
  });
});
