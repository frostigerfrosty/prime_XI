import { tournamentFixture } from './tournament.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { createTournamentEngine } from '../../src/engine/tournament.ts';
import { createSavedTeam } from '../../src/engine/saved-team.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';
import { createHistoryEntry } from '../../src/engine/history.ts';
import previousRatings from '../fixtures/legacy-ratings.json' with { type: 'json' };

/** Previous gameplay values, before the three dated Laporte nationality corrections. */
export function legacyCatalogFixture() {
  const f = tournamentFixture();
  const data = structuredClone(f.data);
  data.datasetVersion = '0.2.0';
  data.ratingModel.id = previousRatings.ratingModelId;
  for (const team of data.teams)
    for (const player of team.players) {
      const old = previousRatings.cards[player.id as keyof typeof previousRatings.cards];
      player.rating = old.rating;
      player.attributes = structuredClone(old.attributes);
      player.ratingModelId = previousRatings.ratingModelId;
      player.ratingStatus = 'approved';
      delete player.ratingAssessment;
      if (player.personId === 'laporte' && team.year >= 2021) player.nationality = 'FRA';
    }
  for (const team of data.teams)
    team.teamRating =
      Math.round(
        (team.defaultLineup.reduce(
          (sum, pick) => sum + team.players.find((player) => player.id === pick.playerId)!.rating,
          0,
        ) /
          11) *
          10,
      ) / 10;
  const builder = createBuilder({
    teams: data.teams,
    formations: data.formations,
    tacticIds: data.tactics.map((t) => t.id),
    rules: data.rules.builder,
    defaultTactic: data.defaults.defaultTactic,
  });
  const team = createSavedTeam(f.draft, builder, f.model, data.datasetVersion, f.now);
  const engine = createTournamentEngine({
    teams: data.teams,
    rules: data.rules,
    strengthModel: f.model,
    datasetVersion: data.datasetVersion,
    defaultTactic: data.defaults.defaultTactic,
  });
  let tournament = engine.start(team, 'legacy-country-0', f.now);
  for (
    let index = 1;
    index < 10 &&
    !tournament.participants.some(
      (p) =>
        p.kind === 'prime' &&
        p.team.year >= 2021 &&
        p.team.players.some((card) => card.personId === 'laporte'),
    );
    index++
  )
    tournament = engine.start(team, `legacy-country-${index}`, f.now);
  const finished = engine.finishTournament(
    engine.finishLeague(engine.start(team, 'legacy-country-history', f.now)),
    f.now,
  );
  const state = {
    ...createInitialAppState(),
    datasetVersion: data.datasetVersion,
    currentDraft: f.draft,
    currentTeam: team,
    currentTournament: tournament,
    completedTournaments: [createHistoryEntry(finished, engine)],
  };
  return { ...f, legacy: { data, builder, team, engine, tournament, state } };
}
