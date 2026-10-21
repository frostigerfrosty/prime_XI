import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import {
  createMatchEngine,
  samplePoisson,
  simulateShootout,
  type MatchContext,
} from '../src/engine/match.ts';
import { primeMatchTeam, savedMatchTeam } from '../src/engine/match-team.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import { seededRandom } from '../src/engine/random.ts';
import type { Score } from '../src/types/application.ts';

const data = getDatabase();
const engine = createMatchEngine(data.rules);
const home = { id: 'h', strength: 90 };
const away = { id: 'a', strength: 90 };
function context<M extends 'regular' | 'knockout' = 'regular'>(
  seed = 'fixture-4',
  mode: M = 'regular' as M,
) {
  return { seed, mode, neutralVenue: true };
}

test('a published seed fixture reproduces the score, xG and independent phase streams', () => {
  const regular = engine.simulateMatch(home, away, context());
  assert.deepEqual(regular.regularTime, { home: 1, away: 1 });
  assert.equal(regular.decidedBy, 'draw');
  assert.equal(regular.winnerParticipantId, null);
  assert.equal(regular.afterExtraTime, null);
  assert.equal(regular.penalties, null);
  assert.equal(regular.aggregateScore, null);
  assert.deepEqual(engine.simulateMatch(home, away, context()), regular);
  const knockout = engine.simulateMatch(home, away, context('fixture-4', 'knockout'));
  assert.deepEqual(knockout.regularTime, regular.regularTime);
  assert.deepEqual(knockout.expectedGoals, regular.expectedGoals);
  assert.deepEqual(knockout.afterExtraTime, { home: 1, away: 2 });
  assert.equal(knockout.decidedBy, 'extra-time');
  assert.equal(knockout.winnerParticipantId, away.id);
  assert.ok(
    Math.abs(knockout.extraTimeExpectedGoals!.home - regular.expectedGoals.home / 3) < 1e-12,
  );
  assert.ok(
    Math.abs(knockout.extraTimeExpectedGoals!.away - regular.expectedGoals.away / 3) < 1e-12,
  );
  assert.equal(knockout.engineVersion, '1.0.0');
});

test('Poisson sampler has the expected mean and variance, including zero and long tails', () => {
  assert.equal(
    samplePoisson(0, () => 0.999),
    0,
  );
  assert.ok(
    samplePoisson(4.5, () => 1 - 2 ** -32) > 20,
    'scores are not capped at a cosmetic maximum',
  );
  const random = seededRandom('poisson-distribution');
  for (const mean of [0.15, 1.35, 4.5]) {
    let sum = 0,
      squares = 0;
    const count = 100_000;
    for (let index = 0; index < count; index++) {
      const goals = samplePoisson(mean, random);
      sum += goals;
      squares += goals ** 2;
    }
    assert.ok(Math.abs(sum / count - mean) < 0.03);
    assert.ok(Math.abs(squares / count - (sum / count) ** 2 - mean) < 0.06);
  }
  for (const invalid of [NaN, Infinity, -1, 11])
    assert.throws(() => samplePoisson(invalid, random));
  assert.throws(() => samplePoisson(1, () => 1));
});

test('strength, neutral venue, home advantage and bounded form affect xG transparently', () => {
  const rules = structuredClone(data.rules);
  rules.match.matchVarianceFraction = 0;
  const deterministic = createMatchEngine(rules);
  assert.deepEqual(deterministic.expectedGoals(home, away, context()), { home: 1.35, away: 1.35 });
  const stronger = deterministic.expectedGoals(
    { ...home, strength: 94 },
    { ...away, strength: 87 },
    context(),
  );
  assert.ok(Math.abs(stronger.home - 1.35 * Math.exp(0.048 * 7)) < 1e-12);
  assert.ok(Math.abs(stronger.away - 1.35 * Math.exp(-0.048 * 7)) < 1e-12);
  const hosted = deterministic.expectedGoals(home, away, { ...context(), neutralVenue: false });
  assert.ok(hosted.home > 1.35 && hosted.away < 1.35);
  const reverse = deterministic.expectedGoals(
    { ...home, strength: 87 },
    { ...away, strength: 94 },
    context(),
  );
  assert.deepEqual(reverse, { home: stronger.away, away: stronger.home });
  const maximum = engine.expectedGoals(
    { ...home, strength: 113 },
    { ...away, strength: 0 },
    context(),
  );
  assert.deepEqual(maximum, { home: 4.5, away: 0.15 });
  for (let index = 0; index < 100; index++) {
    const expected = engine.expectedGoals(home, away, context(`form-${index}`));
    for (const value of Object.values(expected))
      assert.ok(value >= 1.35 * 0.92 && value <= 1.35 * 1.08);
    const equal = engine.simulateMatch(home, away, context(`form-${index}`));
    const improved = engine.simulateMatch(
      { ...home, strength: 95 },
      away,
      context(`form-${index}`),
    );
    assert.ok(
      improved.regularTime.home >= equal.regularTime.home &&
        improved.regularTime.away <= equal.regularTime.away,
    );
  }
});

