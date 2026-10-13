import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** Fire-and-forget: web, tests and a missing motor are silence, never an error. */
function impact(style: ImpactStyle) {
  try {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => {});
  } catch { /* no haptics here */ }
}

export const tap = () => impact(ImpactStyle.Light);
export const heavy = () => impact(ImpactStyle.Heavy);
