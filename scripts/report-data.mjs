import { getDataReadiness, getDatabase } from '../src/data/index.ts';

const db = getDatabase();
const readiness = getDataReadiness(db);
console.log(JSON.stringify({
  ...readiness,
  years: db.targetYears.map((year) => ({
    year,
    selected: db.teams.filter((team) => team.year === year).length,
    populated: db.teams.filter((team) => team.year === year && team.rosterScope === 'curated_squad').length,
    unselected: db.coverage.filter((slot) => slot.year === year && slot.teamId === null).length,
  })),
}, null, 2));

if (process.argv.includes('--release') && !readiness.fullCatalogReady) {
  console.error('Release blocked: historical reviews, rating approval and/or catalog coverage remain open.');
  process.exitCode = 1;
}
