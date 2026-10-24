import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getDatabase } from '../src/data/index.ts';
import { createMatchEngine } from '../src/engine/match.ts';
import { createStrengthModel } from '../src/engine/strength.ts';
import { primeMatchTeam } from '../src/engine/match-team.ts';

const address = new URL(process.argv[2]);
// GitHub can return an HTTP Pages URL while secure browser APIs require HTTPS.
if (address.hostname.endsWith('.github.io')) address.protocol = 'https:';
if (
  !['http:', 'https:'].includes(address.protocol) ||
  address.username ||
  address.password ||
  !address.pathname.endsWith('/')
)
  throw new Error('Supply the site URL with its trailing slash.');
address.search = '';
address.hash = '';
const output = process.argv[3] ?? '/tmp/prime-xi-site-check.json';
const data = getDatabase(),
  model = createStrengthModel(data),
  engine = createMatchEngine(data.rules);
const report = {
  url: address.href,
  commit: process.env['GITHUB_SHA'] ?? null,
  checkedAt: new Date().toISOString(),
  passed: false,
  views: [],
};
const browser = await chromium.launch(
  process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']
    ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] }
    : {},
);
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const failures = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400)
          failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      await page.goto(address.href);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Willkommen am Spielfeldrand.',
      );
      await page.goto(new URL('#/teams', address).href);
      await expect(page.locator('.team-card')).toHaveCount(60);
      await page.getByRole('combobox', { name: 'Verein', exact: true }).selectOption('milan');
      await expect(page.locator('.team-card')).toHaveCount(1);
      await page.locator('.team-card').click();
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('AC Milan');
      await expect(page.locator('.roster-table tbody tr')).toHaveCount(18);
      await page.goto(new URL('#/compare', address).href);
      await expect(page.getByRole('table')).toBeVisible();
      await page.getByRole('link', { name: 'Diese Paarung spielen', exact: true }).click();
      await page.getByLabel('Spielcode', { exact: true }).fill('published-preview-check');
      await page.getByRole('button', { name: 'Anpfiff', exact: true }).click();
      const result = engine.simulateMatch(
        primeMatchTeam(
          data.teams.find((t) => t.id === 'milan-2006-2007'),
          model,
          data.defaults.defaultTactic,
        ),
        primeMatchTeam(
          data.teams.find((t) => t.id === 'barcelona-2010-2011'),
          model,
          data.defaults.defaultTactic,
        ),
        { mode: 'regular', neutralVenue: true, seed: 'published-preview-check' },
      );
      await expect(page.getByTestId('match-score')).toContainText(
        `${result.regularTime.home} : ${result.regularTime.away}`,
      );
      const shared = await page
        .getByRole('textbox', { name: 'Testspiellink', exact: true })
        .inputValue();
      expect(new URL(shared).pathname).toBe(address.pathname);
      await page.goto(shared);
      await expect(page.getByTestId('match-score')).toContainText('VS');
      await page.getByRole('button', { name: 'Anpfiff', exact: true }).click();
      await expect(page.getByTestId('match-score')).toContainText(
        `${result.regularTime.home} : ${result.regularTime.away}`,
      );
      await page.goto(new URL('#/team-builder', address).href);
      await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
      await expect(page.getByText('Team 1 von 11', { exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Prime-Team', exact: true })).toHaveCount(0);
      await expect(page.locator('.drawn-team')).toHaveCount(0);
      await page.locator('button.pick-button:not(:disabled)').first().click();
      await expect(page.getByRole('dialog')).toContainText('Spieler und Position bestätigen?');
      await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
      await expect(page.getByText('Team 2 von 11', { exact: true })).toBeVisible();
      await expect(page.locator('.pitch-slot--filled')).toBeDisabled();
      await page.reload();
      await expect(page.getByText('Team 2 von 11', { exact: true })).toBeVisible();
      await expect(page.locator('.drawn-team')).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      for (const image of await page.locator('img').all())
        expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
      expect(failures).toEqual([]);
      report.views.push({
        width,
        passed: true,
        catalog: 60,
        roster: 18,
        seededMatchReplayed: true,
        sequentialDraftConfirmed: true,
      });
    } finally {
      await context.close();
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Site verification failed';
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report));
