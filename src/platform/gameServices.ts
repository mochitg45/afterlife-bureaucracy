import { Capacitor } from '@capacitor/core';
import { CapacitorGameConnect } from '@openforge/capacitor-game-connect';
import { TODO_ID } from './gameIds';

/** Largest score the Android Play Games plugin can take without crashing (Java int). */
export const PLAY_GAMES_MAX_SCORE = 2_147_483_647;

export interface GameServices {
  signIn(): Promise<boolean>;
  isSignedIn(): boolean;
  unlockAchievements(ids: string[]): Promise<void>;
  submitScore(leaderboardId: string, value: number): Promise<void>;
  /** Opens the platform's leaderboard screen; false if it could not be shown. */
  showLeaderboard(leaderboardId: string): Promise<boolean>;
  /** Whether this platform has leaderboards at all (Play Games / Game Center). */
  available(): boolean;
  /** The signed-in player's display name, for the in-game leaderboard; null when unknown. */
  playerName?(): string | null;
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
  async showLeaderboard() {
    return false;
  },
  available() {
    return false;
  },
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
  let name: string | null = null;

  return {
    async signIn() {
      try {
        const r = await CapacitorGameConnect.signIn();
        name = r?.player_name?.trim() || name;
        signedIn = true;
      } catch {
        signedIn = false;
      }
      return signedIn;
    },

    playerName() {
      return name;
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
      // Whole and non-negative, and capped at a 32-bit int: the Android plugin reads the score
      // with getInt(), which returns null for anything larger, and that null crashes the app
      // (NPE in CapacitorGameConnect.submitScore). Huge totals live on the in-game board instead.
      const totalScoreAmount = Math.max(0, Math.min(Math.round(value), PLAY_GAMES_MAX_SCORE));
      try {
        await CapacitorGameConnect.submitScore({ leaderboardID, totalScoreAmount });
      } catch {
        /* offline or unknown leaderboard */
      }
    },

    async showLeaderboard(leaderboardID) {
      if (!signedIn || isPlaceholder(leaderboardID)) return false;
      try {
        await CapacitorGameConnect.showLeaderboard({ leaderboardID });
        return true;
      } catch {
        return false;
      }
    },

    available() {
      return true;
    },
  };
})();

export function pickGameServices(): GameServices {
  // The plugin is Play Games on Android and Game Center on iOS; ids come from gameIds.ts.
  return Capacitor.isNativePlatform() ? playGamesServices : noopGameServices;
}
