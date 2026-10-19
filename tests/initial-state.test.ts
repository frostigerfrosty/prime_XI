import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAppState } from '../src/data/initial-state.ts';
import { getDatasetVersion, getDefaultSettings } from '../src/data/index.ts';

test('initial state has no saved team, active tournament, draft, or fabricated history', () => {
  const state = createInitialAppState();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.datasetVersion, getDatasetVersion());
  assert.equal(state.currentDraft, null);
  assert.equal(state.currentTeam, null);
  assert.equal(state.currentTournament, null);
  assert.deepEqual(state.completedTournaments, []);
  assert.deepEqual(state.userSettings, getDefaultSettings());
});

test('initial-state factories do not share mutable settings or history arrays', () => {
  const first = createInitialAppState();
  const second = createInitialAppState();
  first.userSettings.soundEnabled = true;
  first.userSettings.historyLimit = 1;
  assert.equal(second.userSettings.soundEnabled, false);
  assert.equal(second.userSettings.historyLimit, 50);
  assert.notEqual(first.completedTournaments, second.completedTournaments);
});
