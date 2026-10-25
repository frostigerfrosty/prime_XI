import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tournamentFixture, championTestTeam } from './helpers/tournament.ts';
import {
  appendHistory,
  createHistoryEntry,
  historyLimit,
  historyStatistics,
  isHistoryEntry,
} from '../src/engine/history.ts';
import { historyStorageKey, readHistory, writeHistory } from '../src/utils/history-storage.ts';

const f = tournamentFixture();
const complete = (seed: string, team = f.team) =>
  f.engine.finishTournament(f.engine.finishLeague(f.engine.start(team, seed, f.now)), f.now);
const state = complete('knockout-0');
const entry = createHistoryEntry(state, f.engine);
const winner = createHistoryEntry(complete('user-champion-1', championTestTeam(f)), f.engine);

test('completed tournaments produce independent, compact snapshots of the real XI and own matches', () => {
  assert.equal(isHistoryEntry(entry, f.model), true);
  assert.equal(entry.userTeam.name, f.team.name);
  assert.equal(entry.leaguePosition, state.standings.find((r) => r.participantId === 'user')!.rank);
  assert.equal(
    entry.matches.length,
    state.matches.filter((m) => m.homeParticipantId === 'user' || m.awayParticipantId === 'user')
      .length,
  );
  assert.ok(JSON.stringify(entry).length < JSON.stringify(state).length / 5);
  const changed = structuredClone(state);
  const saved = createHistoryEntry(changed, f.engine);
  changed.participants.find((p) => p.kind === 'user')!.team.name = 'Changed later';
  changed.matches[0]!.id = 'changed';
  assert.deepEqual(saved, entry);
  assert.throws(() => createHistoryEntry(f.engine.start(f.team, 'running', f.now), f.engine));
  const corrupt = structuredClone(state);
  corrupt.championParticipantId = 'unknown';
  assert.throws(() => createHistoryEntry(corrupt, f.engine));
});

test('archive reports winner, finalist and elimination rounds without invented overall placements', () => {
  assert.equal(winner.outcome, 'champion');
  assert.equal(winner.champion.participantId, 'user');
  for (const seed of ['knockout-0', 'knockout-1', 'knockout-2', 'knockout-3', 'knockout-4']) {
    const result = complete(seed);
    const archived = createHistoryEntry(result, f.engine);
    assert.equal(isHistoryEntry(archived, f.model), true, seed);
    const lost = result.knockoutTies.find(
      (tie) =>
        (tie.teamAId === 'user' || tie.teamBId === 'user') && tie.winnerParticipantId !== 'user',
    );
    assert.equal(
      archived.outcome,
      result.championParticipantId === 'user' ? 'champion' : (lost?.round ?? 'league'),
    );
  }
});

