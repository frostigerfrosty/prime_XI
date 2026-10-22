import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { tournamentFixture } from '../helpers/tournament.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';
import { createHistoryEntry } from '../../src/engine/history.ts';
import {
  backupRecords,
  maximumBackupBytes,
  parseBackup,
  serializeBackup,
} from '../../src/engine/backup.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';
import type { AppState, TournamentState } from '../../src/types/application.ts';

const f = tournamentFixture(),
  keys = f.data.rules.storage.keys;
const services = { builder: f.builder, model: f.model, tournament: f.engine };
function stateFor(seed: string): AppState {
  const complete = f.engine.finishTournament(
    f.engine.finishLeague(f.engine.start(f.team, `${seed}-history`, f.now)),
    f.now,
  );
  return {
    ...createInitialAppState(),
    currentDraft: structuredClone(f.draft),
    currentTeam: { ...structuredClone(f.team), name: `${seed} XI` },
    currentTournament: f.engine.nextMatchday(f.engine.start(f.team, seed, f.now)),
    completedTournaments: [createHistoryEntry(complete, f.engine)],
    userSettings: { ...f.data.defaults, reduceMotion: true },
  };
}
const incoming = stateFor('Importiert');
const incomingRaw = serializeBackup(incoming, services, f.now);
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') found.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) found.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function preload(page: Page, state: AppState, restored = false) {
  await page.addInitScript(
    ({ records, restored, master }) => {
      if (localStorage.getItem('backup-test-initialized')) return;
      if (restored) localStorage.setItem(master, JSON.stringify({ schemaVersion: 1, records }));
      else
        for (const [key, raw] of Object.entries(records))
          if (raw !== null) localStorage.setItem(key, raw);
      localStorage.setItem('backup-test-initialized', 'yes');
      localStorage.setItem('unrelated', 'keep');
    },
    { records: backupRecords(state), restored, master: snapshotStorageKey },
  );
}
const physical = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .toSorted()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
const records = (page: Page): Promise<Record<string, string | null>> =>
  page.evaluate(
    ({ keys, master }) => {
      const raw = localStorage.getItem(master);
      return raw
        ? JSON.parse(raw).records
        : Object.fromEntries(Object.values(keys).map((key) => [key, localStorage.getItem(key)]));
    },
    { keys, master: snapshotStorageKey },
  );
async function choose(page: Page, raw = incomingRaw) {
  await page.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
    name: 'prime-xi-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
}
async function confirm(page: Page) {
  await page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }).click();
  await page.getByRole('button', { name: 'Sicherung übernehmen', exact: true }).click();
}
async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung herunterladen', exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toMatch(/^prime-xi-spielstand-.*\.json$/);
  return parseBackup(await readFile((await file.path())!, 'utf8'), services);
}

test('export downloads a complete valid snapshot without changing existing browser storage', async ({
  page,
}) => {
  await preload(page, incoming);
  await page.goto('#/settings');
  await expect(
    page.getByRole('heading', { name: 'Spielstand sichern & wiederherstellen' }),
  ).toBeVisible();
  const before = await physical(page);
  expect((await download(page)).state).toEqual(incoming);
  expect(await physical(page)).toEqual(before);
  await expect(
    page.getByRole('status').filter({ hasText: 'Herunterladen erstellt' }),
  ).toBeVisible();
});

test('export includes unsaved session changes rather than silently falling back to stale storage', async ({
  page,
}) => {
  await preload(page, incoming);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, keys.currentDraft);
  await page.goto('#/team-builder');
  await page
    .getByRole('combobox', { name: 'Deine Taktik', exact: true })
    .selectOption('possession');
  await expect(page.getByRole('alert').filter({ hasText: 'nur für diese Sitzung' })).toBeVisible();
  await page.goto('#/settings');
  const backup = await download(page);
  expect(backup.state.currentDraft!.tacticId).toBe('possession');
  expect(JSON.parse((await records(page))[keys.currentDraft]!).draft.tacticId).toBe(
    incoming.currentDraft!.tacticId,
  );
  expect(backup.state.currentTeam).toEqual(incoming.currentTeam);
});

