import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dayKey } from '../engine/dailies';

export interface NotificationItem { id: number; atWall: number; title: string; body: string }
export interface Notifications {
  requestPermission(): Promise<boolean>;
  schedule(items: NotificationItem[]): Promise<void>;
  cancelAll(): Promise<void>;
}
export const NOTIF_DAILY = 2;
export const NOTIF_EVENT = 3;
export const NOTIF_AWAY3 = 4;
export const NOTIF_AWAY7 = 5;

/** Local hours reminders may fire in; anything outside moves to the nearest edge of the same day. */
export const REMINDER_FROM_HOUR = 9;
export const REMINDER_UNTIL_HOUR = 21;

function inWakingHours(atWall: number): number {
  const d = new Date(atWall);
  if (d.getHours() < REMINDER_FROM_HOUR) d.setHours(REMINDER_FROM_HOUR, 0, 0, 0);
  else if (d.getHours() >= REMINDER_UNTIL_HOUR) d.setHours(REMINDER_UNTIL_HOUR - 1, 0, 0, 0);
  return d.getTime();
}

/**
 * At most one reminder a local day, and none today: the player is here today, and any reminder
 * that fires tomorrow is replaced on their next visit. `items` are in priority order.
 */
export function planReminders(items: NotificationItem[], wall: number): NotificationItem[] {
  const used = new Set([dayKey(wall)]);
  const kept: NotificationItem[] = [];
  for (const item of items) {
    const atWall = inWakingHours(item.atWall);
    const day = dayKey(atWall);
    if (used.has(day)) continue;
    used.add(day);
    kept.push({ ...item, atWall });
  }
  return kept;
}

export const noopNotifications: Notifications = {
  async requestPermission() { return false; },
  async schedule() {},
  async cancelAll() {},
};
export const capacitorNotifications: Notifications = {
  async requestPermission() {
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  },
  async schedule(items) {
    await LocalNotifications.schedule({ notifications: items.map((i) => ({ id: i.id, title: i.title, body: i.body, schedule: { at: new Date(i.atWall) } })) });
  },
  async cancelAll() {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  },
};
export function pickNotifications(): Notifications {
  return Capacitor.isNativePlatform() ? capacitorNotifications : noopNotifications;
}
