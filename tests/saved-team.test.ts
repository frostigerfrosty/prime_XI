import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { createBuilder } from '../src/engine/builder.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import {
  createSavedTeam,
  isSavedTeam,
  savedTeamMatchesDraft,
  strengthInput,
} from '../src/engine/saved-team.ts';
import { readSavedTeam, writeSavedTeam, teamStorageKey } from '../src/utils/team-storage.ts';
import type { SavedTeam } from '../src/types/application.ts';

function fixture() {
  const data = getDatabase();
  const builder = createBuilder({
    teams: data.teams,
    formations: data.formations,
    tacticIds: data.tactics.map((tactic) => tactic.id),
    rules: data.rules.builder,
    defaultTactic: data.defaults.defaultTactic,
  });
  const model = createStrengthModel(data);
  let draft = builder.newDraft('saved-strength', '4-3-3', '2020-01-01T00:00:00.000Z');
  for (const pick of builder.completion(draft)!)
    draft = builder.change(draft, {
      type: 'player',
      slotId: pick.slotId,
      cardId: pick.playerCardId,
    });
  draft = builder.change(draft, {
    type: 'coach',
    cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id,
  });
  draft = builder.change(draft, {
    type: 'captain',
    personId: builder.lineup(draft)[0]!.player.personId,
  });
  return {
    data,
    builder,
    model,
    draft,
    team: createSavedTeam(draft, builder, model, data.datasetVersion),
  };
}
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test('saving requires a valid complete team and embeds independent player, coach and strength snapshots', () => {
  const { data, builder, model, draft, team } = fixture();
  assert.equal(isSavedTeam(team, model), true);
  assert.deepEqual(team.strength, model.analyze(strengthInput(draft, builder)).strength);
  assert.equal(team.rulesVersion, data.rules.version);
  assert.equal(team.drawnPrimeTeamIds.length, 12);
  assert.equal(savedTeamMatchesDraft(team, draft, builder, model, data.datasetVersion), true);
  const partial = builder.change(draft, { type: 'remove', slotId: draft.picks[0]!.slotId });
  assert.throws(
    () => createSavedTeam(partial, builder, model, data.datasetVersion),
    /elf gültige Spieler/,
  );
  const original = structuredClone(team);
  builder.player(team.lineup[0]!.player.id)!.rating = 1;
  builder.player(team.lineup[0]!.player.id)!.attributes.overall = 1;
  builder.coach(team.coach.id)!.tacticalRating = 1;
  assert.deepEqual(team, original);
  assert.equal(isSavedTeam(team, model), true);
  assert.equal(savedTeamMatchesDraft(team, draft, builder, model, data.datasetVersion), false);
});

test('editing or replacing the draft preserves the last saved team until the next explicit save', () => {
  const { data, builder, model, draft, team } = fixture();
  const before = structuredClone(team);
  const edited = builder.change(draft, { type: 'tactic', tacticId: 'counter-attack' });
  assert.equal(savedTeamMatchesDraft(team, edited, builder, model, data.datasetVersion), false);
  const restored = builder.change(edited, { type: 'tactic', tacticId: draft.tacticId });
  assert.equal(savedTeamMatchesDraft(team, restored, builder, model, data.datasetVersion), true);
  const next = builder.newDraft('another-pool', draft.formationId);
  assert.equal(savedTeamMatchesDraft(team, next, builder, model, data.datasetVersion), false);
  assert.deepEqual(team, before);
});

test('a saved team survives later catalog versions because validation uses its own snapshots', () => {
  const { model, team } = fixture();
  const storage = memory();
  team.datasetVersion = 'old-editorial-version';
  assert.equal(writeSavedTeam(storage, team, model), true);
  assert.deepEqual(readSavedTeam(storage, model), { team, warning: null });
  const restored = readSavedTeam(storage, model).team!;
  restored.lineup[0]!.player.attributes.passing = 0;
  assert.notDeepEqual(readSavedTeam(storage, model).team, restored);
});

test('corrupt scores, cards, coach, captain, source IDs and unknown rule versions are rejected', () => {
  const { model, team } = fixture();
  const mutations: ((value: SavedTeam) => void)[] = [
    (value) => {
      value.strength.matchStrength = 999;
    },
    (value) => {
      value.strength.chemistryBonus = -1;
    },
    (value) => {
      value.lineup[0]!.player.attributes.pace = Infinity;
    },
    (value) => {
      value.lineup[0]!.player.attributes.overall = -1;
    },
    (value) => {
      value.lineup[1]!.player.personId = value.lineup[0]!.player.personId;
    },
    (value) => {
      value.lineup[1]!.slotId = value.lineup[0]!.slotId;
    },
    (value) => {
      value.lineup[0]!.player.primeTeamId = 'not-in-pool';
    },
    (value) => {
      value.coach.primeTeamId = 'not-in-pool';
    },
    (value) => {
      value.coach.tacticalRating = NaN;
    },
    (value) => {
      value.captainPersonId = 'not-in-team';
    },
    (value) => {
      value.drawnPrimeTeamIds[1] = value.drawnPrimeTeamIds[0]!;
    },
    (value) => {
      value.rulesVersion = 'future-rules';
    },
    (value) => {
      value.createdAt = 'invalid';
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(team);
    mutate(changed);
    assert.equal(isSavedTeam(changed, model), false);
  }
  for (const value of [null, [], {}, { lineup: null }])
    assert.equal(isSavedTeam(value, model), false);
});

test('invalid saved data is preserved on read and unrelated draft/settings keys are untouched', () => {
  const { model, team, data } = fixture();
  const storage = memory();
  storage.setItem(data.rules.storage.keys.currentDraft, 'draft-preserved');
  storage.setItem(data.rules.storage.keys.userSettings, 'settings-preserved');
  for (const raw of [
    '{broken',
    'null',
    JSON.stringify({ schemaVersion: 99, team }),
    JSON.stringify({ schemaVersion: 1, team: { ...team, strength: null } }),
  ]) {
    storage.setItem(teamStorageKey, raw);
    const result = readSavedTeam(storage, model);
    assert.equal(result.team, null);
    assert.ok(result.warning);
    assert.equal(storage.getItem(teamStorageKey), raw);
  }
  assert.equal(storage.getItem(data.rules.storage.keys.currentDraft), 'draft-preserved');
  assert.equal(storage.getItem(data.rules.storage.keys.userSettings), 'settings-preserved');
});

test('storage quota/access failures never pretend a saved team was persisted', () => {
  const { model, team } = fixture();
  const blocked = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.equal(writeSavedTeam(blocked, team, model), false);
  assert.equal(readSavedTeam(blocked, model).team, null);
  assert.ok(readSavedTeam(blocked, model).warning);
  assert.equal(isSavedTeam(team, model), true);
});
