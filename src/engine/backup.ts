import type { AppState } from '../types/application.ts';
import type { Builder } from './builder.ts';
import type { StrengthModel } from './strength.ts';
import type { TournamentEngine } from './tournament.ts';
import { isRecord, isText } from './strength.ts';
import { isSavedTeam } from './saved-team.ts';
import { historyLimit, isHistoryEntry } from './history.ts';
import { equalValues } from './comparison.ts';
import { getDefaultSettings, getGameRules } from '../data/index.ts';
import { isCompatibleDraftDataset } from '../data/compatibility.ts';
import type { SnapshotRecords } from '../utils/game-storage.ts';

export interface BackupServices {
  builder: Builder;
  model: StrengthModel;
  tournament: TournamentEngine;
}
export interface GameBackup {
  format: 'prime-xi-backup';
  version: 1;
  exportedAt: string;
  state: AppState;
}
export const maximumBackupBytes = 8 * 1024 * 1024;
const keys = getGameRules().storage.keys;

function isAppState(value: unknown, services: BackupServices): value is AppState {
  if (!isRecord(value) || value['schemaVersion'] !== 1 || !isText(value['datasetVersion']))
    return false;
  const { builder, model, tournament } = services;
  const draft = value['currentDraft'];
  if (
    draft !== null &&
    (!isCompatibleDraftDataset(value['datasetVersion']) ||
      !builder.isValid(draft) ||
      !builder.completion(draft))
  )
    return false;
  if (value['currentTeam'] !== null && !isSavedTeam(value['currentTeam'], model)) return false;
  if (value['currentTournament'] !== null && !tournament.isValid(value['currentTournament']))
    return false;
  const history = value['completedTournaments'];
  if (
    !Array.isArray(history) ||
    history.length > historyLimit ||
    !history.every((entry) => isHistoryEntry(entry, model)) ||
    new Set(history.map((entry) => entry.tournamentId)).size !== history.length
  )
    return false;
  const settings = value['userSettings'];
  if (!isRecord(settings)) return false;
  const defaults = getDefaultSettings();
  return Object.entries(defaults).every(([key, expected]) =>
    key === 'reduceMotion'
      ? typeof settings[key] === 'boolean'
      : equalValues(settings[key], expected),
  );
}

export function backupRecords(state: AppState): SnapshotRecords {
  const records = {
    [keys.currentDraft]:
      state.currentDraft === null
        ? null
        : JSON.stringify({
            schemaVersion: 1,
            datasetVersion: state.datasetVersion,
            draft: state.currentDraft,
          }),
    [keys.currentTeam]:
      state.currentTeam === null
        ? null
        : JSON.stringify({ schemaVersion: 1, team: state.currentTeam }),
    [keys.currentTournament]:
      state.currentTournament === null
        ? null
        : JSON.stringify({ schemaVersion: 1, tournament: state.currentTournament }),
    [keys.completedTournaments]: JSON.stringify({
      schemaVersion: 1,
      entries: state.completedTournaments,
    }),
    [keys.userSettings]: JSON.stringify(state.userSettings),
  };
  if (
    [records[keys.currentTournament], records[keys.completedTournaments]].some(
      (raw) => typeof raw === 'string' && raw.length > 4_000_000,
    )
  )
    throw new Error('Die Sicherung enthält einen zu großen Turnier- oder Archivstand.');
  return records;
}

export function parseBackup(raw: string, services: BackupServices): GameBackup {
  if (new TextEncoder().encode(raw).length > maximumBackupBytes)
    throw new Error('Die Sicherung darf höchstens 8 MB groß sein.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Die Datei enthält keine lesbare JSON-Sicherung.');
  }
  if (!isRecord(value) || value['format'] !== 'prime-xi-backup' || value['version'] !== 1)
    throw new Error('Die Datei ist keine unterstützte PRIME-XI-Sicherung.');
  if (
    !isText(value['exportedAt']) ||
    !Number.isFinite(Date.parse(value['exportedAt'])) ||
    !isAppState(value['state'], services)
  )
    throw new Error(
      'Die Sicherung ist beschädigt oder passt nicht zum aktuellen Katalog und den Spielregeln. Dein Spielstand bleibt unverändert.',
    );
  backupRecords(value['state']);
  return structuredClone(value as unknown as GameBackup);
}

export function serializeBackup(
  state: AppState,
  services: BackupServices,
  now = new Date().toISOString(),
): string {
  const raw = JSON.stringify(
    { format: 'prime-xi-backup', version: 1, exportedAt: now, state },
    null,
    2,
  );
  parseBackup(raw, services);
  return raw;
}