test('shootout goals stay separate from the cumulative 120-minute and aggregate scores', () => {
  const result = engine.simulateMatch(home, away, context('fixture-34', 'knockout'));
  assert.deepEqual(result.regularTime, { home: 1, away: 1 });
  assert.deepEqual(result.afterExtraTime, { home: 1, away: 1 });
  assert.deepEqual(result.aggregateScore, { home: 1, away: 1 });
  assert.deepEqual(result.penalties, { home: 3, away: 4 });
  assert.equal(result.decidedBy, 'penalties');
  assert.equal(result.winnerParticipantId, away.id);
  assert.equal(result.shootoutKicks.length, 10);
});

test('return legs resolve aggregate goals, ignoring away goals and the winner of this leg', () => {
  const drawLeg = engine.simulateMatch(home, away, {
    ...context('fixture-4', 'knockout'),
    aggregateBefore: { home: 2, away: 0 },
  });
  assert.equal(drawLeg.winnerParticipantId, home.id);
  assert.deepEqual(drawLeg.aggregateScore, { home: 3, away: 1 });
  assert.equal(drawLeg.afterExtraTime, null, 'a drawn leg does not imply a tied aggregate');
  const legLoss = engine.simulateMatch(home, away, {
    ...context('fixture-0', 'knockout'),
    aggregateBefore: { home: 3, away: 0 },
  });
  assert.deepEqual(legLoss.regularTime, { home: 0, away: 1 });
  assert.equal(legLoss.winnerParticipantId, home.id);
  assert.equal(legLoss.afterExtraTime, null);
  const tiedAggregate = engine.simulateMatch(home, away, {
    ...context('fixture-0', 'knockout'),
    aggregateBefore: { home: 1, away: 0 },
  });
  assert.ok(
    tiedAggregate.afterExtraTime,
    'a tied aggregate needs resolution despite an away leg win',
  );
  assert.notEqual(tiedAggregate.winnerParticipantId, null);
  assert.deepEqual(tiedAggregate.aggregateScore, {
    home: 1 + tiedAggregate.afterExtraTime.home,
    away: tiedAggregate.afterExtraTime.away,
  });
});

test('penalties stop on a clinch and sudden death always completes both kicks of a pair', () => {
  assert.equal(simulateShootout('shootout-2').kicks.length, 8);
  assert.equal(simulateShootout('shootout-1').kicks.length, 12);
  for (let index = 0; index < 2000; index++) {
    const result = simulateShootout(`shootout-${index}`);
    const goals: Score = { home: 0, away: 0 },
      taken: Score = { home: 0, away: 0 };
    result.kicks.forEach((kick, position) => {
      assert.equal(kick.side, position % 2 === 0 ? 'home' : 'away');
      assert.equal(kick.round, Math.floor(position / 2) + 1);
      taken[kick.side]++;
      if (kick.scored) goals[kick.side]++;
      if (position < result.kicks.length - 1 && kick.round <= 5) {
        assert.ok(goals.home <= goals.away + 5 - taken.away);
        assert.ok(goals.away <= goals.home + 5 - taken.home);
      }
      if (kick.round > 5 && kick.side === 'away' && position < result.kicks.length - 1)
        assert.equal(goals.home, goals.away);
    });
    if (result.kicks.length > 10) assert.equal(result.kicks.length % 2, 0);
    else
      assert.ok(
        goals.home > goals.away + 5 - taken.away || goals.away > goals.home + 5 - taken.home,
      );
    assert.deepEqual(goals, result.score);
    assert.notEqual(goals.home, goals.away);
    assert.ok(result.kicks.length < 200, 'bounded geometric sudden-death sampling');
  }
});

