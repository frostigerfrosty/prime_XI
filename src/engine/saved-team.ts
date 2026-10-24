import type { DraftState, SavedTeam, StrengthBreakdown } from '../types/application.ts';
import type { Builder } from './builder.ts';
import { isRecord, isText, type StrengthInput, type StrengthModel } from './strength.ts';

export function strengthInput(draft: DraftState, builder: Builder): StrengthInput {
  if (!builder.isValid(draft)) throw new Error('Der Draft ist ungültig.');
  return {
    formationId: draft.formationId,
    tacticId: draft.tacticId,
    lineup: builder
      .lineup(draft)
      .map((pick) => ({ ...pick, clubId: builder.team(pick.player.primeTeamId)!.clubId })),
    coach: draft.coachCardId ? builder.coach(draft.coachCardId)! : null,
    captainPersonId: draft.captainPersonId,
  };
}

export function createSavedTeam(
  draft: DraftState,
  builder: Builder,
  model: StrengthModel,
  datasetVersion: string,
  now = new Date().toISOString(),
): SavedTeam {
  if (!isText(datasetVersion) || !isText(now) || !Number.isFinite(Date.parse(now)))
    throw new Error('Ungültige Metadaten für das gespeicherte Team.');
  if (!builder.status(draft).complete)
    throw new Error(
      'Zum Speichern werden elf gültige Spieler, ein Coach und ein Captain benötigt.',
    );
  const input = strengthInput(draft, builder);
  const analysis = model.analyze(input);
  return structuredClone({
    id: `team-${draft.id}`,
    draftId: draft.id,
    name: 'Meine Prime XI',
    createdAt: now,
    datasetVersion,
    rulesVersion: model.rulesVersion,
    ...(draft.mode === 'sequential' ? { draftMode: 'sequential' as const } : {}),
    drawnPrimeTeamIds: draft.drawnPrimeTeamIds,
    formationId: input.formationId,
    tacticId: input.tacticId,
    lineup: input.lineup,
    coach: input.coach!,
    captainPersonId: input.captainPersonId!,
    strength: analysis.strength,
  });
}

const strengthKeys: (keyof StrengthBreakdown)[] = [
  'baseTeamStrength',
  'chemistryBonus',
  'tacticalBonus',
  'coachBonus',
  'captainBonus',
  'matchStrength',
];

/** Validate against embedded snapshots, never replace them with today's cards. */
export function isSavedTeam(value: unknown, model: StrengthModel): value is SavedTeam {
  if (
    !isRecord(value) ||
    !['id', 'draftId', 'name', 'datasetVersion', 'createdAt'].every((key) => isText(value[key])) ||
    !Number.isFinite(Date.parse(value['createdAt'] as string)) ||
    value['rulesVersion'] !== model.rulesVersion ||
    !Array.isArray(value['drawnPrimeTeamIds']) ||
    !(value['draftMode'] === undefined || value['draftMode'] === 'sequential') ||
    value['drawnPrimeTeamIds'].length !==
      (value['draftMode'] === 'sequential'
        ? model.rules.builder.playersRequired
        : model.rules.builder.drawSize) ||
    !value['drawnPrimeTeamIds'].every(isText) ||
    new Set(value['drawnPrimeTeamIds']).size !== value['drawnPrimeTeamIds'].length ||
    !Array.isArray(value['lineup']) ||
    !model.isCoach(value['coach']) ||
    !isText(value['captainPersonId']) ||
    !isRecord(value['strength'])
  )
    return false;
  const sources = new Map<string, number>();
  for (const pick of value['lineup']) {
    if (
      !isRecord(pick) ||
      !model.isPlayer(pick['player']) ||
      !isText(pick['slotId']) ||
      !isText(pick['clubId']) ||
      !value['drawnPrimeTeamIds'].includes(pick['player'].primeTeamId)
    )
      return false;
    const count = (sources.get(pick['player'].primeTeamId) ?? 0) + 1;
    if (count > model.rules.builder.maxPlayersPerPrimeTeam) return false;
    sources.set(pick['player'].primeTeamId, count);
  }
  if (!value['drawnPrimeTeamIds'].includes(value['coach'].primeTeamId)) return false;
  try {
    const expected = model.analyze(value as unknown as StrengthInput).strength;
    const saved = value['strength'];
    return strengthKeys.every(
      (key) =>
        typeof saved[key] === 'number' &&
        Number.isFinite(saved[key]) &&
        Math.abs(saved[key] - expected[key]) < 1e-9,
    );
  } catch {
    return false;
  }
}

export function savedTeamMatchesDraft(
  team: SavedTeam,
  draft: DraftState,
  builder: Builder,
  model: StrengthModel,
  datasetVersion: string,
): boolean {
  if (
    !builder.status(draft).complete ||
    team.draftId !== draft.id ||
    team.datasetVersion !== datasetVersion ||
    team.rulesVersion !== model.rulesVersion
  )
    return false;
  const current = strengthInput(draft, builder);
  const normalized = (input: StrengthInput) => ({
    formationId: input.formationId,
    tacticId: input.tacticId,
    captainPersonId: input.captainPersonId,
    coach: input.coach,
    lineup: [...input.lineup].sort((a, b) => a.slotId.localeCompare(b.slotId)),
  });
  return JSON.stringify(normalized(team)) === JSON.stringify(normalized(current));
}
