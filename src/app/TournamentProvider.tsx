import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useHistory } from './HistoryProvider.tsx';
import type { SavedTeam, TournamentState } from '../types/application.ts';
import {
  readTournament,
  writeTournament,
  tournamentStorageWarning,
} from '../utils/tournament-storage.ts';
import { tournamentEngine } from './game.ts';
import { getGameStorage } from '../utils/game-storage.ts';

interface TournamentContextValue {
  tournament: TournamentState | null;
  warning: string | null;
  persisted: boolean;
  start: (team: SavedTeam, seed: string, replace?: boolean) => void;
  advance: (expectedRound: number, all?: boolean) => void;
  knockoutAction: (action: 'draw' | 'leg' | 'finish', expectedToken: string) => void;
}
const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { archive } = useHistory();
  const [loaded] = useState(() => {
    try {
      return readTournament(getGameStorage(), tournamentEngine);
    } catch {
      return {
        tournament: null,
        warning: 'Dein gespeichertes Turnier konnte nicht gelesen werden.',
      };
    }
  });
  const [tournament, setTournament] = useState(loaded.tournament);
  const current = useRef(tournament);
  const [warning, setWarning] = useState(loaded.warning);
  const [persisted, setPersisted] = useState(Boolean(loaded.tournament));
  // Import the last completed pre-archive save without rewriting that original save.
  useEffect(() => {
    if (loaded.tournament?.phase === 'completed') archive(loaded.tournament);
  }, [loaded.tournament, archive]);
  function commit(next: TournamentState) {
    let success = false;
    try {
      success = writeTournament(getGameStorage(), next, tournamentEngine);
    } catch {
      /* Keep session state. */
    }
    current.current = next;
    setTournament(next);
    setPersisted(success);
    setWarning(success ? null : tournamentStorageWarning);
    if (next.phase === 'completed') archive(next);
  }
  function start(team: SavedTeam, seed: string, replace = false) {
    if (current.current && !replace)
      throw new Error('Bestätige zuerst, dass dein bisheriges Turnier ersetzt werden darf.');
    if (current.current?.phase === 'completed' && !archive(current.current))
      throw new Error(
        'Dein abgeschlossenes Turnier konnte noch nicht dauerhaft archiviert werden. Prüfe die Historie und den verfügbaren Browserspeicher, bevor du ein neues Turnier startest.',
      );
    commit(tournamentEngine.start(team, seed, new Date().toISOString()));
  }
  function advance(expectedRound: number, all = false) {
    if (!current.current) throw new Error('Starte zuerst ein Turnier.');
    if (tournamentEngine.progress(current.current).nextRound !== expectedRound)
      throw new Error('Dieser Spieltag wurde bereits simuliert.');
    commit(
      all
        ? tournamentEngine.finishLeague(current.current)
        : tournamentEngine.nextMatchday(current.current),
    );
  }
  function knockoutAction(action: 'draw' | 'leg' | 'finish', expectedToken: string) {
    if (!current.current) throw new Error('Starte zuerst ein Turnier.');
    if (tournamentEngine.knockoutProgress(current.current).token !== expectedToken)
      throw new Error('Dieser Turnierschritt wurde bereits ausgeführt.');
    const now = new Date().toISOString();
    commit(
      action === 'draw'
        ? tournamentEngine.drawNextRound(current.current)
        : action === 'leg'
          ? tournamentEngine.nextKnockoutLeg(current.current, now)
          : tournamentEngine.finishTournament(current.current, now),
    );
  }
  return (
    <TournamentContext value={{ tournament, warning, persisted, start, advance, knockoutAction }}>
      {children}
    </TournamentContext>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('TournamentProvider is missing');
  return context;
}
