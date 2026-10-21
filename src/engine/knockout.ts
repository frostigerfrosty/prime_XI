import type { GameRules } from '../types/database.ts';
import type {
  KnockoutTie,
  ScheduledMatch,
  TournamentRound,
  TournamentState,
} from '../types/application.ts';
import { createMatchEngine } from './match.ts';
import { seededRandom, shuffled } from './random.ts';
import { equalMatchResults, equalValues } from './comparison.ts';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const roundIds: TournamentRound[] = [
  'playoffs',
  'round-of-16',
  'quarter-finals',
  'semi-finals',
  'final',
];

/** Pure bracket transitions. The tournament controller validates the participants and league. */
export function createKnockoutEngine(input: GameRules) {
  const rules = structuredClone(input),
    config = rules.tournament.knockout;
  const engine = createMatchEngine(rules);
  const league = rules.tournament.league;
  check(
    typeof config.engineVersion === 'string' &&
      config.engineVersion.length > 0 &&
      config.drawPolicy === 'seeded-playoffs-open-redraw' &&
      !config.awayGoalsRule &&
      config.resolveDraw === 'extra-time-then-penalties' &&
      config.finalNeutralVenue &&
      config.rounds.length === roundIds.length &&
      config.rounds.every(
        (round, i) =>
          round.id === roundIds[i] &&
          Number.isInteger(round.teams) &&
          round.teams >= 2 &&
          round.teams % 2 === 0 &&
          round.legs === (round.id === 'final' ? 1 : 2),
      ) &&
      config.rounds[0]!.teams === league.playoffRanks[1] - league.playoffRanks[0] + 1 &&
      config.rounds[1]!.teams ===
        league.directQualificationRanks[1] -
          league.directQualificationRanks[0] +
          1 +
          config.rounds[0]!.teams / 2 &&
      config.rounds.slice(2).every((round, i) => round.teams * 2 === config.rounds[i + 1]!.teams) &&
      config.rounds.at(-1)!.teams === 2,
    'Ungültige K.-o.-Konfiguration.',
  );

  function progress(state: TournamentState) {
    const index = roundIds.indexOf(state.phase as TournamentRound);
    const matches = state.matches.filter((m) => m.phase === state.phase && m.phase !== 'league');
    const roundComplete = matches.length > 0 && matches.every((m) => m.status === 'played');
    const leagueComplete = state.matches
      .filter((m) => m.phase === 'league')
      .every((m) => m.status === 'played');
    const nextRound =
      state.phase === 'league'
        ? leagueComplete
          ? roundIds[0]!
          : null
        : roundComplete && index >= 0
          ? (roundIds[index + 1] ?? null)
          : null;
    const firstPending = matches.find((m) => m.status === 'scheduled');
    return {
      started: index >= 0 || state.phase === 'completed',
      complete: state.phase === 'completed',
      round: index >= 0 ? roundIds[index]! : null,
      roundComplete,
      nextRound,
      nextLeg: firstPending ? (firstPending.leg ?? 1) : null,
      token: `${state.phase}:${state.knockoutTies.length}:${state.matches.filter((m) => m.status === 'played').length}`,
    };
  }
  function draw(state: TournamentState): TournamentState {
    const round = progress(state).nextRound;
    check(round, 'Die aktuelle Runde muss zuerst vollständig gespielt werden.');
    const format = config.rounds.find((r) => r.id === round)!;
    const random = seededRandom(
      JSON.stringify(['knockout-draw', config.engineVersion, state.seed, round]),
    );
    let pairs: [string, string][];
    if (round === 'playoffs' || round === 'round-of-16') {
      let seeded: string[], opponents: string[];
      if (round === 'playoffs') {
        const qualified = state.standings
          .filter((r) => r.rank >= league.playoffRanks[0] && r.rank <= league.playoffRanks[1])
          .map((r) => r.participantId);
        seeded = qualified.slice(0, qualified.length / 2);
        opponents = qualified.slice(qualified.length / 2);
      } else {
        seeded = state.standings
          .filter(
            (r) =>
              r.rank >= league.directQualificationRanks[0] &&
              r.rank <= league.directQualificationRanks[1],
          )
          .map((r) => r.participantId);
        opponents = state.knockoutTies
          .filter((tie) => tie.round === 'playoffs')
          .map((tie) => {
            check(tie.winnerParticipantId, 'Es fehlen Playoff-Sieger.');
            return tie.winnerParticipantId;
          });
      }
      check(
        seeded.length === opponents.length && seeded.length * 2 === format.teams,
        'Die Qualifikanten passen nicht zur nächsten Runde.',
      );
      opponents = shuffled(opponents, random);
      pairs = seeded.map((id, i) => [id, opponents[i]!]);
    } else {
      const previous = roundIds[roundIds.indexOf(round) - 1]!;
      const winners = state.knockoutTies
        .filter((tie) => tie.round === previous)
        .map((tie) => {
          check(tie.winnerParticipantId, 'Die vorherige Runde ist noch nicht entschieden.');
          return tie.winnerParticipantId;
        });
      check(winners.length === format.teams, 'Es fehlen Qualifikanten für die Auslosung.');
      const pool = shuffled(winners, random);
      pairs = Array.from({ length: pool.length / 2 }, (_, i) => [pool[2 * i]!, pool[2 * i + 1]!]);
    }
    const ids = pairs.flat();
    check(
      new Set(ids).size === ids.length &&
        ids.every((id) => state.participants.some((p) => p.id === id)),
      'Ungültige K.-o.-Teilnehmer.',
    );
    const ties: KnockoutTie[] = pairs.map(([teamAId, teamBId], i) => ({
      id: `ko-${round}-${i + 1}`,
      round,
      teamAId,
      teamBId,
      matchIds: [],
      aggregateGoals: { teamA: 0, teamB: 0 },
      winnerParticipantId: null,
    }));
    const matches: ScheduledMatch[] = [];
    for (let leg = 1; leg <= format.legs; leg++)
      for (const tie of ties) {
        const id = `${tie.id}-leg-${leg}`;
        tie.matchIds.push(id);
        matches.push({
          id,
          phase: round,
          roundNumber: leg,
          leg: format.legs === 1 ? null : (leg as 1 | 2),
          homeParticipantId: format.legs === 1 || leg === 2 ? tie.teamAId : tie.teamBId,
          awayParticipantId: format.legs === 1 || leg === 2 ? tie.teamBId : tie.teamAId,
          neutralVenue: format.legs === 1 && config.finalNeutralVenue,
          status: 'scheduled',
          result: null,
        });
      }
    return {
      ...structuredClone(state),
      rulesVersion: rules.version,
      knockoutVersion: config.engineVersion,
      phase: round,
      matches: [...structuredClone(state.matches), ...matches],
      knockoutTies: [...structuredClone(state.knockoutTies), ...ties],
    };
  }
  function step(state: TournamentState, now: string): TournamentState {
    const info = progress(state);
    check(info.round && info.nextLeg !== null, 'Für diese Runde sind keine Spiele mehr offen.');
    const next = structuredClone(state);
    const ties = next.knockoutTies.filter((tie) => tie.round === info.round);
    for (const tie of ties) {
      const matchId = tie.matchIds[info.nextLeg - 1]!;
      const matchIndex = next.matches.findIndex((m) => m.id === matchId),
        match = next.matches[matchIndex]!;
      check(match.status === 'scheduled', 'Dieses Spiel wurde bereits gespielt.');
      const h = next.participants.find((p) => p.id === match.homeParticipantId)!,
        a = next.participants.find((p) => p.id === match.awayParticipantId)!;
      const context = {
        seed: `knockout:${Math.floor(seededRandom(JSON.stringify([config.engineVersion, state.seed, match.id, h.id, a.id]))() * 0x100000000).toString(16)}`,
        neutralVenue: match.neutralVenue,
      };
      const deciding = tie.matchIds.length === 1 || info.nextLeg === 2;
      const aggregateBefore =
        match.homeParticipantId === tie.teamAId
          ? { home: tie.aggregateGoals.teamA, away: tie.aggregateGoals.teamB }
          : { home: tie.aggregateGoals.teamB, away: tie.aggregateGoals.teamA };
      const result = engine.simulateMatch(
        { id: h.id, strength: h.matchStrength },
        { id: a.id, strength: a.matchStrength },
        deciding
          ? { ...context, mode: 'knockout', aggregateBefore }
          : { ...context, mode: 'regular' },
      );
      next.matches[matchIndex] = { ...match, status: 'played', result };
      const score = result.afterExtraTime ?? result.regularTime;
      tie.aggregateGoals.teamA += match.homeParticipantId === tie.teamAId ? score.home : score.away;
      tie.aggregateGoals.teamB += match.homeParticipantId === tie.teamBId ? score.home : score.away;
      if (deciding) {
        check(result.winnerParticipantId, 'Die K.-o.-Paarung hat keinen Sieger.');
        tie.winnerParticipantId = result.winnerParticipantId;
      }
    }
    if (info.round === 'final') {
      check(
        Number.isFinite(Date.parse(now)) && Date.parse(now) >= Date.parse(state.createdAt),
        'Ungültiger Abschlusszeitpunkt.',
      );
      next.phase = 'completed';
      next.completedAt = new Date(now).toISOString();
      next.championParticipantId = ties[0]!.winnerParticipantId;
    }
    return next;
  }
  function finish(state: TournamentState, now: string): TournamentState {
    check(state.phase !== 'completed', 'Das Turnier ist bereits beendet.');
    let next = structuredClone(state);
    for (let index = 0; index < config.rounds.length * 3; index++) {
      const info = progress(next);
      if (info.complete) return next;
      next = info.nextRound ? draw(next) : step(next, now);
    }
    throw new Error('Das Turnier konnte nicht vollständig aufgelöst werden.');
  }
  function isValidProgress(state: TournamentState): boolean {
    try {
      const leagueMatches = state.matches.filter((m) => m.phase === 'league');
      if (state.phase === 'league')
        return (
          state.matches.length === leagueMatches.length &&
          state.knockoutTies.length === 0 &&
          state.championParticipantId === null &&
          state.completedAt === null
        );
      if (leagueMatches.some((m) => m.status !== 'played')) return false;
      if (
        state.phase !== 'completed' &&
        (state.completedAt !== null || state.championParticipantId !== null)
      )
        return false;
      if (
        state.phase === 'completed' &&
        (!state.completedAt ||
          !Number.isFinite(Date.parse(state.completedAt)) ||
          Date.parse(state.completedAt) < Date.parse(state.createdAt))
      )
        return false;
      let expected: TournamentState = {
        ...state,
        phase: 'league',
        matches: leagueMatches,
        knockoutTies: [],
        completedAt: null,
        championParticipantId: null,
      };
      for (const round of config.rounds) {
        const actualTies = state.knockoutTies.filter((tie) => tie.round === round.id);
        if (!actualTies.length) break;
        expected = draw(expected);
        const actualMatches = state.matches.filter((m) => m.phase === round.id);
        const played = actualMatches.filter((m) => m.status === 'played').length;
        const batchSize = round.teams / 2;
        if (played % batchSize !== 0 || played > batchSize * round.legs) return false;
        for (let leg = 0; leg < played / batchSize; leg++)
          expected = step(expected, state.completedAt ?? state.createdAt);
        if (played !== batchSize * round.legs) break;
      }
      if (
        expected.phase !== state.phase ||
        expected.championParticipantId !== state.championParticipantId ||
        expected.completedAt !== state.completedAt ||
        !equalValues(expected.knockoutTies, state.knockoutTies) ||
        expected.matches.length !== state.matches.length
      )
        return false;
      return expected.matches.every((match, i) => {
        const actual = state.matches[i]!;
        const { result: a, ...am } = actual,
          { result: b, ...bm } = match;
        return (
          equalValues(am, bm) &&
          (match.status === 'scheduled' ? a === null : equalMatchResults(a, b))
        );
      });
    } catch {
      return false;
    }
  }
  return { progress, draw, step, finish, isValidProgress, version: config.engineVersion };
}
