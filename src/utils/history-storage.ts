import { jsonLimits, parseUntrustedJson } from './untrusted-json.ts';
import { getGameRules } from '../data/index.ts';
import { historyLimit, isHistoryEntry } from '../engine/history.ts';
import type { StrengthModel } from '../engine/strength.ts';
import { isRecord } from '../engine/strength.ts';
import type { HistoryEntry } from '../types/application.ts';

export const historyStorageKey = getGameRules().storage.keys.completedTournaments;
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;
const maximumSize = 4_000_000;
export const historyStorageWarning =
  'Dein Turnierarchiv konnte nicht dauerhaft gespeichert werden. Die Einträge bleiben für diese Sitzung sichtbar. Vor einem neuen Turnier wird das Speichern erneut versucht.';
export const historyInvalidWarning =
  'Dein Turnierarchiv ist beschädigt oder verwendet ein unbekanntes Speicherformat. Die vorhandenen Daten werden nicht automatisch überschrieben. Dein aktuelles Turnier und deine Elf bleiben erhalten.';
export const historyReadWarning =
  'Dein Turnierarchiv konnte nicht gelesen werden. Prüfe die Browsereinstellungen und lade die Anwendung danach erneut. Vorhandene Archivdaten bleiben unberührt.';

export function readHistory(storage: HistoryStorage, model: StrengthModel) {
  let raw: string | null;
  try {
    raw = storage.getItem(historyStorageKey);
  } catch {
    return {
      entries: [] as HistoryEntry[],
      warning: historyReadWarning,
      writable: false,
      protectedArchive: false,
    };
  }
  try {
    if (raw === null)
      return {
        entries: [] as HistoryEntry[],
        warning: null,
        writable: true,
        protectedArchive: false,
      };
    if (raw.length > maximumSize) throw new Error('Archive too large');
    const envelope: unknown = parseUntrustedJson(raw, jsonLimits.tournament);
    if (
      !isRecord(envelope) ||
      envelope['schemaVersion'] !== 1 ||
      !Array.isArray(envelope['entries']) ||
      envelope['entries'].length > historyLimit ||
      !envelope['entries'].every((entry) => isHistoryEntry(entry, model)) ||
      new Set(envelope['entries'].map((entry: HistoryEntry) => entry.tournamentId)).size !==
        envelope['entries'].length
    )
      throw new Error('Invalid archive');
    return {
      entries: envelope['entries'] as HistoryEntry[],
      warning: null,
      writable: true,
      protectedArchive: false,
    };
  } catch {
    return {
      entries: [] as HistoryEntry[],
      warning: historyInvalidWarning,
      writable: false,
      protectedArchive: true,
    };
  }
}

export function writeHistory(
  storage: HistoryStorage,
  entries: HistoryEntry[],
  model: StrengthModel,
): boolean {
  try {
    if (
      entries.length > historyLimit ||
      !entries.every((entry) => isHistoryEntry(entry, model)) ||
      new Set(entries.map((entry) => entry.tournamentId)).size !== entries.length
    )
      return false;
    const raw = JSON.stringify({ schemaVersion: 1, entries });
    if (raw.length > maximumSize) return false;
    storage.setItem(historyStorageKey, raw);
    return true;
  } catch {
    return false;
  }
}
