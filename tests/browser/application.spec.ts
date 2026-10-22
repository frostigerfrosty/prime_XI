import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const appErrors = new WeakMap<Page, string[]>();
const viewTitles: Record<string, string> = {
  '': 'Willkommen am Spielfeldrand.',
  '#/team-builder': 'Team Builder',
  '#/teams': 'Die Besten ihrer Zeit.',
  '#/teams/milan-2006-2007': 'AC Milan',
  '#/teams/barcelona-2010-2011': 'Barcelona',
  '#/tournament': 'Dein Turnier',
  '#/history': 'Die Spiele bleiben.',
  '#/settings': 'Einstellungen',
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  // A failing runtime or asset request must not be hidden by an otherwise good UI.
  appErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  expect(appErrors.get(page)).toEqual([]);
});

async function navigate(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Menü öffnen' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: label, exact: true })
    .filter({ visible: true })
    .click();
}

test('all five pages navigate to real initial states without an invented game', async ({
  page,
}) => {
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen am Spielfeldrand.');
  await expect(page.getByText('Noch kein Team zusammengestellt')).toBeVisible();
  await navigate(page, 'Team Builder');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team Builder');
  await expect(
    page.getByRole('button', { name: 'Team speichern & Turnier starten' }),
  ).toBeDisabled();
  await navigate(page, 'Turnier');
  await expect(
    page.getByRole('heading', { name: 'Große Spiele brauchen eine vollständige Elf.' }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await navigate(page, 'Prime-Teams');
  await expect(page.locator('.team-card')).toHaveCount(60);
  await navigate(page, 'Historie');
  await expect(
    page.getByRole('heading', { name: 'Jede Legende fängt bei null an.' }),
  ).toBeVisible();
  await navigate(page, 'Dashboard');
  await expect(page).toHaveTitle('Dashboard · PRIME XI');
});

test('catalog filters survive detail navigation and reload; the roster uses real catalog cards', async ({
  page,
}) => {
  await page.goto('#/teams');
  await page.getByRole('searchbox', { name: 'Teams oder Trainer suchen' }).fill('guardiola');
  await page.getByRole('combobox', { name: 'Jahrgang' }).selectOption('2011');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('guardiola');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await page.locator('.team-card').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barcelona');
  await expect(page.locator('.roster-table tbody tr')).toHaveCount(18);
  await expect(page.getByRole('row', { name: /Lionel Messi/ })).toContainText('99');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barcelona');
  await page.goBack();
  await expect(page.getByRole('searchbox')).toHaveValue('guardiola');
  await expect(page.getByRole('combobox', { name: 'Jahrgang' })).toHaveValue('2011');
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(page).toHaveURL(/#\/teams$/);
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Jahrgang' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Verein' })).toHaveValue('');
  await expect(page.locator('.team-card')).toHaveCount(60);
  await page.getByRole('combobox', { name: 'Verein' }).selectOption('milan');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('Kein existierendes Team');
  await expect(page.getByRole('heading', { name: 'Kein Team gefunden.' })).toBeVisible();
  await page.getByRole('button', { name: 'Alle Teams anzeigen' }).click();
  await expect(page.locator('.team-card')).toHaveCount(60);
});

test('an immediate club selection after either reset keeps the other filters cleared', async ({
  page,
}) => {
  for (const reset of ['Filter zurücksetzen', 'Alle Teams anzeigen']) {
    await page.goto('#/teams?q=guardiola&year=2011&club=milan');
    await expect(page.getByRole('searchbox')).toHaveValue('guardiola');
    await expect(page.getByRole('heading', { name: 'Kein Team gefunden.' })).toBeVisible();
    // Run both actions before React can commit the router transition from the reset.
    await page.getByRole('button', { name: reset }).evaluate(
      (button, club) => {
        if (!(button instanceof HTMLButtonElement) || !(club instanceof HTMLSelectElement))
          throw new Error('Catalog filter controls are missing');
        button.click();
        club.value = 'milan';
        club.dispatchEvent(new Event('change', { bubbles: true }));
      },
      await page.getByRole('combobox', { name: 'Verein' }).elementHandle(),
    );
    await expect(page).toHaveURL(/#\/teams\?club=milan$/);
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Jahrgang' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Verein' })).toHaveValue('milan');
    await expect(page.locator('.team-card')).toHaveCount(1);
    await expect(page.locator('.team-card')).toContainText('Milan');
    await page.goBack();
    await expect(page.getByRole('searchbox')).toHaveValue('guardiola');
    await expect(page.getByRole('combobox', { name: 'Jahrgang' })).toHaveValue('2011');
    await page.getByRole('combobox', { name: 'Verein' }).selectOption('barcelona');
    await expect(page.locator('.team-card')).toHaveCount(1);
    await expect(page.locator('.team-card')).toContainText('Barcelona');
  }
});

test('formation preview changes while the incomplete team cannot start a tournament', async ({
  page,
}) => {
  await page.goto('#/team-builder');
  await expect(
    page.getByRole('img', { name: /Leere Aufstellung in Formation 4-3-3/ }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Formation' }).selectOption('3-5-2');
  await expect(
    page.getByRole('img', { name: /Leere Aufstellung in Formation 3-5-2/ }),
  ).toBeVisible();
  await expect(page.locator('.pitch-slot')).toHaveCount(11);
  await expect(page.getByRole('button', { name: '12 Teams ziehen' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Team speichern & Turnier starten' }),
  ).toBeDisabled();
});

test('motion preference persists and missing storage does not crash the app', async ({ page }) => {
  await page.goto('#/settings');
  await page.getByRole('switch', { name: /Bewegung reduzieren/ }).check();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Bewegung reduzieren/ })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await page.reload();
  await page.getByRole('switch', { name: /Bewegung reduzieren/ }).uncheck();
  await expect(page.getByRole('status')).toContainText('keine lokale Speicherung');
});

test('invalid routes and team IDs have a usable way back', async ({ page }) => {
  await page.goto('#/diese-seite-gibt-es-nicht');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Hier ist das Spielfeld zu Ende.',
  );
  await page.getByRole('link', { name: 'Zum Dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen am Spielfeldrand.');
  await page.goto('#/teams/unbekannt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dieses Team gibt es nicht.');
  await page.getByRole('link', { name: 'Zum Teamkatalog' }).click();
  await expect(page.locator('.team-card')).toHaveCount(60);
});

test('all primary views fit small screens and local images and fonts load', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    '',
    '#/team-builder',
    '#/teams',
    '#/teams/milan-2006-2007',
    '#/tournament',
    '#/history',
    '#/settings',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(viewTitles[route]!);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    const images = page.locator('img');
    for (const image of await images.all())
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    expect(await page.evaluate(() => document.fonts.check('600 24px "Barlow Condensed"'))).toBe(
      true,
    );
  }
});

test('keyboard menu closes with Escape and returns focus; skip link targets main', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  const menu = page.getByRole('button', { name: 'Menü öffnen' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navigation' })).not.toBeVisible();
  await expect(menu).toBeFocused();
  await page.getByRole('link', { name: 'Zum Inhalt springen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('core views pass automated accessibility checks', async ({ page }) => {
  for (const route of [
    '',
    '#/team-builder',
    '#/teams/barcelona-2010-2011',
    '#/settings',
    '#/tournament',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(viewTitles[route]!);
    await page.evaluate(() => document.fonts.ready);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(violations, `Accessibility: ${route}`).toEqual([]);
  }
});
