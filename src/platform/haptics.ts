import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

let enabled = true;
/** The player's Vibration setting; the store applies it at boot and whenever it changes. */
export const setHapticsEnabled = (on: boolean) => { enabled = on; };

/** Fire-and-forget: web, tests and a missing motor are silence, never an error. */
function impact(style: ImpactStyle) {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => {});
  } catch { /* no haptics here */ }
}

export const tap = () => impact(ImpactStyle.Light);
export const heavy = () => impact(ImpactStyle.Heavy);
