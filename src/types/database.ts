/** Permanent identities are separate from season-specific gameplay records. */
export type Position =
  | 'GK' | 'RB' | 'CB' | 'LB' | 'RWB' | 'LWB'
  | 'CDM' | 'CM' | 'CAM' | 'RM' | 'LM' | 'RW' | 'LW' | 'ST';

export type FormationId = '4-3-3' | '4-2-3-1' | '4-4-2' | '4-3-1-2' | '4-3-2-1' | '3-4-3' | '3-5-2';
export type ReviewStatus = 'pending' | 'verified';
export type RatingStatus = 'provisional' | 'approved';
export type PositionGroup = 'goalkeeper' | 'defence' | 'midfield' | 'attack';
export type StyleTag = 'balanced' | 'transition' | 'compact' | 'counter-attack' | 'direct' | 'wide-play' | 'possession' | 'high-press';

export interface Person {
  id: string;
  name: string;
  /** ISO alpha-3, plus ENG/SCO/WAL/NIR associations and XKX for Kosovo. */
  nationalities: string[];
  portrait: null;
  verificationStatus: ReviewStatus;
}

export interface Club {
  id: string;
  name: string;
  country: string;
  shortName: string;
  /** Locally generated club monogram, not an official crest. Relative to the site base. */
  logo: string;
  badgeKind: 'monogram';
  colors: { primary: string; secondary: string };
  verificationStatus: ReviewStatus;
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  kind: 'season_reference' | 'dataset_reference';
  accessStatus: 'not_retrieved' | 'retrieved';
  checkedAt: string | null;
  intendedCoverage: string[];
  contentSha256: string | null;
}

export interface Attributes {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  /** Outfield players have no goalkeeper rating. */
  goalkeeping: number | null;
  leadership: number;
}

export interface PlayerSeason {
  /** Unique card. Use personId, not this ID, to prevent selecting someone twice. */
  id: string;
  personId: string;
  name: string;
  nationality: string;
  primeTeamId: string;
  season: string;
  position: Position;
  secondaryPositions: Position[];
  rating: number;
  attributes: Attributes;
  ratingStatus: RatingStatus;
  ratingModelId: string;
  naturalCaptain: boolean;
  styleTags: StyleTag[];
  verificationStatus: ReviewStatus;
  sourceIds: string[];
}

export interface CoachSeason {
  id: string;
  personId: string;
  name: string;
  primeTeamId: string;
  preferredFormations: FormationId[];
  tacticalRating: number;
  styleTags: StyleTag[];
  ratingStatus: RatingStatus;
  verificationStatus: ReviewStatus;
  sourceIds: string[];
}

export interface LineupSlot {
  id: string;
  acceptedPositions: Position[];
  /** Normalized pitch coordinates: (0,0) top left, our goalkeeper near y=1. */
  coordinates: { x: number; y: number };
}

export interface Formation {
  id: FormationId;
  slots: LineupSlot[];
}

export interface PrimeTeam {
  id: string;
  clubId: string;
  clubName: string;
  season: string;
  /** Year in which the European club season ends, e.g. 2007 => 2006/07. */
  year: number;
  logo: string;
  status: 'editorial_draft' | 'research_pending' | 'reviewed';
  rosterScope: 'curated_squad' | 'not_entered';
  /** Editorial game formation; not a claim about every historical match. */
  formation: FormationId | null;
  coach: CoachSeason | null;
  captainPersonId: string | null;
  players: PlayerSeason[];
  defaultLineup: { slotId: string; playerId: string }[];
  /** Arithmetic mean of the default XI only; not the later match-strength formula. */
  teamRating: number | null;
  verificationStatus: ReviewStatus;
  sourceIds: string[];
}

export interface CoverageSlot {
  id: string;
  year: number;
  selectionNumber: number;
  teamId: string | null;
}

