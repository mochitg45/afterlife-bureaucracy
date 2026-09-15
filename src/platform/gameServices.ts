import { Capacitor } from '@capacitor/core';
import { CapacitorGameConnect } from '@openforge/capacitor-game-connect';
import { TODO_ID } from './gameIds';

export interface GameServices {
  signIn(): Promise<boolean>;
  isSignedIn(): boolean;
  unlockAchievements(ids: string[]): Promise<void>;
  submitScore(leaderboardId: string, value: number): Promise<void>;
}

/** Browser and test fallback: no Play Games, nothing to sign into, every call a no-op. */
export const noopGameServices: GameServices = {
  async signIn() {
    return false;
  },
  isSignedIn() {
    return false;
  },
  async unlockAchievements() {},
  async submitScore() {},
};

function isPlaceholder(id: string): boolean {
  return !id || id === TODO_ID || id.startsWith('TODO');
}

/**
 * Play Games Services. Achievements and the leaderboard are cosmetic, so every failure is
 * swallowed: a signed-out player, a device without Play Games, or an unmapped console id
 * must never surface as an error in the game.
 *
 * Not exercised by tests — there is no Play Games SDK under jsdom. Typed against the
 * plugin's published definitions and covered by `tsc` only.
 */
export const playGamesServices: GameServices = (() => {
  let signedIn = false;

  return {
    async signIn() {
      try {
        await CapacitorGameConnect.signIn();
        signedIn = true;
      } catch {
        signedIn = false;
      }
      return signedIn;
    },

    isSignedIn() {
      return signedIn;
    },

    async unlockAchievements(ids) {
      if (!signedIn) return;
      for (const achievementID of ids) {
        if (isPlaceholder(achievementID)) continue;
        try {
          await CapacitorGameConnect.unlockAchievement({ achievementID });
        } catch {
          /* already unlocked, unknown id, or offline */
        }
      }
    },

    async submitScore(leaderboardID, value) {
      if (!signedIn || isPlaceholder(leaderboardID)) return;
      if (!Number.isFinite(value)) return;
      // Play Games leaderboards take a whole, non-negative 64-bit score.
      const totalScoreAmount = Math.max(0, Math.min(Math.round(value), Number.MAX_SAFE_INTEGER));
      try {
        await CapacitorGameConnect.submitScore({ leaderboardID, totalScoreAmount });
      } catch {
        /* offline or unknown leaderboard */
      }
    },
  };
})();

export function pickGameServices(): GameServices {
  return Capacitor.isNativePlatform() ? playGamesServices : noopGameServices;
}
