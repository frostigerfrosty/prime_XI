import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { createStrengthModel, type StrengthInput } from '../src/engine/strength.ts';
import type { FormationId, PositionGroup } from '../src/types/database.ts';

const data = getDatabase();
const model = createStrengthModel(data);
const ratings: Record<PositionGroup, number> = {
  goalkeeper: 80,
  defence: 90,
  midfield: 70,
  attack: 95,
};
function fixture(formationId: FormationId = '4-3-3'): StrengthInput {
  const formation = data.formations.find((item) => item.id === formationId)!;
  const originals = data.teams.find((team) => team.id === 'barcelona-2010-2011')!.players;
  return {
    formationId,
    tacticId: 'balanced',
    coach: null,
    captainPersonId: null,
    lineup: formation.slots.map((slot, index) => {
      // Controlled test cards, not edits to the historical catalog.
      const player = structuredClone(originals[index]!);
      player.id = `card-${index}`;
      player.personId = `person-${index}`;
      player.primeTeamId = `season-${index}`;
      player.position = slot.acceptedPositions[0]!;
      player.secondaryPositions = [];
      player.rating =
        ratings[data.positions.find((position) => position.id === player.position)!.group];
      player.attributes.overall = player.rating;
      player.attributes.goalkeeping = player.position === 'GK' ? player.rating : null;
      player.nationality = `AA${String.fromCharCode(65 + index)}`;
      player.naturalCaptain = false;
      player.styleTags = ['direct'];
      return { slotId: slot.id, player, clubId: `club-${index}` };
    }),
  };
}
function coach(input: StrengthInput, rating = 99) {
  const result = structuredClone(data.teams[0]!.coach!);
  result.preferredFormations = [input.formationId];
  result.styleTags = ['balanced'];
  result.tacticalRating = rating;
  return result;
}

test('base strength matches the hand-calculated 8/27/30/35 weighted group averages', () => {
  const result = model.analyze(fixture());
  // 80*.08 + 90*.27 + 70*.30 + 95*.35 = 84.95.
  assert.equal(result.strength.baseTeamStrength, 84.95);
  assert.equal(result.strength.matchStrength, 84.95);
  assert.deepEqual(
    result.groups.map((group) => group.players),
    [1, 4, 3, 3],
  );
  assert.equal(
    result.contributions.every((pick) => pick.multiplier === 1),
    true,
  );
});

test('all seven formations normalize each assigned group instead of changing its total weight', () => {
  for (const formation of data.formations)
    assert.equal(model.analyze(fixture(formation.id)).strength.baseTeamStrength, 84.95);
});

test('a secondary-position midfielder playing ST loses five percent in the attack group', () => {
  const input = fixture();
  const striker = input.lineup.find((pick) => pick.slotId === 'st-10')!.player;
  striker.position = 'CM';
  striker.secondaryPositions = ['ST'];
  const result = model.analyze(input);
  const contribution = result.contributions.find((pick) => pick.slotId === 'st-10')!;
  assert.equal(contribution.group, 'attack');
  assert.equal(contribution.effectiveRating, 90.25);
  assert.equal(contribution.fit, 'secondary');
  assert.equal(result.strength.baseTeamStrength, 84.4);
  striker.secondaryPositions = [];
  assert.throws(() => model.analyze(input), /ungeeignete Position/);
});

test('chemistry counts every unordered country/club pair once, including different seasons of one club', () => {
  const input = fixture();
  input.lineup.slice(0, 3).forEach((pick) => {
    pick.player.nationality = 'ESP';
  });
  input.lineup[1]!.clubId = 'same-club';
  input.lineup[2]!.clubId = 'same-club';
  const result = model.analyze(input);
  assert.deepEqual(result.chemistry, { sameNationalityPairs: 3, sameClubPairs: 1, pairs: 55 });
  assert.equal(result.strength.chemistryBonus, 0.3);
  const countries = fixture();
  countries.lineup.forEach((pick) => {
    pick.player.nationality = 'ESP';
  });
  assert.equal(model.analyze(countries).strength.chemistryBonus, 4.67);
  const clubs = fixture();
  clubs.lineup.forEach((pick) => {
    pick.clubId = 'shared-club';
  });
  assert.equal(model.analyze(clubs).strength.chemistryBonus, 2.33);
});

test('tactic fit is the matching player share; multiple matching tags do not count a player twice', () => {
  const input = fixture();
  input.lineup.slice(0, 3).forEach((pick) => {
    pick.player.styleTags = ['balanced'];
  });
  assert.equal(model.analyze(input).strength.tacticalBonus, 0.82);
  input.tacticId = 'high-press';
  input.lineup.slice(0, 6).forEach((pick) => {
    pick.player.styleTags = ['high-press', 'transition'];
  });
  assert.equal(model.analyze(input).strength.tacticalBonus, 1.64);
  const outsideRecommendation = fixture('3-5-2');
  outsideRecommendation.lineup.forEach((pick) => {
    pick.player.styleTags = ['balanced'];
  });
  assert.equal(model.analyze(outsideRecommendation).strength.tacticalBonus, 3);
});

