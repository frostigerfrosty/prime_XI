import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  findPrimeTeam, getDatabase, getDataReadiness, getDevelopmentTeams,
  getReleasedTeams, isSamePlayer, isTeamReleased,
  getGameRules, getDefaultLineup, getPositionOptions, findPlayerCard, searchPrimeTeams, getClubBadgePath,
} from '../src/data/index.ts';
import type { Database, PrimeTeam } from '../src/types/database.ts';
import { buildDatabase } from '../scripts/build-data.mjs';
import { validateDatabase } from '../scripts/validate-data.mjs';

function populatedTeam(db: Database): PrimeTeam {
  const team = db.teams.find((candidate) => candidate.players.length >= 18);
  assert.ok(team);
  return team;
}

/** This is only an in-memory fixture. It never changes real editorial statuses. */
function reviewedFixture() {
  const db = getDatabase();
  const team = populatedTeam(db);
  db.ratingModel.status = 'approved';
  for (const person of db.people) person.verificationStatus = 'verified';
  for (const club of db.clubs) club.verificationStatus = 'verified';
  for (const source of db.sources) {
    source.accessStatus = 'retrieved';
    source.checkedAt = '2026-10-19';
  }
  team.status = 'reviewed';
  team.verificationStatus = 'verified';
  for (const player of team.players) {
    player.verificationStatus = 'verified';
    player.ratingStatus = 'approved';
  }
  assert.ok(team.coach);
  team.coach.verificationStatus = 'verified';
  team.coach.ratingStatus = 'approved';
  db.tasks = db.tasks.filter((task) => task.teamId !== team.id);
  return { db, team };
}

test('the complete snapshot passes schema and relationship validation', () => {
  assert.deepEqual(validateDatabase(getDatabase()), []);
});

test('every target year has three distinct selection slots, including unfinished years', () => {
  const db = getDatabase();
  assert.deepEqual(db.targetYears, Array.from({ length: 20 }, (_, i) => 2007 + i));
  assert.equal(db.coverage.length, 60);
  assert.equal(db.teams.length, 60);
  assert.equal(db.teams.reduce((total, team) => total + team.players.length, 0), 1080);
  for (const year of db.targetYears) {
    assert.deepEqual(db.coverage.filter((slot) => slot.year === year).map((slot) => slot.selectionNumber), [1, 2, 3]);
  }
});

test('regeneration is deterministic and matches the saved static snapshot', async () => {
  const first = await buildDatabase();
  const second = await buildDatabase();
  assert.deepEqual(first, second);
  const saved = await readFile(new URL('../src/data/database.json', import.meta.url), 'utf8');
  assert.equal(saved, `${JSON.stringify(first, null, 2)}\n`);
});

test('season cards share a permanent identity across years and clubs', () => {
  const db = getDatabase();
  const cards = db.teams.flatMap((team) => team.players).filter((player) => player.personId === 'cristiano-ronaldo');
  assert.ok(cards.length > 1);
  assert.ok(cards.some((card) => card.primeTeamId.startsWith('manchester-united')));
  assert.ok(cards.some((card) => card.primeTeamId.startsWith('real-madrid')));
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  assert.ok(isSamePlayer(cards[0]!, cards[1]!));
  const another = db.teams.flatMap((team) => team.players).find((card) => card.personId === 'messi');
  assert.ok(another);
  assert.equal(isSamePlayer(cards[0]!, another), false);
});

test('nationality is held on each season card rather than imposed from a later profile', () => {
  const city = findPrimeTeam('manchester-city-2018-2019');
  assert.ok(city);
  assert.equal(city.players.find((player) => player.personId === 'laporte')?.nationality, 'FRA');
  assert.deepEqual(getDatabase().people.find((person) => person.id === 'laporte')?.nationalities, ['FRA', 'ESP']);
});

test('a seasonal captain can be selected from the bench without changing the default XI', () => {
  const united = findPrimeTeam('manchester-united-2007-2008');
  assert.ok(united);
  assert.equal(united.captainPersonId, 'gary-neville');
  assert.ok(!getDefaultLineup(united.id).some((player) => player.personId === united.captainPersonId));
  assert.equal(united.players.filter((player) => player.naturalCaptain).length, 1);
  assert.equal(united.players.find((player) => player.naturalCaptain)?.personId, 'gary-neville');
});

test('mutating a returned team or database cannot change the shared snapshot', () => {
  const copy = getDatabase();
  const team = populatedTeam(copy);
  const originalRating = team.players[0]!.rating;
  team.players[0]!.rating = 0;
  assert.equal(findPrimeTeam(team.id)?.players[0]?.rating, originalRating);
  const found = findPrimeTeam(team.id)!;
  found.players.length = 0;
  assert.equal(findPrimeTeam(team.id)?.players.length, 18);
  assert.equal(findPrimeTeam('unknown-team'), undefined);
});

