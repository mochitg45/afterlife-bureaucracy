import { relativeTime } from './format';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('says the date is unknown when the save carries no timestamp', () => {
    expect(relativeTime(0, NOW)).toBe('date unknown');
  });

  it('calls anything under a minute just now', () => {
    expect(relativeTime(NOW - 1000, NOW)).toBe('just now');
    expect(relativeTime(NOW - 59_000, NOW)).toBe('just now');
  });

  it('counts whole minutes under an hour', () => {
    expect(relativeTime(NOW - 5 * MIN, NOW)).toBe('5 min ago');
    expect(relativeTime(NOW - 59 * MIN, NOW)).toBe('59 min ago');
  });

  it('counts whole hours under a day', () => {
    expect(relativeTime(NOW - 2 * HOUR, NOW)).toBe('2 h ago');
    expect(relativeTime(NOW - 23 * HOUR, NOW)).toBe('23 h ago');
  });

  it('counts days beyond that, singular at one', () => {
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe('3 days ago');
    expect(relativeTime(NOW - DAY, NOW)).toBe('1 day ago');
  });

  // A save stamped in the future is a clock that moved backwards, not a time to count up from.
  it('treats a future stamp as just now', () => {
    expect(relativeTime(NOW + 5 * MIN, NOW)).toBe('just now');
  });
});
