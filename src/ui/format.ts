const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago a wall-clock stamp was, in the coarsest unit that still says something: a
 * player checking a cloud save wants "5 min ago", never a timestamp they have to subtract.
 *
 * A stamp of 0 is a save that was never written (an empty `savedAtWall`), which is a
 * different thing from a save written a long time ago, so it says so. A stamp in the future
 * is a device clock that moved backwards, not a negative age, so it reads as "just now".
 */
export function relativeTime(fromWall: number, nowWall: number): string {
  if (fromWall <= 0) return 'date unknown';
  const ms = nowWall - fromWall;
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  const days = Math.floor(ms / DAY);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** A countdown in whole minutes, rounded up: "3h 07m" reads as "3h 7m". */
export function fmtLeft(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** A longer countdown: "3d 4h" from a day out, otherwise the hours-and-minutes of fmtLeft. */
export function fmtCountdown(ms: number): string {
  const hours = Math.floor(Math.max(0, ms) / 3_600_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : fmtLeft(ms);
}
