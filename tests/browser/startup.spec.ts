import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tournamentFixture } from '../helpers/tournament.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';
import { backupRecords } from '../../src/engine/backup.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';

const f = tournamentFixture();
const records = backupRecords({
  ...createInitialAppState(),
  currentDraft: f.draft,
  currentTeam: f.team,
  currentTournament: f.engine.nextMatchday(f.engine.start(f.team, 'startup-existing', f.now)),
});
const catalogURL = /\/assets\/database-[^/]+\.json(?:\?.*)?$/;
const appURL = /\/assets\/App-[^/]+\.js(?:\?.*)?$/;

async function preserveSave(page: Page) {
  await page.addInitScript(
    ({ master, records }) => {
      if (!localStorage.getItem(master))
        localStorage.setItem(master, JSON.stringify({ schemaVersion: 1, records }));
      localStorage.setItem('unrelated', 'keep');
    },
    { master: snapshotStorageKey, records },
  );
}
const saved = (page: Page) =>
  page.evaluate((master) => localStorage.getItem(master), snapshotStorageKey);
const rawSave = JSON.stringify({ schemaVersion: 1, records });

test('a slow catalog shows an accessible loading screen before becoming the real application', async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.route(catalogURL, async (route) => {
    requests++;
    await ready;
    await route.continue();
  });
  await page.goto('', { waitUntil: 'domcontentloaded' });
  try {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dein Spielfeld wird vorbereitet.',
    );
    await expect(page.getByRole('status')).toContainText('Katalog');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen am Spielfeldrand.');
  await page.goto('#/teams');
  await expect(page.locator('.team-card')).toHaveCount(60);
  expect(requests).toBe(1);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      type: (entry as PerformanceResourceTiming).initiatorType,
    })),
  );
  expect(resources.some((entry) => catalogURL.test(entry.name) && entry.type === 'fetch')).toBe(
    true,
  );
  expect(failures).toEqual([]);
});

for (const resource of ['catalog', 'application'] as const) {
  test(`a missing ${resource} shows recovery and preserves every saved component through reload`, async ({
    page,
  }) => {
    await preserveSave(page);
    let available = false;
    await page.route(resource === 'catalog' ? catalogURL : appURL, async (route) => {
      if (available) await route.continue();
      else
        await route.fulfill({
          status: 404,
          contentType: resource === 'catalog' ? 'application/json' : 'text/javascript',
          body: '',
        });
    });
    await page.goto('', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dein Spielfeld ist noch nicht erreichbar.',
    );
    await expect(page.getByRole('alert')).toContainText('Spielstände bleiben erhalten');
    expect(await saved(page)).toBe(rawSave);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    available = true;
    await page.getByRole('button', { name: 'Erneut laden', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Willkommen am Spielfeldrand.',
    );
    await expect(page.locator('.saved-team-summary')).toContainText(f.team.name);
    expect(await saved(page)).toBe(rawSave);
    expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
  });
}

test('malformed catalog data cannot initialize or overwrite existing game state', async ({
  page,
}) => {
  await preserveSave(page);
  await page.route(catalogURL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"schemaVersion":999}' }),
  );
  await page.goto('', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Dein Spielfeld ist noch nicht erreichbar.',
  );
  expect(await saved(page)).toBe(rawSave);
  await expect(page.getByRole('button', { name: 'Erneut laden', exact: true })).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the static page explains the requirement instead of remaining a blank screen', async ({
    page,
  }) => {
    const response = await page.goto('');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'JavaScript aktivieren', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'PRIME XI benötigt JavaScript für Team Builder, Spiele und lokale Spielstände.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dein Spielfeld wird vorbereitet.', exact: true }),
    ).not.toBeVisible();
  });
});
