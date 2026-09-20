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
  // 20 of the 80 local achievements are mirrored to Play Games (docs/store/ids.md).
  'a-souls-1': 'CgkIi5ONn5EeEAIQGw',
  'a-souls-2': 'CgkIi5ONn5EeEAIQIA',
  'a-souls-4': 'CgkIi5ONn5EeEAIQGA',
  'a-souls-6': 'CgkIi5ONn5EeEAIQFw',
  'a-souls-8': 'CgkIi5ONn5EeEAIQHQ',
  'a-clicks-2': 'CgkIi5ONn5EeEAIQJQ',
  'a-staff-2': 'CgkIi5ONn5EeEAIQIg',
  'a-staff-4': 'CgkIi5ONn5EeEAIQIw',
  'a-depts-2': 'CgkIi5ONn5EeEAIQGQ',
  'a-depts-4': 'CgkIi5ONn5EeEAIQJg',
  'a-audits-1': 'CgkIi5ONn5EeEAIQIQ',
  'a-audits-3': 'CgkIi5ONn5EeEAIQGg',
  'a-seals-2': 'CgkIi5ONn5EeEAIQJw',
  'a-cards-2': 'CgkIi5ONn5EeEAIQHw',
  'a-cards-5': 'CgkIi5ONn5EeEAIQKQ',
  'a-execs-1': 'CgkIi5ONn5EeEAIQHg',
  'a-fivestar-1': 'CgkIi5ONn5EeEAIQJA',
  'a-dailies-2': 'CgkIi5ONn5EeEAIQKg',
  'a-streak-2': 'CgkIi5ONn5EeEAIQKA',
  'a-streak-3': 'CgkIi5ONn5EeEAIQHA',
};

/** Play Games leaderboard for lifetime souls filed. */
export const LEADERBOARD_LIFETIME_SOULS: string = 'CgkIi5ONn5EeEAIQAQ';

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
