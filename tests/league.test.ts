import test from 'node:test';
import assert from 'node:assert/strict';
import { getGameRules } from '../src/data/index.ts';
import {
  createLeagueSchedule,
  calculateLeagueTable,
  leagueQualification,
} from '../src/engine/league.ts';
import type { ScheduledMatch } from '../src/types/application.ts';

const rules = getGameRules().tournament.league;
const ids = Array.from({ length: 36 }, (_, i) => `team-${i}`);

test('200 seeded schedules each give 36 teams eight distinct opponents, four home and four away games', () => {
  for (let seed = 0; seed < 200; seed++) {
    const matches = createLeagueSchedule(ids, `schedule-${seed}`, rules);
    assert.equal(matches.length, 144);
    assert.equal(new Set(matches.map((m) => m.id)).size, 144);
    assert.equal(
      new Set(matches.map((m) => [m.homeParticipantId, m.awayParticipantId].sort().join('|'))).size,
      144,
    );
    for (let round = 1; round <= 8; round++) {
      const day = matches.filter((m) => m.roundNumber === round);
      assert.equal(day.length, 18);
      assert.equal(
        new Set(day.flatMap((m) => [m.homeParticipantId, m.awayParticipantId])).size,
        36,
      );
    }
    for (const id of ids) {
      const home = matches.filter((m) => m.homeParticipantId === id);
      const away = matches.filter((m) => m.awayParticipantId === id);
      assert.equal(home.length, 4);
      assert.equal(away.length, 4);
      const opponents = [
        ...home.map((m) => m.awayParticipantId),
        ...away.map((m) => m.homeParticipantId),
      ];
      assert.equal(new Set(opponents).size, 8);
      assert.ok(!opponents.includes(id));
    }
    assert.ok(
      matches.every(
        (m) =>
          m.phase === 'league' &&
          m.leg === null &&
          !m.neutralVenue &&
          m.status === 'scheduled' &&
          m.result === null,
      ),
    );
  }
});

test('schedule generation is repeatable, leaves its inputs alone, and supports smaller even formats', () => {
  const copy = [...ids];
  assert.deepEqual(
    createLeagueSchedule(ids, 'replay', rules),
    createLeagueSchedule(ids, 'replay', rules),
  );
  assert.notDeepEqual(
    createLeagueSchedule(ids, 'replay', rules),
    createLeagueSchedule(ids, 'other', rules),
  );
  assert.deepEqual(ids, copy);
  const small = createLeagueSchedule(ids.slice(0, 8), 'small', {
    ...rules,
    matchesPerTeam: 4,
    homeMatches: 2,
    awayMatches: 2,
  });
  assert.equal(small.length, 16);
  for (const id of ids.slice(0, 8))
    assert.equal(small.filter((m) => m.homeParticipantId === id).length, 2);
});

test('impossible formats, duplicate participants and invalid seeds fail explicitly', () => {
  assert.throws(() => createLeagueSchedule(ids.slice(1), 'x', rules));
  assert.throws(() => createLeagueSchedule([...ids.slice(1), ids[1]!], 'x', rules));
  assert.throws(() => createLeagueSchedule(ids, ' ', rules));
  assert.throws(() => createLeagueSchedule(ids, 'x', { ...rules, homeMatches: 5 }));
  assert.throws(() => createLeagueSchedule(ids.slice(0, 8), 'x', rules));
  assert.throws(() => createLeagueSchedule(ids, 'x', { ...rules, matchesPerTeam: 7 }));
});

function played(id: string, h: string, a: string, home: number, away: number): ScheduledMatch {
  return {
    id,
    phase: 'league',
    roundNumber: 1,
    leg: null,
    homeParticipantId: h,
    awayParticipantId: a,
    neutralVenue: false,
    status: 'played',
    result: {
      engineVersion: '1.0.0',
      regularTime: { home, away },
      afterExtraTime: null,
      penalties: null,
      shootoutKicks: [],
      winnerParticipantId: home === away ? null : home > away ? h : a,
      decidedBy: home === away ? 'draw' : 'regular-time',
      expectedGoals: { home: 1, away: 1 },
      extraTimeExpectedGoals: null,
      aggregateScore: null,
      seed: id,
    },
  };
}

