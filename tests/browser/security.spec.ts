import { expect, test } from '@playwright/test';
import { tournamentFixture } from '../helpers/tournament.ts';
import { backupRecords } from '../../src/engine/backup.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';

const f = tournamentFixture();

test('the production policy blocks inline script, eval, external connections and base injection', async ({
  page,
}) => {
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen am Spielfeldrand.');
  // Exercise CSP from a real page script. DevTools evaluation can bypass eval restrictions.
  await page.route('**/security-probe.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `void (async () => {
      const violations = [];
      document.addEventListener('securitypolicyviolation', event => violations.push(event.effectiveDirective));
      const script = document.createElement('script');
      script.textContent = 'document.documentElement.dataset.injected = "yes"';
      document.body.append(script);
      let evalBlocked = false;
      try { (0, eval)('document.documentElement.dataset.injected = "yes"'); }
      catch { evalBlocked = true; }
      let connectionBlocked = false;
      try { await fetch('https://example.invalid/private-game-data'); }
      catch { connectionBlocked = true; }
      const base = document.createElement('base');
      base.href = 'https://example.invalid/';
      document.head.append(base);
      await new Promise(resolve => setTimeout(resolve, 100));
      document.documentElement.dataset.probe = JSON.stringify({
        injected: document.documentElement.dataset.injected, evalBlocked, connectionBlocked,
        base: document.baseURI, violations,
        referrer: document.querySelector('meta[name="referrer"]').getAttribute('content')
      });
    })();`,
    }),
  );
  await page.evaluate((url) => {
    const script = document.createElement('script');
    script.src = url;
    document.body.append(script);
  }, new URL('security-probe.js', page.url()).href);
  await expect(page.locator('html')).toHaveAttribute('data-probe', /evalBlocked/);
  const result = await page.evaluate(() => JSON.parse(document.documentElement.dataset.probe!));
  expect(result.injected).toBeUndefined();
  expect(result.evalBlocked).toBe(true);
  expect(result.connectionBlocked).toBe(true);
  expect(result.base).not.toContain('example.invalid');
  expect(result.violations).toEqual(
    expect.arrayContaining(['script-src-elem', 'script-src', 'connect-src', 'base-uri']),
  );
  expect(result.referrer).toBe('no-referrer');
});

test('HTML in a stored team name is displayed as text and never becomes active markup', async ({
  page,
}) => {
  const name = '<img src=x onerror="document.body.dataset.xss=1">';
  await page.addInitScript(
    (records) => {
      for (const [key, value] of Object.entries(records))
        if (value !== null) localStorage.setItem(key, value);
    },
    backupRecords({ ...createInitialAppState(), currentTeam: { ...f.team, name } }),
  );
  await page.goto('');
  await expect(page.locator('.saved-team-summary')).toContainText(name);
  await expect(page.locator('.saved-team-summary img[src="x"]')).toHaveCount(0);
  expect(await page.locator('body').getAttribute('data-xss')).toBeNull();
});

test('a malicious backup is rejected without replacing the existing game state', async ({
  page,
}) => {
  await page.goto('#/settings');
  await expect(page.getByLabel('Sicherungsdatei auswählen', { exact: true })).toBeVisible();
  const previous = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  await page.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
    name: 'untrusted.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      '{"format":"prime-xi-backup","version":1,"extra":' +
        '{"x":'.repeat(100) +
        '0' +
        '}'.repeat(100) +
        '}',
    ),
  });
  await expect(page.getByRole('alert')).toContainText('keine lesbare JSON-Sicherung');
  await expect(
    page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(previous);
});
