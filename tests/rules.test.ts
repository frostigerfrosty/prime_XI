import test from 'node:test';
import assert from 'node:assert/strict';
import { getGameRules } from '../src/data/index.ts';
import type { GameRules } from '../src/types/database.ts';
import { validateRules } from '../scripts/validate-rules.mjs';

test('central rules define a feasible 36-team league and knockout progression', () => {
  const rules = getGameRules();
  assert.deepEqual(validateRules(rules), []);
  assert.equal(rules.tournament.totalTeams * rules.tournament.league.matchesPerTeam / 2, 144);
  const rounds = rules.tournament.knockout.rounds;
  assert.deepEqual(rounds.map((round) => round.teams), [16, 16, 8, 4, 2]);
  assert.deepEqual(rounds.map((round) => round.legs), [2, 2, 2, 2, 1]);
  assert.equal(rules.builder.coachConsumesPlayerPick, false);
});

const corruptions: [string, (rules: GameRules) => void, RegExp][] = [
  ['non-normalized weights', (r) => { r.strength.positionGroupWeights.attack = 0.8; }, /weights must sum/],
  ['overlapping qualification ranks', (r) => { r.tournament.league.playoffRanks[0] = 8; }, /without overlap/],
  ['wrong playoff field', (r) => { r.tournament.knockout.rounds[0]!.teams = 12; }, /playoff participants/],
  ['inconsistent home and away counts', (r) => { r.tournament.league.homeMatches = 5; }, /home\/away/],
  ['too many bonuses', (r) => { r.strength.bonusCaps.coach = 30; }, /dominate player quality/],
  ['wrong expected-goals bounds', (r) => { r.match.expectedGoalsMax = 0.1; }, /expected-goals bounds/],
  ['colliding save keys', (r) => { r.storage.keys.currentTeam = r.storage.keys.currentTournament; }, /storage keys/],
  ['advantage for a secondary position', (r) => { r.strength.positionFit.secondaryMultiplier = 1.1; }, /secondary fit/],
];
for (const [name, corrupt, expected] of corruptions) {
  test(`rejects ${name}`, () => {
    const rules = getGameRules(); corrupt(rules);
    assert.match(validateRules(rules).join('\n'), expected);
  });
}