test('all catalog opponents use the same strength formula rather than the arithmetic card average', () => {
  const model = createStrengthModel(data);
  const before = structuredClone(data.teams);
  for (const team of data.teams) {
    const result = primeMatchTeam(team, model, data.defaults.defaultTactic);
    assert.equal(result.id, team.id);
    assert.ok(result.strength > team.teamRating!);
    const input = {
      formationId: team.formation!,
      tacticId: data.defaults.defaultTactic,
      lineup: team.defaultLineup.map((pick) => ({
        slotId: pick.slotId,
        player: team.players.find((p) => p.id === pick.playerId)!,
        clubId: team.clubId,
      })),
      coach: team.coach,
      captainPersonId: team.captainPersonId,
    };
    if (!input.lineup.some((pick) => pick.player.personId === input.captainPersonId))
      input.captainPersonId = null;
    assert.equal(result.strength, model.analyze(input).strength.matchStrength);
  }
  assert.deepEqual(data.teams, before);
});

test('malformed participants, contexts and numerical rules fail before simulation', () => {
  for (const strength of [NaN, Infinity, -1, 113.01])
    assert.throws(() => engine.simulateMatch({ ...home, strength }, away, context()));
  assert.throws(() => engine.simulateMatch(home, { ...away, id: home.id }, context()));
  assert.throws(() => engine.simulateMatch(home, away, context('  ')));
  assert.throws(() =>
    engine.simulateMatch(home, away, { ...context(), mode: 'invalid' } as unknown as MatchContext),
  );
  assert.throws(() =>
    engine.simulateMatch(home, away, {
      ...context(),
      aggregateBefore: { home: 1, away: 1 },
    } as unknown as MatchContext),
  );
  assert.throws(() =>
    engine.simulateMatch(home, away, {
      ...context('x', 'knockout'),
      aggregateBefore: { home: -1, away: 0 },
    }),
  );
  const rules = structuredClone(data.rules);
  rules.match.penaltyConversionProbability = 1;
  assert.throws(() => createMatchEngine(rules));
  assert.throws(() => savedMatchTeam({} as never, createStrengthModel(data)));
});

test('configuration and result mutations cannot alter later simulations; every KO has one winner', () => {
  const rules = structuredClone(data.rules),
    ownEngine = createMatchEngine(rules);
  rules.match.strengthSensitivity = 1;
  const before = structuredClone({ home, away });
  const result = ownEngine.simulateMatch(home, away, context());
  result.regularTime.home = 999;
  assert.deepEqual(
    ownEngine.simulateMatch(home, away, context()),
    engine.simulateMatch(home, away, context()),
  );
  for (let index = 0; index < 2000; index++) {
    const played = ownEngine.simulateMatch(home, away, context(`resolution-${index}`, 'knockout'));
    assert.ok([home.id, away.id].includes(played.winnerParticipantId!));
    assert.notEqual(played.decidedBy, 'draw');
  }
  assert.deepEqual({ home, away }, before);
  // Longest supported public code must also work if a shootout is needed.
  assert.doesNotThrow(() => engine.simulateMatch(home, away, context('x'.repeat(200), 'knockout')));
  assert.doesNotThrow(() =>
    engine.simulateMatch(home, away, context('\0'.repeat(200), 'knockout')),
  );
});

test('neutral calibration gives close contests, a clear favorite and real underdog victories', () => {
  const count = 50_000;
  const cases = [
    { h: 94, a: 87, min: 0.7, max: 0.75 },
    { h: 94, a: 93, min: 0.51, max: 0.55 },
    { h: 82, a: 91, min: 0.19, max: 0.25 },
    { h: 90, a: 90, min: 0.49, max: 0.51 },
  ];
  for (const pair of cases) {
    let wins = 0,
      draws = 0;
    for (let index = 0; index < count; index++) {
      const result = engine.simulateMatch(
        { ...home, strength: pair.h },
        { ...away, strength: pair.a },
        context(`report-${index}`, 'knockout'),
      );
      if (result.winnerParticipantId === home.id) wins++;
      if (result.regularTime.home === result.regularTime.away) draws++;
    }
    assert.ok(
      wins / count >= pair.min && wins / count <= pair.max,
      `${pair.h}/${pair.a}: ${wins / count}`,
    );
    assert.ok(draws / count > 0.15 && draws / count < 0.3, '90-minute draws remain explicit');
  }
});
