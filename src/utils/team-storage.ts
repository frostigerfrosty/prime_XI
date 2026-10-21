import { getGameRules } from '../data/index.ts';
import { isSavedTeam } from '../engine/saved-team.ts';
import type { StrengthModel } from '../engine/strength.ts';
import type { SavedTeam } from '../types/application.ts';

export const teamStorageKey = getGameRules().storage.keys.currentTeam;
type TeamStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const teamStorageWarning =
  'Dein Team konnte nicht dauerhaft im Browser gespeichert werden. Die aktuelle Elf bleibt für diese Sitzung erhalten.';

export function readSavedTeam(
  storage: TeamStorage,
  model: StrengthModel,
): { team: SavedTeam | null; warning: string | null } {
  try {
    const raw = storage.getItem(teamStorageKey);
    if (!raw) return { team: null, warning: null };
    const envelope: unknown = JSON.parse(raw);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('schemaVersion' in envelope) ||
      envelope.schemaVersion !== 1 ||
      !('team' in envelope) ||
      !isSavedTeam(envelope.team, model)
    ) {
      return {
        team: null,
        warning:
          'Das gespeicherte Team ist beschädigt oder verwendet andere Spielregeln. Dein Draft bleibt davon unberührt; du kannst die Aufstellung erneut speichern.',
      };
    }
    return { team: envelope.team, warning: null };
  } catch {
    return {
      team: null,
      warning:
        'Dein gespeichertes Team konnte nicht gelesen werden. Dein Draft kann weiterhin bearbeitet werden.',
    };
  }
}

export function writeSavedTeam(
  storage: TeamStorage,
  team: SavedTeam,
  model: StrengthModel,
): boolean {
  if (!isSavedTeam(team, model)) return false;
  try {
    storage.setItem(teamStorageKey, JSON.stringify({ schemaVersion: 1, team }));
    return true;
  } catch {
    return false;
  }
}
