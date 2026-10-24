import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { createBuilder, fitsSlot } from '../src/engine/builder.ts';
import type { DraftState } from '../src/types/application.ts';
import { readDraft, writeDraft, draftStorageKey } from '../src/utils/draft-storage.ts';

const data = getDatabase();
const catalog = {
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((tactic) => tactic.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
};
const builder = createBuilder(catalog);
const now = '2026-10-21T12:00:00.000Z';
const fresh = (seed = 'builder-test') => builder.newPoolDraft(seed, '4-3-3', now);
const change = (draft: DraftState, action: Parameters<typeof builder.change>[1]) =>
  builder.change(draft, action, now);
function filled(seed = 'builder-test') {
  let draft = fresh(seed);
  for (const pick of builder.completion(draft)!)
    draft = change(draft, { type: 'player', slotId: pick.slotId, cardId: pick.playerCardId });
  return draft;
}

test('draws are deterministic, have exactly twelve unique teams and support every formation', () => {
  const original = JSON.stringify(catalog);
  for (const formation of data.formations)
    for (let seed = 0; seed < 15; seed++) {
      const first = builder.newPoolDraft(`sample-${seed}`, formation.id, now);
      assert.deepEqual(first, builder.newPoolDraft(`sample-${seed}`, formation.id, now));
      assert.equal(new Set(first.drawnPrimeTeamIds).size, 12);
      assert.equal(builder.completion(first)?.length, 11);
      assert.equal(builder.isValid(first), true);
    }
  assert.notDeepEqual(fresh('a').drawnPrimeTeamIds, fresh('b').drawnPrimeTeamIds);
  assert.equal(JSON.stringify(catalog), original);
});

test('too few valid teams, duplicate catalog IDs and invalid seed fail explicitly', () => {
  assert.throws(
    () =>
      createBuilder({ ...catalog, teams: data.teams.slice(0, 11) }).newPoolDraft(
        'seed',
        '4-3-3',
        now,
      ),
    /mindestens 12/,
  );
  const invalid = structuredClone(data.teams[0]!);
  invalid.players[0]!.rating = 100;
  assert.throws(
    () =>
      createBuilder({ ...catalog, teams: [invalid, ...data.teams.slice(1, 12)] }).newPoolDraft(
        'seed',
        '4-3-3',
        now,
      ),
    /mindestens 12/,
  );
  assert.throws(
    () => createBuilder({ ...catalog, teams: [data.teams[0]!, data.teams[0]!] }),
    /doppelte Teams/,
  );
  assert.throws(() => fresh('x'.repeat(101)), /Ungültige/);
});

test('eleven legal picks do not complete a team without a coach and captain', () => {
  let draft = filled();
  assert.equal(builder.status(draft).complete, false);
  draft = change(draft, {
    type: 'coach',
    cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id,
  });
  draft = change(draft, { type: 'captain', personId: builder.lineup(draft)[0]!.player.personId });
  assert.equal(builder.status(draft).complete, true);
  const players = builder.lineup(draft).map((pick) => pick.player);
  assert.equal(new Set(players.map((player) => player.personId)).size, 11);
  assert.equal(new Set(players.map((player) => player.primeTeamId)).size, 11);
  assert.equal(
    builder.status(draft).averageRating,
    Math.round((players.reduce((sum, player) => sum + player.rating, 0) / 11) * 10) / 10,
  );
});

test('a used team can supply a coach separately; replacement and removal release the player pick', () => {
  const draft = fresh();
  const first = builder.completion(draft)![0]!;
  const player = builder.player(first.playerCardId)!;
  const picked = change(draft, {
    type: 'player',
    slotId: first.slotId,
    cardId: first.playerCardId,
  });
  const coached = change(picked, {
    type: 'coach',
    cardId: builder.team(player.primeTeamId)!.coach!.id,
  });
  assert.equal(coached.picks.length, 1);
  const another = builder
    .team(player.primeTeamId)!
    .players.find((candidate) => candidate.position === 'GK' && candidate.id !== player.id)!;
  const replaced = change(coached, { type: 'player', slotId: first.slotId, cardId: another.id });
  assert.equal(replaced.picks[0]!.playerCardId, another.id);
  const removed = change(replaced, { type: 'remove', slotId: first.slotId });
  assert.equal(removed.picks.length, 0);
  assert.equal(removed.coachCardId, coached.coachCardId);
  assert.equal(builder.playerIssue(removed, first.slotId, first.playerCardId), null);
  assert.equal(draft.picks.length, 0);
});

test('foreign players, invalid positions and multiple players from one season team are rejected', () => {
  const draft = fresh();
  const pick = builder.completion(draft)![0]!;
  const player = builder.player(pick.playerCardId)!;
  const picked = change(draft, { type: 'player', slotId: pick.slotId, cardId: player.id });
  const other = builder
    .team(player.primeTeamId)!
    .players.find((candidate) => candidate.position === 'CB')!;
  assert.throws(
    () => change(picked, { type: 'player', slotId: 'cb-3', cardId: other.id }),
    /bereits ein Spieler/,
  );
  assert.throws(
    () => change(draft, { type: 'player', slotId: 'st-10', cardId: player.id }),
    /nicht geeignet/,
  );
  const outside = data.teams.find((team) => !draft.drawnPrimeTeamIds.includes(team.id))!;
  assert.throws(
    () => change(draft, { type: 'player', slotId: 'gk-1', cardId: outside.players[0]!.id }),
    /nicht zu deinem Draft/,
  );
  assert.throws(() => change(draft, { type: 'coach', cardId: outside.coach!.id }), /nicht erlaubt/);
  assert.throws(
    () => change(draft, { type: 'captain', personId: 'nicht-gewaehlt' }),
    /nicht erlaubt/,
  );
});

test('the same person cannot be selected from two different historical season cards', () => {
  const variants = data.teams
    .filter((team) => team.players.some((player) => player.personId === 'messi'))
    .slice(0, 2);
  const ids = variants.map((team) => team.id);
  const draft = {
    ...fresh(),
    drawnPrimeTeamIds: [
      ...ids,
      ...data.teams
        .filter((team) => !ids.includes(team.id))
        .slice(0, 10)
        .map((team) => team.id),
    ],
  };
  const first = variants[0]!.players.find((player) => player.personId === 'messi')!;
  const second = variants[1]!.players.find((player) => player.personId === 'messi')!;
  const slots = data.formations.find((formation) => formation.id === draft.formationId)!.slots;
  const a = slots.find((slot) => fitsSlot(first, slot))!;
  const b = slots.find((slot) => slot.id !== a.id && fitsSlot(second, slot))!;
  const picked = change(draft, { type: 'player', slotId: a.id, cardId: first.id });
  assert.throws(
    () => change(picked, { type: 'player', slotId: b.id, cardId: second.id }),
    /bereits in deiner Elf/,
  );
});

test('natural captains are proposed, manual captains are preserved and removal repairs selection', () => {
  const draft = filled();
  const natural = builder.lineup(draft).find((entry) => entry.player.naturalCaptain);
  if (natural) assert.notEqual(draft.captainPersonId, null);
  const first = builder.lineup(draft)[0]!;
  const chosen = change(draft, { type: 'captain', personId: first.player.personId });
  const tactic = change(chosen, { type: 'tactic', tacticId: 'counter-attack' });
  assert.equal(tactic.captainPersonId, first.player.personId);
  const removed = change(tactic, { type: 'remove', slotId: first.slotId });
  assert.notEqual(removed.captainPersonId, first.player.personId);
  assert.equal(builder.isValid(removed), true);
});

test('formation changes preserve legal matching picks and never change the original state', () => {
  const original = filled();
  const copy = structuredClone(original);
  let changed = false;
  for (const formation of data.formations.filter((item) => item.id !== original.formationId)) {
    try {
      const next = change(original, { type: 'formation', formationId: formation.id });
      assert.equal(builder.isValid(next), true);
      assert.equal(builder.completion(next)?.length, 11);
      for (const pick of next.picks)
        assert.ok(original.picks.some((entry) => entry.playerCardId === pick.playerCardId));
      changed = true;
    } catch (error) {
      assert.match((error as Error).message, /nicht vervollständigen/);
    }
  }
  assert.ok(changed);
  assert.deepEqual(original, copy);
});

test('runtime draft validation rejects corrupt identities, slots, sources and stale selections', () => {
  const draft = filled();
  const mutations: ((value: DraftState) => void)[] = [
    (value) => {
      value.drawnPrimeTeamIds[1] = value.drawnPrimeTeamIds[0]!;
    },
    (value) => {
      value.picks[1] = { ...value.picks[0]! };
    },
    (value) => {
      value.picks[0]!.playerCardId = 'missing';
    },
    (value) => {
      value.picks[0]!.slotId = 'missing';
    },
    (value) => {
      value.tacticId = 'missing';
    },
    (value) => {
      value.captainPersonId = 'missing';
    },
    (value) => {
      value.coachCardId = 'missing';
    },
    (value) => {
      value.updatedAt = 'broken';
    },
  ];
  for (const mutate of mutations) {
    const next = structuredClone(draft);
    mutate(next);
    assert.equal(builder.isValid(next), false);
  }
  for (const value of [null, [], 1, {}, { picks: null }])
    assert.equal(builder.isValid(value), false);
});

test('a draft round-trips with version guards and corrupt saved data is not overwritten on read', () => {
  const values = new Map<string, string>([['other-setting', 'preserved']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const draft = filled();
  assert.equal(writeDraft(storage, draft, builder), true);
  assert.deepEqual(readDraft(storage, builder).draft, draft);
  const serialized = values.get(draftStorageKey)!;
  for (const raw of [
    '{broken',
    'null',
    JSON.stringify({ ...JSON.parse(serialized), schemaVersion: 99 }),
    JSON.stringify({ ...JSON.parse(serialized), datasetVersion: 'old' }),
  ]) {
    values.set(draftStorageKey, raw);
    const loaded = readDraft(storage, builder);
    assert.equal(loaded.draft, null);
    assert.ok(loaded.warning);
    assert.equal(values.get(draftStorageKey), raw);
    assert.equal(values.get('other-setting'), 'preserved');
  }
});

test('blocked or full storage reports failure without destroying the in-memory draft', () => {
  const draft = fresh();
  const storage = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  };
  assert.ok(readDraft(storage, builder).warning);
  assert.equal(writeDraft(storage, draft, builder), false);
  assert.equal(builder.isValid(draft), true);
});

test('a tempting legal-position pick is blocked if it consumes the only remaining source for LW', () => {
  // Deliberately constrained test fixture, never written into the real catalog.
  const teams = structuredClone(data.teams.slice(0, 12));
  for (const [index, team] of teams.entries()) {
    for (const [card, player] of team.players.entries()) {
      player.secondaryPositions = player.secondaryPositions.filter((position) => position !== 'LW');
      if (index === 0) player.position = card === 2 ? 'LW' : card === 3 ? 'ST' : 'GK';
      else if (player.position === 'LW') player.position = 'RW';
    }
  }
  const constrained = createBuilder({ ...catalog, teams });
  const draft = constrained.newPoolDraft('bottleneck', '4-3-3', now);
  const striker = teams[0]!.players[3]!;
  assert.ok(constrained.completion(draft));
  assert.match(constrained.playerIssue(draft, 'st-10', striker.id)!, /übrigen Positionen/);
  assert.throws(
    () => constrained.change(draft, { type: 'player', slotId: 'st-10', cardId: striker.id }, now),
    /übrigen Positionen/,
  );
  assert.equal(draft.picks.length, 0);
});
