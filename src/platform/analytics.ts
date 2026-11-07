import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

/**
 * Google Analytics through Firebase (project afterlife-bureaucracy). Native Android only: a
 * browser build logs nothing, so development play never pollutes the data, and the iOS build
 * drops the Firebase pod (see codemagic.yaml).
 *
 * Event names follow GA4's recommended game events where one exists (level_up,
 * spend_virtual_currency, tutorial_complete, unlock_achievement) so the stock reports
 * understand them; the rest are this game's own. Never awaited and never throws: analytics
 * must not be able to stall or break a stamp.
 */
type Params = Record<string, string | number>;

export function track(name: string, params: Params = {}): void {
  if (Capacitor.getPlatform() !== 'android') return;
  FirebaseAnalytics.logEvent({ name, params }).catch(() => {});
}

/** GA's own session rule: coming back after this long away is a new session. */
const SESSION_GAP_MS = 1_800_000;
let awayAt = 0;

export function noteAway(): void { awayAt = Date.now(); }

/** Sends this install's running session count, so drop-off can be read by session. */
export function trackSession(): void {
  if (Capacitor.getPlatform() !== 'android' || (awayAt && Date.now() - awayAt < SESSION_GAP_MS)) return;
  let session = 1;
  try {
    session = Number(localStorage.getItem('sessionCount') ?? 0) + 1;
    localStorage.setItem('sessionCount', String(session));
  } catch { /* storage blocked: still report the session */ }
  track('session_number', { session });
}
