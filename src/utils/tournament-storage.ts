import { getGameRules } from '../data/index.ts';
import type { TournamentState } from '../types/application.ts';
import type { TournamentEngine } from '../engine/tournament.ts';

export const tournamentStorageKey = getGameRules().storage.keys.currentTournament;
type TournamentStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const tournamentStorageWarning =
  'Dein Turnier konnte nicht dauerhaft im Browser gespeichert werden. Du kannst in dieser Sitzung weiterspielen; beim Neuladen kann der letzte gespeicherte Stand zurückkehren.';

export function readTournament(
  storage: TournamentStorage,
  engine: TournamentEngine,
): { tournament: TournamentState | null; warning: string | null } {
  try {
    const raw = storage.getItem(tournamentStorageKey);
    if (!raw) return { tournament: null, warning: null };
    if (raw.length > 4_000_000) throw new Error('Save too large');
    const envelope: unknown = JSON.parse(raw);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('schemaVersion' in envelope) ||
      envelope.schemaVersion !== 1 ||
      !('tournament' in envelope) ||
      !engine.isValid(envelope.tournament)
    ) {
      return {
        tournament: null,
        warning:
          'Dein gespeichertes Turnier ist beschädigt oder verwendet andere Spielregeln. Es wird nicht geladen oder automatisch überschrieben. Deine gespeicherte Elf bleibt erhalten.',
      };
    }
    return { tournament: envelope.tournament, warning: null };
  } catch {
    return {
      tournament: null,
      warning:
        'Dein gespeichertes Turnier konnte nicht gelesen werden. Du kannst ein neues Turnier für diese Sitzung starten.',
    };
  }
}

export function writeTournament(
  storage: TournamentStorage,
  tournament: TournamentState,
  engine: TournamentEngine,
): boolean {
  if (!engine.isValid(tournament)) return false;
  try {
    const raw = JSON.stringify({ schemaVersion: 1, tournament });
    if (raw.length > 4_000_000) return false;
    storage.setItem(tournamentStorageKey, raw);
    return true;
  } catch {
    return false;
  }
}
