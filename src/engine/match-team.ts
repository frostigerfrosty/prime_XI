import type { PrimeTeam } from '../types/database.ts';
import type { SavedTeam } from '../types/application.ts';
import type { StrengthModel } from './strength.ts';
import { isSavedTeam } from './saved-team.ts';
import type { MatchTeam } from './match.ts';

export function savedMatchTeam(team: SavedTeam, model: StrengthModel): MatchTeam {
  if (!isSavedTeam(team, model)) throw new Error('Die gespeicherte Elf ist ungültig.');
  return { id: team.id, strength: team.strength.matchStrength };
}

/** Historical opponents use the SAME formulas, their curated XI and explicit tactic. */
export function primeMatchTeam(team: PrimeTeam, model: StrengthModel, tacticId: string): MatchTeam {
  if (!team.formation || !team.coach) throw new Error('Dem Gegner fehlen Aufstellung oder Coach.');
  const lineup = team.defaultLineup.map((pick) => {
    const player = team.players.find((card) => card.id === pick.playerId);
    if (!player) throw new Error('Die Standardelf enthält eine unbekannte Karte.');
    return { slotId: pick.slotId, player, clubId: team.clubId };
  });
  const captainPersonId = lineup.some((pick) => pick.player.personId === team.captainPersonId)
    ? team.captainPersonId
    : null;
  const strength = model.analyze({
    formationId: team.formation,
    tacticId,
    lineup,
    coach: team.coach,
    captainPersonId,
  }).strength.matchStrength;
  return { id: team.id, strength };
}
