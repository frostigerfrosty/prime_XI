import { getDatasetVersion, getDefaultSettings } from './index.ts';
import type { AppState } from '../types/application.ts';

/** No synthetic saved team, running tournament, result or history is inserted. */
export function createInitialAppState(): AppState {
  return {
    schemaVersion: 1,
    datasetVersion: getDatasetVersion(),
    currentDraft: null,
    currentTeam: null,
    currentTournament: null,
    completedTournaments: [],
    userSettings: getDefaultSettings(),
  };
}
