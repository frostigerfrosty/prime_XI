import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tournamentFixture } from './helpers/tournament.ts';
import { createHistoryEntry } from '../src/engine/history.ts';
import {
  backupRecords,
  maximumBackupBytes,
  parseBackup,
  serializeBackup,
} from '../src/engine/backup.ts';
import { createInitialAppState } from '../src/data/initial-state.ts';
import { getDefaultSettings } from '../src/data/index.ts';
import {
  createGameStorage,
  gameStorageKeys,
  installSnapshot,
  snapshotStorageKey,
} from '../src/utils/game-storage.ts';
import { readDraft } from '../src/utils/draft-storage.ts';
import { readSavedTeam } from '../src/utils/team-storage.ts';
import { readTournament } from '../src/utils/tournament-storage.ts';
import { readHistory } from '../src/utils/history-storage.ts';
import { readSettings } from '../src/utils/settings.ts';

const f = tournamentFixture();
const services = { builder: f.builder, model: f.model, tournament: f.engine };
const finished = f.engine.finishTournament(
  f.engine.finishLeague(f.engine.start(f.team, 'backup-history', f.now)),
  f.now,
);
const fullState = () => ({
  ...createInitialAppState(),
  currentDraft: structuredClone(f.draft),
  currentTeam: structuredClone(f.team),
  currentTournament: f.engine.nextMatchday(f.engine.start(f.team, 'backup-running', f.now)),
  completedTournaments: [createHistoryEntry(finished, f.engine)],
  userSettings: { ...getDefaultSettings(), reduceMotion: true },
});
function memory() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => {
      values.set(key, raw);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  return { values, storage };
}

test('complete and empty backups round-trip every loaded component with independent snapshots', () => {
  for (const state of [createInitialAppState(), fullState()]) {
    const raw = serializeBackup(state, services, f.now);
    const backup = parseBackup(raw, services);
    assert.equal(backup.format, 'prime-xi-backup');
    assert.equal(backup.version, 1);
    assert.equal(backup.exportedAt, f.now);
    assert.deepEqual(backup.state, state);
    backup.state.userSettings.reduceMotion = !state.userSettings.reduceMotion;
    assert.notDeepEqual(backup.state.userSettings, state.userSettings);
  }
});

test('known Phase-6 league saves and frozen team/history snapshots survive without being rewritten', () => {
  const state = fullState();
  state.currentTournament.rulesVersion = '1.3.0';
  delete state.currentTournament.knockoutVersion;
  const backup = parseBackup(serializeBackup(state, services, f.now), services);
  assert.deepEqual(backup.state, state);
  assert.equal(backup.state.currentTournament!.rulesVersion, '1.3.0');
});

test('malformed, foreign, future, oversized and incomplete backup files are rejected', () => {
  for (const raw of [
    '{broken',
    'null',
    '[]',
    '{}',
    JSON.stringify({ format: 'other', version: 1 }),
    JSON.stringify({ format: 'prime-xi-backup', version: 2, state: createInitialAppState() }),
    ' '.repeat(maximumBackupBytes + 1),
  ])
    assert.throws(() => parseBackup(raw, services));
  const value = JSON.parse(serializeBackup(createInitialAppState(), services, f.now));
  delete value.state.currentTeam;
  assert.throws(() => parseBackup(JSON.stringify(value), services));
  value.state.currentTeam = null;
  value.exportedAt = 'invalid';
  assert.throws(() => parseBackup(JSON.stringify(value), services));
});

test('imports reject altered cards, results, archive statistics, duplicate histories and incompatible drafts/settings', () => {
  const mutations = [
    (state: ReturnType<typeof fullState>) => {
      state.currentTeam.lineup[0]!.player.rating = 0;
    },
    (state: ReturnType<typeof fullState>) => {
      const match = state.currentTournament.matches[0]!;
      if (match.status === 'played') match.result.regularTime.home++;
    },
    (state: ReturnType<typeof fullState>) => {
      state.completedTournaments[0]!.statistics.played++;
    },
    (state: ReturnType<typeof fullState>) => {
      state.completedTournaments.push(state.completedTournaments[0]!);
    },
    (state: ReturnType<typeof fullState>) => {
      state.currentDraft.picks[0]!.playerCardId = 'unknown';
    },
    (state: ReturnType<typeof fullState>) => {
      state.datasetVersion = 'other-catalog';
    },
    (state: ReturnType<typeof fullState>) => {
      state.userSettings.historyLimit = 999;
    },
  ];
  for (const mutate of mutations) {
    const state = fullState();
    mutate(state);
    assert.throws(() => serializeBackup(state, services, f.now));
  }
});

