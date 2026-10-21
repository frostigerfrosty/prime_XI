import test from 'node:test';
import assert from 'node:assert/strict';
import { tournamentFixture, championTestTeam } from './helpers/tournament.ts';
import type { TournamentState } from '../src/types/application.ts';
import { createTournamentEngine } from '../src/engine/tournament.ts';
import {
  readTournament,
  writeTournament,
  tournamentStorageKey,
} from '../src/utils/tournament-storage.ts';
import { userTournamentStatus } from '../src/utils/tournament-display.ts';

const f = tournamentFixture(),
  { engine, team, now } = f;
const league = (seed = 'knockout-0') => engine.finishLeague(engine.start(team, seed, now));
const finished = () => engine.finishTournament(league(), now);

test('the seeded playoff draw uses ranks 9–16 against 17–24, with home return legs for seeded teams', () => {
  const initial = league(),
    before = structuredClone(initial),
    drawn = engine.drawNextRound(initial);
  assert.deepEqual(initial, before);
  assert.equal(drawn.phase, 'playoffs');
  assert.equal(drawn.knockoutTies.length, 8);
  assert.equal(drawn.matches.length, 160);
  const ranks = new Map(initial.standings.map((row) => [row.participantId, row.rank]));
  for (const tie of drawn.knockoutTies) {
    assert.ok(ranks.get(tie.teamAId)! >= 9 && ranks.get(tie.teamAId)! <= 16);
    assert.ok(ranks.get(tie.teamBId)! >= 17 && ranks.get(tie.teamBId)! <= 24);
    const first = drawn.matches.find((m) => m.id === tie.matchIds[0])!,
      second = drawn.matches.find((m) => m.id === tie.matchIds[1])!;
    assert.equal(first.homeParticipantId, tie.teamBId);
    assert.equal(second.homeParticipantId, tie.teamAId);
    assert.equal(first.leg, 1);
    assert.equal(second.leg, 2);
    assert.equal(first.neutralVenue, false);
    assert.equal(second.neutralVenue, false);
    assert.deepEqual(tie.aggregateGoals, { teamA: 0, teamB: 0 });
    assert.equal(tie.winnerParticipantId, null);
  }
  assert.deepEqual(engine.drawNextRound(initial), drawn);
  assert.throws(() => engine.drawNextRound(drawn), /vollständig/);
  assert.equal(engine.isValid(drawn), true);
});

test('first legs remain unresolved after 90 minutes; round-of-16 byes wait for eight playoff winners', () => {
  const initial = league(),
    drawn = engine.drawNextRound(initial),
    first = engine.nextKnockoutLeg(drawn, now);
  assert.equal(
    first.matches.filter((m) => m.phase === 'playoffs' && m.status === 'played').length,
    8,
  );
  assert.ok(first.knockoutTies.every((tie) => tie.winnerParticipantId === null));
  assert.ok(
    first.matches
      .filter((m) => m.phase === 'playoffs' && m.status === 'played')
      .every(
        (m) =>
          m.status === 'played' &&
          m.result.afterExtraTime === null &&
          m.result.penalties === null &&
          m.result.aggregateScore === null,
      ),
  );
  assert.throws(() => engine.drawNextRound(first));
  const resolved = engine.nextKnockoutLeg(first, now),
    next = engine.drawNextRound(resolved);
  assert.equal(next.phase, 'round-of-16');
  const direct = new Set(initial.standings.slice(0, 8).map((r) => r.participantId));
  const winners = new Set(resolved.knockoutTies.map((tie) => tie.winnerParticipantId));
  const r16 = next.knockoutTies.filter((tie) => tie.round === 'round-of-16');
  assert.equal(r16.length, 8);
  assert.ok(r16.every((tie) => direct.has(tie.teamAId) && winners.has(tie.teamBId)));
  assert.equal(new Set(r16.flatMap((tie) => [tie.teamAId, tie.teamBId])).size, 16);
  assert.deepEqual(next.standings, initial.standings);
});

