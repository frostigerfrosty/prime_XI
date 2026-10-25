import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { evaluateSeasonRating, ratingCriteria } from '../src/engine/ratings.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import { analyzePrimeTeam } from '../src/engine/match-team.ts';
import { validateDatabase } from '../scripts/validate-data.mjs';

const data = getDatabase(),
  rubric = data.ratingModel.rubric;
const cards = data.teams.flatMap((team) => team.players);
test('every season card is reproducible from five explicit judgments and registered read references', () => {
  assert.equal(cards.length, 1080);
  assert.deepEqual(rubric.weights, {
    performance: 0.35,
    influence: 0.25,
    consistency: 0.2,
    bigGames: 0.1,
    historical: 0.1,
  });
  for (const card of cards) {
    assert.ok(card.ratingAssessment, card.id);
    assert.equal(evaluateSeasonRating(card.ratingAssessment, rubric).rating, card.rating, card.id);
    assert.ok(
      card.ratingAssessment.sourceIds.every((id) =>
        data.sources.some((source) => source.id === id && source.accessStatus === 'retrieved'),
      ),
    );
    if (card.rating >= 98) assert.ok(card.ratingAssessment.historicalException?.justification);
  }
  for (const card of cards.filter((card) => card.rating >= 95))
    assert.equal(card.ratingAssessment!.confidence, 'reference');
  assert.equal(cards.filter((card) => card.rating === 99).length, 0);
});
test('a perfect numeric score cannot bypass historical or evidence gates on any position', () => {
  const original = structuredClone(cards.find((card) => card.rating === 98)!.ratingAssessment!);
  const maximum = {
    ...original,
    scores: Object.fromEntries(ratingCriteria.map((key) => [key, 99])) as typeof original.scores,
  };
  assert.equal(evaluateSeasonRating(maximum, rubric).rating, 99);
  assert.equal(evaluateSeasonRating({ ...maximum, historicalException: null }, rubric).rating, 97);
  assert.equal(evaluateSeasonRating({ ...maximum, confidence: 'editorial' }, rubric).rating, 94);
  assert.equal(evaluateSeasonRating({ ...maximum, confidence: 'limited' }, rubric).rating, 89);
  assert.equal(
    evaluateSeasonRating({ ...maximum, scores: { ...maximum.scores, historical: 89 } }, rubric)
      .rating,
    89,
  );
  assert.equal(
    evaluateSeasonRating({ ...maximum, scores: { ...maximum.scores, consistency: 90 } }, rubric)
      .ceiling,
    97,
  );
  assert.equal(
    evaluateSeasonRating(
      {
        ...maximum,
        historicalException: { ...maximum.historicalException!, sourceIds: ['unrelated'] },
      },
      rubric,
    ).ceiling,
    97,
  );
  assert.throws(
    () =>
      evaluateSeasonRating({ ...maximum, scores: { ...maximum.scores, performance: 100 } }, rubric),
    /Saisonbewertung/,
  );
  assert.throws(
    () =>
      evaluateSeasonRating(maximum, {
        ...rubric,
        weights: { ...rubric.weights, performance: 0.9 },
      }),
    /Gewichtung/,
  );
});
test('season comparisons distinguish historical peaks, young world class and short injury seasons', () => {
  const find = (id: string) => cards.find((card) => card.id === id)!;
  assert.equal(find('barcelona-2024-2025:lamine-yamal').rating, 92);
  assert.equal(find('barcelona-2010-2011:messi').rating, 98);
  assert.ok(find('barcelona-2024-2025:ter-stegen').rating < 85);
  assert.ok(find('real-madrid-2023-2024:courtois').rating < 90);
  assert.ok(find('bayern-2019-2020:neuer').rating >= 95);
  assert.ok(find('liverpool-2018-2019:van-dijk').rating >= 95);
  const model = createStrengthModel(data),
    get = (id: string) => data.teams.find((team) => team.id === id)!;
  assert.ok(
    analyzePrimeTeam(get('barcelona-2009-2010'), model, data.defaults.defaultTactic).strength
      .matchStrength >
      analyzePrimeTeam(get('inter-2024-2025'), model, data.defaults.defaultTactic).strength
        .matchStrength +
        3,
  );
  const corrupt = structuredClone(data);
  corrupt.teams[0]!.players[0]!.rating++;
  assert.match(validateDatabase(corrupt).join(' '), /season assessment/);
});
