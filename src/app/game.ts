import { getDatasetVersion, getDefaultSettings, getGameRules } from '../data/index.ts';
import { createBuilder } from '../engine/builder.ts';
import { createStrengthModel } from '../engine/strength.ts';
import { createMatchEngine } from '../engine/match.ts';
import { createTournamentEngine } from '../engine/tournament.ts';
import { formations, positions, tactics, teams } from './catalog.ts';

export const gameRules = getGameRules();
export const matchEngine = createMatchEngine(gameRules);
export const builder = createBuilder({
  teams,
  formations,
  tacticIds: tactics.map((tactic) => tactic.id),
  rules: gameRules.builder,
  defaultTactic: getDefaultSettings().defaultTactic,
});
export const strengthModel = createStrengthModel({
  rules: gameRules,
  formations,
  positions,
  tactics,
});
export const tournamentEngine = createTournamentEngine({
  teams,
  rules: gameRules,
  strengthModel,
  datasetVersion: getDatasetVersion(),
  defaultTactic: getDefaultSettings().defaultTactic,
});
