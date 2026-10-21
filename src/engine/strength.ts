import type { StrengthBreakdown } from '../types/application.ts';
import type {
  CoachSeason,
  Database,
  Formation,
  FormationId,
  GameRules,
  LineupSlot,
  PlayerSeason,
  Position,
  PositionGroup,
} from '../types/database.ts';

export interface AssignedPlayer {
  slotId: string;
  player: PlayerSeason;
  clubId: string;
}
export interface StrengthInput {
  formationId: FormationId;
  tacticId: string;
  lineup: AssignedPlayer[];
  coach: CoachSeason | null;
  captainPersonId: string | null;
}
export interface PlayerContribution {
  slotId: string;
  personId: string;
  name: string;
  position: Position;
  group: PositionGroup;
  fit: 'primary' | 'secondary';
  multiplier: number;
  rating: number;
  effectiveRating: number;
}
export interface StrengthAnalysis {
  strength: StrengthBreakdown;
  contributions: PlayerContribution[];
  groups: {
    group: PositionGroup;
    players: number;
    average: number;
    weight: number;
    contribution: number;
  }[];
  chemistry: { sameNationalityPairs: number; sameClubPairs: number; pairs: number };
  tactic: { label: string; matchingPlayers: number; totalPlayers: number };
  coach: {
    name: string | null;
    formationMatches: boolean;
    styleCoverage: number;
    ratingFactor: number;
  };
  captain: { name: string | null; natural: boolean };
}

