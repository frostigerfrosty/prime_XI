import catalogURL from './database.json?url';
import { createDataAccess } from './access.ts';
import { loadCatalog } from './load.ts';

// Vite resolves browser imports of data/index.ts here; Node keeps its synchronous API.
const data = await loadCatalog(catalogURL);
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
} = createDataAccess(data);
