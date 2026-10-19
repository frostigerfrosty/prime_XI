import { getDatabase, getDevelopmentTeams } from '../data/index.ts';

// Browsing deliberately uses the editorial catalog. The historical release gate
// in src/data/index.ts remains unchanged; this is not a playable-team release.
export const teams = getDevelopmentTeams();
export const { formations, clubs, targetYears, countries, positions } = getDatabase();
export const catalogStats = {
  teams: teams.length,
  years: targetYears.length,
  cards: teams.reduce((total, team) => total + team.players.length, 0),
};
export const featuredTeamIds = ['milan-2006-2007', 'barcelona-2010-2011', 'real-madrid-2016-2017'];
