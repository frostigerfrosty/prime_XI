import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, getDatasetVersion } from '../src/data/index.ts';
import { isCompatibleDraftDataset } from '../src/data/compatibility.ts';
import { readDraft, writeDraft, draftStorageKey } from '../src/utils/draft-storage.ts';
import { parseBackup, serializeBackup } from '../src/engine/backup.ts';
import { matchSetupParams, readMatchSetup } from '../src/engine/match-link.ts';
import { legacyCatalogFixture } from './helpers/legacy-catalog.ts';

const f = legacyCatalogFixture();
test('the known nationality patch keeps old draft choices without writing or accepting arbitrary versions', () => {
  const values = new Map([
    [
      draftStorageKey,
      JSON.stringify({ schemaVersion: 1, datasetVersion: '0.2.0', draft: f.draft }),
    ],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => {
      values.set(key, raw);
    },
  };
  const before = values.get(draftStorageKey);
  const loaded = readDraft(storage, f.builder);
  assert.deepEqual(loaded.draft, f.draft);
  assert.match(loaded.warning!, /Länderzuordnungen/);
  assert.equal(values.get(draftStorageKey), before);
  assert.ok(writeDraft(storage, f.draft, f.builder));
  assert.equal(JSON.parse(values.get(draftStorageKey)!).datasetVersion, getDatasetVersion());
  for (const version of ['0.1.0', '0.2.2', '0.3.1', null, {}])
    assert.equal(isCompatibleDraftDataset(version), false);
});
test('old backups retain their frozen team, tournament and archive snapshots under the new catalog', () => {
  const raw = serializeBackup(
    f.legacy.state,
    { builder: f.legacy.builder, model: f.model, tournament: f.legacy.engine },
    f.now,
  );
  const backup = parseBackup(raw, { builder: f.builder, model: f.model, tournament: f.engine });
  assert.deepEqual(backup.state, f.legacy.state);
  assert.equal(backup.state.currentTeam!.datasetVersion, '0.2.0');
  assert.equal(backup.state.currentTournament!.datasetVersion, '0.2.0');
});
test('continuing an old tournament uses its old opponents and reproduces the previous engine results', () => {
  assert.ok(
    f.legacy.tournament.participants.some(
      (p) =>
        p.kind === 'prime' &&
        p.team.year >= 2021 &&
        p.team.players.some((card) => card.personId === 'laporte' && card.nationality === 'FRA'),
    ),
  );
  assert.ok(f.engine.isValid(f.legacy.tournament));
  assert.deepEqual(
    f.engine.nextMatchday(f.legacy.tournament),
    f.legacy.engine.nextMatchday(f.legacy.tournament),
  );
  const versions = {
    dataset: getDatasetVersion(),
    engine: f.data.rules.match.engineVersion,
    strength: f.model.rulesVersion,
  };
  const link = matchSetupParams(
    {
      homeId: 'milan-2006-2007',
      awayId: 'barcelona-2010-2011',
      mode: 'regular',
      neutralVenue: true,
      seed: 'old-shared-game',
    },
    { ...versions, dataset: '0.2.0' },
  );
  assert.throws(
    () =>
      readMatchSetup(
        link,
        {
          homeId: 'milan-2006-2007',
          awayId: 'barcelona-2010-2011',
          mode: 'regular',
          neutralVenue: true,
          seed: 'new-game',
        },
        new Set(f.data.teams.map((team) => team.id)),
        versions,
      ),
    /anderen Katalog/,
  );
});
test('dated country corrections and coach evidence do not imply a blanket historical release', () => {
  const data = getDatabase();
  assert.equal(
    data.teams.filter((team) => team.coach?.verificationStatus === 'verified').length,
    60,
  );
  for (const team of data.teams)
    for (const player of team.players)
      if (player.personId === 'laporte') {
        assert.equal(player.nationality, team.year >= 2021 ? 'ESP' : 'FRA');
        if (team.year >= 2021) assert.ok(player.sourceIds.includes('reference-laporte-career'));
      }
  assert.ok(data.teams.every((team) => team.verificationStatus === 'pending'));
});
