import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { createBuilder, fitsSlot } from '../src/engine/builder.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import { createTournamentEngine } from '../src/engine/tournament.ts';
import { createSavedTeam, isSavedTeam } from '../src/engine/saved-team.ts';
import { createInitialAppState } from '../src/data/initial-state.ts';
import { parseBackup, serializeBackup } from '../src/engine/backup.ts';
import { readDraft, writeDraft, draftStorageKey } from '../src/utils/draft-storage.ts';
import type { DraftState } from '../src/types/application.ts';

const data = getDatabase();
const catalog = {
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((t) => t.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
};
const builder = createBuilder(catalog);
const now = '2026-10-24T15:00:00.000Z';
const start = (seed = 'sequential') => builder.newDraft(seed, '4-3-3', now);
function pick(draft: DraftState) {
  const current = builder.currentTeam(draft)!;
  return builder
    .completion(draft)!
    .find((p) => builder.player(p.playerCardId)!.primeTeamId === current.id)!;
}
function advance(draft: DraftState) {
  const p = pick(draft);
  return builder.change(draft, { type: 'player', slotId: p.slotId, cardId: p.playerCardId }, now);
}

test('new rounds vary their first team and reject invalid inputs without changing the catalog', () => {
  const before = JSON.stringify(data);
  const firstTeams = new Set(
    Array.from({ length: 30 }, (_, index) => start(`first-${index}`).drawnPrimeTeamIds[0]),
  );
  assert.ok(firstTeams.size > 10);
  assert.throws(() => start('x'.repeat(101)), /Ungültige/);
  assert.throws(
    () =>
      createBuilder({ ...catalog, teams: data.teams.slice(0, 10) }).newDraft('short', '4-3-3', now),
    /mindestens 11/,
  );
  assert.equal(JSON.stringify(data), before);
});

test('sequential rounds reveal only the current team and finish eleven immutable distinct picks in every formation', () => {
  for (const formation of data.formations)
    for (let seed = 0; seed < 5; seed++) {
      let draft = builder.newDraft(`round-${seed}`, formation.id, now);
      assert.equal(draft.drawnPrimeTeamIds.length, 1);
      for (let turn = 0; turn < 11; turn++) {
        const before = structuredClone(draft);
        const current = builder.currentTeam(draft)!;
        assert.equal(draft.drawnPrimeTeamIds.length, turn + 1);
        assert.equal(draft.drawnPrimeTeamIds.at(-1), current.id);
        assert.ok(!builder.lineup(draft).some((p) => p.player.primeTeamId === current.id));
        draft = advance(draft);
        assert.deepEqual(draft.picks.slice(0, turn), before.picks);
        assert.ok(builder.isValid(draft));
        assert.equal(new Set(draft.drawnPrimeTeamIds).size, draft.drawnPrimeTeamIds.length);
      }
      assert.equal(builder.currentTeam(draft), undefined);
      assert.equal(draft.drawnPrimeTeamIds.length, 11);
      assert.equal(new Set(builder.lineup(draft).map((p) => p.player.personId)).size, 11);
      assert.equal(builder.status(draft).complete, false);
      draft = builder.change(
        draft,
        { type: 'coach', cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id },
        now,
      );
      draft = builder.change(
        draft,
        { type: 'captain', personId: builder.lineup(draft)[0]!.player.personId },
        now,
      );
      assert.equal(builder.status(draft).complete, true);
    }
});

test('illegal, past and unrevealed picks cannot advance the round or replace confirmed positions', () => {
  const fresh = start();
  const current = builder.currentTeam(fresh)!;
  const other = data.teams.find((t) => t.id !== current.id)!;
  assert.throws(
    () =>
      builder.change(fresh, { type: 'player', slotId: 'gk-1', cardId: other.players[0]!.id }, now),
    /aktuellen Team/,
  );
  const unsuitable = current.players.find(
    (p) => p.position !== 'GK' && !p.secondaryPositions.includes('GK'),
  )!;
  assert.throws(
    () => builder.change(fresh, { type: 'player', slotId: 'gk-1', cardId: unsuitable.id }, now),
    /nicht geeignet/,
  );
  assert.equal(fresh.drawnPrimeTeamIds.length, 1);
  assert.equal(fresh.picks.length, 0);
  const chosen = pick(fresh);
  const draft = advance(fresh);
  const before = structuredClone(draft);
  assert.throws(
    () => builder.change(draft, { type: 'remove', slotId: chosen.slotId }, now),
    /nicht entfernt/,
  );
  assert.throws(
    () =>
      builder.change(
        draft,
        { type: 'player', slotId: chosen.slotId, cardId: chosen.playerCardId },
        now,
      ),
    /gesperrt/,
  );
  assert.throws(
    () => builder.change(draft, { type: 'formation', formationId: '4-4-2' }, now),
    /gesperrt/,
  );
  assert.throws(
    () => builder.change(fresh, { type: 'coach', cardId: other.coach!.id }, now),
    /nicht erlaubt/,
  );
  assert.deepEqual(draft, before);
  assert.ok(
    builder.isValid(builder.change(draft, { type: 'tactic', tacticId: 'counter-attack' }, now)),
  );
});

test('sequential storage and validation preserve the exact current round and reject leaked future teams and altered history', () => {
  const draft = advance(start());
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.ok(writeDraft(storage, draft, builder));
  assert.deepEqual(readDraft(storage, builder).draft, draft);
  for (const mutate of [
    (d: DraftState) => {
      d.drawnPrimeTeamIds.push(data.teams.find((t) => !d.drawnPrimeTeamIds.includes(t.id))!.id);
    },
    (d: DraftState) => {
      d.drawnPrimeTeamIds.reverse();
    },
    (d: DraftState) => {
      (d as unknown as { mode: string }).mode = 'future-mode';
    },
    (d: DraftState) => {
      d.drawnPrimeTeamIds[1] = d.drawnPrimeTeamIds[0]!;
    },
  ]) {
    const invalid = structuredClone(draft);
    mutate(invalid);
    assert.equal(builder.isValid(invalid), false);
    assert.equal(writeDraft(storage, invalid, builder), false);
  }
  assert.deepEqual(JSON.parse(values.get(draftStorageKey)!).draft, draft);
});

test('varied valid strategies always leave a playable next team, including late keepers', () => {
  for (let seed = 0; seed < 12; seed++) {
    let draft = start(`strategy-${seed}`);
    while (draft.picks.length < 11) {
      const formation = data.formations.find((f) => f.id === draft.formationId)!;
      const team = builder.currentTeam(draft)!;
      const candidates = formation.slots
        .filter((s) => !draft.picks.some((p) => p.slotId === s.id))
        .flatMap((slot) =>
          team.players
            .filter((p) => fitsSlot(p, slot))
            .map((player) => ({ slotId: slot.id, cardId: player.id })),
        )
        .filter((p) => !builder.playerIssue(draft, p.slotId, p.cardId));
      assert.ok(candidates.length);
      const candidate =
        seed % 2 ? candidates.at(-1)! : candidates[Math.floor(candidates.length / 2)]!;
      draft = builder.change(draft, { type: 'player', ...candidate }, now);
    }
    assert.ok(builder.isValid(draft));
  }
});

test('eleven-team snapshots work in tournaments and backups alongside existing twelve-team drafts', () => {
  const model = createStrengthModel(data);
  const tournament = createTournamentEngine({
    teams: data.teams,
    rules: data.rules,
    strengthModel: model,
    datasetVersion: data.datasetVersion,
    defaultTactic: data.defaults.defaultTactic,
  });
  const services = { builder, model, tournament };
  let draft = start('snapshot');
  while (draft.picks.length < 11) draft = advance(draft);
  draft = builder.change(
    draft,
    { type: 'coach', cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id },
    now,
  );
  draft = builder.change(
    draft,
    { type: 'captain', personId: builder.lineup(draft)[0]!.player.personId },
    now,
  );
  const team = createSavedTeam(draft, builder, model, data.datasetVersion, now);
  assert.ok(isSavedTeam(team, model));
  assert.equal(team.drawnPrimeTeamIds.length, 11);
  const state = {
    ...createInitialAppState(),
    currentDraft: draft,
    currentTeam: team,
    currentTournament: tournament.nextMatchday(
      tournament.start(team, 'sequential-tournament', now),
    ),
  };
  assert.deepEqual(parseBackup(serializeBackup(state, services, now), services).state, state);
  const partial = { ...createInitialAppState(), currentDraft: advance(start('partial')) };
  assert.deepEqual(parseBackup(serializeBackup(partial, services, now), services).state, partial);
  const legacy = builder.newPoolDraft('existing-pool', '4-3-3', now);
  assert.equal(legacy.drawnPrimeTeamIds.length, 12);
  assert.ok(builder.isValid(legacy));
  assert.deepEqual(
    parseBackup(
      serializeBackup({ ...createInitialAppState(), currentDraft: legacy }, services, now),
      services,
    ).state.currentDraft,
    legacy,
  );
});
