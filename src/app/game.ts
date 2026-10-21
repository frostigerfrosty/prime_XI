import { getDefaultSettings, getGameRules } from '../data/index.ts';
import { createBuilder } from '../engine/builder.ts';
import { createStrengthModel } from '../engine/strength.ts';
import { formations, positions, tactics, teams } from './catalog.ts';

export const gameRules = getGameRules();
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
