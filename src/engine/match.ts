import type { GameRules } from '../types/database.ts';
import type { MatchResult, Score, ShootoutKick } from '../types/application.ts';
import { seededRandom } from './random.ts';

export interface MatchTeam {
  id: string;
  strength: number;
}

export type MatchContext = { seed: string; neutralVenue: boolean } & (
  | { mode: 'regular'; aggregateBefore?: never }
  | {
      mode: 'knockout';
      /** Prior legs, oriented to THIS match's home/away teams. */ aggregateBefore?: Score;
    }
);

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const finite = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;
const text = (value: string) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const score = (value: Score) =>
  value && [value.home, value.away].every((n) => Number.isSafeInteger(n) && finite(n, 0, 10_000));
const plus = (a: Score, b: Score): Score => ({ home: a.home + b.home, away: a.away + b.away });

/** Inverse CDF: one draw, no goal cap, bounded numerical work for the supported means. */
export function samplePoisson(mean: number, random: () => number): number {
  check(finite(mean, 0, 10), 'Ungültiger Poisson-Mittelwert.');
  const draw = random();
  check(finite(draw, 0, 1) && draw < 1, 'Ungültiger Zufallswert.');
  let probability = Math.exp(-mean);
  let cumulative = probability;
  for (let goals = 0; goals < 128; goals++) {
    if (draw <= cumulative) return goals;
    probability *= mean / (goals + 1);
    cumulative += probability;
  }
  throw new Error('Poisson-Verteilung konnte numerisch nicht aufgelöst werden.');
}

/** Equal conversion odds: strength already acts through 90/120 minutes. */
export function simulateShootout(seed: string, conversionProbability = 0.76, initialKicks = 5) {
  check(
    typeof seed === 'string' &&
      seed.trim().length > 0 &&
      seed.length <= 4096 &&
      finite(conversionProbability, 0.5, 0.9) &&
      initialKicks === 5,
    'Ungültige Elfmetereinstellungen.',
  );
  const random = seededRandom(seed);
  const result: Score = { home: 0, away: 0 };
  const kicks: ShootoutKick[] = [];
  const taken: Score = { home: 0, away: 0 };
  function kick(side: 'home' | 'away', round: number, scored: boolean) {
    taken[side]++;
    if (scored) result[side]++;
    kicks.push({ side, round, scored });
  }
  const clinched = () =>
    result.home > result.away + initialKicks - taken.away ||
    result.away > result.home + initialKicks - taken.home;
  for (let round = 1; round <= initialKicks; round++) {
    kick('home', round, random() < conversionProbability);
    if (clinched()) return { score: result, kicks };
    kick('away', round, random() < conversionProbability);
    if (clinched()) return { score: result, kicks };
  }
  if (result.home !== result.away) return { score: result, kicks };

  // Sample tied pairs geometrically, then a deciding pair. Same distribution as
  // repeated kicks, without an unbounded loop or an arbitrary coin-flip cutoff.
  const tiedPairProbability = conversionProbability ** 2 + (1 - conversionProbability) ** 2;
  const tiedPairs = Math.floor(Math.log1p(-random()) / Math.log(tiedPairProbability));
  for (let index = 0; index < tiedPairs; index++) {
    const bothScore = random() < conversionProbability ** 2 / tiedPairProbability;
    kick('home', initialKicks + index + 1, bothScore);
    kick('away', initialKicks + index + 1, bothScore);
  }
  const homeScores = random() < 0.5;
  kick('home', initialKicks + tiedPairs + 1, homeScores);
  kick('away', initialKicks + tiedPairs + 1, !homeScores);
  return { score: result, kicks };
}

