import { t, tn } from '../i18n';

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
  if (fromWall <= 0) return t('time.unknown');
  const ms = nowWall - fromWall;
  if (ms < MINUTE) return t('time.justNow');
  if (ms < HOUR) return t('time.minAgo', { n: Math.floor(ms / MINUTE) });
  if (ms < DAY) return t('time.hAgo', { n: Math.floor(ms / HOUR) });
  return tn('time.daysAgo', Math.floor(ms / DAY));
}

/** A countdown in whole minutes, rounded up: "3h 07m" reads as "3h 7m". */
export function fmtLeft(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return t('time.hm', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

/** A longer countdown: "3d 4h" from a day out, otherwise the hours-and-minutes of fmtLeft. */
export function fmtCountdown(ms: number): string {
  const hours = Math.floor(Math.max(0, ms) / 3_600_000);
  return hours >= 24 ? t('time.dh', { d: Math.floor(hours / 24), h: hours % 24 }) : fmtLeft(ms);
}
