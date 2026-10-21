import type { HistoryEntry, Score, TournamentState } from '../types/application.ts';
import { getDefaultSettings, getGameRules } from '../data/index.ts';
import { isRecord, isText, type StrengthModel } from './strength.ts';
import { isSavedTeam } from './saved-team.ts';
import { createMatchEngine } from './match.ts';
import { equalMatchResults, equalValues } from './comparison.ts';
import type { TournamentEngine } from './tournament.ts';
import { participantIdentity } from '../utils/tournament-display.ts';

export const historyLimit = getDefaultSettings().historyLimit;
const rules = getGameRules();
const matchEngine = createMatchEngine(rules);
const rounds = ['playoffs', 'round-of-16', 'quarter-finals', 'semi-finals', 'final'] as const;
const date = (value: unknown): value is string =>
  isText(value) && Number.isFinite(Date.parse(value));
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

export function historyStatistics(matches: HistoryEntry['matches']): HistoryEntry['statistics'] {
  const stats = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const { fixture } of matches) {
    const score = fixture.result.afterExtraTime ?? fixture.result.regularTime;
    const home = fixture.homeParticipantId === 'user';
    const scored = home ? score.home : score.away;
    const conceded = home ? score.away : score.home;
    stats.played++;
    stats.goalsFor += scored;
    stats.goalsAgainst += conceded;
    stats[scored > conceded ? 'wins' : scored < conceded ? 'losses' : 'draws']++;
  }
  return stats;
}

/** Copy only the user's matches and XI, rather than 35 full opponent rosters per entry. */
export function createHistoryEntry(state: TournamentState, engine: TournamentEngine): HistoryEntry {
  if (state.phase !== 'completed' || !engine.isValid(state))
    throw new Error('Nur vollständig abgeschlossene, gültige Turniere können archiviert werden.');
  const own = state.participants.find((p) => p.kind === 'user')!;
  if (own.kind !== 'user') throw new Error('Die Turnier-Elf fehlt.');
  const champion = state.participants.find((p) => p.id === state.championParticipantId)!;
  const identity = participantIdentity(champion);
  const row = state.standings.find((r) => r.participantId === state.userParticipantId)!;
  const matches: HistoryEntry['matches'] = [];
  for (const fixture of state.matches) {
    if (
      fixture.status !== 'played' ||
      (fixture.homeParticipantId !== 'user' && fixture.awayParticipantId !== 'user')
    )
      continue;
    const opponent = state.participants.find(
      (p) =>
        p.id ===
        (fixture.homeParticipantId === 'user'
          ? fixture.awayParticipantId
          : fixture.homeParticipantId),
    )!;
    const label = participantIdentity(opponent);
    matches.push({
      fixture,
      opponent: {
        id: opponent.id,
        label: `${label.name} · ${label.detail}`,
        matchStrength: opponent.matchStrength,
      },
    });
  }
  const last = matches.at(-1)!.fixture;
  return structuredClone({
    id: `history-${state.id}`,
    tournamentId: state.id,
    finishedAt: state.completedAt!,
    createdAt: state.createdAt,
    seed: state.seed,
    datasetVersion: state.datasetVersion,
    rulesVersion: state.rulesVersion,
    userTeam: own.team,
    leaguePosition: row.rank,
    leaguePoints: row.points,
    outcome: champion.id === 'user' ? 'champion' : last.phase,
    champion: { participantId: champion.id, label: `${identity.name} · ${identity.detail}` },
    matches,
    statistics: historyStatistics(matches),
  });
}

