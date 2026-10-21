/** Relational constraints for already schema-validated game data. No simulation here. */
export function validateRules(rules) {
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(`Rules: ${message}`); };
  const close = (a, b) => Math.abs(a - b) < 1e-10;
  const { builder, strength, coach, match, tournament, storage } = rules;
  const league = tournament.league;
  assert(close(Object.values(strength.positionGroupWeights).reduce((a, b) => a + b, 0), 1), 'position group weights must sum to 1');
  assert(close(coach.formationShare + coach.styleShare, 1), 'coach shares must sum to 1');
  assert(strength.positionFit.secondaryMultiplier < strength.positionFit.primaryMultiplier, 'secondary fit must be lower than primary fit');
  assert(strength.naturalCaptainBonus <= strength.bonusCaps.captain, 'captain bonus exceeds its cap');
  assert(Object.values(strength.bonusCaps).reduce((a, b) => a + b, 0) <= 20, 'combined bonus caps may not dominate player quality');
  assert(builder.playersRequired <= builder.drawSize * builder.maxPlayersPerPrimeTeam, 'not enough player picks in a draft');
  assert(tournament.userTeams + tournament.opponentTeams === tournament.totalTeams, 'participant totals disagree');
  assert(league.homeMatches + league.awayMatches === league.matchesPerTeam, 'home/away counts disagree');
  assert(tournament.totalTeams % 2 === 0 && league.matchesPerTeam % 2 === 0 && league.homeMatches === league.awayMatches,
    'league scheduling needs even participants and balanced home/away rounds');
  assert(league.matchesPerTeam < tournament.totalTeams, 'not enough distinct league opponents');
  assert((league.matchesPerTeam * tournament.totalTeams) % 2 === 0, 'league schedule has a fractional match count');
  assert(league.winPoints > league.drawPoints && league.drawPoints >= league.lossPoints, 'invalid points ordering');
  const [directFirst, directLast] = league.directQualificationRanks;
  const [playoffFirst, playoffLast] = league.playoffRanks;
  const [outFirst, outLast] = league.eliminatedRanks;
  assert(directFirst === 1 && playoffFirst === directLast + 1 && outFirst === playoffLast + 1 && outLast === tournament.totalTeams,
    'qualification ranges must cover every rank without overlap');
  const rounds = tournament.knockout.rounds;
  assert(tournament.knockout.drawPolicy === 'seeded-playoffs-open-redraw' && !tournament.knockout.awayGoalsRule,
    'unknown knockout draw policy or away-goals rule');
  const playoffTeams = playoffLast - playoffFirst + 1;
  assert(rounds[0]?.teams === playoffTeams && playoffTeams % 2 === 0, 'playoff participants disagree with league ranks');
  assert(rounds[1]?.teams === directLast + playoffTeams / 2, 'round-of-16 participants do not follow from playoffs');
  for (let index = 2; index < rounds.length; index++) {
    assert(rounds[index].teams * 2 === rounds[index - 1].teams, 'knockout rounds must halve the field');
  }
  assert(rounds.at(-1)?.teams === 2 && rounds.at(-1)?.legs === 1, 'a final requires two teams and one leg');
  assert(new Set(rounds.map((round) => round.id)).size === rounds.length, 'duplicate knockout round');
  assert(match.expectedGoalsMin > 0 && match.expectedGoalsMin <= match.baseExpectedGoals && match.baseExpectedGoals <= match.expectedGoalsMax,
    'invalid expected-goals bounds');
  assert(match.expectedGoalsMax <= 10 && match.strengthSensitivity >= 0 && match.strengthSensitivity <= 1,
    'invalid Poisson parameters');
  assert(match.matchVarianceFraction >= 0 && match.matchVarianceFraction <= 0.3 && match.neutralVenueHomeAdvantage === 0,
    'invalid match variance or neutral advantage');
  assert(match.penaltyConversionProbability >= 0.5 && match.penaltyConversionProbability <= 0.9,
    'invalid penalty conversion probability');
  assert(new Set(Object.values(storage.keys)).size === Object.keys(storage.keys).length, 'storage keys must be distinct');
  assert(new Set(league.tiebreakers).size === league.tiebreakers.length && league.tiebreakers[0] === 'points' && league.tiebreakers.at(-1) === 'teamId',
    'table ordering needs points first and a stable final tie-breaker');
  return errors;
}
