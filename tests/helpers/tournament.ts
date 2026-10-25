import { getDatabase } from '../../src/data/index.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { createSavedTeam } from '../../src/engine/saved-team.ts';
import { createTournamentEngine } from '../../src/engine/tournament.ts';

export function tournamentFixture() {
  const data = getDatabase();
  const now = '2026-10-21T12:00:00.000Z';
  const builder = createBuilder({
    teams: data.teams,
    formations: data.formations,
    tacticIds: data.tactics.map((t) => t.id),
    rules: data.rules.builder,
    defaultTactic: data.defaults.defaultTactic,
  });
  const model = createStrengthModel(data);
  let draft = builder.newPoolDraft('browser-complete', '4-3-3', now);
  for (const pick of builder.completion(draft)!)
    draft = builder.change(
      draft,
      { type: 'player', slotId: pick.slotId, cardId: pick.playerCardId },
      now,
    );
  draft = builder.change(
    draft,
    { type: 'coach', cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id },
    now,
  );
  const team = createSavedTeam(draft, builder, model, data.datasetVersion, now);
  const environment = {
    teams: data.teams,
    rules: data.rules,
    strengthModel: model,
    datasetVersion: data.datasetVersion,
    defaultTactic: data.defaults.defaultTactic,
  };
  const engine = createTournamentEngine(environment);
  return { data, now, builder, model, draft, team, environment, engine };
}

/** A valid high-strength snapshot for testing the real winner path, not fixed scores. */
export function championTestTeam(fixture: ReturnType<typeof tournamentFixture>) {
  const team = structuredClone(fixture.team);
  for (const { player } of team.lineup) {
    player.rating = 99;
    for (const key of Object.keys(player.attributes) as (keyof typeof player.attributes)[])
      if (player.attributes[key] !== null) player.attributes[key] = 99;
    player.nationality = 'ENG';
    player.styleTags = ['balanced'];
    if (player.personId === team.captainPersonId) player.naturalCaptain = true;
  }
  team.coach.tacticalRating = 99;
  team.coach.preferredFormations = [team.formationId];
  team.coach.styleTags = ['balanced'];
  team.tacticId = 'balanced';
  team.strength = fixture.model.analyze(team).strength;
  return team;
}

/** Find a real shoot-out under the current catalogue; never fabricate a result. */
export function playoffShootoutFixture(fixture: ReturnType<typeof tournamentFixture>) {
  for (let index = 0; index < 32; index++) {
    const league = fixture.engine.finishLeague(
      fixture.engine.start(fixture.team, `shootout-fixture-${index}`, fixture.now),
    );
    const drawn = fixture.engine.drawNextRound(league);
    const state = fixture.engine.nextKnockoutLeg(
      fixture.engine.nextKnockoutLeg(drawn, fixture.now),
      fixture.now,
    );
    const tie = state.knockoutTies.find((tie) =>
      state.matches.some(
        (match) =>
          tie.matchIds.includes(match.id) &&
          match.status === 'played' &&
          match.result.penalties !== null,
      ),
    );
    if (tie) return { state, tie };
  }
  throw new Error('No deterministic playoff shoot-out fixture found.');
}
