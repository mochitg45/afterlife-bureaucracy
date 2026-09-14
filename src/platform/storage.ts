import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const SAVE_KEY = 'afterlife.save.v1';

export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const localStorageStorage: Storage = {
  async get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  async set(key, value) { try { localStorage.setItem(key, value); } catch { /* quota or private mode */ } },
};

export const capacitorStorage: Storage = {
  async get(key) { return (await Preferences.get({ key })).value; },
  async set(key, value) { await Preferences.set({ key, value }); },
};

export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.get(key) ?? null; },
    async set(key, value) { map.set(key, value); },
  };
}

export function pickStorage(): Storage {
  return Capacitor.isNativePlatform() ? capacitorStorage : localStorageStorage;
}
