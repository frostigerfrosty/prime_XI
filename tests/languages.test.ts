import test from 'node:test';
import assert from 'node:assert/strict';
import english from '../src/i18n/en.json' with { type: 'json' };
import italian from '../src/i18n/it.json' with { type: 'json' };
import { getLanguage, getIntlLocale, setLanguage, t, isLanguage } from '../src/i18n/locale.ts';
import { formatStrength } from '../src/utils/display.ts';
import { readSettings, saveSettings } from '../src/utils/settings.ts';
import { getDefaultSettings } from '../src/data/index.ts';
import { parseBackup, serializeBackup } from '../src/engine/backup.ts';
import { createInitialAppState } from '../src/data/initial-state.ts';
import { tournamentFixture } from './helpers/tournament.ts';

test('English and Italian cover the same messages and preserve every placeholder', () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(italian).sort());
  assert.ok(Object.keys(english).length > 900);
  for (const dictionary of [english, italian])
    for (const [source, translated] of Object.entries(dictionary)) {
      assert.ok(translated.trim(), source);
      assert.deepEqual(
        (source.match(/\{\d+\}/gu) ?? []).sort(),
        (translated.match(/\{\d+\}/gu) ?? []).sort(),
        source,
      );
    }
});
test('language selection translates complete messages and dynamic names without changing codes', async () => {
  try {
    await setLanguage('en');
    assert.equal(t('Einstellungen'), 'Settings');
    assert.equal(t('Team 3 von 11'), 'Team 3 of 11');
    assert.equal(t('Wählen: Lionel Messi'), 'Select: Lionel Messi');
    assert.equal(t('Wählen: Finale'), 'Select: Finale');
    assert.equal(t(' Spieler '), ' Players ');
    assert.equal(
      t('Mit Boni sind Werte über 99 möglich. Obergrenze: 113.'),
      'Bonuses can produce values above 99. Maximum: 113.',
    );
    assert.equal(formatStrength(92.5), '92.50');
    await setLanguage('it');
    assert.equal(t('Einstellungen'), 'Impostazioni');
    assert.equal(t('Team 3 von 11'), 'Squadra 3 di 11');
    assert.equal(t('Wählen: Lionel Messi'), 'Scegli: Lionel Messi');
    assert.equal(getIntlLocale(), 'it-IT');
    assert.equal(formatStrength(92.5), '92,50');
    assert.equal(t('barcelona-2010-2011'), 'barcelona-2010-2011');
    assert.equal(t('seed-ABC-123'), 'seed-ABC-123');
    assert.equal(t('constructor'), 'constructor');
    await Promise.all([setLanguage('en'), setLanguage('it'), setLanguage('de')]);
    assert.equal(getLanguage(), 'de');
    assert.equal(t('Einstellungen'), 'Einstellungen');
  } finally {
    await setLanguage('de');
  }
});
test('supported languages round-trip in settings and backups while unsupported values are rejected', () => {
  const f = tournamentFixture();
  const services = { builder: f.builder, model: f.model, tournament: f.engine };
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  for (const locale of ['de', 'en', 'it'] as const) {
    const settings = { ...getDefaultSettings(), locale };
    assert.ok(saveSettings(storage, settings));
    assert.equal(readSettings(storage).locale, locale);
    const state = { ...createInitialAppState(), userSettings: settings };
    assert.deepEqual(parseBackup(serializeBackup(state, services, f.now), services).state, state);
  }
  assert.equal(isLanguage('fr'), false);
  assert.equal(
    readSettings({ getItem: () => JSON.stringify({ locale: 'fr' }), setItem: () => {} }).locale,
    'de',
  );
  const invalid = {
    ...createInitialAppState(),
    userSettings: { ...getDefaultSettings(), locale: 'fr' },
  };
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          format: 'prime-xi-backup',
          version: 1,
          exportedAt: f.now,
          state: invalid,
        }),
        services,
      ),
    /beschädigt/,
  );
});
