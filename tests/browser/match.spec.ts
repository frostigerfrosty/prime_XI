import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase } from '../../src/data/index.ts';
import { createMatchEngine } from '../../src/engine/match.ts';
import { primeMatchTeam } from '../../src/engine/match-team.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { createSavedTeam } from '../../src/engine/saved-team.ts';
import { formatStrength } from '../../src/utils/display.ts';

const data = getDatabase(),
  model = createStrengthModel(data),
  engine = createMatchEngine(data.rules);
const homeId = 'real-madrid-2016-2017',
  awayId = 'barcelona-2010-2011';
const h = primeMatchTeam(
  data.teams.find((team) => team.id === homeId)!,
  model,
  data.defaults.defaultTactic,
);
const a = primeMatchTeam(
  data.teams.find((team) => team.id === awayId)!,
  model,
  data.defaults.defaultTactic,
);
function fixture(decision: 'extra-time' | 'penalties') {
  for (let index = 0; index < 1000; index++) {
    const seed = `browser-match-${index}`;
    const result = engine.simulateMatch(h, a, { seed, neutralVenue: true, mode: 'knockout' });
    if (result.decidedBy === decision) return { seed, result };
  }
  throw new Error(`No fixture for ${decision}`);
}
const scoreText = (score: { home: number; away: number }) => `${score.home} : ${score.away}`;
const appErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  appErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
});
test.afterEach(async ({ page }) => {
  expect(appErrors.get(page)).toEqual([]);
});

test('a seeded catalog match replays exactly and changed controls clear the previous result', async ({
  page,
}) => {
  await page.goto('#/test-match');
  await expect(page).toHaveTitle('Testspiel · PRIME XI');
  await expect(page.getByRole('combobox', { name: 'Heimteam' }).locator('option')).toHaveCount(60);
  await page.getByLabel('Spielcode', { exact: true }).fill('browser-replay');
  const result = engine.simulateMatch(h, a, {
    seed: 'browser-replay',
    neutralVenue: true,
    mode: 'regular',
  });
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByTestId('match-score')).toContainText(scoreText(result.regularTime));
  const before = await page.locator('.match-stage').innerText();
  await expect(page.getByRole('region', { name: 'Spielergebnis' })).toBeFocused();
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  expect(await page.locator('.match-stage').innerText()).toBe(before);
  const keysBefore = await page.evaluate(() => Object.keys(localStorage));
  expect(keysBefore).not.toContain(data.rules.storage.keys.currentTournament);
  expect(keysBefore).not.toContain(data.rules.storage.keys.completedTournaments);
  await page.getByLabel('Neutraler Platz', { exact: true }).uncheck();
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await expect(page.getByText('Das Heimteam erhält 1,5 Stärkepunkte Heimvorteil.')).toBeVisible();
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  const hosted = engine.simulateMatch(h, a, {
    seed: 'browser-replay',
    neutralVenue: false,
    mode: 'regular',
  });
  await expect(page.getByTestId('match-score')).toContainText(scoreText(hosted.regularTime));
  await page.getByRole('combobox', { name: 'Gastteam' }).selectOption('milan-2006-2007');
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await page.getByRole('button', { name: 'Neuer Code' }).click();
  await expect(page.getByLabel('Spielcode', { exact: true })).not.toHaveValue('browser-replay');
  await page.getByLabel('Spielcode', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await expect(page.getByRole('alert')).toContainText('Ungültiger Spielkontext');
});

test('extra time uses a cumulative score and penalties remain a separate result with kick details', async ({
  page,
}) => {
  await page.goto('#/test-match');
  await page.getByRole('combobox', { name: 'Spielmodus' }).selectOption('knockout');
  for (const decision of ['extra-time', 'penalties'] as const) {
    const { seed, result } = fixture(decision);
    await page.getByLabel('Spielcode', { exact: true }).fill(seed);
    await page.getByRole('button', { name: 'Anpfiff' }).click();
    await expect(page.getByTestId('match-score')).toContainText(scoreText(result.afterExtraTime!));
    await expect(page.getByRole('status')).toContainText(
      `Nach 90 Minuten ${scoreText(result.regularTime)}`,
    );
    await expect(page.getByRole('status')).toContainText('Sieger:');
    if (result.penalties) {
      await expect(page.getByRole('status')).toContainText(
        `Elfmeterschießen ${scoreText(result.penalties)} · separat vom Spielstand`,
      );
      const details = page.getByText('Elfmeterschießen ansehen', { exact: true });
      await details.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.match-penalties li')).toHaveCount(result.shootoutKicks.length);
    }
  }
  await page.getByRole('combobox', { name: 'Spielmodus' }).selectOption('regular');
  await expect(page.getByTestId('match-score')).toContainText('VS');
  await expect(page.locator('.match-penalties')).toHaveCount(0);
});

test('the legacy saved XI is playable with its saved strength while the draft has unsaved changes', async ({
  page,
}) => {
  const builder = createBuilder({
    teams: data.teams,
    formations: data.formations,
    tacticIds: data.tactics.map((t) => t.id),
    rules: data.rules.builder,
    defaultTactic: data.defaults.defaultTactic,
  });
  let draft = builder.newDraft('browser-complete', '4-3-3', '2020-01-01T00:00:00.000Z');
  for (const pick of builder.completion(draft)!)
    draft = builder.change(draft, {
      type: 'player',
      slotId: pick.slotId,
      cardId: pick.playerCardId,
    });
  draft = builder.change(draft, {
    type: 'coach',
    cardId: builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id,
  });
  const team = createSavedTeam(draft, builder, model, data.datasetVersion);
  expect(team.rulesVersion).toBe('1.1.0');
  draft = builder.change(draft, { type: 'tactic', tacticId: 'possession' });
  await page.addInitScript(
    ({ team, draft, data }) => {
      localStorage.setItem(
        data.rules.storage.keys.currentTeam,
        JSON.stringify({ schemaVersion: 1, team }),
      );
      localStorage.setItem(
        data.rules.storage.keys.currentDraft,
        JSON.stringify({ schemaVersion: 1, datasetVersion: data.datasetVersion, draft }),
      );
    },
    { team, draft, data: { rules: data.rules, datasetVersion: data.datasetVersion } },
  );
  await page.goto('#/test-match');
  await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(team.id);
  await expect(page.locator('.match-identity').first()).toContainText(
    formatStrength(team.strength.matchStrength),
  );
  await expect(
    page.getByText('Für deine Elf gelten die zuletzt gespeicherten Werte.', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Spielcode', { exact: true }).fill('saved-xi-test');
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  const result = engine.simulateMatch({ id: team.id, strength: team.strength.matchStrength }, a, {
    seed: 'saved-xi-test',
    neutralVenue: true,
    mode: 'regular',
  });
  await expect(page.getByTestId('match-score')).toContainText(scoreText(result.regularTime));
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).team,
      data.rules.storage.keys.currentTeam,
    ),
  ).toEqual(team);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Heimteam' })).toHaveValue(team.id);
  await expect(page.getByTestId('match-score')).toContainText('VS');
});

test('test matches work without storage writes, pass accessibility checks and fit small screens', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota', 'QuotaExceededError');
    };
  });
  await page.goto('#/test-match');
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  const { seed } = fixture('penalties');
  await page.getByRole('combobox', { name: 'Spielmodus' }).selectOption('knockout');
  await page.getByLabel('Spielcode', { exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Anpfiff' }).click();
  await page.getByText('Elfmeterschießen ansehen', { exact: true }).click();
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
});
