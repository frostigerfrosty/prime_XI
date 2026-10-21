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
  let draft = builder.newDraft('browser-complete', '4-3-3', now);
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
