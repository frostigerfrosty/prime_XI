import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { getDatasetVersion } from '../data/index.ts';
import type { BuilderAction } from '../engine/builder.ts';
import { createSavedTeam, savedTeamMatchesDraft, strengthInput } from '../engine/saved-team.ts';
import type { StrengthAnalysis } from '../engine/strength.ts';
import type { DraftState, SavedTeam } from '../types/application.ts';
import type { FormationId } from '../types/database.ts';
import { readDraft, writeDraft, draftStorageWarning } from '../utils/draft-storage.ts';
import { readSavedTeam, writeSavedTeam, teamStorageWarning } from '../utils/team-storage.ts';
import { builder, strengthModel } from './game.ts';

export { builder } from './game.ts';
interface DraftContextValue {
  draft: DraftState | null;
  warning: string | null;
  saved: boolean;
  assessment: StrengthAnalysis | null;
  currentTeam: SavedTeam | null;
  teamPersisted: boolean;
  teamMatchesDraft: boolean;
  teamWarning: string | null;
  start: (formationId: FormationId) => void;
  dispatch: (action: BuilderAction) => void;
  save: () => boolean;
}
const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => {
    try {
      return readDraft(window.localStorage, builder);
    } catch {
      return { draft: null, warning: draftStorageWarning };
    }
  });
  const [draft, setDraft] = useState(loaded.draft);
  const current = useRef(draft);
  const [warning, setWarning] = useState(loaded.warning);
  const [saved, setSaved] = useState(Boolean(loaded.draft));
  const [loadedTeam] = useState(() => {
    try {
      return readSavedTeam(window.localStorage, strengthModel);
    } catch {
      return { team: null, warning: 'Dein gespeichertes Team konnte nicht gelesen werden.' };
    }
  });
  const [currentTeam, setCurrentTeam] = useState(loadedTeam.team);
  const [teamWarning, setTeamWarning] = useState(loadedTeam.warning);
  const [teamPersisted, setTeamPersisted] = useState(Boolean(loadedTeam.team));
  const assessment = useMemo(
    () =>
      draft?.picks.length === 11 ? strengthModel.analyze(strengthInput(draft, builder)) : null,
    [draft],
  );
  const teamMatchesDraft = useMemo(
    () =>
      Boolean(
        draft &&
        currentTeam &&
        savedTeamMatchesDraft(currentTeam, draft, builder, strengthModel, getDatasetVersion()),
      ),
    [currentTeam, draft],
  );
  function persist(next: DraftState) {
    let success = false;
    try {
      success = writeDraft(window.localStorage, next, builder);
    } catch {
      /* Session remains usable. */
    }
    setSaved(success);
    setWarning(success ? null : draftStorageWarning);
    return success;
  }
  function commit(next: DraftState) {
    current.current = next;
    setDraft(next);
    persist(next);
  }
  function start(formationId: FormationId) {
    commit(builder.newDraft(crypto.randomUUID(), formationId));
  }
  function dispatch(action: BuilderAction) {
    if (!current.current) throw new Error('Ziehe zuerst zwölf Prime-Teams.');
    commit(builder.change(current.current, action));
  }
  function save() {
    if (!current.current || !builder.status(current.current).complete) return false;
    const team = createSavedTeam(current.current, builder, strengthModel, getDatasetVersion());
    const draftSuccess = persist(current.current);
    let teamSuccess = false;
    try {
      teamSuccess = writeSavedTeam(window.localStorage, team, strengthModel);
    } catch {
      /* Keep the session snapshot. */
    }
    setCurrentTeam(team);
    setTeamPersisted(teamSuccess);
    setTeamWarning(teamSuccess ? null : teamStorageWarning);
    return teamSuccess && draftSuccess;
  }
  return (
    <DraftContext
      value={{
        draft,
        warning,
        saved,
        assessment,
        currentTeam,
        teamPersisted,
        teamMatchesDraft,
        teamWarning,
        start,
        dispatch,
        save,
      }}
    >
      {children}
    </DraftContext>
  );
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('DraftProvider is missing');
  return context;
}
