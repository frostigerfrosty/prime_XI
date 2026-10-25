import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase } from '../../src/data/index.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';
import { readFile } from 'node:fs/promises';
import { tournamentFixture } from '../helpers/tournament.ts';

const data = getDatabase();
const builder = createBuilder({
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((t) => t.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
});

test('a tournament can change language after a matchday and finish with an Italian archive', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const f = tournamentFixture();
  await page.addInitScript(
    ({ team, settings, keys }) => {
      if (!localStorage.getItem(keys.currentTeam)) {
        localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
        localStorage.setItem(keys.userSettings, JSON.stringify(settings));
      }
    },
    {
      team: f.team,
      settings: { ...f.data.defaults, locale: 'en' },
      keys: f.data.rules.storage.keys,
    },
  );
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Start tournament', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate matchday 1', exact: true }).click();
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    data.rules.storage.keys.currentTournament,
  );
  await page.goto('#/settings');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('it');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impostazioni');
  await page.goto('#/tournament');
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      data.rules.storage.keys.currentTournament,
    ),
  ).toBe(before);
  await expect(
    page.getByRole('button', { name: 'Simula la giornata 2', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Simula il resto della fase campionato', exact: true })
    .click();
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await page.getByRole('button', { name: 'Simula fino alla finale', exact: true }).click();
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByTestId('tournament-champion')).toBeVisible();
  await page.getByRole('link', { name: "Vai all'archivio dei tornei", exact: true }).click();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByRole('link', { name: 'Mostra il torneo', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Le tue partite archiviate', exact: true }),
  ).toBeVisible();
});

test('the latest language choice wins while a pack is loading and blocked storage only limits persistence', async ({
  page,
}) => {
  await page.route('**/en-*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto('#/settings');
  const delayed = page.waitForResponse((response) => /\/en-[^/]+\.js/u.test(response.url()));
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en');
  await page.getByRole('combobox').first().selectOption('it');
  await delayed;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impostazioni');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impostazioni');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'QuotaExceededError');
    };
  });
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Your browser currently does not allow local saving.' }),
  ).toBeVisible();
});
test('language changes persist, preserve a confirmed draft and work in English and Italian on mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  await page.locator('button.pick-button:not(:disabled)').first().click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    data.rules.storage.keys.currentDraft,
  );
  await page.goto('#/settings');
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page).toHaveTitle('Settings · PRIME XI');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  await page.goto('#/team-builder');
  await expect(page.getByText('Team 2 of 11', { exact: true })).toBeVisible();
  await expect(page.locator('.pitch-slot--filled')).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), data.rules.storage.keys.currentDraft),
  ).toBe(before);
  await page.goto('#/teams');
  await page.getByRole('combobox', { name: 'Club', exact: true }).selectOption('milan');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await page.locator('.team-card').click();
  await page.getByText('Explain rating', { exact: true }).first().click();
  await expect(
    page.getByText('Position performance (35 %)', { exact: true }).first(),
  ).toBeVisible();
  await page.goto('#/settings');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('it');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impostazioni');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.goto('#/team-builder');
  await expect(page.getByText('Squadra 2 di 11', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Scegli la posizione', exact: true }),
  ).toBeVisible();
  await page.locator('button.pick-button:not(:disabled)').first().click();
  await expect(page.getByRole('dialog')).toContainText('Confermare giocatore e posizione?');
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByText('Squadra 3 di 11', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Squadra 3 di 11', { exact: true })).toBeVisible();
  await page.goto('#/test-match');
  await page.getByLabel('Codice partita', { exact: true }).fill('Einstellungen');
  await page.getByRole('button', { name: "Calcio d'inizio", exact: true }).click();
  await expect(page.getByTestId('match-score')).not.toContainText('VS');
  await expect(page.locator('code').filter({ hasText: /^Einstellungen$/u })).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('a backup restores its language and the same hidden current team without changing the draft', async ({
  page,
  browser,
}) => {
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  const draft = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).draft,
    data.rules.storage.keys.currentDraft,
  );
  expect(builder.isValid(draft)).toBe(true);
  await page.goto('#/settings');
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('it');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica il backup', exact: true }).click();
  const file = await event,
    raw = await readFile((await file.path())!, 'utf8');
  expect(JSON.parse(raw).state.userSettings.locale).toBe('it');
  const fresh = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const restored = await fresh.newPage();
    await restored.goto(new URL('#/settings', page.url()).href);
    await restored.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
      name: 'italiano.json',
      mimeType: 'application/json',
      buffer: Buffer.from(raw),
    });
    await restored
      .getByRole('button', { name: 'Spielstand wiederherstellen', exact: true })
      .click();
    await restored.getByRole('button', { name: 'Sicherung übernehmen', exact: true }).click();
    await expect(restored.getByRole('heading', { level: 1 })).toHaveText('Impostazioni');
    await restored.goto(new URL('#/team-builder', page.url()).href);
    await expect(restored.getByText('Squadra 1 di 11', { exact: true })).toBeVisible();
    const stored = await restored.evaluate(
      ({ master, key }) => JSON.parse(JSON.parse(localStorage.getItem(master)!).records[key]).draft,
      { master: snapshotStorageKey, key: data.rules.storage.keys.currentDraft },
    );
    expect(stored).toEqual(draft);
  } finally {
    await fresh.close();
  }
});