/** Pure simulation; no catalog access, browser state, clock or unseeded randomness. */
export function createMatchEngine(input: GameRules) {
  const rules = structuredClone(input);
  const config = rules.match;
  const maximumStrength =
    rules.strength.ratingMax +
    Object.values(rules.strength.bonusCaps).reduce((sum, value) => sum + value, 0);
  check(
    text(config.engineVersion) &&
      config.distribution === 'poisson' &&
      config.seedSupported === true &&
      finite(maximumStrength, 1, 200) &&
      finite(config.baseExpectedGoals, 0.01, 10) &&
      finite(config.strengthSensitivity, 0, 1) &&
      finite(config.homeAdvantageRating, 0, 10) &&
      config.neutralVenueHomeAdvantage === 0 &&
      finite(config.matchVarianceFraction, 0, 0.3) &&
      finite(config.expectedGoalsMin, 0.01, config.baseExpectedGoals) &&
      finite(config.expectedGoalsMax, config.baseExpectedGoals, 10) &&
      config.regularMinutes === 90 &&
      config.extraTimeMinutes === 30 &&
      config.penaltiesInitialKicks === 5 &&
      config.penaltiesSuddenDeath === true &&
      finite(config.penaltyConversionProbability, 0.5, 0.9),
    'Ungültige Matchregeln.',
  );

  function validate(home: MatchTeam, away: MatchTeam, context: MatchContext) {
    check(
      home &&
        away &&
        text(home.id) &&
        text(away.id) &&
        home.id !== away.id &&
        finite(home.strength, 0, maximumStrength) &&
        finite(away.strength, 0, maximumStrength),
      'Zwei verschiedene Teilnehmer mit gültiger Matchstärke werden benötigt.',
    );
    check(
      context &&
        text(context.seed) &&
        typeof context.neutralVenue === 'boolean' &&
        (context.mode === 'regular' || context.mode === 'knockout'),
      'Ungültiger Spielkontext.',
    );
    check(
      context.aggregateBefore === undefined ||
        (context.mode === 'knockout' && score(context.aggregateBefore)),
      'Ungültiges Hinspielergebnis.',
    );
  }
  const stream = (seed: string, label: string) =>
    seededRandom(JSON.stringify([config.engineVersion, seed, label]));

  function expectedGoals(home: MatchTeam, away: MatchTeam, context: MatchContext): Score {
    validate(home, away, context);
    const difference =
      home.strength -
      away.strength +
      (context.neutralVenue ? config.neutralVenueHomeAdvantage : config.homeAdvantageRating);
    const mean = (side: 'home' | 'away', sign: number) => {
      const variance =
        1 + (stream(context.seed, `variance-${side}`)() * 2 - 1) * config.matchVarianceFraction;
      return Math.min(
        config.expectedGoalsMax,
        Math.max(
          config.expectedGoalsMin,
          config.baseExpectedGoals *
            Math.exp(sign * config.strengthSensitivity * difference) *
            variance,
        ),
      );
    };
    return { home: mean('home', 1), away: mean('away', -1) };
  }

  function simulateMatch(home: MatchTeam, away: MatchTeam, context: MatchContext): MatchResult {
    const means = expectedGoals(home, away, context);
    const sample = (label: string, expected: Score): Score => ({
      home: samplePoisson(expected.home, stream(context.seed, `${label}-home`)),
      away: samplePoisson(expected.away, stream(context.seed, `${label}-away`)),
    });
    const winner = (goals: Score) =>
      goals.home === goals.away ? null : goals.home > goals.away ? home.id : away.id;
    const regularTime = sample('regular', means);
    const prior = context.aggregateBefore ?? { home: 0, away: 0 };
    const result: MatchResult = {
      engineVersion: config.engineVersion,
      regularTime,
      afterExtraTime: null,
      penalties: null,
      shootoutKicks: [],
      winnerParticipantId: winner(
        context.mode === 'knockout' ? plus(prior, regularTime) : regularTime,
      ),
      decidedBy: 'regular-time',
      expectedGoals: means,
      extraTimeExpectedGoals: null,
      aggregateScore: context.mode === 'knockout' ? plus(prior, regularTime) : null,
      seed: context.seed,
    };
    if (context.mode === 'regular') {
      if (!result.winnerParticipantId) result.decidedBy = 'draw';
      return result;
    }
    if (result.winnerParticipantId) return result;
    const ratio = config.extraTimeMinutes / config.regularMinutes;
    result.extraTimeExpectedGoals = { home: means.home * ratio, away: means.away * ratio };
    result.afterExtraTime = plus(regularTime, sample('extra', result.extraTimeExpectedGoals));
    result.aggregateScore = plus(prior, result.afterExtraTime);
    result.winnerParticipantId = winner(result.aggregateScore);
    result.decidedBy = 'extra-time';
    if (result.winnerParticipantId) return result;
    const shootout = simulateShootout(
      JSON.stringify([config.engineVersion, context.seed, 'penalties']),
      config.penaltyConversionProbability,
      config.penaltiesInitialKicks,
    );
    result.penalties = shootout.score;
    result.shootoutKicks = shootout.kicks;
    result.winnerParticipantId = winner(shootout.score);
    result.decidedBy = 'penalties';
    return result;
  }
  return { simulateMatch, expectedGoals, engineVersion: config.engineVersion, maximumStrength };
}
