import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateDatabase } from './validate-data.mjs';
import { renderClubBadge } from './club-badges.mjs';

const root = new URL('../', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(`data/editorial/${name}.json`, root), 'utf8'));

/** Pure generation: no clock, network, random values, or implicit rating changes. */
export async function buildDatabase() {
  const [people, rawClubs, seeds, formations, sources, ratingModel, policy, positions, countries, tactics, rules, defaults] = await Promise.all(
    ['people', 'clubs', 'teams', 'formations', 'sources', 'rating-model', 'selection-policy', 'positions', 'countries', 'tactics', 'game-rules', 'defaults'].map(read),
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const clubs = rawClubs.map(({ wikipediaSeasonClub: _, ...club }) => ({
    ...club, logo: `assets/clubs/${club.id}.svg`, badgeKind: 'monogram',
  }));
  const clubsById = new Map(clubs.map((c) => [c.id, c]));
  const teams = seeds.map((seed) => {
    const club = clubsById.get(seed.clubId);
    if (!club) throw new Error(`Unknown club ${seed.clubId}`);
    const season = `${seed.year - 1}/${String(seed.year).slice(-2)}`;
    const formation = formations.find((f) => f.id === seed.formation);
    const populated = seed.players.length > 0;
    if (populated && !formation) throw new Error(`Unknown formation in ${seed.id}`);
    if (populated && (seed.players.length < 18 || seed.startingXI?.length !== 11)) {
      throw new Error(`${seed.id}: at least 18 squad members and an explicit default XI required`);
    }
    const players = seed.players.map((player) => {
      const person = peopleById.get(player.personId);
      if (!person || !player.attributes) throw new Error(`Missing identity/explicit attributes in ${seed.id}: ${player.personId}`);
      return {
        id: `${seed.id}:${person.id}`,
        personId: person.id,
        name: person.name,
        nationality: player.nationality,
        primeTeamId: seed.id,
        season,
        position: player.position,
        secondaryPositions: player.secondaryPositions,
        rating: player.rating,
        attributes: player.attributes,
        styleTags: player.styleTags,
        ratingStatus: player.ratingStatus,
        ratingModelId: ratingModel.id,
        naturalCaptain: seed.captainPersonId === person.id,
        verificationStatus: seed.verificationStatus,
        sourceIds: seed.sourceIds,
      };
    });
    const coach = seed.coachPersonId ? peopleById.get(seed.coachPersonId) : null;
    if (seed.coachPersonId && !coach) throw new Error(`Unknown coach in ${seed.id}`);
    return {
      id: seed.id,
      clubId: club.id,
      clubName: club.name,
      season,
      year: seed.year,
      logo: club.logo,
      status: !populated ? 'research_pending' : seed.verificationStatus === 'verified' ? 'reviewed' : 'editorial_draft',
      rosterScope: populated ? 'curated_squad' : 'not_entered',
      formation: seed.formation,
      coach: coach ? {
        id: `${seed.id}:coach:${coach.id}`,
        personId: coach.id,
        name: coach.name,
        primeTeamId: seed.id,
        preferredFormations: [seed.formation],
        tacticalRating: seed.coachTacticalRating,
        styleTags: seed.coachStyleTags,
        ratingStatus: seed.coachRatingStatus,
        verificationStatus: seed.coachVerificationStatus ?? seed.verificationStatus,
        sourceIds: seed.coachSourceIds ?? seed.sourceIds,
      } : null,
      captainPersonId: seed.captainPersonId,
      players,
      defaultLineup: (seed.startingXI ?? []).map((id, index) => ({ slotId: formation.slots[index].id, playerId: `${seed.id}:${id}` })),
      teamRating: populated ? Math.round(seed.startingXI.reduce((sum, id) => {
        const player = players.find((candidate) => candidate.personId === id);
        if (!player) throw new Error(`${seed.id}: default XI references missing player ${id}`);
        return sum + player.rating;
      }, 0) / 11 * 10) / 10 : null,
      verificationStatus: seed.verificationStatus,
      sourceIds: seed.sourceIds,
    };
  });

  const coverage = policy.targetYears.flatMap((year) => {
    const selected = teams.filter((t) => t.year === year);
    if (selected.length > policy.targetTeamsPerYear) throw new Error(`Too many selected teams for ${year}`);
    return Array.from({ length: policy.targetTeamsPerYear }, (_, index) => ({
      id: `${year}-${index + 1}`, year, selectionNumber: index + 1, teamId: selected[index]?.id ?? null,
    }));
  });
  const tasks = coverage.flatMap((slot) => {
    const team = teams.find((t) => t.id === slot.teamId);
    if (!team) return [{
      id: `select-${slot.id}`, teamId: null, slotId: slot.id, kind: 'team_selection',
      description: `${slot.year}: Kandidat ${slot.selectionNumber} recherchieren und begründet auswählen; keinen Vereinsnamen erfinden.`,
    }];
    if (!team.players.length) return [{
      id: `research-${team.id}`, teamId: team.id, slotId: slot.id, kind: 'roster_research',
      description: `${team.clubName} ${team.season}: Auswahl, Elf, Trainer, Captain und Saisonrollen belegen; danach Spielratings erstellen.`,
    }];
    if (team.verificationStatus === 'pending') return [{
      id: `review-${team.id}`, teamId: team.id, slotId: slot.id, kind: 'historical_review',
      description: `${team.clubName} ${team.season}: Kaderzugehörigkeit, Saison-Nationalitäten, Captain und Positionsrollen belegen${team.coach?.verificationStatus === 'verified' ? '; Trainername bereits am Saisonregister abgeglichen.' : '; Trainer-Zuordnung noch belegen.'}`,
    }];
    return [];
  });
  return {
    schemaVersion: 2,
    datasetVersion: policy.datasetVersion,
    status: policy.status,
    targetYears: policy.targetYears,
    targetTeamsPerYear: policy.targetTeamsPerYear,
    people, clubs, formations, sources, coverage, teams, tasks, ratingModel,
    positions, countries, tactics, rules, defaults,
  };
}

async function main() {
  const db = await buildDatabase();
  const errors = validateDatabase(db);
  if (errors.length) throw new Error(`Invalid dataset:\n${errors.join('\n')}`);
  const output = `${JSON.stringify(db, null, 2)}\n`;
  const destination = new URL('src/data/database.json', root);
  if (process.argv.includes('--check')) {
    const saved = await readFile(destination, 'utf8');
    if (saved !== output) throw new Error('Generated database is stale. Run npm run data:build.');
    for (const club of db.clubs) {
      const badge = await readFile(new URL(`public/${club.logo}`, root), 'utf8');
      if (badge !== renderClubBadge(club)) throw new Error(`Stale club badge: ${club.logo}`);
    }
    console.log('Database is valid and exactly matches its editorial sources.');
  } else {
    await mkdir(new URL('src/data/', root), { recursive: true });
    await writeFile(destination, output);
    await mkdir(new URL('public/assets/clubs/', root), { recursive: true });
    for (const club of db.clubs) await writeFile(new URL(`public/${club.logo}`, root), renderClubBadge(club));
    console.log(`Built ${db.teams.length} candidates, ${db.teams.reduce((n, t) => n + t.players.length, 0)} cards, ${db.coverage.length} year slots.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
