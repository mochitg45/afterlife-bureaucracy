import type { GameState } from './state';
import type Decimal from 'break_infinity.js';

export type CloudSyncResult = 'none' | 'uploaded' | 'downloaded' | 'kept-local' | 'unavailable' | 'error';
export interface SaveSummary { soulsLifetime: Decimal; savedAtWall: number; fiscalYear: number; seals: number }

export function summarize(s: GameState): SaveSummary {
  return { soulsLifetime: s.soulsLifetime, savedAtWall: s.savedAtWall, fiscalYear: s.fiscalYear, seals: s.seals };
}

/** More lifetime souls wins; equal souls, later save wins; equal souls and time, local wins. */
export function pickWinner(local: GameState, cloud: GameState): 'local' | 'cloud' {
  const c = cloud.soulsLifetime.cmp(local.soulsLifetime);
  if (c > 0) return 'cloud';
  if (c < 0) return 'local';
  return cloud.savedAtWall > local.savedAtWall ? 'cloud' : 'local';
}
