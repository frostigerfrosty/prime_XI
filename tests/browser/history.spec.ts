import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tournamentFixture, championTestTeam } from '../helpers/tournament.ts';
import { createHistoryEntry } from '../../src/engine/history.ts';
import type { SavedTeam, TournamentState } from '../../src/types/application.ts';

const f = tournamentFixture(),
  keys = f.data.rules.storage.keys;
const complete = f.engine.finishTournament(
  f.engine.finishLeague(f.engine.start(f.team, 'knockout-0', f.now)),
  f.now,
);
const second = f.engine.finishTournament(
  f.engine.finishLeague(f.engine.start(f.team, 'knockout-1', f.now)),
  f.now,
);
const archived = createHistoryEntry(complete, f.engine);
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

async function preload(page: Page, tournament: TournamentState, team: SavedTeam = f.team) {
  await page.addInitScript(
    ({ keys, tournament, team }) => {
      if (!localStorage.getItem(keys.currentTeam))
        localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
      if (!localStorage.getItem(keys.currentTournament))
        localStorage.setItem(
          keys.currentTournament,
          JSON.stringify({ schemaVersion: 1, tournament }),
        );
    },
    { keys, tournament, team },
  );
}
const readArchive = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), keys.completedTournaments);
const readTournament = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).tournament as TournamentState,
    keys.currentTournament,
  );
async function restart(page: Page, seed = 'archive-new') {
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Neues Turnier', exact: true }).click();
  await page.getByRole('textbox', { name: 'Turniercode', exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
}

test('a pre-archive completed save is imported once and its frozen XI survives reload and later team changes', async ({
  page,
}) => {
  await preload(page, complete);
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  expect((await readArchive(page)).entries).toEqual([archived]);
  expect(await readTournament(page)).toEqual(complete);
  await page.reload();
  expect((await readArchive(page)).entries).toHaveLength(1);
  await page.getByRole('link', { name: 'Turnier ansehen', exact: true }).click();
  await expect(page).toHaveTitle('Turnierrückblick · PRIME XI');
  await expect(
    page.getByRole('table', { name: 'Archivierte Aufstellung' }).locator('tbody tr'),
  ).toHaveCount(11);
  await expect(
    page.getByRole('table', { name: 'Deine archivierten Spiele' }).locator('tbody tr'),
  ).toHaveCount(archived.matches.length);
  await page.evaluate(
    ({ key, team }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ schemaVersion: 1, team: { ...team, name: 'Spätere Elf' } }),
      ),
    { key: keys.currentTeam, team: f.team },
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.team.name);
  expect((await readArchive(page)).entries).toEqual([archived]);
  expect(await readTournament(page)).toEqual(complete);
});