test('return-leg orientation, extra time and penalties agree with independently summed match goals', () => {
  let extra = 0,
    penalties = 0,
    winnerLostLeg = 0;
  for (const seed of ['knockout-0', 'knockout-1', 'knockout-2']) {
    const state = engine.finishTournament(league(seed), now);
    for (const tie of state.knockoutTies) {
      let a = 0,
        b = 0;
      for (const id of tie.matchIds) {
        const m = state.matches.find((match) => match.id === id)!;
        assert.equal(m.status, 'played');
        if (m.status !== 'played') throw new Error('not played');
        const score = m.result.afterExtraTime ?? m.result.regularTime;
        a += m.homeParticipantId === tie.teamAId ? score.home : score.away;
        b += m.homeParticipantId === tie.teamBId ? score.home : score.away;
      }
      assert.deepEqual(tie.aggregateGoals, { teamA: a, teamB: b });
      const last = state.matches.find((m) => m.id === tie.matchIds.at(-1))!;
      if (last.status !== 'played') throw new Error('not played');
      const result = last.result;
      assert.equal(result.winnerParticipantId, tie.winnerParticipantId);
      assert.deepEqual(result.aggregateScore, { home: a, away: b });
      if (result.penalties) {
        penalties++;
        assert.equal(a, b);
        assert.equal(
          tie.winnerParticipantId,
          result.penalties.home > result.penalties.away ? tie.teamAId : tie.teamBId,
        );
      } else assert.equal(tie.winnerParticipantId, a > b ? tie.teamAId : tie.teamBId);
      if (result.afterExtraTime) extra++;
      if (tie.matchIds.length === 2) {
        const first = state.matches.find((m) => m.id === tie.matchIds[0])!;
        if (first.status !== 'played') throw new Error('not played');
        const a90 = first.result.regularTime.away + result.regularTime.home;
        const b90 = first.result.regularTime.home + result.regularTime.away;
        assert.equal(
          result.afterExtraTime !== null,
          a90 === b90,
          'extra time depends on the aggregate, not the leg',
        );
        if (
          tie.winnerParticipantId === tie.teamAId &&
          result.regularTime.home < result.regularTime.away &&
          !result.afterExtraTime
        )
          winnerLostLeg++;
        if (
          tie.winnerParticipantId === tie.teamBId &&
          result.regularTime.home > result.regularTime.away &&
          !result.afterExtraTime
        )
          winnerLostLeg++;
      }
    }
  }
  assert.ok(extra > 0 && penalties > 0 && winnerLostLeg > 0);
});

test('all knockout rounds reach one neutral final and one champion after exactly 189 matches', () => {
  const initial = league(),
    before = structuredClone(initial);
  let state = initial;
  for (let i = 0; i < 14; i++) {
    const progress = engine.knockoutProgress(state);
    state = progress.nextRound ? engine.drawNextRound(state) : engine.nextKnockoutLeg(state, now);
    assert.equal(engine.isValid(state), true);
  }
  assert.deepEqual(state, engine.finishTournament(initial, now));
  assert.deepEqual(initial, before);
  assert.equal(state.phase, 'completed');
  assert.equal(state.completedAt, now);
  assert.equal(state.matches.length, 189);
  assert.ok(state.matches.every((m) => m.status === 'played'));
  assert.equal(state.knockoutTies.length, 23);
  assert.deepEqual(
    f.data.rules.tournament.knockout.rounds.map(
      (r) => state.knockoutTies.filter((t) => t.round === r.id).length,
    ),
    [8, 8, 4, 2, 1],
  );
  const final = state.matches.filter((m) => m.phase === 'final');
  assert.equal(final.length, 1);
  assert.equal(final[0]!.neutralVenue, true);
  assert.equal(final[0]!.leg, null);
  assert.equal(state.championParticipantId, state.knockoutTies.at(-1)!.winnerParticipantId);
  assert.deepEqual(state.standings, initial.standings);
  assert.deepEqual(engine.progress(state), {
    completedRounds: 8,
    totalRounds: 8,
    nextRound: null,
    complete: true,
  });
  assert.throws(() => engine.nextKnockoutLeg(state, now));
  assert.throws(() => engine.drawNextRound(state));
  assert.throws(() => engine.finishTournament(state, now), /bereits beendet/);
});

test('only survivors enter the next open draw, and eliminated teams never re-enter', () => {
  const state = finished();
  const rounds = f.data.rules.tournament.knockout.rounds;
  for (let i = 2; i < rounds.length; i++) {
    const previous = state.knockoutTies.filter((t) => t.round === rounds[i - 1]!.id);
    const winners = previous.map((t) => t.winnerParticipantId!).sort();
    const current = state.knockoutTies.filter((t) => t.round === rounds[i]!.id);
    assert.deepEqual(current.flatMap((t) => [t.teamAId, t.teamBId]).sort(), winners);
  }
});

test('saved mid-round states continue identically and final timestamps never affect scores', () => {
  const first = engine.nextKnockoutLeg(engine.drawNextRound(league()), now);
  const raw = JSON.stringify(first),
    restored = JSON.parse(raw) as TournamentState;
  const direct = engine.finishTournament(first, now),
    resumed = engine.finishTournament(restored, '2026-10-22T12:00:00.000Z');
  assert.deepEqual(direct.matches, resumed.matches);
  assert.deepEqual(direct.knockoutTies, resumed.knockoutTies);
  assert.equal(direct.championParticipantId, resumed.championParticipantId);
  assert.notEqual(direct.completedAt, resumed.completedAt);
  assert.equal(JSON.stringify(first), raw);
});

