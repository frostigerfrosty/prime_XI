import test from 'node:test';
import assert from 'node:assert/strict';
import { tournamentFixture } from './helpers/tournament.ts';
import { createTournamentEngine } from '../src/engine/tournament.ts';
import {
  readTournament,
  writeTournament,
  tournamentStorageKey,
} from '../src/utils/tournament-storage.ts';
import type { TournamentState } from '../src/types/application.ts';

const f = tournamentFixture(),
  { engine, team, now } = f;
const start = (seed = 'league-fixture') => engine.start(team, seed, now);

test('the user automatically joins 35 unique season opponents; seeded draws preserve complete snapshots', () => {
  const state = start(),
    copy = structuredClone(state);
  assert.equal(state.participants.length, 36);
  assert.equal(state.participants.filter((p) => p.kind === 'user').length, 1);
  assert.deepEqual(state.participants[0]!.team, team);
  assert.notEqual(state.participants[0]!.team, team);
  const primes = state.participants.filter((p) => p.kind === 'prime');
  assert.equal(new Set(primes.map((p) => p.team.id)).size, 35);
  assert.ok(
    new Set(primes.map((p) => p.team.clubId)).size < 35,
    'different seasons of a club remain eligible',
  );
  assert.deepEqual(start(), state);
  assert.notDeepEqual(start('another-seed').participants, state.participants);
  assert.equal(engine.isValid(state), true);
  assert.equal(state.standings.length, 36);
  assert.ok(state.standings.every((row) => row.played === 0 && row.points === 0));
  state.participants[0]!.matchStrength = 0;
  assert.deepEqual(start(), copy);
});

test('one action simulates exactly one complete matchday with league draws and no extra time', () => {
  const initial = start(),
    before = structuredClone(initial),
    next = engine.nextMatchday(initial);
  assert.deepEqual(initial, before);
  assert.equal(next.matches.filter((m) => m.status === 'played').length, 18);
  assert.ok(
    next.matches
      .filter((m) => m.status === 'played')
      .every(
        (m) =>
          m.result.afterExtraTime === null &&
          m.result.penalties === null &&
          m.result.aggregateScore === null,
      ),
  );
  assert.ok(next.standings.every((row) => row.played === 1));
  assert.deepEqual(engine.progress(next), {
    completedRounds: 1,
    totalRounds: 8,
    nextRound: 2,
    complete: false,
  });
  assert.deepEqual(engine.nextMatchday(initial), next);
  const second = engine.nextMatchday(next);
  assert.deepEqual(second.matches.slice(0, 18), next.matches.slice(0, 18));
  assert.equal(second.matches.filter((m) => m.status === 'played').length, 36);
  assert.equal(engine.isValid(second), true);
});

test('playing eight matchdays and finishing the league at once produce the identical final table and 144 results', () => {
  const initial = start();
  let stepwise = initial;
  for (let index = 0; index < 8; index++) stepwise = engine.nextMatchday(stepwise);
  const bulk = engine.finishLeague(initial);
  assert.deepEqual(stepwise, bulk);
  assert.ok(
    bulk.standings.every((row) => row.played === 8 && row.wins + row.draws + row.losses === 8),
  );
  assert.deepEqual(
    bulk.standings.map((row) => row.rank),
    Array.from({ length: 36 }, (_, i) => i + 1),
  );
  const played = bulk.matches.filter((m) => m.status === 'played');
  assert.equal(played.length, 144);
  const drawn = played.filter((m) => m.result.decidedBy === 'draw').length;
  assert.ok(drawn > 0);
  assert.equal(
    bulk.standings.reduce((sum, row) => sum + row.points, 0),
    (144 - drawn) * 3 + drawn * 2,
  );
  assert.equal(
    bulk.standings.reduce((sum, row) => sum + row.goalsFor, 0),
    bulk.standings.reduce((sum, row) => sum + row.goalsAgainst, 0),
  );
  assert.equal(
    bulk.standings.reduce((sum, row) => sum + row.goalDifference, 0),
    0,
  );
  assert.equal(bulk.phase, 'league');
  assert.equal(bulk.completedAt, null);
  assert.equal(bulk.championParticipantId, null);
  assert.deepEqual(bulk.knockoutTies, []);
  assert.equal(engine.progress(bulk).complete, true);
  assert.throws(() => engine.nextMatchday(bulk), /bereits beendet/);
  assert.throws(() => engine.finishLeague(bulk), /bereits beendet/);
});

test('mid-league continuation ignores later saved-team and catalog edits and old dataset version numbers', () => {
  const initial = engine.nextMatchday(start());
  const environment = {
    ...f.environment,
    teams: structuredClone(f.data.teams),
    datasetVersion: '9.0.0',
  };
  const opponent = initial.participants.find((p) => p.kind === 'prime')!;
  const edited = environment.teams.find((t) => t.id === opponent.team.id)!;
  const card = edited.players.find((p) => p.id === edited.defaultLineup[0]!.playerId)!;
  card.rating--;
  card.attributes.overall--;
  edited.teamRating =
    Math.round(
      (edited.defaultLineup.reduce(
        (sum, pick) => sum + edited.players.find((p) => p.id === pick.playerId)!.rating,
        0,
      ) /
        11) *
        10,
    ) / 10;
  const changed = createTournamentEngine(environment);
  assert.equal(changed.isValid(initial), true);
  assert.deepEqual(changed.finishLeague(initial), engine.finishLeague(initial));
  const mutatedSave = structuredClone(team);
  mutatedSave.name = 'Andere Elf';
  const user = initial.participants.find((p) => p.kind === 'user')!;
  assert.equal(user.team.name, team.name);
  assert.notEqual(user.team.name, mutatedSave.name);
});

