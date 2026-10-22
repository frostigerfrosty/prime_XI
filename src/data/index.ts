import snapshot from './database.json' with { type: 'json' };
import type { Database } from '../types/database.ts';
import { createDataAccess } from './access.ts';

// Node tests and maintenance scripts retain synchronous access to the checked-in snapshot.
export const {
  getDatabase,
  findPrimeTeam,
  isSamePlayer,
  getDevelopmentTeams,
  isTeamReleased,
  getReleasedTeams,
  getDataReadiness,
  getGameRules,
  getDatasetVersion,
  getDefaultSettings,
  searchPrimeTeams,
  getDefaultLineup,
  findPlayerCard,
  getPositionOptions,
  getClubBadgePath,
} = createDataAccess(snapshot as unknown as Database);
