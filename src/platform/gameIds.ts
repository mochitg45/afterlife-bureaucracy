/**
 * Play Games Services ids.
 *
 * The Play Games project does not exist yet, so everything here is a placeholder. Console
 * ids look like `CgkI…`; once the project is created, fill them in here (and in
 * `docs/store/ids.md`) — nothing else needs to change, because `playAchievementId` and
 * `LEADERBOARD_LIFETIME_SOULS` return `null` for unmapped ids and every call site skips
 * unmapped ids rather than sending a placeholder to the SDK.
 */

/** Sentinel written in place of a console id that has not been created yet. */
export const TODO_ID = 'TODO';

/** Local achievement id (`src/data/achievements.json`) → Play Games achievement id. */
export const PLAY_ACHIEVEMENT_IDS: Record<string, string> = {
  // TODO: fill in once the Play Games project exists. Example:
  // 'a-souls-1': 'CgkIxxxxxxxxxxxxEAIQAQ',
};

/** Play Games leaderboard for lifetime souls filed. */
export const LEADERBOARD_LIFETIME_SOULS: string = TODO_ID;

function resolved(id: string | undefined): string | null {
  return id && id !== TODO_ID ? id : null;
}

/** Play Games id for a local achievement, or `null` while the console id is unmapped. */
export function playAchievementId(localId: string): string | null {
  return resolved(PLAY_ACHIEVEMENT_IDS[localId]);
}

/** Play Games ids for local achievements, dropping the ones with no console id yet. */
export function playAchievementIds(localIds: readonly string[]): string[] {
  return localIds.flatMap((id) => {
    const mapped = playAchievementId(id);
    return mapped ? [mapped] : [];
  });
}

/** The lifetime-souls leaderboard id, or `null` while it is unmapped. */
export function lifetimeSoulsLeaderboardId(): string | null {
  return resolved(LEADERBOARD_LIFETIME_SOULS);
}