test('the table matches hand-calculated points, goals and W/D/L and ignores unplayed or knockout matches', () => {
  const matches = [
    played('ab', 'a', 'b', 2, 0),
    played('cd', 'c', 'd', 3, 1),
    played('bc', 'b', 'c', 1, 1),
  ];
  const before = structuredClone(matches);
  const table = calculateLeagueTable(['d', 'b', 'a', 'c'], matches, rules);
  assert.deepEqual(
    table.map((row) => row.participantId),
    ['c', 'a', 'b', 'd'],
  );
  assert.deepEqual(table[0], {
    participantId: 'c',
    rank: 1,
    played: 2,
    wins: 1,
    draws: 1,
    losses: 0,
    goalsFor: 4,
    goalsAgainst: 2,
    goalDifference: 2,
    points: 4,
  });
  assert.deepEqual(table[2], {
    participantId: 'b',
    rank: 3,
    played: 2,
    wins: 0,
    draws: 1,
    losses: 1,
    goalsFor: 1,
    goalsAgainst: 3,
    goalDifference: -2,
    points: 1,
  });
  const scheduled: ScheduledMatch = {
    ...matches[0]!,
    id: 'scheduled',
    status: 'scheduled',
    result: null,
  };
  const knockout = { ...matches[0]!, id: 'ko', phase: 'final' as const };
  assert.deepEqual(
    calculateLeagueTable(['d', 'b', 'a', 'c'], [...matches, scheduled, knockout], rules),
    table,
  );
  assert.deepEqual(matches, before);
});

test('tie-breakers distinguish points, goal difference, goals, wins and finally stable IDs', () => {
  const pair = [
    played('a1', 'a', 'c', 1, 0),
    played('a2', 'a', 'd', 1, 0),
    played('a3', 'e', 'a', 1, 0),
    played('b1', 'b', 'f', 1, 0),
    played('b2', 'b', 'g', 1, 1),
    played('b3', 'b', 'h', 0, 0),
    played('b4', 'b', 'i', 0, 0),
  ];
  const rows = calculateLeagueTable(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], pair, rules);
  assert.deepEqual(
    rows
      .slice(0, 2)
      .map((row) => [row.participantId, row.points, row.goalDifference, row.goalsFor, row.wins]),
    [
      ['a', 6, 1, 2, 2],
      ['b', 6, 1, 2, 1],
    ],
  );
  assert.deepEqual(
    calculateLeagueTable(['b', 'a', 'A'], [], rules).map((row) => row.participantId),
    ['A', 'a', 'b'],
  );
  const goals = calculateLeagueTable(
    ['a', 'b', 'c', 'd'],
    [played('ab', 'a', 'b', 2, 0), played('cd', 'c', 'd', 3, 1)],
    rules,
  );
  assert.equal(goals[0]!.participantId, 'c');
  const diff = calculateLeagueTable(
    ['a', 'b', 'c', 'd'],
    [played('ab', 'a', 'b', 1, 0), played('cd', 'c', 'd', 2, 0)],
    rules,
  );
  assert.equal(diff[0]!.participantId, 'c');
  const customized = calculateLeagueTable(['a', 'b'], [played('x', 'a', 'b', 1, 1)], {
    ...rules,
    drawPoints: 2,
    winPoints: 4,
  });
  assert.equal(customized[0]!.points, 2);
});

test('duplicate games, unknown teams, fractional goals and unsupported table ordering are rejected', () => {
  const m = played('x', 'a', 'b', 1, 0);
  assert.throws(() => calculateLeagueTable(['a', 'b'], [m, m], rules));
  assert.throws(() => calculateLeagueTable(['a', 'b'], [played('bad', 'a', 'z', 1, 0)], rules));
  assert.throws(() => calculateLeagueTable(['a', 'b'], [played('bad', 'a', 'b', NaN, 0)], rules));
  assert.throws(() => calculateLeagueTable(['a', 'b'], [played('bad', 'a', 'b', 1.1, 0)], rules));
  assert.throws(() =>
    calculateLeagueTable(['a', 'b'], [m], {
      ...rules,
      tiebreakers: ['points', 'coin-flip', 'teamId'],
    }),
  );
});

test('qualification covers all boundaries without overlapping places', () => {
  for (const rank of [1, 8]) assert.equal(leagueQualification(rank, rules), 'direct');
  for (const rank of [9, 24]) assert.equal(leagueQualification(rank, rules), 'playoff');
  for (const rank of [25, 36]) assert.equal(leagueQualification(rank, rules), 'eliminated');
  for (const rank of [0, 37, 8.5, NaN]) assert.throws(() => leagueQualification(rank, rules));
});
