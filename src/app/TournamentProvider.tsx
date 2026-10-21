import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { SavedTeam, TournamentState } from '../types/application.ts';
import {
  readTournament,
  writeTournament,
  tournamentStorageWarning,
} from '../utils/tournament-storage.ts';
import { tournamentEngine } from './game.ts';

interface TournamentContextValue {
  tournament: TournamentState | null;
  warning: string | null;
  persisted: boolean;
  start: (team: SavedTeam, seed: string, replace?: boolean) => void;
  advance: (expectedRound: number, all?: boolean) => void;
}
const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => {
    try {
      return readTournament(window.localStorage, tournamentEngine);
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
  function commit(next: TournamentState) {
    let success = false;
    try {
      success = writeTournament(window.localStorage, next, tournamentEngine);
    } catch {
      /* Keep session state. */
    }
    current.current = next;
    setTournament(next);
    setPersisted(success);
    setWarning(success ? null : tournamentStorageWarning);
  }
  function start(team: SavedTeam, seed: string, replace = false) {
    if (current.current && !replace)
      throw new Error('Bestätige zuerst, dass dein bisheriges Turnier ersetzt werden darf.');
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
  return (
    <TournamentContext value={{ tournament, warning, persisted, start, advance }}>
      {children}
    </TournamentContext>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('TournamentProvider is missing');
  return context;
}