test('an editorial dataset can be used explicitly for development without a release claim', () => {
  const db = getDatabase();
  const development = getDevelopmentTeams();
  assert.equal(development.length, 60);
  assert.ok(development.every((team) => team.players.length === 18 && team.coach !== null));
  assert.ok(getReleasedTeams().every((team) => isTeamReleased(team, db)));
  const team = populatedTeam(db);
  team.status = 'editorial_draft';
  team.verificationStatus = 'pending';
  assert.equal(isTeamReleased(team, db), false);
});

test('a historically reviewed team still needs explicit rating approval', () => {
  const { db, team } = reviewedFixture();
  assert.deepEqual(validateDatabase(db), []);
  assert.equal(isTeamReleased(team, db), true);
  team.players[0]!.ratingStatus = 'provisional';
  assert.equal(isTeamReleased(team, db), false);
  team.players[0]!.ratingStatus = 'approved';
  db.ratingModel.status = 'provisional';
  assert.equal(isTeamReleased(team, db), false);
});

test('an unread reference, unreviewed person, or unreviewed coach blocks release', () => {
  for (const field of ['source', 'person', 'coach'] as const) {
    const { db, team } = reviewedFixture();
    if (field === 'source') {
      const source = db.sources.find((candidate) => candidate.id === team.sourceIds[0])!;
      source.accessStatus = 'not_retrieved'; source.checkedAt = null;
    } else if (field === 'person') {
      db.people.find((person) => person.id === team.players[0]!.personId)!.verificationStatus = 'pending';
    } else {
      team.coach!.verificationStatus = 'pending';
    }
    assert.equal(isTeamReleased(team, db), false, field);
    assert.ok(validateDatabase(db).length > 0, field);
  }
});

test('enough released teams for a tournament cannot hide an unreviewed catalog entry', () => {
  const { db } = reviewedFixture();
  for (const team of db.teams.filter((candidate) => candidate.players.length >= 18)) {
    team.status = 'reviewed'; team.verificationStatus = 'verified';
    for (const player of team.players) {
      player.verificationStatus = 'verified'; player.ratingStatus = 'approved';
    }
    team.coach!.verificationStatus = 'verified'; team.coach!.ratingStatus = 'approved';
  }
  db.teams.at(-1)!.status = 'editorial_draft';
  db.teams.at(-1)!.verificationStatus = 'pending';
  const readiness = getDataReadiness(db);
  assert.equal(readiness.draftDataReady, true);
  assert.equal(readiness.tournamentDataReady, true);
  assert.equal(readiness.fullCatalogReady, false);
});

test('all year slots now contain squads while unreviewed facts remain explicit', () => {
  const db = getDatabase();
  assert.ok(db.coverage.every((slot) => slot.teamId !== null));
  for (const team of db.teams) {
    assert.equal(team.rosterScope, 'curated_squad');
    assert.equal(team.players.length, 18);
    assert.ok(team.coach);
    if (team.verificationStatus === 'pending') {
      assert.equal(team.status, 'editorial_draft');
      assert.ok(db.tasks.some((task) => task.teamId === team.id && task.kind === 'historical_review'));
    }
  }
});

const corruptions: [string, (db: Database, team: PrimeTeam) => void, RegExp][] = [
  ['duplicate player identity', (_db, team) => { team.players[1]!.personId = team.players[0]!.personId; }, /Duplicate .*player identity/],
  ['nonexistent identity', (_db, team) => { team.players[0]!.personId = 'invented-person'; }, /player identity/],
  ['wrong season', (_db, team) => { team.players[0]!.season = '2008/09'; }, /season\/team reference/],
  ['out of range rating', (_db, team) => { team.players[0]!.rating = 100; }, /must be <= 99/],
  ['broken position', (_db, team) => { team.players[0]!.position = 'ST'; }, /position mismatch/],
  ['duplicate lineup player', (_db, team) => { team.defaultLineup[1]!.playerId = team.defaultLineup[0]!.playerId; }, /Duplicate .*lineup player/],
  ['missing coach', (_db, team) => { team.coach = null; }, /missing coach/],
  ['bad average', (_db, team) => { team.teamRating = 0; }, /incorrect .*team average/],
  ['fake captain', (_db, team) => { team.players[0]!.naturalCaptain = true; }, /captain flag/],
  ['missing reference', (_db, team) => { team.sourceIds = ['nonexistent-source']; }, /unknown source/],
  ['duplicate coverage', (db) => { db.coverage[1]!.teamId = db.coverage[0]!.teamId; }, /Duplicate coverage team/],
  ['untracked missing data', (db) => { db.tasks = []; }, /data task/],
  ['unknown field', (_db, team) => { Object.assign(team, { ratign: 92 }); }, /additional properties/],
  ['undersized squad', (_db, team) => { team.players.pop(); team.players.pop(); team.players.pop(); }, /at least 18/],
  ['nonexistent country', (db) => { db.countries = db.countries.filter((country) => country.id !== 'ITA'); }, /country label missing/],
  ['broken pitch coordinate', (db) => { db.formations[0]!.slots[0]!.coordinates.x = 3; }, /must be <= 1/],
  ['unknown tactic formation', (db) => { db.defaults.defaultTactic = 'invented-tactic'; }, /Unknown default tactic/],
];

