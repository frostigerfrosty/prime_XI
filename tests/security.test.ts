import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUntrustedJson, jsonLimits } from '../src/utils/untrusted-json.ts';
import { parseBackup, serializeBackup } from '../src/engine/backup.ts';
import { createInitialAppState } from '../src/data/initial-state.ts';
import { tournamentFixture } from './helpers/tournament.ts';
import { readDraft, draftStorageKey } from '../src/utils/draft-storage.ts';
import { readSavedTeam, teamStorageKey } from '../src/utils/team-storage.ts';
import { readSettings } from '../src/utils/settings.ts';
import { createGameStorage, snapshotStorageKey } from '../src/utils/game-storage.ts';
import { renderClubBadge } from '../scripts/club-badges.mjs';

const f = tournamentFixture();
const services = { builder: f.builder, model: f.model, tournament: f.engine };
const deep = '{"nested":'.repeat(100) + 'null' + '}'.repeat(100);

test('untrusted JSON rejects depth, oversized collections, excessive nodes, nonfinite numbers and prototype keys', () => {
  const manyNodes = JSON.stringify(Array.from({ length: 100 }, () => Array(3000).fill(0)));
  for (const raw of [
    deep,
    JSON.stringify(Array(10_001).fill(0)),
    manyNodes,
    '1e400',
    '{"__proto__":{"polluted":true}}',
    '{"a":{"constructor":{"prototype":{"polluted":true}}}}',
  ]) {
    assert.throws(() => parseUntrustedJson(raw, 2_000_000));
  }
  assert.throws(() => parseUntrustedJson(' '.repeat(100) + '{}', 100));
  assert.equal(({} as Record<string, unknown>)['polluted'], undefined);
  assert.deepEqual(parseUntrustedJson('{"name":"<img onerror=alert(1)>","score":99}', 100), {
    name: '<img onerror=alert(1)>',
    score: 99,
  });
});

test('backup preflight rejects malicious extension fields before expensive replay and preserves valid legacy snapshots', () => {
  const raw = serializeBackup(createInitialAppState(), services, f.now);
  for (const extension of [deep, '{"__proto__":{"polluted":true}}']) {
    assert.throws(() => parseBackup(raw.replace(/}$/, `,"extension":${extension}}`), services));
  }
  assert.ok(parseBackup(raw, services));
});

test('local storage adapters fail closed without overwriting malformed input', () => {
  for (const [key, limit, read] of [
    [draftStorageKey, jsonLimits.draft, (storage: Storage) => readDraft(storage, f.builder).draft],
    [teamStorageKey, jsonLimits.team, (storage: Storage) => readSavedTeam(storage, f.model).team],
  ] as const) {
    for (const raw of [deep, ' '.repeat(limit + 1)]) {
      const store = {
        getItem: () => raw,
        setItem: () => assert.fail('must not overwrite'),
      } as unknown as Storage;
      assert.equal(read(store), null, key);
    }
  }
  const defaults = readSettings({ getItem: () => deep, setItem: () => assert.fail() });
  assert.equal(defaults.locale, 'de');
  const storage = {
    getItem: () => deep,
    setItem: () => assert.fail(),
    removeItem: () => assert.fail(),
  };
  assert.throws(() => createGameStorage(storage).getItem(draftStorageKey));
  assert.throws(() => createGameStorage(storage).setItem(draftStorageKey, 'replacement'));
  assert.ok(snapshotStorageKey);
});

test('SVG generation escapes names and rejects attribute injection in badge colors', () => {
  const club = {
    name: '"><script>alert(1)</script>',
    shortName: '<X>',
    colors: { primary: '#123456', secondary: '#abcdef' },
  };
  const svg = renderClubBadge(club);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(!svg.includes('<script>'));
  for (const color of ['red', '#fff', '#123456" onload="alert(1)', 'url(https://example.com)']) {
    assert.throws(() => renderClubBadge({ ...club, colors: { ...club.colors, primary: color } }));
  }
});

test('backups cannot install a component larger than its own storage reader accepts', () => {
  const state = { ...createInitialAppState(), currentDraft: structuredClone(f.draft) };
  const draft = state.currentDraft as unknown as Record<string, unknown>;
  draft['extension'] = 'x'.repeat(jsonLimits.draft);
  assert.throws(() => serializeBackup(state, services, f.now));
});
