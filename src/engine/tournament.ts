import type {
  SavedTeam,
  ScheduledMatch,
  TournamentParticipant,
  TournamentState,
} from '../types/application.ts';
import type { GameRules, PrimeTeam } from '../types/database.ts';
import { isRecord, isText, type StrengthModel } from './strength.ts';
import { isSavedTeam } from './saved-team.ts';
import { createMatchEngine } from './match.ts';
import { primeMatchTeam } from './match-team.ts';
import { seededRandom, shuffled } from './random.ts';
import { calculateLeagueTable, createLeagueSchedule, leagueQualification } from './league.ts';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const date = (value: unknown): value is string =>
  isText(value) && Number.isFinite(Date.parse(value));
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isText) &&
  new Set(value).size === value.length;
/** Structural comparison, independent of JSON key order. xG may differ by one platform ULP. */
function equal(a: unknown, b: unknown, tolerant = false): boolean {
  if (a === b) return true;
  if (tolerant && typeof a === 'number' && typeof b === 'number')
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-10;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => equal(item, b[i], tolerant));
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a).sort();
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key], tolerant))
  );
}

/** Stateful UI uses immutable outputs from this browser-independent league controller. */
export function createTournamentEngine(input: {
  teams: PrimeTeam[];
  rules: GameRules;
  strengthModel: StrengthModel;
  datasetVersion: string;
  defaultTactic: string;
}) {
  const rules = structuredClone(input.rules),
    catalog = structuredClone(input.teams);
  const model = { ...input.strengthModel, rules: structuredClone(input.strengthModel.rules) },
    config = rules.tournament,
    league = config.league;
  const matchEngine = createMatchEngine(rules);
  const { datasetVersion, defaultTactic } = input;
  check(
    isText(config.engineVersion) &&
      isText(datasetVersion) &&
      isText(defaultTactic) &&
      Number.isInteger(config.totalTeams) &&
      Number.isInteger(config.opponentTeams) &&
      config.totalTeams >= 4 &&
      config.userTeams === 1 &&
      config.totalTeams === config.opponentTeams + 1 &&
      config.uniquePrimeTeamIds &&
      config.differentSeasonsOfSameClubAllowed &&
      model.rulesVersion === rules.strength.modelVersion,
    'Ungültige Turnierkonfiguration.',
  );
  // Validate the configured format before any real tournament is started.
  createLeagueSchedule(
    Array.from({ length: config.totalTeams }, (_, i) => `test-${i}`),
    'format-check',
    league,
  );
  check(
    league.directQualificationRanks[0] === 1 &&
      league.playoffRanks[0] === league.directQualificationRanks[1] + 1 &&
      league.eliminatedRanks[0] === league.playoffRanks[1] + 1 &&
      league.eliminatedRanks[1] === config.totalTeams,
    'Ungültige Qualifikationsplätze.',
  );
  calculateLeagueTable(['validation-a', 'validation-b'], [], league);

  function validPrime(value: unknown): value is PrimeTeam {
    if (
      !isRecord(value) ||
      !['id', 'clubId', 'clubName', 'season', 'logo'].every((key) => isText(value[key])) ||
      (value['id'] as string).length > 180 ||
      !Number.isInteger(value['year']) ||
      !['editorial_draft', 'research_pending', 'reviewed'].includes(value['status'] as string) ||
      value['rosterScope'] !== 'curated_squad' ||
      !['pending', 'verified'].includes(value['verificationStatus'] as string) ||
      !strings(value['sourceIds']) ||
      !Array.isArray(value['players']) ||
      value['players'].length !== 18 ||
      !value['players'].every(
        (player) =>
          model.isPlayer(player) &&
          player.primeTeamId === value['id'] &&
          player.season === value['season'],
      ) ||
      new Set(value['players'].map((p) => (p as { id: string }).id)).size !== 18 ||
      new Set(value['players'].map((p) => (p as { personId: string }).personId)).size !== 18 ||
      !model.isCoach(value['coach']) ||
      value['coach'].primeTeamId !== value['id'] ||
      !Array.isArray(value['defaultLineup']) ||
      value['defaultLineup'].length !== 11 ||
      !value['defaultLineup'].every(
        (pick) => isRecord(pick) && isText(pick['slotId']) && isText(pick['playerId']),
      ) ||
      !(
        value['captainPersonId'] === null ||
        value['players'].some(
          (p) => (p as { personId: string }).personId === value['captainPersonId'],
        )
      ) ||
      typeof value['teamRating'] !== 'number' ||
      !Number.isFinite(value['teamRating'])
    )
      return false;
    const team = value as unknown as PrimeTeam;
    const selected = team.defaultLineup.map((pick) =>
      team.players.find((player) => player.id === pick.playerId),
    );
    if (selected.some((player) => !player)) return false;
    const average =
      Math.round((selected.reduce((sum, player) => sum + player!.rating, 0) / 11) * 10) / 10;
    return Math.abs(team.teamRating! - average) < 1e-9;
  }
  const catalogIds = new Set(catalog.map((team) => team.id));
  check(
    catalogIds.size === catalog.length &&
      catalog.length >= config.opponentTeams &&
      catalog.every(validPrime),
    'Der Turnierkatalog enthält zu wenige oder ungültige Gegner.',
  );
  for (const team of catalog) primeMatchTeam(team, model, defaultTactic);

  function progress(state: TournamentState) {
    const completedRounds =
      state.matches.filter((match) => match.status === 'played').length / (config.totalTeams / 2);
    return {
      completedRounds,
      totalRounds: league.matchesPerTeam,
      complete: completedRounds === league.matchesPerTeam,
      nextRound: completedRounds < league.matchesPerTeam ? completedRounds + 1 : null,
    };
  }
  const tournamentId = (seed: string, now: string) =>
    `tournament-${new Date(now).toISOString()}-${Math.floor(seededRandom(seed)() * 0x100000000).toString(16)}`;
  function start(team: SavedTeam, seed: string, now: string): TournamentState {
    check(isSavedTeam(team, model), 'Speichere zuerst eine vollständige, gültige Elf.');
    check(
      isText(seed) && seed.trim().length > 0 && date(now),
      'Ungültiger Turniercode oder Startzeitpunkt.',
    );
    const opponents = shuffled(
      catalog,
      seededRandom(JSON.stringify([config.engineVersion, seed, 'opponents'])),
    ).slice(0, config.opponentTeams);
    const participants: TournamentParticipant[] = [
      {
        id: 'user',
        kind: 'user',
        team: structuredClone(team),
        matchStrength: team.strength.matchStrength,
      },
      ...opponents.map((opponent): TournamentParticipant => ({
        id: `prime:${opponent.id}`,
        kind: 'prime',
        team: structuredClone(opponent),
        matchStrength: primeMatchTeam(opponent, model, defaultTactic).strength,
      })),
    ];
    const ids = participants.map((p) => p.id);
    return {
      id: tournamentId(seed, now),
      seed,
      createdAt: new Date(now).toISOString(),
      datasetVersion,
      rulesVersion: rules.version,
      leagueVersion: config.engineVersion,
      matchEngineVersion: rules.match.engineVersion,
      opponentTacticId: defaultTactic,
      completedAt: null,
      phase: 'league',
      userParticipantId: 'user',
      participants,
      matches: createLeagueSchedule(ids, seed, league),
      standings: calculateLeagueTable(ids, [], league),
      knockoutTies: [],
      championParticipantId: null,
    };
  }
  function simulate(state: TournamentState, match: ScheduledMatch) {
    const h = state.participants.find((p) => p.id === match.homeParticipantId)!;
    const a = state.participants.find((p) => p.id === match.awayParticipantId)!;
    return matchEngine.simulateMatch(
      { id: h.id, strength: h.matchStrength },
      { id: a.id, strength: a.matchStrength },
      {
        seed: `league:${Math.floor(seededRandom(JSON.stringify([state.seed, match.id, h.id, a.id]))() * 0x100000000).toString(16)}`,
        mode: 'regular',
        neutralVenue: false,
      },
    );
  }
  function isValid(value: unknown): value is TournamentState {
    try {
      if (
        !isRecord(value) ||
        !isText(value['seed']) ||
        !date(value['createdAt']) ||
        !isText(value['datasetVersion']) ||
        value['id'] !== tournamentId(value['seed'], value['createdAt']) ||
        value['rulesVersion'] !== rules.version ||
        value['leagueVersion'] !== config.engineVersion ||
        value['matchEngineVersion'] !== rules.match.engineVersion ||
        !isText(value['opponentTacticId']) ||
        value['phase'] !== 'league' ||
        value['completedAt'] !== null ||
        value['championParticipantId'] !== null ||
        value['userParticipantId'] !== 'user' ||
        !Array.isArray(value['knockoutTies']) ||
        value['knockoutTies'].length !== 0 ||
        !Array.isArray(value['participants']) ||
        value['participants'].length !== config.totalTeams ||
        !Array.isArray(value['matches']) ||
        value['matches'].length !== (config.totalTeams * league.matchesPerTeam) / 2
      )
        return false;
      const participants = value['participants'];
      if (participants.filter((p) => isRecord(p) && p['kind'] === 'user').length !== 1)
        return false;
      for (const p of participants) {
        if (
          !isRecord(p) ||
          !isText(p['id']) ||
          typeof p['matchStrength'] !== 'number' ||
          !Number.isFinite(p['matchStrength'])
        )
          return false;
        if (p['kind'] === 'user') {
          if (
            p['id'] !== 'user' ||
            !isSavedTeam(p['team'], model) ||
            p['matchStrength'] !== p['team'].strength.matchStrength
          )
            return false;
        } else if (p['kind'] === 'prime') {
          if (
            !validPrime(p['team']) ||
            p['id'] !== `prime:${p['team'].id}` ||
            p['matchStrength'] !==
              primeMatchTeam(p['team'], model, value['opponentTacticId']).strength
          )
            return false;
        } else return false;
      }
      const ids = participants.map((p) => (p as TournamentParticipant).id);
      if (new Set(ids).size !== ids.length) return false;
      const state = value as unknown as TournamentState;
      const schedule = createLeagueSchedule(ids, state.seed, league);
      const playedCount = state.matches.filter((match) => match.status === 'played').length;
      if (playedCount % (config.totalTeams / 2) !== 0) return false;
      for (let index = 0; index < schedule.length; index++) {
        const expected = schedule[index]!,
          actual = state.matches[index];
        if (!isRecord(actual)) return false;
        const { status: _status, result: _result, ...metadata } = actual;
        const { status: _s, result: _r, ...expectedMetadata } = expected;
        if (!equal(metadata, expectedMetadata)) return false;
        if (index < playedCount) {
          if (
            actual['status'] !== 'played' ||
            !equal(actual['result'], simulate(state, expected), true)
          )
            return false;
        } else if (actual['status'] !== 'scheduled' || actual['result'] !== null) return false;
      }
      return equal(state.standings, calculateLeagueTable(ids, state.matches, league));
    } catch {
      return false;
    }
  }
  function advance(state: TournamentState, all = false): TournamentState {
    check(isValid(state), 'Der Turnierstand ist beschädigt oder verwendet andere Spielregeln.');
    const nextRound = progress(state).nextRound;
    check(nextRound !== null, 'Die Ligaphase ist bereits beendet.');
    const next = structuredClone(state);
    next.matches = next.matches.map((match): ScheduledMatch =>
      match.status === 'scheduled' && (all || match.roundNumber === nextRound)
        ? { ...match, status: 'played', result: simulate(next, match) }
        : match,
    );
    next.standings = calculateLeagueTable(
      next.participants.map((p) => p.id),
      next.matches,
      league,
    );
    return next;
  }
  return {
    start,
    isValid,
    progress,
    nextMatchday: (state: TournamentState) => advance(state),
    finishLeague: (state: TournamentState) => advance(state, true),
    qualification: (rank: number) => leagueQualification(rank, league),
    rulesVersion: rules.version,
    leagueVersion: config.engineVersion,
  };
}
export type TournamentEngine = ReturnType<typeof createTournamentEngine>;