/** Revalidate stored match results from their frozen strengths, including aggregate context. */
export function isHistoryEntry(value: unknown, model: StrengthModel): value is HistoryEntry {
  try {
    if (
      !isRecord(value) ||
      !isText(value['tournamentId']) ||
      value['id'] !== `history-${value['tournamentId']}` ||
      !isText(value['seed']) ||
      !date(value['createdAt']) ||
      !date(value['finishedAt']) ||
      Date.parse(value['finishedAt']) < Date.parse(value['createdAt']) ||
      !isText(value['datasetVersion']) ||
      value['rulesVersion'] !== rules.version ||
      !isSavedTeam(value['userTeam'], model) ||
      !integer(value['leaguePosition']) ||
      value['leaguePosition'] < 1 ||
      value['leaguePosition'] > rules.tournament.totalTeams ||
      !integer(value['leaguePoints']) ||
      value['leaguePoints'] > rules.tournament.league.matchesPerTeam * 3 ||
      !isRecord(value['champion']) ||
      !isText(value['champion']['participantId']) ||
      !isText(value['champion']['label']) ||
      !Array.isArray(value['matches']) ||
      value['matches'].length < 8 ||
      value['matches'].length > 17
    )
      return false;
    const entry = value as unknown as HistoryEntry;
    const ids = new Set<string>();
    let previousRound = -1;
    const firstLegs = new Map<string, HistoryEntry['matches'][number]>();
    for (let i = 0; i < entry.matches.length; i++) {
      const item = entry.matches[i];
      if (!isRecord(item) || !isRecord(item.fixture) || !isRecord(item.opponent)) return false;
      const { fixture, opponent } = item;
      if (
        !isText(fixture.id) ||
        ids.has(fixture.id) ||
        fixture.status !== 'played' ||
        !isText(opponent.id) ||
        opponent.id === 'user' ||
        !isText(opponent.label) ||
        typeof opponent.matchStrength !== 'number' ||
        !Number.isFinite(opponent.matchStrength) ||
        !(
          (fixture.homeParticipantId === 'user' && fixture.awayParticipantId === opponent.id) ||
          (fixture.awayParticipantId === 'user' && fixture.homeParticipantId === opponent.id)
        ) ||
        !isRecord(fixture.result) ||
        !isText(fixture.result.seed)
      )
        return false;
      ids.add(fixture.id);
      const home = fixture.homeParticipantId === 'user';
      const own = { id: 'user', strength: entry.userTeam.strength.matchStrength };
      const away = { id: opponent.id, strength: opponent.matchStrength };
      let aggregateBefore: Score | undefined;
      if (i < 8) {
        if (
          fixture.phase !== 'league' ||
          fixture.roundNumber !== i + 1 ||
          fixture.leg !== null ||
          fixture.neutralVenue !== false
        )
          return false;
      } else {
        const round = rounds.indexOf(fixture.phase as (typeof rounds)[number]);
        if (
          round < 0 ||
          fixture.roundNumber !== (fixture.leg ?? 1) ||
          round < previousRound ||
          (previousRound >= 0 && round > previousRound + 1) ||
          (previousRound < 0 && round > 1)
        )
          return false;
        if (fixture.phase === 'final') {
          if (
            fixture.leg !== null ||
            fixture.neutralVenue !== true ||
            i !== entry.matches.length - 1
          )
            return false;
        } else if (fixture.leg === 1) {
          if (firstLegs.has(fixture.phase) || fixture.neutralVenue !== false) return false;
          firstLegs.set(fixture.phase, item);
        } else if (fixture.leg === 2) {
          const first = firstLegs.get(fixture.phase);
          if (
            !first ||
            first.opponent.id !== opponent.id ||
            first.fixture.homeParticipantId !== fixture.awayParticipantId ||
            fixture.neutralVenue !== false
          )
            return false;
          const score = first.fixture.result.regularTime;
          aggregateBefore = { home: score.away, away: score.home };
        } else return false;
        previousRound = round;
      }
      const expected = matchEngine.simulateMatch(home ? own : away, home ? away : own, {
        seed: fixture.result.seed,
        neutralVenue: fixture.neutralVenue,
        ...(fixture.phase === 'final' || fixture.leg === 2
          ? { mode: 'knockout' as const, ...(aggregateBefore ? { aggregateBefore } : {}) }
          : { mode: 'regular' as const }),
      });
      if (!equalMatchResults(fixture.result, expected)) return false;
      if (
        i >= 8 &&
        fixture.leg !== 1 &&
        expected.winnerParticipantId !== 'user' &&
        i !== entry.matches.length - 1
      )
        return false;
    }
    const leagueMatches = entry.matches.slice(0, 8);
    const leagueStats = historyStatistics(leagueMatches);
    if (
      leagueMatches.filter((m) => m.fixture.homeParticipantId === 'user').length !== 4 ||
      new Set(leagueMatches.map((m) => m.opponent.id)).size !== 8 ||
      entry.leaguePoints !== leagueStats.wins * 3 + leagueStats.draws
    )
      return false;
    for (const [phase] of firstLegs) {
      if (entry.matches.filter((m) => m.fixture.phase === phase).length !== 2) return false;
    }
    const last = entry.matches.at(-1)!.fixture;
    const won = last.phase === 'final' && last.result.winnerParticipantId === 'user';
    if (
      last.phase !== 'league' &&
      last.phase !== 'final' &&
      last.result.winnerParticipantId === 'user'
    )
      return false;
    return (
      (entry.leaguePosition > 24 ? entry.matches.length === 8 : entry.matches.length > 8) &&
      (entry.leaguePosition <= 8
        ? !firstLegs.has('playoffs')
        : entry.leaguePosition > 24 || firstLegs.has('playoffs')) &&
      entry.outcome === (won ? 'champion' : last.phase) &&
      (entry.champion.participantId === 'user') === won &&
      equalValues(entry.statistics, historyStatistics(entry.matches))
    );
  } catch {
    return false;
  }
}

export function appendHistory(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  if (entries.some((saved) => saved.tournamentId === entry.tournamentId)) return entries;
  return structuredClone(
    [...entries, entry]
      .toSorted(
        (a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt) || a.id.localeCompare(b.id),
      )
      .slice(0, historyLimit),
  );
}
