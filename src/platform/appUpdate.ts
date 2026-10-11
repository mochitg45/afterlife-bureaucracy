import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability, type AppUpdateInfo } from '@capawesome/capacitor-app-update';

/**
 * Forced updates (Android, Play installs only): when Play has a newer version, the game
 * blocks until the player updates. Play's own immediate-update screen is tried first; if the
 * player backs out of it, the ForceUpdate overlay keeps them from playing the old version.
 */
export function updateRequired(info: Pick<AppUpdateInfo, 'updateAvailability'>): boolean {
  return info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
    || info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS;
}

const android = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** True when a newer version is on Play. Never throws: no Play, no network = not required. */
export async function checkUpdate(): Promise<boolean> {
  if (!android()) return false;
  try {
    return updateRequired(await AppUpdate.getAppUpdateInfo());
  } catch {
    return false;
  }
}

/** Play's full-screen updater, or the store page when Play won't run it in-app. */
export async function startUpdate(): Promise<void> {
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate();
      return;
    }
  } catch {
    /* fall through to the store page */
  }
  try {
    await AppUpdate.openAppStore();
  } catch {
    /* nothing else to try */
  }
}
