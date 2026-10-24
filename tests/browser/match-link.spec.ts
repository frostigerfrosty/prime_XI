import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase } from '../../src/data/index.ts';
import { createMatchEngine } from '../../src/engine/match.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { primeMatchTeam } from '../../src/engine/match-team.ts';
import { matchSetupParams, type MatchSetup } from '../../src/engine/match-link.ts';
import { tournamentFixture } from '../helpers/tournament.ts';
import { backupRecords } from '../../src/engine/backup.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';

const data = getDatabase();
const model = createStrengthModel(data);
const engine = createMatchEngine(data.rules);
const versions = {
  dataset: data.datasetVersion,
  engine: engine.engineVersion,
  strength: model.rulesVersion,
};
const defaults: MatchSetup = {
  homeId: 'real-madrid-2016-2017',
  awayId: 'barcelona-2010-2011',
  mode: 'regular',
  neutralVenue: true,
  seed: 'shared-game',
};
const address = (setup: MatchSetup) => `#/test-match?${matchSetupParams(setup, versions)}`;
const home = (page: Page) => page.getByRole('combobox', { name: 'Heimteam', exact: true });
const away = (page: Page) => page.getByRole('combobox', { name: 'Gastteam', exact: true });
const mode = (page: Page) => page.getByRole('combobox', { name: 'Spielmodus', exact: true });
const seed = (page: Page) => page.getByLabel('Spielcode', { exact: true });
const share = (page: Page) => page.getByRole('textbox', { name: 'Testspiellink', exact: true });
const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page)).toEqual([]);
});

test('every edited setting survives reload and a new tab repeats the exact catalog game without auto-playing', async ({
  page,
  context,
}) => {
  await page.goto('#/test-match');
  await home(page).selectOption('milan-2006-2007');
  await away(page).selectOption(defaults.homeId);
  await mode(page).selectOption('knockout');
  await page.getByLabel('Neutraler Platz', { exact: true }).uncheck();
  const code = 'Finale + Rückspiel & = #? / % ⚽';
  await seed(page).fill(code);
  const url = await share(page).inputValue();
  expect(new URLSearchParams(new URL(url).hash.split('?')[1]).get('seed')).toBe(code);
  await page.reload();
  await expect(home(page)).toHaveValue('milan-2006-2007');
  await expect(away(page)).toHaveValue(defaults.homeId);
  await expect(mode(page)).toHaveValue('knockout');
  await expect(page.getByLabel('Neutraler Platz', { exact: true })).not.toBeChecked();
  await expect(seed(page)).toHaveValue(code);
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  const before = await page.locator('.match-stage').innerText();
  const other = await context.newPage();
  await other.goto(url);
  await expect(other.getByTestId('match-score')).toContainText('VS');
  await other.getByRole('button', { name: 'Anpfiff' }).click();
  expect(await other.locator('.match-stage').innerText()).toBe(before);
  await other.close();
});

test('typing and editing the middle of a code retains every character and the input focus', async ({
  page,
}) => {
  await page.goto(address(defaults));
  await seed(page).fill('');
  await seed(page).pressSequentially('Finale+&=12', { delay: 20 });
  await expect(seed(page)).toHaveValue('Finale+&=12');
  await expect(seed(page)).toBeFocused();
  await seed(page).evaluate((input) => (input as HTMLInputElement).setSelectionRange(3, 3));
  await page.keyboard.type('XY', { delay: 20 });
  await expect(seed(page)).toHaveValue('FinXYale+&=12');
  expect(await seed(page).evaluate((input) => (input as HTMLInputElement).selectionStart)).toBe(5);
  await page.reload();
  await expect(seed(page)).toHaveValue('FinXYale+&=12');
});

test('a known penalty game reproduces score, xG and all shootout kicks from its link', async ({
  page,
}) => {
  const h = primeMatchTeam(
    data.teams.find((t) => t.id === defaults.homeId)!,
    model,
    data.defaults.defaultTactic,
  );
  const a = primeMatchTeam(
    data.teams.find((t) => t.id === defaults.awayId)!,
    model,
    data.defaults.defaultTactic,
  );
  let fixture;
  for (let index = 0; index < 1000; index++) {
    const code = `shared-penalties-${index}`;
    const result = engine.simulateMatch(h, a, { seed: code, neutralVenue: true, mode: 'knockout' });
    if (result.penalties) {
      fixture = { code, result };
      break;
    }
  }
  if (!fixture) throw Error('No penalty fixture');
  await page.goto(address({ ...defaults, mode: 'knockout', seed: fixture.code }));
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByTestId('match-score')).toContainText(
    `${fixture.result.afterExtraTime!.home} : ${fixture.result.afterExtraTime!.away}`,
  );
  await page.getByText('Elfmeterschießen ansehen', { exact: true }).click();
  const before = await page.locator('.match-stage').innerText();
  await page.reload();
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await page.getByText('Elfmeterschießen ansehen', { exact: true }).click();
  expect(await page.locator('.match-stage').innerText()).toBe(before);
  await expect(page.locator('.match-penalties li')).toHaveCount(
    fixture.result.shootoutKicks.length,
  );
});