const groups: PositionGroup[] = ['goalkeeper', 'defence', 'midfield', 'attack'];
const styleTags = new Set([
  'balanced',
  'transition',
  'compact',
  'counter-attack',
  'direct',
  'wide-play',
  'possession',
  'high-press',
]);
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;
export const roundStrength = (value: number, decimals = 2): number =>
  Math.round((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
const check = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isText) &&
  new Set(value).size === value.length;

/** Pure, versioned formulas. No catalog reads, randomness, React or browser APIs. */
export function createStrengthModel(environment: {
  rules: GameRules;
  formations: Formation[];
  positions: Database['positions'];
  tactics: Database['tactics'];
}) {
  const config = structuredClone(environment);
  const { rules } = config;
  const { strength, chemistry, coach } = rules;
  const formations = new Map(config.formations.map((item) => [item.id, item]));
  const positions = new Map(config.positions.map((item) => [item.id, item.group]));
  const tactics = new Map(config.tactics.map((item) => [item.id, item]));
  const finite = (value: number, min = 0, max = Infinity) =>
    Number.isFinite(value) && value >= min && value <= max;
  check(isText(strength.modelVersion), 'Ungültige Stärkemodell-Version.');
  check(strength.ratingMin === 0 && finite(strength.ratingMax, 1), 'Ungültige Ratingskala.');
  check(
    groups.every((group) => finite(strength.positionGroupWeights[group], 0, 1)) &&
      Math.abs(groups.reduce((sum, group) => sum + strength.positionGroupWeights[group], 0) - 1) <
        1e-10,
    'Positionsgewichte müssen zusammen 100 % ergeben.',
  );
  check(
    finite(strength.positionFit.primaryMultiplier, 0, 1) &&
      finite(strength.positionFit.secondaryMultiplier, 0, strength.positionFit.primaryMultiplier) &&
      !strength.positionFit.invalidPositionAllowed,
    'Ungültige Positionsfaktoren.',
  );
  check(
    Object.values(strength.bonusCaps).every((value) => finite(value, 0, 20)) &&
      Object.values(strength.bonusCaps).reduce((sum, value) => sum + value, 0) <= 20 &&
      finite(strength.naturalCaptainBonus, 0, strength.bonusCaps.captain),
    'Ungültige Bonusgrenzen.',
  );
  check(
    finite(coach.formationShare, 0, 1) &&
      finite(coach.styleShare, 0, 1) &&
      Math.abs(coach.formationShare + coach.styleShare - 1) < 1e-10,
    'Ungültige Coach-Gewichte.',
  );
  check(
    finite(chemistry.sameNationalityPairWeight) &&
      finite(chemistry.sameClubPairWeight) &&
      Number.isInteger(chemistry.roundDecimals) &&
      finite(chemistry.roundDecimals, 0, 6),
    'Ungültige Chemie-Konfiguration.',
  );
  const rating = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    finite(value, strength.ratingMin, strength.ratingMax);
  const tags = (value: unknown): value is PlayerSeason['styleTags'] =>
    strings(value) && value.every((tag) => styleTags.has(tag));
  const review = (value: unknown) => value === 'pending' || value === 'verified';
  const approval = (value: unknown) => value === 'approved' || value === 'provisional';

  function isPlayer(value: unknown): value is PlayerSeason {
    if (
      !isRecord(value) ||
      !['id', 'personId', 'name', 'primeTeamId', 'season', 'ratingModelId'].every((key) =>
        isText(value[key]),
      ) ||
      !isText(value['nationality']) ||
      !/^[A-Z]{3}$/.test(value['nationality']) ||
      !positions.has(value['position'] as Position) ||
      !Array.isArray(value['secondaryPositions']) ||
      !value['secondaryPositions'].every((position) => positions.has(position)) ||
      new Set(value['secondaryPositions']).size !== value['secondaryPositions'].length ||
      value['secondaryPositions'].includes(value['position']) ||
      !rating(value['rating']) ||
      !isRecord(value['attributes']) ||
      !tags(value['styleTags']) ||
      typeof value['naturalCaptain'] !== 'boolean' ||
      !review(value['verificationStatus']) ||
      !approval(value['ratingStatus']) ||
      !strings(value['sourceIds'])
    )
      return false;
    const attributes = value['attributes'];
    return (
      [
        'overall',
        'pace',
        'shooting',
        'passing',
        'dribbling',
        'defending',
        'physical',
        'leadership',
      ].every((key) => rating(attributes[key])) &&
      attributes['overall'] === value['rating'] &&
      (value['position'] === 'GK'
        ? rating(attributes['goalkeeping'])
        : attributes['goalkeeping'] === null)
    );
  }

  function isCoach(value: unknown): value is CoachSeason {
    return (
      isRecord(value) &&
      ['id', 'personId', 'name', 'primeTeamId'].every((key) => isText(value[key])) &&
      strings(value['preferredFormations']) &&
      value['preferredFormations'].every((id) => formations.has(id as FormationId)) &&
      rating(value['tacticalRating']) &&
      tags(value['styleTags']) &&
      review(value['verificationStatus']) &&
      approval(value['ratingStatus']) &&
      strings(value['sourceIds'])
    );
  }

  function slotGroup(slot: LineupSlot): PositionGroup {
    const group = positions.get(slot.acceptedPositions[0]!);
    check(
      group && slot.acceptedPositions.every((position) => positions.get(position) === group),
      'Ungültige Positionsgruppe im Formationsslot.',
    );
    return group!;
  }

  function calculatePlayerContribution(player: PlayerSeason, slot: LineupSlot): PlayerContribution {
    check(isPlayer(player), 'Ungültige Spielerwerte.');
    const primary = slot.acceptedPositions.includes(player.position);
    check(
      primary ||
        slot.acceptedPositions.some((position) => player.secondaryPositions.includes(position)),
      `${player.name}: ungeeignete Position.`,
    );
    const multiplier = primary
      ? strength.positionFit.primaryMultiplier
      : strength.positionFit.secondaryMultiplier;
    return {
      slotId: slot.id,
      personId: player.personId,
      name: player.name,
      position: slot.acceptedPositions[0]!,
      group: slotGroup(slot),
      fit: primary ? 'primary' : 'secondary',
      multiplier,
      rating: player.rating,
      effectiveRating: player.rating * multiplier,
    };
  }

  function validateLineup(lineup: AssignedPlayer[], formationId: FormationId): Formation {
    const formation = formations.get(formationId);
    check(
      formation &&
        formation.slots.length === rules.builder.playersRequired &&
        new Set(formation.slots.map((slot) => slot.id)).size === rules.builder.playersRequired,
      'Ungültige Formation.',
    );
    check(
      Array.isArray(lineup) && lineup.length === rules.builder.playersRequired,
      'Für die Teamstärke werden genau elf Spieler benötigt.',
    );
    check(
      lineup.every(
        (pick) =>
          isRecord(pick) &&
          isPlayer(pick.player) &&
          isText(pick.clubId) &&
          formation!.slots.some((slot) => slot.id === pick.slotId),
      ),
      'Unvollständige oder ungültige Spielerzuordnung.',
    );
    check(
      new Set(lineup.map((pick) => pick.slotId)).size === lineup.length,
      'Ein Positionsslot ist doppelt besetzt.',
    );
    check(
      new Set(lineup.map((pick) => pick.player.personId)).size === lineup.length,
      'Eine Person ist mehrfach aufgestellt.',
    );
    const sources = new Map<string, string>();
    for (const pick of lineup) {
      check(
        !sources.has(pick.player.primeTeamId) ||
          sources.get(pick.player.primeTeamId) === pick.clubId,
        'Widersprüchliche Vereinszuordnung eines Saisonteams.',
      );
      sources.set(pick.player.primeTeamId, pick.clubId);
    }
    return formation!;
  }

  const bounded = (value: number, cap: number, decimals = 2) =>
    Math.min(cap, Math.max(0, roundStrength(value, decimals)));
  function calculateChemistry(lineup: AssignedPlayer[]) {
    let sameNationalityPairs = 0;
    let sameClubPairs = 0;
    for (let a = 0; a < lineup.length; a++)
      for (let b = a + 1; b < lineup.length; b++) {
        if (lineup[a]!.player.nationality === lineup[b]!.player.nationality) sameNationalityPairs++;
        if (lineup[a]!.clubId === lineup[b]!.clubId) sameClubPairs++;
      }
    const pairs = (lineup.length * (lineup.length - 1)) / 2;
    const maxWeight = pairs * (chemistry.sameNationalityPairWeight + chemistry.sameClubPairWeight);
    const score =
      sameNationalityPairs * chemistry.sameNationalityPairWeight +
      sameClubPairs * chemistry.sameClubPairWeight;
    return {
      sameNationalityPairs,
      sameClubPairs,
      pairs,
      bonus: maxWeight
        ? bounded(
            (score / maxWeight) * strength.bonusCaps.chemistry,
            strength.bonusCaps.chemistry,
            chemistry.roundDecimals,
          )
        : 0,
    };
  }

  function analyze(input: StrengthInput): StrengthAnalysis {
    const formation = validateLineup(input.lineup, input.formationId);
    const tactic = tactics.get(input.tacticId);
    check(tactic && tags(tactic.styleTags), 'Ungültige Taktik.');
    check(input.coach === null || isCoach(input.coach), 'Ungültige Trainerwerte.');
    const contributions = formation.slots.map((slot) =>
      calculatePlayerContribution(
        input.lineup.find((pick) => pick.slotId === slot.id)!.player,
        slot,
      ),
    );
    const groupDetails = groups.map((group) => {
      const players = contributions.filter((pick) => pick.group === group);
      const weight = strength.positionGroupWeights[group];
      check(
        players.length > 0 || weight === 0,
        'Die Formation enthält nicht alle gewichteten Positionsgruppen.',
      );
      const average = players.length
        ? players.reduce((sum, pick) => sum + pick.effectiveRating, 0) / players.length
        : 0;
      return { group, players: players.length, average, weight, contribution: average * weight };
    });
    const baseTeamStrength = roundStrength(
      groupDetails.reduce((sum, group) => sum + group.contribution, 0),
    );
    const chemistryDetails = calculateChemistry(input.lineup);
    const matchingPlayers = input.lineup.filter((pick) =>
      tactic!.styleTags.some((tag) => pick.player.styleTags.includes(tag)),
    ).length;
    const tacticalBonus = bounded(
      (matchingPlayers / input.lineup.length) * strength.bonusCaps.tactical,
      strength.bonusCaps.tactical,
    );
    const formationMatches = input.coach?.preferredFormations.includes(formation.id) ?? false;
    const styleCoverage = input.coach
      ? tactic!.styleTags.filter((tag) => input.coach!.styleTags.includes(tag)).length /
        tactic!.styleTags.length
      : 0;
    const ratingFactor = input.coach ? input.coach.tacticalRating / strength.ratingMax : 0;
    const coachBonus = bounded(
      (Number(formationMatches) * coach.formationShare + styleCoverage * coach.styleShare) *
        ratingFactor *
        strength.bonusCaps.coach,
      strength.bonusCaps.coach,
    );
    const captain = input.lineup.find(
      (pick) => pick.player.personId === input.captainPersonId,
    )?.player;
    check(
      input.captainPersonId === null || captain,
      'Der Captain muss aus der aktuellen Elf stammen.',
    );
    const captainBonus = captain?.naturalCaptain
      ? Math.min(strength.naturalCaptainBonus, strength.bonusCaps.captain)
      : 0;
    const breakdown = {
      baseTeamStrength,
      chemistryBonus: chemistryDetails.bonus,
      tacticalBonus,
      coachBonus,
      captainBonus,
      matchStrength: 0,
    };
    breakdown.matchStrength = roundStrength(
      baseTeamStrength + breakdown.chemistryBonus + tacticalBonus + coachBonus + captainBonus,
    );
    return {
      strength: breakdown,
      contributions,
      groups: groupDetails,
      chemistry: {
        sameNationalityPairs: chemistryDetails.sameNationalityPairs,
        sameClubPairs: chemistryDetails.sameClubPairs,
        pairs: chemistryDetails.pairs,
      },
      tactic: { label: tactic!.label, matchingPlayers, totalPlayers: input.lineup.length },
      coach: { name: input.coach?.name ?? null, formationMatches, styleCoverage, ratingFactor },
      captain: { name: captain?.name ?? null, natural: captain?.naturalCaptain ?? false },
    };
  }

  return {
    analyze,
    calculatePlayerContribution,
    isPlayer,
    isCoach,
    rulesVersion: strength.modelVersion,
    caps: { ...strength.bonusCaps },
    rules: structuredClone(rules),
    maximumStrength:
      strength.ratingMax + Object.values(strength.bonusCaps).reduce((sum, value) => sum + value, 0),
  };
}

export type StrengthModel = ReturnType<typeof createStrengthModel>;
