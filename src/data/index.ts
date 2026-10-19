import snapshot from './database.json' with { type: 'json' };
import type { Database, PlayerSeason, PrimeTeam } from '../types/database.ts';

// Validated by npm run data:check, typecheck and the relational data tests.
const data = snapshot as unknown as Database;

/** Return an independent copy so consumers cannot change the shared source data. */
export function getDatabase(): Database {
  return structuredClone(data);
}

export function findPrimeTeam(id: string): PrimeTeam | undefined {
  const team = data.teams.find((candidate) => candidate.id === id);
  return team ? structuredClone(team) : undefined;
}

/** Draft identities are global, even when cards come from different seasons/clubs. */
export function isSamePlayer(a: Pick<PlayerSeason, 'personId'>, b: Pick<PlayerSeason, 'personId'>): boolean {
  return a.personId === b.personId;
}

/** Deliberate opt-in for development; these teams still require historical review. */
export function getDevelopmentTeams(): PrimeTeam[] {
  return structuredClone(data.teams.filter((team) => team.rosterScope === 'curated_squad'));
}

/** A content-review gate, not a claim that the UI or simulation already exists. */
export function isTeamReleased(team: PrimeTeam, database: Database): boolean {
  const people = new Map(database.people.map((person) => [person.id, person]));
  const sourceIds = [
    ...team.sourceIds,
    ...team.players.flatMap((player) => player.sourceIds),
    ...(team.coach?.sourceIds ?? []),
  ];
  return team.status === 'reviewed'
    && team.verificationStatus === 'verified'
    && team.rosterScope === 'curated_squad'
    && team.players.length >= 18
    && new Set(team.players.map((player) => player.personId)).size === team.players.length
    && team.defaultLineup.length === 11
    && database.clubs.some((club) => club.id === team.clubId && club.verificationStatus === 'verified')
    && database.ratingModel.status === 'approved'
    && team.players.every((player) => player.verificationStatus === 'verified'
      && player.ratingStatus === 'approved'
      && people.get(player.personId)?.verificationStatus === 'verified')
    && team.coach !== null
    && team.coach.verificationStatus === 'verified'
    && team.coach.ratingStatus === 'approved'
    && people.get(team.coach.personId)?.verificationStatus === 'verified'
    && team.captainPersonId !== null
    && people.get(team.captainPersonId)?.verificationStatus === 'verified'
    && sourceIds.length > 0
    && sourceIds.every((id) => database.sources.some((source) => source.id === id
      && source.accessStatus === 'retrieved' && source.checkedAt !== null));
}

export function getReleasedTeams(): PrimeTeam[] {
  return structuredClone(data.teams.filter((team) => isTeamReleased(team, data)));
}

export function getDataReadiness(database: Database = data) {
  const releasedTeams = database.teams.filter((team) => isTeamReleased(team, database));
  const coverageComplete = database.targetYears.every((year) =>
    database.coverage.filter((slot) => slot.year === year).length === database.targetTeamsPerYear
    && database.coverage.filter((slot) => slot.year === year).every((slot) =>
      releasedTeams.some((team) => team.id === slot.teamId && team.year === year)));
  return {
    targetTeams: database.targetYears.length * database.targetTeamsPerYear,
    selectedCandidates: database.teams.length,
    populatedTeams: database.teams.filter((team) => team.rosterScope === 'curated_squad').length,
    playerCards: database.teams.reduce((count, team) => count + team.players.length, 0),
    releasedTeams: releasedTeams.length,
    openHistoricalTasks: database.tasks.length,
    unapprovedRatings: database.teams.reduce((count, team) => count
      + team.players.filter((player) => player.ratingStatus !== 'approved').length
      + (team.coach && team.coach.ratingStatus !== 'approved' ? 1 : 0), 0),
    draftDataReady: releasedTeams.length >= 12,
    tournamentDataReady: releasedTeams.length >= 35,
    fullCatalogReady: coverageComplete,
    developmentCatalogComplete: database.teams.length === database.targetYears.length * database.targetTeamsPerYear
      && database.coverage.every((slot) => database.teams.some((team) => team.id === slot.teamId
        && team.players.length >= 18 && team.defaultLineup.length === 11 && team.coach !== null)),
    verifiedCoachRecords: database.teams.filter((team) => team.coach?.verificationStatus === 'verified').length,
  };
}

export function getGameRules() {
  return structuredClone(data.rules);
}

export function getDatasetVersion(): string {
  return data.datasetVersion;
}

export function getDefaultSettings() {
  return structuredClone(data.defaults);
}

export function searchPrimeTeams(filters: { year?: number; clubId?: string; query?: string } = {}): PrimeTeam[] {
  const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('de');
  const query = normalize(filters.query?.trim() ?? '');
  return structuredClone(data.teams.filter((team) =>
    (filters.year === undefined || team.year === filters.year)
    && (filters.clubId === undefined || team.clubId === filters.clubId)
    && (!query || normalize(`${team.clubName} ${team.season} ${team.coach?.name ?? ''}`).includes(query))));
}

export function getDefaultLineup(teamId: string): PlayerSeason[] {
  const team = data.teams.find((candidate) => candidate.id === teamId);
  if (!team) return [];
  return structuredClone(team.defaultLineup.map((pick) => {
    const player = team.players.find((candidate) => candidate.id === pick.playerId);
    if (!player) throw new Error(`${team.id}: default lineup contains a missing player`);
    return player;
  }));
}

export function findPlayerCard(cardId: string): PlayerSeason | undefined {
  const player = data.teams.flatMap((team) => team.players).find((candidate) => candidate.id === cardId);
  return player ? structuredClone(player) : undefined;
}

export function getPositionOptions(teamId: string, position: PlayerSeason['position'], includeSecondary = true): PlayerSeason[] {
  return findPrimeTeam(teamId)?.players.filter((player) => player.position === position
    || (includeSecondary && player.secondaryPositions.includes(position))) ?? [];
}

/** Works under GitHub Pages repository paths as well as a root deployment. */
export function getClubBadgePath(clubId: string, siteBase = '/'): string | undefined {
  const club = data.clubs.find((candidate) => candidate.id === clubId);
  if (!club) return undefined;
  return `${siteBase.endsWith('/') ? siteBase : `${siteBase}/`}${club.logo}`;
}
