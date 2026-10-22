import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase } from '../../src/data/index.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { createMatchEngine } from '../../src/engine/match.ts';
import { primeMatchTeam } from '../../src/engine/match-team.ts';
import { formatStrength } from '../../src/utils/display.ts';
import { tournamentFixture } from '../helpers/tournament.ts';
import { backupRecords } from '../../src/engine/backup.ts';
import { createInitialAppState } from '../../src/data/initial-state.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';

const data = getDatabase();
const model = createStrengthModel(data);
const engine = createMatchEngine(data.rules);
const milan = 'milan-2006-2007';
const barcelona = 'barcelona-2010-2011';
const madrid = 'real-madrid-2016-2017';
const first = (page: Page) => page.getByRole('combobox', { name: 'Erstes Team', exact: true });
const second = (page: Page) => page.getByRole('combobox', { name: 'Zweites Team', exact: true });

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test('catalog and detail links open a real comparison, including a Barcelona-only link', async ({
  page,
}) => {
  await page.goto('#/teams');
  await page.getByRole('link', { name: 'Zwei Prime-Teams vergleichen' }).click();
  await expect(page).toHaveTitle('Teamvergleich · PRIME XI');
  await expect(first(page)).toHaveValue(milan);
  await expect(second(page)).toHaveValue(barcelona);
  await expect(first(page).locator('option:not([value=""])')).toHaveCount(60);
  await page.getByRole('link', { name: 'Kader und Teamdetails' }).nth(1).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barcelona');
  await page.getByRole('link', { name: 'Barcelona 2010/11 vergleichen' }).click();
  await expect(first(page)).toHaveValue(barcelona);
  await expect(second(page)).toHaveValue(milan);
  await expect(page.getByRole('table')).toBeVisible();
  await page.reload();
  await expect(first(page)).toHaveValue(barcelona);
  await expect(second(page)).toHaveValue(milan);
});

test('changing and swapping teams survives reload and browser history without losing the other side', async ({
  page,
}) => {
  await page.goto('#/compare');
  await first(page).selectOption(madrid);
  await expect(page).toHaveURL(new RegExp(`left=${madrid}&right=${barcelona}`));
  await page.getByRole('button', { name: 'Teams tauschen' }).click();
  await expect(first(page)).toHaveValue(barcelona);
  await expect(second(page)).toHaveValue(madrid);
  await page.reload();
  await expect(first(page)).toHaveValue(barcelona);
  await expect(second(page)).toHaveValue(madrid);
  await page.goBack();
  await expect(first(page)).toHaveValue(madrid);
  await expect(second(page)).toHaveValue(barcelona);
  await page.goForward();
  await expect(first(page)).toHaveValue(barcelona);
  await second(page).selectOption(milan);
  await expect(first(page)).toHaveValue(barcelona);
  await expect(second(page)).toHaveValue(milan);
  await expect(first(page).locator(`option[value="${milan}"]`)).toHaveJSProperty('disabled', true);
  await expect(second(page).locator(`option[value="${barcelona}"]`)).toHaveJSProperty(
    'disabled',
    true,
  );
});

test('rapid successive choices and a swap retain both latest selections', async ({ page }) => {
  await page.goto('#/compare');
  await first(page).evaluate(
    (left, ids) => {
      const right = document.querySelector<HTMLSelectElement>(
        '.compare-controls label:nth-child(2) select',
      )!;
      if (!(left instanceof HTMLSelectElement)) throw Error('Missing first selection');
      left.value = ids.madrid;
      left.dispatchEvent(new Event('change', { bubbles: true }));
      right.value = ids.milan;
      right.dispatchEvent(new Event('change', { bubbles: true }));
      const swap = document.querySelector<HTMLButtonElement>('.compare-controls button')!;
      swap.click();
    },
    { madrid, milan },
  );
  await expect(first(page)).toHaveValue(milan);
  await expect(second(page)).toHaveValue(madrid);
  await expect(page).toHaveURL(new RegExp(`left=${milan}&right=${madrid}`));
});