test('the engine captures its input configuration before external code can change it', () => {
  const fixture = tournamentFixture();
  const before = fixture.engine.start(fixture.team, 'config-snapshot', fixture.now);
  fixture.environment.defaultTactic = 'possession';
  fixture.environment.datasetVersion = 'future-version';
  fixture.environment.teams.splice(0);
  fixture.environment.rules.tournament.league.winPoints = 10;
  fixture.model.rules.builder.drawSize = 1;
  assert.deepEqual(fixture.engine.start(fixture.team, 'config-snapshot', fixture.now), before);
  assert.equal(fixture.engine.isValid(before), true);
});

test('invalid teams, insufficient catalogs and inconsistent league formats fail before creating a tournament', () => {
  assert.throws(() => engine.start({} as never, 'x', now));
  assert.throws(() => engine.start(team, ' ', now));
  assert.throws(() => engine.start(team, 'x', 'not-a-date'));
  assert.throws(() =>
    createTournamentEngine({ ...f.environment, teams: f.data.teams.slice(0, 34) }),
  );
  assert.throws(() =>
    createTournamentEngine({ ...f.environment, teams: [...f.data.teams, f.data.teams[0]!] }),
  );
  const rules = structuredClone(f.data.rules);
  rules.tournament.league.homeMatches = 5;
  assert.throws(() => createTournamentEngine({ ...f.environment, rules }));
});

const corruptions: [string, (s: TournamentState) => void][] = [
  [
    'duplicate participants',
    (s) => {
      s.participants[1] = s.participants[2]!;
    },
  ],
  [
    'changed strength',
    (s) => {
      s.participants[0]!.matchStrength++;
    },
  ],
  [
    'changed card rating',
    (s) => {
      const p = s.participants[1]!;
      if (p.kind === 'prime') p.team.players[0]!.rating--;
    },
  ],
  [
    'tampered table',
    (s) => {
      s.standings[0]!.points++;
    },
  ],
  [
    'tampered result',
    (s) => {
      const m = s.matches[0]!;
      if (m.status === 'played') m.result.regularTime.home++;
    },
  ],
  [
    'tampered xG',
    (s) => {
      const m = s.matches[0]!;
      if (m.status === 'played') m.result.expectedGoals.home = NaN;
    },
  ],
  [
    'unknown result property',
    (s) => {
      const m = s.matches[0]!;
      if (m.status === 'played') Object.assign(m.result, { injected: true });
    },
  ],
  [
    'wrong home rights',
    (s) => {
      const m = s.matches[1]!;
      [m.homeParticipantId, m.awayParticipantId] = [m.awayParticipantId, m.homeParticipantId];
    },
  ],
  [
    'wrong matchday',
    (s) => {
      s.matches[0]!.roundNumber = 8;
    },
  ],
  [
    'partial matchday',
    (s) => {
      s.matches[0] = { ...s.matches[0]!, status: 'scheduled', result: null };
    },
  ],
  [
    'future engine',
    (s) => {
      s.matchEngineVersion = 'future';
    },
  ],
  [
    'unknown rules',
    (s) => {
      s.rulesVersion = 'future';
    },
  ],
  [
    'premature champion',
    (s) => {
      s.championParticipantId = 'user';
    },
  ],
];
for (const [name, mutate] of corruptions)
  test(`restore rejects ${name} without changing the supplied state`, () => {
    const state = engine.nextMatchday(start());
    mutate(state);
    const before = structuredClone(state);
    assert.equal(engine.isValid(state), false);
    assert.throws(() => engine.nextMatchday(state), /beschädigt/);
    assert.deepEqual(state, before);
  });

test('storage round-trips, validates results and preserves malformed data and unrelated keys', () => {
  const values = new Map<string, string>([['unrelated', 'keep']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const state = engine.nextMatchday(start());
  assert.equal(writeTournament(storage, state, engine), true);
  assert.deepEqual(readTournament(storage, engine), { tournament: state, warning: null });
  values.set(tournamentStorageKey, '{corrupt');
  assert.equal(readTournament(storage, engine).tournament, null);
  assert.ok(readTournament(storage, engine).warning);
  assert.equal(values.get(tournamentStorageKey), '{corrupt');
  assert.equal(values.get('unrelated'), 'keep');
  const broken = structuredClone(state);
  broken.standings = [];
  assert.equal(writeTournament(storage, broken, engine), false);
  assert.equal(values.get(tournamentStorageKey), '{corrupt');
});

test('denied reads and full storage report failure; valid in-memory tournaments remain playable', () => {
  const state = start(),
    before = structuredClone(state);
  const blocked = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(readTournament(blocked, engine).tournament, null);
  assert.ok(readTournament(blocked, engine).warning);
  assert.equal(writeTournament(blocked, state, engine), false);
  assert.deepEqual(state, before);
  assert.equal(engine.progress(engine.nextMatchday(state)).completedRounds, 1);
});
