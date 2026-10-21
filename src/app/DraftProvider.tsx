import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { getDefaultSettings, getGameRules } from '../data/index.ts';
import { createBuilder, type BuilderAction } from '../engine/builder.ts';
import type { DraftState } from '../types/application.ts';
import type { FormationId } from '../types/database.ts';
import { readDraft, writeDraft, draftStorageWarning } from '../utils/draft-storage.ts';
import { teams, formations, tactics } from './catalog.ts';

export const builder = createBuilder({
  teams,
  formations,
  tacticIds: tactics.map((tactic) => tactic.id),
  rules: getGameRules().builder,
  defaultTactic: getDefaultSettings().defaultTactic,
});
interface DraftContextValue {
  draft: DraftState | null;
  warning: string | null;
  saved: boolean;
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
    return current.current ? persist(current.current) : false;
  }
  return (
    <DraftContext value={{ draft, warning, saved, start, dispatch, save }}>{children}</DraftContext>
  );
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error('DraftProvider is missing');
  return context;
}