test('preview and cancellation preserve the current state; confirmed restore updates all providers and remains playable after reload', async ({
  page,
}) => {
  await preload(page, stateFor('Bisherig'));
  await page.goto('#/settings');
  const before = await physical(page);
  await choose(page);
  await expect(page.getByRole('region', { name: 'Sicherungsvorschau' })).toContainText(
    'Importiert XI',
  );
  expect(await physical(page)).toEqual(before);
  await page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await physical(page)).toEqual(before);
  await confirm(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'wurde wiederhergestellt' }),
  ).toBeVisible();
  await expect(page.getByRole('switch', { name: /Bewegung reduzieren/ })).toBeChecked();
  expect(await records(page)).toEqual(backupRecords(incoming));
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
  await page.goto('#/');
  await expect(page.locator('.saved-team-summary')).toContainText('Importiert XI');
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }).click();
  const advanced = JSON.parse((await records(page))[keys.currentTournament]!)
    .tournament as TournamentState;
  expect(f.engine.isValid(advanced)).toBe(true);
  expect(f.engine.progress(advanced).completedRounds).toBe(2);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Spieltag 3 simulieren', exact: true }),
  ).toBeVisible();
  await page.goto('#/settings');
  await page.getByRole('switch', { name: /Bewegung reduzieren/ }).uncheck();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Bewegung reduzieren/ })).not.toBeChecked();
  const again = await download(page);
  expect(again.state.currentTournament).toEqual(advanced);
  expect(again.state.completedTournaments).toEqual(incoming.completedTournaments);
  expect(again.state.currentDraft).toEqual(incoming.currentDraft);
  expect(again.state.userSettings.reduceMotion).toBe(false);
});

test('restoring an explicitly confirmed empty backup clears old game data without resurrecting it on reload', async ({
  page,
}) => {
  await preload(page, incoming, true);
  await page.goto('#/settings');
  await choose(page, serializeBackup(createInitialAppState(), services, f.now));
  await confirm(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'wurde wiederhergestellt' }),
  ).toBeVisible();
  expect(await records(page)).toEqual(backupRecords(createInitialAppState()));
  await page.reload();
  await page.goto('#/team-builder');
  await expect(page.getByRole('button', { name: '12 Teams ziehen', exact: true })).toBeVisible();
  await page.goto('#/history');
  await expect(
    page.getByRole('heading', { name: 'Jede Legende fängt bei null an.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
});

test('invalid, future, altered and oversized files cannot leave a stale import preview or modify storage', async ({
  page,
}) => {
  await preload(page, incoming);
  await page.goto('#/settings');
  const before = await physical(page);
  await choose(page);
  await expect(
    page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }),
  ).toBeVisible();
  const altered = JSON.parse(incomingRaw);
  altered.state.completedTournaments[0].statistics.goalsFor++;
  for (const raw of [
    '{broken',
    JSON.stringify({ ...JSON.parse(incomingRaw), version: 99 }),
    JSON.stringify(altered),
  ]) {
    await choose(page, raw);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }),
    ).toHaveCount(0);
    expect(await physical(page)).toEqual(before);
  }
  await page.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(maximumBackupBytes + 1, ' '),
  });
  await expect(page.getByRole('alert')).toContainText('höchstens 8 MB');
  expect(await physical(page)).toEqual(before);
});

test('quota failures keep the previous restored state intact and the same file can be retried successfully', async ({
  page,
}) => {
  const previous = stateFor('Bisherig');
  await preload(page, previous, true);
  await page.addInitScript((master) => {
    Object.assign(window, { backupWritesBlocked: true });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (
        name === master &&
        (window as Window & { backupWritesBlocked?: boolean }).backupWritesBlocked
      )
        throw new DOMException('Quota', 'QuotaExceededError');
      original.call(this, name, value);
    };
  }, snapshotStorageKey);
  await page.goto('#/settings');
  const before = await physical(page);
  await choose(page);
  await confirm(page);
  await expect(page.getByRole('alert')).toContainText('bisheriger Spielstand bleibt unverändert');
  expect(await physical(page)).toEqual(before);
  expect((await download(page)).state).toEqual(previous);
  await page.evaluate(() => Object.assign(window, { backupWritesBlocked: false }));
  await confirm(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'wurde wiederhergestellt' }),
  ).toBeVisible();
  expect(await records(page)).toEqual(backupRecords(incoming));
});

test('a restored completed tournament is archived exactly once while the other imported components stay unchanged', async ({
  page,
}) => {
  const state = structuredClone(incoming);
  state.currentTournament = f.engine.finishTournament(
    f.engine.finishLeague(f.engine.start(f.team, 'restored-finale', f.now)),
    f.now,
  );
  state.completedTournaments = [];
  await page.goto('#/settings');
  await choose(page, serializeBackup(state, services, f.now));
  await confirm(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'wurde wiederhergestellt' }),
  ).toBeVisible();
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  const result = await records(page);
  const expected = backupRecords(state);
  for (const key of [
    keys.currentDraft,
    keys.currentTeam,
    keys.currentTournament,
    keys.userSettings,
  ])
    expect(result[key]).toBe(expected[key]);
  expect(JSON.parse(result[keys.completedTournaments]!).entries).toEqual([
    createHistoryEntry(state.currentTournament, f.engine),
  ]);
});

test('backup preview and confirmation support keyboard navigation, accessibility and mobile widths', async ({
  page,
}) => {
  await page.goto('#/settings');
  await choose(page);
  await expect(page.getByRole('heading', { name: 'Geprüfte Sicherung' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }),
  ).toBeFocused();
});
