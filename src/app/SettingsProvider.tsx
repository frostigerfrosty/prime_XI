import { useLanguage } from '../i18n/react.ts';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { getDefaultSettings } from '../data/index.ts';
import { readSettings, saveSettings } from '../utils/settings.ts';
import { getGameStorage } from '../utils/game-storage.ts';
import { setLanguage, type Language } from '../i18n/locale.ts';
import type { UserSettings } from '../types/application.ts';
interface SettingsContextValue {
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  storageAvailable: boolean;
  locale: Language;
  setLocale: (value: Language) => void;
  languageError: string | null;
}
const SettingsContext = createContext<SettingsContextValue | null>(null);
export function SettingsProvider({ children }: { children: ReactNode }) {
  useLanguage();
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      return readSettings(getGameStorage());
    } catch {
      return getDefaultSettings();
    }
  });
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [languageError, setLanguageError] = useState<string | null>(null);
  useLayoutEffect(() => {
    let active = true;
    void setLanguage(settings.locale).catch(() => {
      if (active)
        setLanguageError('Die Sprache konnte nicht geladen werden. Bitte lade die Seite erneut.');
    });
    return () => {
      active = false;
    };
  }, [settings.locale]);
  useEffect(() => {
    document.documentElement.dataset['reduceMotion'] = String(settings.reduceMotion);
  }, [settings.reduceMotion]);
  function setReduceMotion(reduceMotion: boolean) {
    const next = { ...settings, reduceMotion };
    setSettings(next);
    try {
      setStorageAvailable(saveSettings(getGameStorage(), next));
    } catch {
      setStorageAvailable(false);
    }
  }
  function setLocale(locale: Language) {
    const next = { ...settings, locale };
    setSettings(next);
    setLanguageError(null);
    try {
      setStorageAvailable(saveSettings(getGameStorage(), next));
    } catch {
      setStorageAvailable(false);
    }
  }
  return (
    <SettingsContext
      value={{
        reduceMotion: settings.reduceMotion,
        setReduceMotion,
        storageAvailable,
        locale: settings.locale,
        setLocale,
        languageError,
      }}
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
