import test from 'node:test';
import assert from 'node:assert/strict';
import { readSettings, saveSettings, settingsKey } from '../src/utils/settings.ts';
import { getDefaultSettings } from '../src/data/index.ts';

test('malformed, missing and inaccessible browser settings safely use defaults', () => {
  for (const raw of [null, '{broken', 'null', '[]', '42', '{"reduceMotion":"true"}']) {
    assert.deepEqual(readSettings({ getItem: () => raw, setItem: () => {} }), getDefaultSettings());
  }
  assert.deepEqual(
    readSettings({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
    }),
    getDefaultSettings(),
  );
});

test('motion settings round-trip using the central storage key and write failures are reported', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const settings = { ...getDefaultSettings(), reduceMotion: true };
  assert.equal(saveSettings(storage, settings), true);
  assert.equal(values.has(settingsKey), true);
  assert.deepEqual(readSettings(storage), settings);
  assert.equal(
    saveSettings(
      {
        ...storage,
        setItem: () => {
          throw new Error('full');
        },
      },
      settings,
    ),
    false,
  );
});
