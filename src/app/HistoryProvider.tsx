import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { HistoryEntry, TournamentState } from '../types/application.ts';
import { appendHistory, createHistoryEntry } from '../engine/history.ts';
import {
  readHistory,
  writeHistory,
  historyInvalidWarning,
  historyReadWarning,
  historyStorageWarning,
} from '../utils/history-storage.ts';
import { strengthModel, tournamentEngine } from './game.ts';
import { getGameStorage } from '../utils/game-storage.ts';

interface HistoryContextValue {
  entries: HistoryEntry[];
  warning: string | null;
  persisted: boolean;
  protectedArchive: boolean;
  archive: (tournament: TournamentState) => boolean;
  reset: () => boolean;
}
const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    try {
      return { ...readHistory(getGameStorage(), strengthModel), persisted: true };
    } catch {
      return {
        entries: [] as HistoryEntry[],
        warning: historyReadWarning,
        writable: false,
        protectedArchive: false,
        persisted: false,
      };
    }
  });
  const current = useRef(state);
  const archive = useCallback((tournament: TournamentState) => {
    const previous = current.current;
    if (
      previous.persisted &&
      previous.entries.some((entry) => entry.tournamentId === tournament.id)
    )
      return true;
    const entries = appendHistory(
      previous.entries,
      createHistoryEntry(tournament, tournamentEngine),
    );
    let persisted = false;
    try {
      if (previous.writable) persisted = writeHistory(getGameStorage(), entries, strengthModel);
    } catch {
      /* Keep the in-memory entry and the previous persisted archive. */
    }
    const next = {
      ...previous,
      entries,
      persisted,
      warning: previous.writable
        ? persisted
          ? null
          : historyStorageWarning
        : (previous.warning ?? historyInvalidWarning),
    };
    current.current = next;
    setState(next);
    return persisted;
  }, []);
  const reset = useCallback(() => {
    try {
      if (writeHistory(getGameStorage(), [], strengthModel)) {
        const next = {
          entries: [],
          warning: null,
          writable: true,
          protectedArchive: false,
          persisted: true,
        };
        current.current = next;
        setState(next);
        return true;
      }
    } catch {
      /* The protected data remains untouched if resetting fails. */
    }
    return false;
  }, []);
  return (
    <HistoryContext
      value={{
        entries: state.entries,
        warning: state.warning,
        persisted: state.persisted,
        protectedArchive: state.protectedArchive,
        archive,
        reset,
      }}
    >
      {children}
    </HistoryContext>
  );
}

export function useHistory() {
  const value = useContext(HistoryContext);
  if (!value) throw new Error('HistoryProvider is missing');
  return value;
}