test('known Phase-6 league snapshots are loaded as-is and upgraded only by the first knockout draw', () => {
  const legacy = league();
  legacy.rulesVersion = '1.3.0';
  delete legacy.knockoutVersion;
  const raw = JSON.stringify({ schemaVersion: 1, tournament: legacy });
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw new Error('read must never write');
    },
  };
  assert.equal(engine.isValid(legacy), true);
  assert.deepEqual(readTournament(storage, engine), { tournament: legacy, warning: null });
  const next = engine.drawNextRound(legacy);
  assert.equal(next.rulesVersion, '1.4.0');
  assert.equal(next.knockoutVersion, '1.0.0');
  assert.deepEqual(next.matches.slice(0, 144), legacy.matches);
  assert.deepEqual(next.participants, legacy.participants);
  assert.deepEqual(next.standings, legacy.standings);
  assert.equal(engine.isValid(next), true);
  assert.equal(legacy.knockoutVersion, undefined);
  const invalid = structuredClone(next);
  invalid.rulesVersion = '1.3.0';
  delete invalid.knockoutVersion;
  assert.equal(engine.isValid(invalid), false);
});

test('unknown legacy versions, unsupported formats and unfinished league transitions are rejected', () => {
  const initial = engine.start(team, 'incomplete', now);
  assert.throws(() => engine.drawNextRound(initial));
  assert.throws(() => engine.nextKnockoutLeg(initial, now));
  assert.throws(() => engine.finishTournament(initial, now));
  const legacy = league();
  legacy.rulesVersion = '1.2.0';
  delete legacy.knockoutVersion;
  assert.equal(engine.isValid(legacy), false);
  const rules = structuredClone(f.data.rules);
  rules.tournament.knockout.awayGoalsRule = true;
  assert.throws(() => createTournamentEngine({ ...f.environment, rules }));
  const drawn = engine.drawNextRound(league());
  const first = engine.nextKnockoutLeg(drawn, now);
  assert.throws(() => engine.drawNextRound(first));
});

const corruptions: [string, (s: TournamentState) => void][] = [
  [
    'aggregate goals',
    (s) => {
      s.knockoutTies[0]!.aggregateGoals.teamA++;
    },
  ],
  [
    'tie winner',
    (s) => {
      s.knockoutTies[0]!.winnerParticipantId = 'user';
    },
  ],
  [
    'final champion',
    (s) => {
      s.championParticipantId = 'user';
    },
  ],
  [
    'home venue',
    (s) => {
      s.matches.at(-1)!.neutralVenue = false;
    },
  ],
  [
    'swapped return leg',
    (s) => {
      const m = s.matches.find((m) => m.phase === 'playoffs' && m.leg === 2)!;
      [m.homeParticipantId, m.awayParticipantId] = [m.awayParticipantId, m.homeParticipantId];
    },
  ],
  [
    'partial leg batch',
    (s) => {
      const i = s.matches.findIndex((m) => m.phase === 'quarter-finals');
      s.matches[i] = { ...s.matches[i]!, status: 'scheduled', result: null };
    },
  ],
  [
    'fractional goals',
    (s) => {
      const m = s.matches.at(-1)!;
      if (m.status === 'played') m.result.regularTime.home += 1e-12;
    },
  ],
  [
    'penalty kicks',
    (s) => {
      const m = s.matches.find((m) => m.status === 'played' && m.result.penalties)!;
      if (m.status === 'played')
        m.result.shootoutKicks[0]!.scored = !m.result.shootoutKicks[0]!.scored;
    },
  ],
  [
    'missing timestamp',
    (s) => {
      s.completedAt = null;
    },
  ],
  [
    'early timestamp',
    (s) => {
      s.completedAt = '2020-01-01T00:00:00.000Z';
    },
  ],
  [
    'unknown knockout version',
    (s) => {
      s.knockoutVersion = 'future';
    },
  ],
];
for (const [name, mutate] of corruptions)
  test(`restoring rejects changed ${name} and preserves the raw save`, () => {
    const state = finished();
    mutate(state);
    const before = structuredClone(state);
    const raw = JSON.stringify({ schemaVersion: 1, tournament: state });
    const values = new Map([[tournamentStorageKey, raw]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    assert.equal(engine.isValid(state), false);
    assert.equal(readTournament(storage, engine).tournament, null);
    assert.equal(writeTournament(storage, state, engine), false);
    assert.equal(values.get(tournamentStorageKey), raw);
    assert.deepEqual(state, before);
  });

test('both a user champion and a league elimination remain honest user statuses', () => {
  const strong = championTestTeam(f);
  let champion: TournamentState | null = null;
  for (let i = 0; i < 20; i++) {
    const state = engine.finishTournament(
      engine.finishLeague(engine.start(strong, `user-champion-${i}`, now)),
      now,
    );
    if (state.championParticipantId === 'user') {
      champion = state;
      break;
    }
  }
  assert.ok(champion);
  assert.match(userTournamentStatus(champion, f.data.rules.tournament.league), /Turniersieger/);
  const out = engine.finishTournament(league('knockout-1'), now);
  assert.match(
    userTournamentStatus(out, f.data.rules.tournament.league),
    /Ligaphase ausgeschieden/,
  );
  const bypass = engine.drawNextRound(league('knockout-0'));
  assert.match(
    userTournamentStatus(bypass, f.data.rules.tournament.league),
    /überspringst die Playoffs/,
  );
});