for (const [name, corrupt, expected] of corruptions) {
  test(`rejects ${name}`, () => {
    const db = getDatabase();
    corrupt(db, populatedTeam(db));
    assert.match(validateDatabase(db).join('\n'), expected);
  });
}

test('default lineup contains exactly eleven distinct squad members and one goalkeeper', () => {
  for (const team of getDatabase().teams) {
    const lineup = getDefaultLineup(team.id);
    assert.equal(lineup.length, 11, team.id);
    assert.equal(new Set(lineup.map((player) => player.personId)).size, 11, team.id);
    assert.equal(lineup.filter((player) => player.position === 'GK').length, 1, team.id);
    assert.ok(lineup.every((player) => team.players.some((member) => member.id === player.id)));
    const expected = Math.round(lineup.reduce((sum, player) => sum + player.rating, 0) / 11 * 10) / 10;
    assert.equal(team.teamRating, expected);
  }
  assert.deepEqual(getDefaultLineup('missing'), []);
});

test('individual game attributes distinguish player styles even in the same role', () => {
  const messi = findPlayerCard('barcelona-2010-2011:messi')!;
  const villa = findPlayerCard('barcelona-2010-2011:villa')!;
  assert.ok(messi.attributes.pace >= 90);
  assert.ok(messi.attributes.dribbling > villa.attributes.dribbling);
  const neuer = findPlayerCard('bayern-2019-2020:neuer')!;
  const courtois = findPlayerCard('real-madrid-2021-2022:courtois')!;
  assert.ok(neuer.attributes.passing > courtois.attributes.passing);
  assert.equal(neuer.attributes.goalkeeping, neuer.rating);
  assert.equal(messi.attributes.goalkeeping, null);
  assert.equal(findPlayerCard('missing'), undefined);
});

test('position queries distinguish primary from secondary roles', () => {
  const teamId = 'chelsea-2007-2008';
  assert.ok(getPositionOptions(teamId, 'RB').some((player) => player.personId === 'essien'));
  assert.ok(!getPositionOptions(teamId, 'RB', false).some((player) => player.personId === 'essien'));
  assert.deepEqual(getPositionOptions('missing', 'GK'), []);
});

test('team queries filter by season, club and accent-insensitive names', () => {
  assert.equal(searchPrimeTeams({ year: 2026 }).length, 3);
  const atletico = searchPrimeTeams({ query: 'ATLETICO' });
  assert.ok(atletico.length > 0 && atletico.every((team) => team.clubId === 'atletico'));
  const zidane = searchPrimeTeams({ query: 'ZINÉDINE', clubId: 'real-madrid' });
  assert.equal(zidane.length, 3);
  assert.deepEqual(searchPrimeTeams({ year: 1999 }), []);
});

test('club badge paths work on GitHub Pages and club monograms are bundled', async () => {
  const db = getDatabase();
  assert.equal(getClubBadgePath('real-madrid', '/prime_XI/'), '/prime_XI/assets/clubs/real-madrid.svg');
  assert.equal(getClubBadgePath('real-madrid', '/prime_XI'), '/prime_XI/assets/clubs/real-madrid.svg');
  assert.equal(getClubBadgePath('missing'), undefined);
  for (const club of db.clubs) {
    assert.equal(club.badgeKind, 'monogram');
    const svg = await readFile(new URL(`../public/${club.logo}`, import.meta.url), 'utf8');
    assert.match(svg, /eigenes Vereinsmonogramm/);
    assert.match(svg, /<svg /);
    assert.doesNotMatch(svg, /(?:href=|data:|<script|<image)/);
  }
});

test('a complete development package does not claim historical release readiness', () => {
  const db = getDatabase();
  assert.equal(getDataReadiness(db).developmentCatalogComplete, true);
  assert.ok(db.teams.some((team) => team.verificationStatus === 'pending'));
  assert.equal(getDataReadiness(db).fullCatalogReady, false);
  assert.equal(getGameRules().match.calibrationStatus, 'requires_engine_validation');
  const rules = getGameRules(); rules.strength.bonusCaps.coach = 99;
  assert.equal(getGameRules().strength.bonusCaps.coach, 2);
});
