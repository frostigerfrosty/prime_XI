import { getGameRules } from '../data/index.ts';
import { isRecord } from '../engine/strength.ts';

export const snapshotStorageKey = 'prime-xi:restored-state:v1';
export const gameStorageKeys = Object.values(getGameRules().storage.keys);
export type SnapshotRecords = Record<string, string | null>;
type PhysicalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function readSnapshot(storage: PhysicalStorage): SnapshotRecords | null {
  const raw = storage.getItem(snapshotStorageKey);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value['schemaVersion'] !== 1 || !isRecord(value['records']))
    throw new Error('Unbekanntes Spielstandformat.');
  const records = value['records'];
  if (
    Object.keys(records).length !== gameStorageKeys.length ||
    !gameStorageKeys.every(
      (key) =>
        Object.hasOwn(records, key) && (records[key] === null || typeof records[key] === 'string'),
    )
  )
    throw new Error('Unvollständiger Spielstand.');
  return records as SnapshotRecords;
}

/** Older installations retain their keys until an explicit restore creates a snapshot. */
export function createGameStorage(storage: PhysicalStorage): PhysicalStorage {
  function change(key: string, value: string | null) {
    if (!gameStorageKeys.includes(key)) throw new Error('Unbekannter Spielstandschlüssel.');
    const records = readSnapshot(storage);
    if (records) {
      storage.setItem(
        snapshotStorageKey,
        JSON.stringify({ schemaVersion: 1, records: { ...records, [key]: value } }),
      );
    } else if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
  return {
    getItem(key) {
      if (!gameStorageKeys.includes(key)) throw new Error('Unbekannter Spielstandschlüssel.');
      const records = readSnapshot(storage);
      return records ? records[key]! : storage.getItem(key);
    },
    setItem: (key, value) => change(key, value),
    removeItem: (key) => change(key, null),
  };
}

export const getGameStorage = () => createGameStorage(window.localStorage);

/** Web Storage replaces one value atomically: quota/permission errors preserve the old state. */
export function installSnapshot(storage: PhysicalStorage, records: SnapshotRecords): void {
  if (
    Object.keys(records).length !== gameStorageKeys.length ||
    !gameStorageKeys.every(
      (key) =>
        Object.hasOwn(records, key) && (records[key] === null || typeof records[key] === 'string'),
    )
  )
    throw new Error('Unvollständiger Spielstand.');
  storage.setItem(snapshotStorageKey, JSON.stringify({ schemaVersion: 1, records }));
  // Only after committing the complete replacement may obsolete application keys be removed.
  for (const key of gameStorageKeys) {
    try {
      storage.removeItem(key);
    } catch {
      /* The committed snapshot already owns these values. */
    }
  }
}
