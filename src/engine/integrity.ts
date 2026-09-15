/**
 * Clock plausibility (spec §12). Without a server the game can only reason about two
 * numbers a save carries: the wall clock it was last seen at, and the monotonic uptime of
 * the process that wrote it. This module turns those into a verdict about how much offline
 * time is honest, and whether the daily rollover should be trusted at all.
 */

/** Any single gap longer than this is credited as this much and no more. */
export const MAX_OFFLINE_DAYS = 30;
export const MAX_OFFLINE_MS = MAX_OFFLINE_DAYS * 86_400_000;
export const MAX_OFFLINE_SECONDS = MAX_OFFLINE_MS / 1000;

/**
 * Inside one process the monotonic clock is the truth. A wall clock that outruns it by more
 * than this is someone nudging the device clock forward, not a slow frame.
 */
export const FORWARD_JUMP_TOLERANCE_MS = 5 * 60_000;

/** NTP corrections and daylight-saving edges move the wall clock back a little; that is fine. */
export const BACKWARDS_TOLERANCE_MS = 60_000;

export type GapReason = 'ok' | 'backwards' | 'forward-jump' | 'capped';

export interface GapAssessment {
  /** Seconds of offline time the caller may credit. Never more than the 30-day cap. */
  creditSec: number;
  /** The clock cannot be trusted; the store keeps this sticky until the next honest boot. */
  suspect: boolean;
  /** Whether the daily rollover may run. A rewound clock would otherwise farm daily tasks. */
  allowRollover: boolean;
  reason: GapReason;
}

export interface SavedClocks {
  lastSeenWallClock: number;
  uptimeAtSave: number;
  /** The process that wrote the save. Empty on a save written before v6. */
  processId: string;
}

export interface NowClocks {
  wall: number;
  mono: number;
  processId: string;
}

export function assessGap(saved: SavedClocks, now: NowClocks): GapAssessment {
  const wallDelta = now.wall - saved.lastSeenWallClock;
  if (wallDelta < -BACKWARDS_TOLERANCE_MS) {
    return { creditSec: 0, suspect: true, allowRollover: false, reason: 'backwards' };
  }
  const monoDelta = now.mono - saved.uptimeAtSave;
  // Only comparable within one process: across a restart the monotonic clock starts over,
  // so wall time legitimately outruns it by the whole time the app was closed.
  if (now.processId === saved.processId && wallDelta > monoDelta + FORWARD_JUMP_TOLERANCE_MS) {
    return { creditSec: Math.max(0, monoDelta / 1000), suspect: true, allowRollover: false, reason: 'forward-jump' };
  }
  if (wallDelta > MAX_OFFLINE_MS) {
    return { creditSec: MAX_OFFLINE_SECONDS, suspect: false, allowRollover: true, reason: 'capped' };
  }
  return { creditSec: wallDelta / 1000, suspect: false, allowRollover: true, reason: 'ok' };
}

/**
 * A per-process id, regenerated on every boot. Two boots of the same save must not collide,
 * so that the forward-jump rule only ever fires on a genuine same-process resume.
 */
export function newProcessId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
}