export interface DataTask {
  id: string;
  teamId: string | null;
  slotId: string | null;
  kind: 'historical_review' | 'roster_research' | 'team_selection';
  description: string;
}

export interface Database {
  schemaVersion: 2;
  datasetVersion: string;
  status: 'editorial_draft';
  targetYears: number[];
  targetTeamsPerYear: number;
  people: Person[];
  clubs: Club[];
  formations: Formation[];
  sources: SourceReference[];
  coverage: CoverageSlot[];
  teams: PrimeTeam[];
  tasks: DataTask[];
  ratingModel: {
    id: string;
    status: RatingStatus;
    provenance: 'original_editorial_gameplay';
    description: string;
    method: 'explicit-season-attributes';
    /** Initial authoring profiles retained for provenance; never overwrite explicit attributes. */
    attributeOffsets: Record<Position, Omit<Attributes, 'overall' | 'goalkeeping'>>;
  };
  positions: { id: Position; label: string; group: PositionGroup }[];
  countries: { id: string; label: string }[];
  tactics: { id: string; label: string; styleTags: StyleTag[]; preferredFormations: FormationId[] }[];
  rules: GameRules;
  defaults: {
    locale: 'de'; theme: 'dark'; defaultTactic: string; reduceMotion: boolean;
    soundEnabled: boolean; historyLimit: number;
  };
}

/** Versioned game-design defaults. Match calibration is an engine task, not a data claim. */
export interface GameRules {
  id: string;
  version: string;
  provenance: 'original_game_design';
  builder: {
    drawSize: number; playersRequired: number; coachRequired: boolean;
    defaultFormation: FormationId; distinctPrimeTeams: boolean;
    playerIdentityKey: 'personId'; maxPlayersPerPrimeTeam: number; coachConsumesPlayerPick: boolean;
  };
  strength: {
    modelVersion: string;
    ratingMin: number; ratingMax: number;
    positionGroupWeights: Record<PositionGroup, number>;
    positionFit: { primaryMultiplier: number; secondaryMultiplier: number; invalidPositionAllowed: boolean };
    bonusCaps: { chemistry: number; tactical: number; coach: number; captain: number };
    naturalCaptainBonus: number;
  };
  chemistry: { sameNationalityPairWeight: number; sameClubPairWeight: number; normalization: string; roundDecimals: number };
  coach: { formationShare: number; styleShare: number };
  match: {
    engineVersion: string;
    distribution: 'poisson'; baseExpectedGoals: number; strengthSensitivity: number;
    homeAdvantageRating: number; neutralVenueHomeAdvantage: number;
    expectedGoalsMin: number; expectedGoalsMax: number; matchVarianceFraction: number;
    regularMinutes: number; extraTimeMinutes: number; penaltiesInitialKicks: number;
    penaltyConversionProbability: number;
    penaltiesSuddenDeath: boolean; seedSupported: boolean; calibrationStatus: 'validated_v1';
  };
  tournament: {
    engineVersion: string;
    totalTeams: number; userTeams: number; opponentTeams: number;
    uniquePrimeTeamIds: boolean; differentSeasonsOfSameClubAllowed: boolean;
    league: {
      matchesPerTeam: number; homeMatches: number; awayMatches: number;
      winPoints: number; drawPoints: number; lossPoints: number;
      tiebreakers: string[]; directQualificationRanks: [number, number];
      playoffRanks: [number, number]; eliminatedRanks: [number, number];
    };
    knockout: {
      engineVersion: string;
      drawPolicy: 'seeded-playoffs-open-redraw';
      rounds: { id: string; teams: number; legs: number }[]; awayGoalsRule: boolean;
      resolveDraw: 'extra-time-then-penalties'; finalNeutralVenue: boolean;
    };
  };
  storage: {
    version: number;
    keys: Record<'currentDraft' | 'currentTeam' | 'currentTournament' | 'completedTournaments' | 'userSettings', string>;
  };
  designDecisions: { id: string; description: string }[];
}
