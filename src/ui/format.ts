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
