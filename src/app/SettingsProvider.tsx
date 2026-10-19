import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDefaultSettings } from '../data/index.ts';
import { readSettings, saveSettings } from '../utils/settings.ts';

interface SettingsContextValue {
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  storageAvailable: boolean;
}
const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => {
    try {
      return readSettings(window.localStorage);
    } catch {
      return getDefaultSettings();
    }
  });
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    document.documentElement.dataset['reduceMotion'] = String(settings.reduceMotion);
  }, [settings.reduceMotion]);
  function setReduceMotion(reduceMotion: boolean) {
    const next = { ...settings, reduceMotion };
    setSettings(next);
    try {
      setStorageAvailable(saveSettings(window.localStorage, next));
    } catch {
      setStorageAvailable(false);
    }
  }
  return (
    <SettingsContext
      value={{ reduceMotion: settings.reduceMotion, setReduceMotion, storageAvailable }}
    >
      {children}
    </SettingsContext>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('SettingsProvider is missing');
  return value;
}