test('clipboard success copies the complete current configuration and edits remove stale results and feedback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
      configurable: true,
    });
  });
  await page.goto(address(defaults));
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await page.getByRole('button', { name: 'Link kopieren', exact: true }).click();
  await expect(page.getByText('Testspiellink kopiert.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    await share(page).inputValue(),
  );
  await mode(page).selectOption('knockout');
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await expect(page.getByText('Testspiellink kopiert.', { exact: true })).toHaveCount(0);
  expect(
    new URLSearchParams(new URL(await share(page).inputValue()).hash.split('?')[1]).get('mode'),
  ).toBe('knockout');
  await page.getByRole('button', { name: 'Neuer Code' }).click();
  await expect(seed(page)).not.toHaveValue(defaults.seed);
  await page.reload();
  await expect(seed(page)).not.toHaveValue(defaults.seed);
  await seed(page).fill('   ');
  await expect(share(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Link kopieren', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByRole('alert')).toContainText('Ungültiger Spielkontext');
});

test('denied or unavailable clipboard falls back to a selected manual link and remains accessible at mobile widths', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
      configurable: true,
    });
  });
  await page.goto(address(defaults));
  await page.getByRole('button', { name: 'Link kopieren', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Kopiere den markierten Link manuell/)).toBeVisible();
  await expect(share(page)).toBeFocused();
  expect(
    await share(page).evaluate(
      (el) => (el as HTMLInputElement).selectionEnd! - (el as HTMLInputElement).selectionStart!,
    ),
  ).toBe((await share(page).inputValue()).length);
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
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }),
  );
  await page.getByRole('button', { name: 'Link kopieren', exact: true }).click();
  await expect(share(page)).toBeFocused();
});

test('ambiguous, incomplete, malformed and outdated links never simulate or silently replace their configuration', async ({
  page,
}) => {
  const badLinks = [
    `${matchSetupParams(defaults, versions)}&home=${defaults.homeId}`,
    matchSetupParams(defaults, { ...versions, dataset: 'other-catalog' }).toString(),
    matchSetupParams(defaults, { ...versions, engine: 'other-engine' }).toString(),
    matchSetupParams(defaults, { ...versions, strength: 'other-model' }).toString(),
    matchSetupParams({ ...defaults, homeId: 'missing' }, versions).toString(),
  ];
  for (const [key, value] of [
    ['v', '2'],
    ['mode', 'invalid'],
    ['neutral', 'yes'],
    ['seed', 'x'.repeat(101)],
  ]) {
    const params = matchSetupParams(defaults, versions);
    params.set(key!, value!);
    badLinks.push(params.toString());
  }
  const incomplete = matchSetupParams(defaults, versions);
  incomplete.delete('seed');
  badLinks.push(incomplete.toString());
  for (const query of badLinks) {
    await page.goto(`#/test-match?${query}`);
    await expect(
      page.getByRole('heading', { name: 'Diese Paarung ist nicht verfügbar.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anpfiff' })).toHaveCount(0);
    await expect(share(page)).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Teams neu wählen' }).click();
  await expect(home(page)).toHaveValue(defaults.homeId);
  await expect(away(page)).toHaveValue(defaults.awayId);
});

test('rapid consecutive edits retain the latest complete setup and navigation clears prior results', async ({
  page,
}) => {
  await page.goto(address(defaults));
  await home(page).evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) throw Error('Missing home selection');
    element.value = 'milan-2006-2007';
    element.dispatchEvent(new Event('change', { bubbles: true }));
    const awaySelect = [...document.querySelectorAll<HTMLSelectElement>('.match-setup select')][1]!;
    awaySelect.value = 'real-madrid-2016-2017';
    awaySelect.dispatchEvent(new Event('change', { bubbles: true }));
    const modeSelect = [...document.querySelectorAll<HTMLSelectElement>('.match-setup select')][2]!;
    modeSelect.value = 'knockout';
    modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(home(page)).toHaveValue('milan-2006-2007');
  await expect(away(page)).toHaveValue(defaults.homeId);
  await expect(mode(page)).toHaveValue('knockout');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await page.goto(address({ ...defaults, seed: 'second-link' }));
  await expect(seed(page)).toHaveValue('second-link');
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await page.goBack();
  await expect(home(page)).toHaveValue('milan-2006-2007');
  await expect(mode(page)).toHaveValue('knockout');
  await expect(page.getByTestId('match-score')).toContainText('VS');
});

test('a saved-XI match stays local, survives reload and leaves the entire saved game unchanged', async ({
  page,
}) => {
  const f = tournamentFixture();
  const raw = JSON.stringify({
    schemaVersion: 1,
    records: backupRecords({
      ...createInitialAppState(),
      currentDraft: f.draft,
      currentTeam: f.team,
      currentTournament: f.engine.nextMatchday(f.engine.start(f.team, 'stage12-local', f.now)),
    }),
  });
  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
      localStorage.setItem('unrelated', 'keep');
    },
    { key: snapshotStorageKey, raw },
  );
  await page.goto('#/test-match');
  await expect(home(page)).toHaveValue(f.team.id);
  await expect(share(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Zur Spielstandsicherung' })).toBeVisible();
  await mode(page).selectOption('knockout');
  await seed(page).fill('my-local-game');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  const before = await page.locator('.match-stage').innerText();
  await page.reload();
  await expect(home(page)).toHaveValue(f.team.id);
  await expect(mode(page)).toHaveValue('knockout');
  await expect(seed(page)).toHaveValue('my-local-game');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  expect(await page.locator('.match-stage').innerText()).toBe(before);
  expect(await page.evaluate((key) => localStorage.getItem(key), snapshotStorageKey)).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
  await home(page).selectOption(defaults.homeId);
  await expect(share(page)).toBeVisible();
});

test('sharing works with blocked storage and a late clipboard response cannot confirm a changed link', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota', 'QuotaExceededError');
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            (window as unknown as { finishCopy: () => void }).finishCopy = resolve;
          }),
      },
      configurable: true,
    });
  });
  await page.goto(address(defaults));
  await page.getByRole('button', { name: 'Link kopieren', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Link wird kopiert …' })).toBeDisabled();
  await seed(page).fill('changed-during-copy');
  await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy());
  await expect(page.getByText('Testspiellink kopiert.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Link kopieren', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByTestId('match-score')).not.toContainText('VS');
});
