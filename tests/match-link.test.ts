import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { createMatchEngine } from '../src/engine/match.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import { primeMatchTeam } from '../src/engine/match-team.ts';
import {
  isShareableMatchCode,
  matchSetupParams,
  readMatchSetup,
  type MatchSetup,
} from '../src/engine/match-link.ts';

const data = getDatabase();
const model = createStrengthModel(data);
const engine = createMatchEngine(data.rules);
const versions = {
  dataset: data.datasetVersion,
  engine: engine.engineVersion,
  strength: model.rulesVersion,
};
const known = new Set(data.teams.map((team) => team.id));
const defaults: MatchSetup = {
  homeId: 'real-madrid-2016-2017',
  awayId: 'barcelona-2010-2011',
  mode: 'regular',
  neutralVenue: true,
  seed: 'new-session-code',
};
const read = (params: URLSearchParams) => readMatchSetup(params, defaults, known, versions);

test('no setup uses the session defaults; old pair links keep their teams and receive session settings', () => {
  const empty = read(new URLSearchParams());
  assert.deepEqual(empty, defaults);
  assert.notEqual(empty, defaults);
  assert.deepEqual(read(new URLSearchParams({ home: 'milan-2006-2007', away: defaults.homeId })), {
    ...defaults,
    homeId: 'milan-2006-2007',
    awayId: defaults.homeId,
  });
  assert.deepEqual(read(new URLSearchParams('unrelated=ignored')), defaults);
});

test('all modes and venue settings round-trip codes with Unicode, punctuation and literal URL characters', () => {
  for (const mode of ['regular', 'knockout'] as const)
    for (const neutralVenue of [true, false])
      for (const seed of ['Finale + Rückspiel & = #? / % ⚽', 'x'.repeat(100), '  Spielcode  ']) {
        const setup = { ...defaults, mode, neutralVenue, seed };
        const params = new URLSearchParams(matchSetupParams(setup, versions).toString());
        assert.deepEqual(read(params), setup);
        assert.ok(isShareableMatchCode(seed));
        const home = primeMatchTeam(
          data.teams.find((team) => team.id === setup.homeId)!,
          model,
          data.defaults.defaultTactic,
        );
        const away = primeMatchTeam(
          data.teams.find((team) => team.id === setup.awayId)!,
          model,
          data.defaults.defaultTactic,
        );
        const restored = read(params);
        assert.deepEqual(
          engine.simulateMatch(home, away, {
            mode: restored.mode,
            neutralVenue: restored.neutralVenue,
            seed: restored.seed.trim(),
          }),
          engine.simulateMatch(home, away, { mode, neutralVenue, seed: seed.trim() }),
        );
      }
});

test('unknown, identical, empty and incomplete pairs never fall back to different teams', () => {
  for (const params of [
    new URLSearchParams('home=missing&away=barcelona-2010-2011'),
    new URLSearchParams({ home: defaults.homeId, away: defaults.homeId }),
    new URLSearchParams('home=&away=barcelona-2010-2011'),
    new URLSearchParams({ home: defaults.homeId }),
    new URLSearchParams('seed=unversioned'),
  ])
    assert.throws(() => read(params));
});

test('duplicate fields and missing parts of a versioned link are rejected individually', () => {
  const complete = matchSetupParams(defaults, versions);
  for (const [key, value] of complete) {
    const duplicate = new URLSearchParams(complete);
    duplicate.append(key, value);
    assert.throws(() => read(duplicate), /mehrdeutig/);
    const incomplete = new URLSearchParams(complete);
    incomplete.delete(key);
    assert.throws(() => read(incomplete));
  }
});

test('future link formats and mismatched catalog, match-engine or strength-model versions are rejected', () => {
  for (const [key, value] of [
    ['v', '2'],
    ['dataset', 'other-catalog'],
    ['engine', 'other-engine'],
    ['strength', 'other-model'],
  ]) {
    const params = matchSetupParams(defaults, versions);
    params.set(key!, value!);
    assert.throws(() => read(params));
  }
});

test('invalid modes, venue flags and excessive or control-character codes cannot initialize a match', () => {
  for (const [key, value] of [
    ['mode', 'league'],
    ['neutral', 'true'],
    ['neutral', ''],
    ['seed', 'x'.repeat(101)],
    ['seed', 'tab\tcode'],
    ['seed', 'line\ncode'],
    ['seed', '\u007f'],
  ]) {
    const params = matchSetupParams(defaults, versions);
    params.set(key!, value!);
    assert.throws(() => read(params));
  }
});

test('unfinished codes remain editable but cannot be shared; a local saved XI is only resolvable where available', () => {
  for (const seed of ['', '   ']) {
    assert.equal(read(matchSetupParams({ ...defaults, seed }, versions)).seed, seed);
    assert.equal(isShareableMatchCode(seed), false);
  }
  assert.equal(isShareableMatchCode('x'.repeat(101)), false);
  assert.equal(isShareableMatchCode('bad\tcode'), false);
  const own = { ...defaults, homeId: 'local-saved-xi' };
  const params = matchSetupParams(own, versions);
  assert.throws(() => read(params));
  assert.deepEqual(
    readMatchSetup(params, defaults, new Set([...known, own.homeId]), versions),
    own,
  );
});
