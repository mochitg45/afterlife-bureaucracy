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