test('a confirmed snapshot is readable by every existing adapter and removes only obsolete application keys', () => {
  const { storage, values } = memory();
  const state = fullState();
  for (const key of gameStorageKeys) storage.setItem(key, 'old data');
  storage.setItem('unrelated', 'keep');
  installSnapshot(storage, backupRecords(state));
  const game = createGameStorage(storage);
  assert.deepEqual(readDraft(game, f.builder).draft, state.currentDraft);
  assert.deepEqual(readSavedTeam(game, f.model).team, state.currentTeam);
  assert.deepEqual(readTournament(game, f.engine).tournament, state.currentTournament);
  assert.deepEqual(readHistory(game, f.model).entries, state.completedTournaments);
  assert.deepEqual(readSettings(game), state.userSettings);
  assert.equal(storage.getItem('unrelated'), 'keep');
  assert.ok(values.has(snapshotStorageKey));
  assert.ok(gameStorageKeys.every((key) => !values.has(key)));
});

test('legacy saves keep using their own keys until restoration and snapshot updates preserve all other components', () => {
  const { storage, values } = memory();
  const key = gameStorageKeys[0]!;
  const game = createGameStorage(storage);
  game.setItem(key, 'legacy');
  assert.equal(storage.getItem(key), 'legacy');
  assert.equal(storage.getItem(snapshotStorageKey), null);
  assert.equal(game.getItem(key), 'legacy');
  const records = backupRecords(fullState());
  installSnapshot(storage, records);
  game.setItem(key, 'changed');
  for (const other of gameStorageKeys.filter((candidate) => candidate !== key))
    assert.equal(game.getItem(other), records[other]);
  assert.equal(game.getItem(key), 'changed');
  game.removeItem(key);
  assert.equal(game.getItem(key), null);
  assert.equal(values.has(key), false);
  assert.throws(() => game.setItem('unrelated', 'changed'));
});

test('quota failures preserve the entire prior legacy or restored state without partial writes or deletions', () => {
  for (const restored of [false, true]) {
    const { storage, values } = memory();
    const previous = backupRecords(fullState());
    if (restored) installSnapshot(storage, previous);
    else
      for (const [key, raw] of Object.entries(previous))
        if (raw !== null) storage.setItem(key, raw);
    storage.setItem('unrelated', 'keep');
    const before = new Map(values);
    const blocked = {
      ...storage,
      setItem: () => {
        throw new Error('Quota');
      },
    };
    assert.throws(() => installSnapshot(blocked, backupRecords(createInitialAppState())));
    assert.deepEqual(values, before);
  }
});

test('an empty confirmed backup clears all game components without allowing stale legacy data to return', () => {
  const { storage } = memory();
  installSnapshot(storage, backupRecords(fullState()));
  installSnapshot(storage, backupRecords(createInitialAppState()));
  // Leftover legacy records, including failed cleanup, never override the committed snapshot.
  storage.setItem(
    f.data.rules.storage.keys.currentTeam,
    JSON.stringify({ schemaVersion: 1, team: f.team }),
  );
  const game = createGameStorage(storage);
  assert.equal(readSavedTeam(game, f.model).team, null);
  assert.equal(readDraft(game, f.builder).draft, null);
  assert.equal(readTournament(game, f.engine).tournament, null);
  assert.deepEqual(readHistory(game, f.model).entries, []);
  assert.deepEqual(readSettings(game), getDefaultSettings());
});

test('cleanup failure does not undo a committed restore and unknown snapshot formats remain protected', () => {
  const { storage } = memory();
  const records = backupRecords(fullState());
  installSnapshot(
    {
      ...storage,
      removeItem: () => {
        throw new Error('Denied');
      },
    },
    records,
  );
  assert.equal(
    createGameStorage(storage).getItem(gameStorageKeys[0]!),
    records[gameStorageKeys[0]!],
  );
  for (const raw of [
    '{',
    JSON.stringify({ schemaVersion: 99, records }),
    JSON.stringify({ schemaVersion: 1, records: {} }),
  ]) {
    storage.setItem(snapshotStorageKey, raw);
    assert.throws(() => createGameStorage(storage).getItem(gameStorageKeys[0]!));
    assert.throws(() => createGameStorage(storage).setItem(gameStorageKeys[0]!, 'replacement'));
    assert.equal(storage.getItem(snapshotStorageKey), raw);
  }
  assert.throws(() => installSnapshot(storage, {}));
});
