import { getDefaultSettings, getGameRules } from '../data/index.ts';
import type { UserSettings } from '../types/application.ts';

export const settingsKey = getGameRules().storage.keys.userSettings;
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readSettings(storage: SettingsStorage): UserSettings {
  const defaults = getDefaultSettings();
  try {
    const value: unknown = JSON.parse(storage.getItem(settingsKey) ?? 'null');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaults;
    const candidate = value as Record<string, unknown>;
    // Only the implemented preference is restored in Etappe 1.
    return {
      ...defaults,
      reduceMotion:
        typeof candidate['reduceMotion'] === 'boolean'
          ? candidate['reduceMotion']
          : defaults.reduceMotion,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(storage: SettingsStorage, settings: UserSettings): boolean {
  try {
    storage.setItem(settingsKey, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