test('all displayed values and both lineups come from the selected real standard XIs', async ({
  page,
}) => {
  await page.goto(`#/compare?left=${madrid}&right=${barcelona}`);
  const table = page.getByRole('table');
  for (const [index, id] of [madrid, barcelona].entries()) {
    const team = data.teams.find((candidate) => candidate.id === id)!;
    const lineup = team.defaultLineup.map((pick) => ({
      slotId: pick.slotId,
      player: team.players.find((p) => p.id === pick.playerId)!,
      clubId: team.clubId,
    }));
    const assessment = model.analyze({
      formationId: team.formation!,
      tacticId: data.defaults.defaultTactic,
      lineup,
      coach: team.coach,
      captainPersonId: lineup.some((p) => p.player.personId === team.captainPersonId)
        ? team.captainPersonId
        : null,
    });
    const values: [string, number][] = [
      ['Ø Kartenrating der Elf', team.teamRating!],
      ['Matchstärke', assessment.strength.matchStrength],
      ['Basisstärke', assessment.strength.baseTeamStrength],
      ['Teamchemie', assessment.strength.chemistryBonus],
      ['Taktik-Fit', assessment.strength.tacticalBonus],
      ['Coach-Bonus', assessment.strength.coachBonus],
      ['Captain-Bonus', assessment.strength.captainBonus],
      ...assessment.groups.map((g): [string, number] => [
        { goalkeeper: 'Torwart', defence: 'Abwehr', midfield: 'Mittelfeld', attack: 'Angriff' }[
          g.group
        ],
        g.average,
      ]),
    ];
    for (const [title, value] of values)
      await expect(
        table
          .getByRole('row')
          .filter({ has: page.getByRole('rowheader', { name: title, exact: true }) })
          .getByRole('cell')
          .nth(index),
      ).toHaveText(formatStrength(value));
    const card = page.getByRole('region', {
      name: `Standardelf ${team.clubName} · ${team.season}`,
      exact: true,
    });
    await expect(card.locator('.pitch-slot--filled')).toHaveCount(11);
    await card.getByText('Standardelf als Liste ansehen', { exact: true }).click();
    await expect(card.getByRole('listitem')).toHaveCount(11);
    for (const pick of lineup)
      await expect(card.getByRole('listitem').filter({ hasText: pick.player.name })).toContainText(
        `${pick.player.rating} OVR`,
      );
    const image = card.getByRole('img', { name: /Standardelf in Formation/ });
    for (const pick of lineup)
      await expect(image).toHaveAttribute(
        'aria-label',
        new RegExp(pick.player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
  }
});

test('unknown and duplicate team links can be repaired without silently showing a different pair', async ({
  page,
}) => {
  for (const link of [
    `left=unknown&right=${barcelona}`,
    `left=${milan}&right=${milan}`,
    `left=&right=${barcelona}`,
  ]) {
    await page.goto(`#/compare?${link}`);
    await expect(
      page.getByRole('heading', { name: 'Diese Paarung ist nicht verfügbar.' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Diese Paarung spielen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Teams tauschen' })).toBeDisabled();
    await first(page).selectOption(madrid);
    await expect(first(page)).toHaveValue(madrid);
    await expect(page.getByRole('table')).toBeVisible();
  }
  await page.goto('#/compare?left=unknown&right=missing');
  await page.getByRole('button', { name: 'Vergleich zurücksetzen' }).click();
  await expect(page).toHaveURL(/#\/compare$/);
  await expect(first(page)).toHaveValue(milan);
  await expect(second(page)).toHaveValue(barcelona);
});

test('a comparison opens and plays exactly that pair, including a new pair after browser back', async ({
  page,
}) => {
  await page.goto(`#/compare?left=${milan}&right=${madrid}`);
  for (const [home, away] of [
    [milan, madrid],
    [barcelona, madrid],
  ]) {
    await page.getByRole('link', { name: 'Diese Paarung spielen' }).click();
    await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(home!);
    await expect(page.getByRole('combobox', { name: 'Gastteam' })).toHaveValue(away!);
    await expect(page.getByLabel('Neutraler Platz', { exact: true })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(home!);
    await page.getByLabel('Spielcode', { exact: true }).fill('stage11-comparison');
    await page.getByRole('button', { name: 'Anpfiff' }).click();
    const result = engine.simulateMatch(
      primeMatchTeam(
        data.teams.find((t) => t.id === home)!,
        model,
        data.defaults.defaultTactic,
      ),
      primeMatchTeam(
        data.teams.find((t) => t.id === away)!,
        model,
        data.defaults.defaultTactic,
      ),
      { seed: 'stage11-comparison', neutralVenue: true, mode: 'regular' },
    );
    await expect(page.getByTestId('match-score')).toHaveText(
      new RegExp(`${result.regularTime.home} : ${result.regularTime.away}`),
    );
    await page.goBack();
    await expect(first(page)).toHaveValue(home!);
    await first(page).selectOption(barcelona);
  }
});

test('invalid test-match links require a new selection and never start a substituted match', async ({
  page,
}) => {
  for (const link of [
    `home=missing&away=${milan}`,
    `home=${milan}&away=${milan}`,
    `home=${milan}`,
  ]) {
    await page.goto(`#/test-match?${link}`);
    await expect(
      page.getByRole('heading', { name: 'Diese Paarung ist nicht verfügbar.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anpfiff' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Teams neu wählen' }).click();
    await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(madrid);
    await expect(page.getByRole('combobox', { name: 'Gastteam' })).toHaveValue(barcelona);
  }
});

test('a catalog pair overrides the saved-XI default without changing any existing game data', async ({
  page,
}) => {
  const f = tournamentFixture();
  const rawSave = JSON.stringify({
    schemaVersion: 1,
    records: backupRecords({
      ...createInitialAppState(),
      currentDraft: f.draft,
      currentTeam: f.team,
      currentTournament: f.engine.nextMatchday(f.engine.start(f.team, 'stage11-saved', f.now)),
    }),
  });
  await page.addInitScript(
    ({ key, raw }) => {
      localStorage.setItem(key, raw);
      localStorage.setItem('unrelated', 'keep');
    },
    { key: snapshotStorageKey, raw: rawSave },
  );
  await page.goto(`#/compare?left=${milan}&right=${barcelona}`);
  await page.getByRole('link', { name: 'Diese Paarung spielen' }).click();
  await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(milan);
  await expect(page.getByRole('combobox', { name: 'Gastteam' })).toHaveValue(barcelona);
  await expect(
    page.getByRole('combobox', { name: 'Heimteam' }).locator(`option[value="${f.team.id}"]`),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByTestId('match-score')).not.toContainText('VS');
  expect(await page.evaluate((key) => localStorage.getItem(key), snapshotStorageKey)).toBe(rawSave);
  expect(await page.evaluate(() => localStorage.getItem('unrelated'))).toBe('keep');
});

test('the comparison works with denied storage, supports the keyboard and fits mobile screens accessibly', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota', 'QuotaExceededError');
    };
  });
  await page.goto('#/compare');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Teamvergleich');
  await page.evaluate(() => document.fonts.ready);
  const swap = page.getByRole('button', { name: 'Teams tauschen' });
  await swap.focus();
  await page.keyboard.press('Enter');
  await expect(first(page)).toHaveValue(barcelona);
  await expect(swap).toBeFocused();
  for (const summary of await page
    .getByText('Standardelf als Liste ansehen', { exact: true })
    .all()) {
    await summary.focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.locator('.compare-lineup-details[open]')).toHaveCount(2);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    for (const image of await page.locator('img').all())
      await expect
        .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
  }
  await page.goto('#/compare?left=unknown&right=missing');
  await expect(
    page.getByRole('heading', { name: 'Diese Paarung ist nicht verfügbar.' }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
