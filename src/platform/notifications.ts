import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationItem { id: number; atWall: number; title: string; body: string }
export interface Notifications {
  requestPermission(): Promise<boolean>;
  schedule(items: NotificationItem[]): Promise<void>;
  cancelAll(): Promise<void>;
}
export const NOTIF_INTRAY = 1;
export const NOTIF_DAILY = 2;

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