test('starting and completing another tournament keeps both archives and the filters show real results', async ({
  page,
}) => {
  const team = championTestTeam(f);
  team.name = 'Neue Siegerelf';
  await preload(page, complete, team);
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await restart(page, 'user-champion-1');
  await page.getByRole('button', { name: 'Restliche Ligaphase simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByTestId('tournament-champion')).toContainText(team.name);
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(2);
  const entries = (await readArchive(page)).entries;
  expect(
    entries.find((entry: { tournamentId: string }) => entry.tournamentId === complete.id),
  ).toEqual(archived);
  await page.getByRole('checkbox', { name: 'Nur eigene Titel' }).check();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await expect(page.getByTestId('history-entry')).toContainText(team.name);
  await page.getByRole('checkbox', { name: 'Nur eigene Titel' }).uncheck();
  await page.getByRole('searchbox', { name: 'Turniere durchsuchen' }).fill('knockout-0');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await expect(page.getByTestId('history-entry')).toContainText(f.team.name);
  await page.reload();
  await expect(page.getByTestId('history-entry')).toHaveCount(2);
});

test('an unfinished legacy league save never creates an archive and unknown detail links have a way back', async ({
  page,
}) => {
  const legacy = f.engine.nextMatchday(f.engine.start(f.team, 'legacy-archive', f.now));
  legacy.rulesVersion = '1.3.0';
  delete legacy.knockoutVersion;
  await preload(page, legacy);
  await page.goto('#/history');
  await expect(
    page.getByRole('heading', { name: 'Jede Legende fängt bei null an.' }),
  ).toBeVisible();
  expect(await readArchive(page)).toBeNull();
  expect(await readTournament(page)).toEqual(legacy);
  await page.goto('#/history/unknown');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Dieser Rückblick ist nicht im Archiv.',
  );
  await page.getByRole('link', { name: 'Zum Turnierarchiv', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Jede Legende fängt bei null an.' }),
  ).toBeVisible();
});

test('unknown archive formats remain untouched until an explicit reset and cannot silently lose the completed save', async ({
  page,
}) => {
  const raw = JSON.stringify({ schemaVersion: 99, entries: ['future data'] });
  await preload(page, complete);
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: keys.completedTournaments, raw },
  );
  await page.goto('#/history');
  await expect(page.getByRole('alert')).toContainText('nicht automatisch überschrieben');
  expect(await page.evaluate((key) => localStorage.getItem(key), keys.completedTournaments)).toBe(
    raw,
  );
  await restart(page);
  await expect(
    page.getByRole('alert').filter({ hasText: 'noch nicht dauerhaft archiviert' }),
  ).toBeVisible();
  expect(await readTournament(page)).toEqual(complete);
  await page.goto('#/history');
  await page.getByRole('button', { name: 'Beschädigtes Archiv zurücksetzen', exact: true }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), keys.completedTournaments)).toBe(
    raw,
  );
  await page.getByRole('button', { name: 'Beschädigtes Archiv zurücksetzen', exact: true }).click();
  await page.getByRole('button', { name: 'Archiv zurücksetzen', exact: true }).click();
  expect(await readTournament(page)).toEqual(complete);
  await restart(page);
  await expect(
    page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }),
  ).toBeVisible();
  expect((await readArchive(page)).entries).toEqual([archived]);
});

test('quota failures preserve durable entries and the last completed tournament until archiving can be retried', async ({
  page,
}) => {
  await preload(page, second);
  await page.addInitScript(
    ({ key, entry }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, entries: [entry] }));
      Object.assign(window, { archiveWritesBlocked: true });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (
          name === key &&
          (window as Window & { archiveWritesBlocked?: boolean }).archiveWritesBlocked
        )
          throw new DOMException('Quota', 'QuotaExceededError');
        original.call(this, name, value);
      };
    },
    { key: keys.completedTournaments, entry: archived },
  );
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText('nicht dauerhaft');
  expect((await readArchive(page)).entries).toEqual([archived]);
  await restart(page);
  expect(await readTournament(page)).toEqual(second);
  await expect(
    page.getByRole('alert').filter({ hasText: 'noch nicht dauerhaft archiviert' }),
  ).toBeVisible();
  await page.evaluate(() => Object.assign(window, { archiveWritesBlocked: false }));
  await restart(page);
  await expect(
    page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }),
  ).toBeVisible();
  expect((await readArchive(page)).entries).toHaveLength(2);
  expect(
    (await readArchive(page)).entries.find((entry: { id: string }) => entry.id === archived.id),
  ).toEqual(archived);
});

test('denied archive reads preserve the completed tournament without offering a destructive reset', async ({
  page,
}) => {
  await preload(page, complete);
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException('Denied', 'SecurityError');
      return original.call(this, name);
    };
  }, keys.completedTournaments);
  await page.goto('#/history');
  await expect(page.getByRole('alert')).toContainText('Browsereinstellungen');
  await expect(
    page.getByRole('button', { name: 'Beschädigtes Archiv zurücksetzen', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  expect(await readTournament(page)).toEqual(complete);
  await restart(page);
  await expect(
    page.getByRole('alert').filter({ hasText: 'noch nicht dauerhaft archiviert' }),
  ).toBeVisible();
  expect(await readTournament(page)).toEqual(complete);
});

test('archive, frozen details and reset dialog pass accessibility checks and fit mobile screens', async ({
  page,
}) => {
  await preload(page, complete);
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  for (const detail of [false, true]) {
    if (detail) await page.getByRole('link', { name: 'Turnier ansehen', exact: true }).click();
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
  }
  await page.evaluate((key) => localStorage.setItem(key, 'invalid'), keys.completedTournaments);
  await page.goto('#/history');
  await page.reload();
  await page.getByRole('button', { name: 'Beschädigtes Archiv zurücksetzen', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Beschädigtes Archiv zurücksetzen', exact: true }),
  ).toBeFocused();
});
