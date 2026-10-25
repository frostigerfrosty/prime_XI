import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { validateRules } from './validate-rules.mjs';
import { evaluateSeasonRating } from '../src/engine/ratings.ts';

const schema = JSON.parse(
  readFileSync(new URL('../data/schema/database.schema.json', import.meta.url), 'utf8'),
);
const checkSchema = new Ajv({ allErrors: true, strict: true }).compile(schema);

/** Validate shape first, then the relationships that JSON Schema cannot express. */
export function validateDatabase(db) {
  if (!checkSchema(db)) {
    return checkSchema.errors.map((error) => `${error.instancePath || '/'}: ${error.message}`);
  }
  const errors = validateRules(db.rules);
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const unique = (items, label) =>
    assert(new Set(items).size === items.length, `Duplicate ${label}`);
  for (const key of [
    'people',
    'clubs',
    'formations',
    'sources',
    'coverage',
    'teams',
    'tasks',
    'positions',
    'countries',
    'tactics',
  ]) {
    unique(
      db[key].map((item) => item.id),
      `${key} ID`,
    );
  }
  const people = new Map(db.people.map((person) => [person.id, person]));
  const clubs = new Map(db.clubs.map((club) => [club.id, club]));
  const formations = new Map(db.formations.map((formation) => [formation.id, formation]));
  const sources = new Map(db.sources.map((source) => [source.id, source]));
  const teams = new Map(db.teams.map((team) => [team.id, team]));
  const slots = new Map(db.coverage.map((slot) => [slot.id, slot]));
  const countries = new Set(db.countries.map((country) => country.id));
  const positionIds = new Set(db.positions.map((position) => position.id));
  for (const person of db.people)
    for (const country of person.nationalities) {
      assert(countries.has(country), `${person.id}: country label missing for ${country}`);
    }
  for (const club of db.clubs) {
    assert(
      club.logo === `assets/clubs/${club.id}.svg`,
      `${club.id}: badge must have a stable relative path`,
    );
    assert(countries.has(club.country), `${club.id}: country label missing`);
  }
  assert(db.positions.length === 14, 'Position catalog must cover all 14 roles');
  assert(formations.has(db.rules.builder.defaultFormation), 'Unknown default formation');
  assert(
    db.tactics.some((tactic) => tactic.id === db.defaults.defaultTactic),
    'Unknown default tactic',
  );
  for (const tactic of db.tactics)
    for (const formation of tactic.preferredFormations) {
      assert(formations.has(formation), `${tactic.id}: missing tactic formation ${formation}`);
    }
  const checkSources = (ids, label) => {
    for (const id of ids) assert(sources.has(id), `${label}: unknown source ${id}`);
  };
  const sourceReviewed = (id) =>
    sources.get(id)?.accessStatus === 'retrieved' && sources.get(id)?.checkedAt != null;

  for (const source of db.sources) {
    assert(
      (source.accessStatus === 'retrieved') === (source.checkedAt !== null),
      `${source.id}: source retrieval date/status mismatch`,
    );
    if (source.checkedAt !== null) {
      const timestamp = Date.parse(source.checkedAt);
      assert(
        Number.isFinite(timestamp) &&
          new Date(timestamp).toISOString().slice(0, 10) === source.checkedAt,
        `${source.id}: invalid source review date`,
      );
    }
  }
  for (const formation of db.formations) {
    unique(
      formation.slots.map((slot) => slot.id),
      `${formation.id} slot`,
    );
    assert(
      formation.slots.filter((slot) => slot.acceptedPositions.includes('GK')).length === 1,
      `${formation.id}: exactly one goalkeeper slot required`,
    );
    for (const slot of formation.slots)
      for (const position of slot.acceptedPositions) {
        assert(positionIds.has(position), `${formation.id}: missing position label ${position}`);
      }
    unique(
      formation.slots.map((slot) => `${slot.coordinates.x},${slot.coordinates.y}`),
      `${formation.id} pitch coordinates`,
    );
  }
  for (const year of db.targetYears) {
    const yearSlots = db.coverage.filter((slot) => slot.year === year);
    assert(
      yearSlots.length === db.targetTeamsPerYear,
      `${year}: exactly 3 coverage slots required`,
    );
    unique(
      yearSlots.map((slot) => slot.selectionNumber),
      `${year} selection number`,
    );
  }
  unique(
    db.coverage.filter((slot) => slot.teamId !== null).map((slot) => slot.teamId),
    'coverage team',
  );
  for (const slot of db.coverage) {
    assert(
      slot.id === `${slot.year}-${slot.selectionNumber}`,
      `${slot.id}: inconsistent coverage ID`,
    );
    if (slot.teamId !== null)
      assert(teams.get(slot.teamId)?.year === slot.year, `${slot.id}: missing team or wrong year`);
    const team = teams.get(slot.teamId);
    const expectedKind = !team
      ? 'team_selection'
      : !team.players.length
        ? 'roster_research'
        : team.verificationStatus === 'pending'
          ? 'historical_review'
          : null;
    const tasks = db.tasks.filter((task) => task.slotId === slot.id);
    assert(tasks.length === (expectedKind ? 1 : 0), `${slot.id}: missing or redundant data task`);
    if (expectedKind)
      assert(
        tasks[0]?.kind === expectedKind && tasks[0]?.teamId === slot.teamId,
        `${slot.id}: data task does not match missing work`,
      );
  }
  for (const task of db.tasks) {
    assert(task.teamId === null || teams.has(task.teamId), `${task.id}: unknown task team`);
    assert(task.slotId !== null && slots.has(task.slotId), `${task.id}: unknown task slot`);
  }

  const allPlayerIds = [];
  const allCoachIds = [];
  unique(
    db.teams.map((team) => `${team.year}:${team.clubId}`),
    'club-season',
  );
  for (const team of db.teams) {
    const label = team.id;
    const club = clubs.get(team.clubId);
    assert(club?.name === team.clubName, `${label}: unknown club or inconsistent club name`);
    assert(
      db.coverage.filter((slot) => slot.teamId === team.id).length === 1,
      `${label}: team must occupy exactly one coverage slot`,
    );
    assert(
      label === `${team.clubId}-${team.year - 1}-${team.year}`,
      `${label}: inconsistent team ID`,
    );
    assert(
      team.season === `${team.year - 1}/${String(team.year).slice(-2)}`,
      `${label}: wrong season end year`,
    );
    checkSources(team.sourceIds, label);

    if (!team.players.length) {
      assert(
        team.status === 'research_pending' &&
          team.rosterScope === 'not_entered' &&
          team.coach === null &&
          team.captainPersonId === null &&
          team.formation === null &&
          team.teamRating === null &&
          team.defaultLineup.length === 0 &&
          team.verificationStatus === 'pending',
        `${label}: research-only team must not contain invented gameplay data`,
      );
      continue;
    }
    assert(
      team.rosterScope === 'curated_squad' && team.players.length >= 18,
      `${label}: curated squad requires at least 18 players`,
    );
    assert(
      team.status === (team.verificationStatus === 'verified' ? 'reviewed' : 'editorial_draft'),
      `${label}: team review status mismatch`,
    );
    assert(team.coach !== null, `${label}: missing coach`);
    assert(
      team.captainPersonId !== null && people.has(team.captainPersonId),
      `${label}: missing captain identity`,
    );
    unique(
      team.players.map((player) => player.personId),
      `${label} player identity`,
    );
    const formation = formations.get(team.formation);
    assert(formation !== undefined, `${label}: unknown formation`);
    assert(team.defaultLineup.length === 11, `${label}: incomplete default lineup`);
    unique(
      team.defaultLineup.map((pick) => pick.slotId),
      `${label} lineup slot`,
    );
    unique(
      team.defaultLineup.map((pick) => pick.playerId),
      `${label} lineup player`,
    );
    assert(
      team.players.filter((player) => player.position === 'GK').length >= 2,
      `${label}: at least two squad goalkeepers required`,
    );

    for (const pick of team.defaultLineup) {
      const slot = formation?.slots.find((candidate) => candidate.id === pick.slotId);
      const player = team.players.find((candidate) => candidate.id === pick.playerId);
      assert(
        slot !== undefined && player !== undefined,
        `${label}: lineup references missing slot/player`,
      );
      if (slot && player)
        assert(
          slot.acceptedPositions.some(
            (position) =>
              position === player.position || player.secondaryPositions.includes(position),
          ),
          `${label}: position mismatch for ${player.personId}`,
        );
    }

    for (const player of team.players) {
      allPlayerIds.push(player.id);
      const person = people.get(player.personId);
      assert(
        person?.name === player.name && person?.nationalities.includes(player.nationality),
        `${player.id}: unknown or inconsistent player identity`,
      );
      assert(
        player.id === `${label}:${player.personId}` &&
          player.primeTeamId === label &&
          player.season === team.season,
        `${player.id}: inconsistent season/team reference`,
      );
      assert(
        !player.secondaryPositions.includes(player.position),
        `${player.id}: primary repeated as secondary position`,
      );
      assert(
        player.naturalCaptain === (player.personId === team.captainPersonId),
        `${player.id}: inconsistent captain flag`,
      );
      assert(player.ratingModelId === db.ratingModel.id, `${player.id}: unknown rating model`);
      try {
        const result = evaluateSeasonRating(player.ratingAssessment, db.ratingModel.rubric);
        assert(
          player.rating === result.rating,
          `${player.id}: rating disagrees with its season assessment`,
        );
        checkSources(player.ratingAssessment.sourceIds, player.id);
        assert(
          player.ratingAssessment.sourceIds.every(sourceReviewed),
          `${player.id}: rating assessment has unread sources`,
        );
      } catch (error) {
        assert(false, `${player.id}: invalid season assessment: ${error.message}`);
      }
      assert(player.attributes.overall === player.rating, `${player.id}: inconsistent overall`);
      assert(
        player.attributes.goalkeeping === (player.position === 'GK' ? player.rating : null),
        `${player.id}: inappropriate goalkeeper attribute`,
      );
      checkSources(player.sourceIds, player.id);
    }
    const startingPlayers = team.defaultLineup.map((pick) =>
      team.players.find((player) => player.id === pick.playerId),
    );
    const expectedRating =
      Math.round(
        (startingPlayers.reduce((sum, player) => sum + (player?.rating ?? 0), 0) / 11) * 10,
      ) / 10;
    assert(team.teamRating === expectedRating, `${label}: incorrect default-XI team average`);

    if (team.coach) {
      const coach = team.coach;
      allCoachIds.push(coach.id);
      assert(
        people.get(coach.personId)?.name === coach.name,
        `${label}: unknown or inconsistent coach identity`,
      );
      assert(
        coach.id === `${label}:coach:${coach.personId}` && coach.primeTeamId === label,
        `${label}: inconsistent coach/team reference`,
      );
      for (const preferred of coach.preferredFormations)
        assert(formations.has(preferred), `${label}: unknown coach formation`);
      checkSources(coach.sourceIds, coach.id);
    }

    if (team.verificationStatus === 'verified') {
      assert(team.sourceIds.every(sourceReviewed), `${label}: verified team has unread references`);
      assert(club?.verificationStatus === 'verified', `${label}: unverified club identity`);
      assert(
        people.get(team.captainPersonId)?.verificationStatus === 'verified',
        `${label}: unverified captain identity`,
      );
      for (const player of team.players)
        assert(
          player.verificationStatus === 'verified' &&
            people.get(player.personId)?.verificationStatus === 'verified' &&
            player.sourceIds.every(sourceReviewed),
          `${label}: unverified player in reviewed team`,
        );
      assert(
        team.coach?.verificationStatus === 'verified' &&
          people.get(team.coach?.personId)?.verificationStatus === 'verified' &&
          team.coach?.sourceIds.every(sourceReviewed),
        `${label}: unverified coach in reviewed team`,
      );
    }
  }
  unique(allPlayerIds, 'player card ID');
  unique(allCoachIds, 'coach card ID');
  return errors;
}
