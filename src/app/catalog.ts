import { getDatabase, getDevelopmentTeams } from '../data/index.ts';

// UI development deliberately uses the editorial catalog. The historical release
// gate in src/data/index.ts remains unchanged; no historical release is asserted.
export const teams = getDevelopmentTeams();
export const {
  formations,
  clubs,
  targetYears,
  countries,
  positions,
  tactics,
  ratingModel,
  sources,
} = getDatabase();
export const catalogStats = {
  teams: teams.length,
  years: targetYears.length,
  cards: teams.reduce((total, team) => total + team.players.length, 0),
};
export const featuredTeamIds = ['milan-2006-2007', 'barcelona-2010-2011', 'real-madrid-2016-2017'];
