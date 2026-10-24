import type { CoachSeason, FormationId, PlayerSeason, PrimeTeam } from './database.ts';

export type TournamentRound =
  'playoffs' | 'round-of-16' | 'quarter-finals' | 'semi-finals' | 'final';
export type TournamentPhase = 'league' | TournamentRound | 'completed';

export interface UserSettings {
  locale: 'de';
  theme: 'dark';
  defaultTactic: string;
  reduceMotion: boolean;
  soundEnabled: boolean;
  historyLimit: number;
}

export interface DraftState {
  /** Absent on existing pool drafts; sequential drafts contain only revealed teams. */
  mode?: 'sequential';
  id: string;
  seed: string;
  createdAt: string;
  updatedAt: string;
  drawnPrimeTeamIds: string[];
  formationId: FormationId;
  tacticId: string;
  picks: { slotId: string; playerCardId: string }[];
  coachCardId: string | null;
  captainPersonId: string | null;
}

export interface StrengthBreakdown {
  baseTeamStrength: number;
  chemistryBonus: number;
  tacticalBonus: number;
  coachBonus: number;
  captainBonus: number;
  matchStrength: number;
}

/** Embed selected card/coach snapshots so future catalog edits do not rewrite a save. */
export interface SavedTeam {
  draftMode?: 'sequential';
  id: string;
  draftId: string;
  name: string;
  createdAt: string;
  datasetVersion: string;
  rulesVersion: string;
  drawnPrimeTeamIds: string[];
  formationId: FormationId;
  tacticId: string;
  lineup: { slotId: string; player: PlayerSeason; clubId: string }[];
  coach: CoachSeason;
  captainPersonId: string;
  strength: StrengthBreakdown;
}

export type TournamentParticipant =
  | { id: string; kind: 'user'; team: SavedTeam; matchStrength: number }
  | { id: string; kind: 'prime'; team: PrimeTeam; matchStrength: number };

export interface Score {
  home: number;
  away: number;
}

export interface MatchResult {
  engineVersion: string;
  regularTime: Score;
  /** Cumulative score after 120 minutes, not just goals in the extra-time segment. */
  afterExtraTime: Score | null;
  /** Separate shootout score; never added to table goals or aggregate match goals. */
  penalties: Score | null;
  shootoutKicks: ShootoutKick[];
  /** In knockout context this is the advancing team, including prior legs. */
  winnerParticipantId: string | null;
  decidedBy: 'regular-time' | 'extra-time' | 'penalties' | 'draw';
  expectedGoals: { home: number; away: number };
  extraTimeExpectedGoals: Score | null;
  /** Prior legs plus the current 90/120-minute score; excludes shootout goals. */
  aggregateScore: Score | null;
  seed: string;
}

export interface ShootoutKick {
  side: 'home' | 'away';
  round: number;
  scored: boolean;
}

export type ScheduledMatch = {
  id: string;
  phase: Exclude<TournamentPhase, 'completed'>;
  roundNumber: number;
  leg: 1 | 2 | null;
  homeParticipantId: string;
  awayParticipantId: string;
  neutralVenue: boolean;
} & ({ status: 'scheduled'; result: null } | { status: 'played'; result: MatchResult });

export interface LeagueTableRow {
  participantId: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface KnockoutTie {
  id: string;
  round: TournamentRound;
  teamAId: string;
  teamBId: string;
  matchIds: string[];
  aggregateGoals: { teamA: number; teamB: number };
  winnerParticipantId: string | null;
}

export interface TournamentState {
  id: string;
  datasetVersion: string;
  rulesVersion: string;
  leagueVersion: string;
  matchEngineVersion: string;
  /** Absent only on compatible Phase-6 league saves. Added at the first K.-o. draw. */
  knockoutVersion?: string;
  opponentTacticId: string;
  seed: string;
  createdAt: string;
  completedAt: string | null;
  phase: TournamentPhase;
  userParticipantId: string;
  participants: TournamentParticipant[];
  matches: ScheduledMatch[];
  standings: LeagueTableRow[];
  knockoutTies: KnockoutTie[];
  championParticipantId: string | null;
}

export interface HistoryEntry {
  id: string;
  tournamentId: string;
  finishedAt: string;
  createdAt: string;
  seed: string;
  datasetVersion: string;
  rulesVersion: string;
  userTeam: SavedTeam;
  leaguePosition: number;
  leaguePoints: number;
  outcome: 'champion' | 'league' | TournamentRound;
  champion: { participantId: string; label: string };
  matches: {
    fixture: Extract<ScheduledMatch, { status: 'played' }>;
    opponent: { id: string; label: string; matchStrength: number };
  }[];
  statistics: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
  };
}

/** Persistence contract. Runtime validation/migrations belong to the application step. */
export interface AppState {
  schemaVersion: 1;
  datasetVersion: string;
  currentDraft: DraftState | null;
  currentTeam: SavedTeam | null;
  currentTournament: TournamentState | null;
  completedTournaments: HistoryEntry[];
  userSettings: UserSettings;
}