test('statistics sum actual home and away goals after extra time and exclude shootout goals', () => {
  const matches = winner.matches;
  const expected = {
    played: matches.length,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
  for (const { fixture } of matches) {
    const score = fixture.result.afterExtraTime ?? fixture.result.regularTime;
    const goals =
      fixture.homeParticipantId === 'user' ? [score.home, score.away] : [score.away, score.home];
    expected.goalsFor += goals[0]!;
    expected.goalsAgainst += goals[1]!;
    if (goals[0]! > goals[1]!) expected.wins++;
    else if (goals[0]! < goals[1]!) expected.losses++;
    else expected.draws++;
  }
  assert.deepEqual(winner.statistics, expected);
  const shootout = structuredClone(matches[0]!);
  shootout.fixture.result.regularTime = { home: 1, away: 1 };
  shootout.fixture.result.afterExtraTime = { home: 2, away: 2 };
  shootout.fixture.result.penalties = { home: 5, away: 4 };
  assert.deepEqual(historyStatistics([shootout]), {
    played: 1,
    wins: 0,
    draws: 1,
    losses: 0,
    goalsFor: 2,
    goalsAgainst: 2,
  });
});

test('archive rejects manipulated results, statistics, snapshots, versions, and unfinished knockout paths', () => {
  const corruptions = [
    (v: typeof entry) => {
      v.statistics.goalsFor++;
    },
    (v: typeof entry) => {
      v.matches[0]!.fixture.result.regularTime.home++;
    },
    (v: typeof entry) => {
      v.userTeam.lineup[0]!.player.rating = 0;
    },
    (v: typeof entry) => {
      v.rulesVersion = '999';
    },
    (v: typeof entry) => {
      v.finishedAt = 'invalid';
    },
    (v: typeof entry) => {
      v.leaguePoints++;
    },
    (v: typeof entry) => {
      v.champion.participantId = 'user';
    },
    (v: typeof entry) => {
      v.matches[1] = v.matches[0]!;
    },
    (v: typeof entry) => {
      v.outcome = 'champion';
    },
  ];
  for (const corrupt of corruptions) {
    const value = structuredClone(entry);
    corrupt(value);
    assert.equal(isHistoryEntry(value, f.model), false);
  }
  assert.equal(isHistoryEntry(null, f.model), false);
  assert.equal(isHistoryEntry({}, f.model), false);
  const incomplete = structuredClone(winner);
  incomplete.matches.pop();
  incomplete.outcome = 'semi-finals';
  incomplete.champion.participantId = 'other';
  incomplete.statistics = historyStatistics(incomplete.matches);
  assert.equal(isHistoryEntry(incomplete, f.model), false);
});

test('archiving is idempotent, preserves frozen entries, orders newest first and retains the latest 50', () => {
  const original = structuredClone(entry);
  const entries = appendHistory([], entry);
  assert.deepEqual(appendHistory(entries, { ...entry, seed: 'changed' }), entries);
  let archive: typeof entries = [];
  for (let i = 0; i <= historyLimit; i++) {
    const tournamentId = `tournament-${i}`;
    archive = appendHistory(archive, {
      ...entry,
      tournamentId,
      id: `history-${tournamentId}`,
      finishedAt: new Date(Date.parse(f.now) + i * 1000).toISOString(),
    });
  }
  assert.equal(archive.length, historyLimit);
  assert.equal(archive[0]!.tournamentId, `tournament-${historyLimit}`);
  assert.equal(archive.at(-1)!.tournamentId, 'tournament-1');
  assert.deepEqual(entry, original);
});

test('versioned storage round-trips entries and preserves malformed, future, oversized and unrelated data on read', () => {
  const values = new Map<string, string>([['unrelated', 'untouched']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => {
      values.set(key, raw);
    },
  };
  assert.deepEqual(readHistory(storage, f.model).entries, []);
  assert.equal(writeHistory(storage, [winner, entry], f.model), true);
  assert.deepEqual(readHistory(storage, f.model).entries, [winner, entry]);
  assert.equal(writeHistory(storage, [entry, entry], f.model), false);
  for (const raw of [
    '{',
    JSON.stringify({ schemaVersion: 2, entries: [] }),
    JSON.stringify({ schemaVersion: 1, entries: [{ ...entry, statistics: {} }] }),
    ' '.repeat(4_000_001),
  ]) {
    storage.setItem(historyStorageKey, raw);
    const result = readHistory(storage, f.model);
    assert.equal(result.writable, false);
    assert.ok(result.warning);
    assert.deepEqual(result.entries, []);
    assert.equal(storage.getItem(historyStorageKey), raw);
  }
  assert.equal(values.get('unrelated'), 'untouched');
});

test('denied reads and quota failures are explicit and leave the last durable archive intact', () => {
  assert.equal(
    readHistory(
      {
        getItem: () => {
          throw new Error('Denied');
        },
        setItem: () => {},
      },
      f.model,
    ).writable,
    false,
  );
  const raw = JSON.stringify({ schemaVersion: 1, entries: [entry] });
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw new Error('Quota');
    },
  };
  assert.equal(writeHistory(storage, [winner, entry], f.model), false);
  assert.deepEqual(readHistory(storage, f.model).entries, [entry]);
});