test('coach bonus separates formation, style coverage and bounded tactical quality', () => {
  const input = fixture();
  input.coach = coach(input);
  assert.equal(model.analyze(input).strength.coachBonus, 2);
  input.coach.styleTags = ['direct'];
  assert.equal(model.analyze(input).strength.coachBonus, 1.2);
  input.coach.preferredFormations = ['4-4-2'];
  input.coach.styleTags = ['balanced'];
  assert.equal(model.analyze(input).strength.coachBonus, 0.8);
  input.coach.preferredFormations = ['4-3-3'];
  input.coach.tacticalRating = 90;
  assert.equal(model.analyze(input).strength.coachBonus, 1.82);
  input.coach.tacticalRating = 0;
  assert.equal(model.analyze(input).strength.coachBonus, 0);
  input.coach = coach(input);
  input.coach.styleTags = ['transition'];
  input.tacticId = 'high-press';
  assert.equal(model.analyze(input).strength.coachBonus, 1.6);
});

test('only the chosen, actually fielded Natural Captain earns the flat bonus', () => {
  const input = fixture();
  input.lineup[0]!.player.naturalCaptain = true;
  assert.equal(model.analyze(input).strength.captainBonus, 0);
  input.captainPersonId = input.lineup[1]!.player.personId;
  assert.equal(model.analyze(input).strength.captainBonus, 0);
  input.captainPersonId = input.lineup[0]!.player.personId;
  assert.equal(model.analyze(input).strength.captainBonus, 2);
  input.captainPersonId = 'not-in-the-eleven';
  assert.throws(() => model.analyze(input), /Captain/);
});

test('ceiling is 113, component sum is exact to two decimals and player ratings stay unchanged', () => {
  const input = fixture();
  input.lineup.forEach((pick) => {
    pick.player.rating = 99;
    pick.player.attributes.overall = 99;
    pick.player.nationality = 'ESP';
    pick.player.styleTags = ['balanced'];
    pick.clubId = 'shared';
  });
  input.coach = coach(input);
  input.lineup[0]!.player.naturalCaptain = true;
  input.captainPersonId = input.lineup[0]!.player.personId;
  const before = structuredClone(input);
  assert.deepEqual(model.analyze(input).strength, {
    baseTeamStrength: 99,
    chemistryBonus: 7,
    tacticalBonus: 3,
    coachBonus: 2,
    captainBonus: 2,
    matchStrength: 113,
  });
  assert.deepEqual(input, before);
});

test('zero inputs, zero chemistry weights and configurable bonus caps stay finite', () => {
  const input = fixture();
  input.lineup.forEach((pick) => {
    pick.player.rating = 0;
    pick.player.attributes.overall = 0;
  });
  assert.equal(model.analyze(input).strength.matchStrength, 0);
  const config = structuredClone(data);
  config.rules.chemistry.sameNationalityPairWeight = 0;
  config.rules.chemistry.sameClubPairWeight = 0;
  assert.equal(createStrengthModel(config).analyze(input).strength.chemistryBonus, 0);
  config.rules.strength.positionGroupWeights = {
    goalkeeper: 1,
    defence: 0,
    midfield: 0,
    attack: 0,
  };
  assert.equal(createStrengthModel(config).analyze(fixture()).strength.baseTeamStrength, 80);
  config.rules.strength.bonusCaps = { chemistry: 0, tactical: 0, coach: 0, captain: 0 };
  config.rules.strength.naturalCaptainBonus = 0;
  assert.equal(createStrengthModel(config).analyze(fixture()).strength.matchStrength, 80);
});

test('invalid assignments, nonfinite ratings and malformed rules fail instead of generating a strength', () => {
  const mutations: ((input: StrengthInput) => void)[] = [
    (input) => {
      input.lineup.pop();
    },
    (input) => {
      input.lineup[1]!.slotId = input.lineup[0]!.slotId;
    },
    (input) => {
      input.lineup[1]!.player.personId = input.lineup[0]!.player.personId;
    },
    (input) => {
      input.lineup[0]!.player.rating = NaN;
    },
    (input) => {
      input.lineup[0]!.player.attributes.pace = Infinity;
    },
    (input) => {
      input.lineup[0]!.player.rating = 100;
    },
    (input) => {
      input.lineup[0]!.player.attributes.overall = 1;
    },
    (input) => {
      input.tacticId = 'unknown';
    },
    (input) => {
      input.lineup[1]!.player.primeTeamId = input.lineup[0]!.player.primeTeamId;
    },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input);
    assert.throws(() => model.analyze(input));
  }
  const config = structuredClone(data);
  config.rules.strength.positionGroupWeights.attack = NaN;
  assert.throws(() => createStrengthModel(config), /Positionsgewichte/);
});

test('better player quality remains the main effect while model creation isolates external mutations', () => {
  const input = fixture();
  const previous = model.analyze(input).strength.matchStrength;
  input.lineup.forEach((pick) => {
    pick.player.rating += 4;
    pick.player.attributes.overall += 4;
  });
  assert.equal(model.analyze(input).strength.matchStrength, previous + 4);
  const config = structuredClone(data);
  const isolated = createStrengthModel(config);
  config.rules.strength.positionGroupWeights.attack = 0;
  assert.equal(isolated.analyze(fixture()).strength.baseTeamStrength, 84.95);
});

test('every catalog player and coach is usable without confusing historical review with valid game data', () => {
  for (const team of data.teams) {
    for (const player of team.players) assert.equal(model.isPlayer(player), true, player.id);
    assert.equal(model.isCoach(team.coach), true, team.id);
  }
});
