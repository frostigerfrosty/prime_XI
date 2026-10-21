import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase, getDatasetVersion } from '../../src/data/index.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { strengthInput } from '../../src/engine/saved-team.ts';
import { formatStrength } from '../../src/utils/display.ts';
import type { DraftState, SavedTeam } from '../../src/types/application.ts';

const data = getDatabase();
const builder = createBuilder({
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((tactic) => tactic.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
});
const model = createStrengthModel(data);
const keys = data.rules.storage.keys;
function completeDraft() {
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
  const captain = builder.lineup(draft).find((pick) => pick.player.naturalCaptain)!.player;
  return builder.change(draft, { type: 'captain', personId: captain.personId });
}
async function preload(page: Page, draft: DraftState) {
  await page.addInitScript(
    ({ key, draft, version }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({ schemaVersion: 1, datasetVersion: version, draft }),
        );
    },
    { key: keys.currentDraft, draft, version: getDatasetVersion() },
  );
}
const readTeam = (page: Page): Promise<SavedTeam> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).team, keys.currentTeam);
const readDraft = (page: Page): Promise<DraftState> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).draft, keys.currentDraft);
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

test('incomplete lineups show missing strength instead of a fabricated number', async ({
  page,
}) => {
  const complete = completeDraft();
  const partial = builder.change(complete, { type: 'remove', slotId: complete.picks[0]!.slotId });
  await preload(page, partial);
  await page.goto('#/team-builder');
  await expect(page.getByTestId('match-strength')).toHaveText('–');
  await expect(page.getByTestId('baseTeamStrength')).toHaveText('–');
  await expect(
    page.getByText('Wird berechnet, sobald alle elf Positionen besetzt sind.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Aufstellung speichern', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), keys.currentTeam)).toBeNull();
});

test('strength components update live and only the selected Natural Captain adds two points', async ({
  page,
}) => {
  const draft = completeDraft();
  await preload(page, draft);
  await page.goto('#/team-builder');
  const initial = model.analyze(strengthInput(draft, builder)).strength;
  await expect(page.getByTestId('match-strength')).toHaveText(
    formatStrength(initial.matchStrength),
  );
  await expect(page.getByTestId('captainBonus')).toHaveText('+2,00');
  await page.getByText('Berechnung und Positionspassung ansehen', { exact: true }).click();
  await expect(
    page
      .getByRole('table', { name: 'Spielerratings und Positionspassung der aktuellen Elf' })
      .locator('tbody tr'),
  ).toHaveCount(11);
  const other = builder.lineup(draft).find((pick) => !pick.player.naturalCaptain)!.player;
  await page.getByRole('combobox', { name: 'Captain wählen' }).selectOption(other.personId);
  await expect(page.getByTestId('captainBonus')).toHaveText('+0,00');
  await expect(page.getByTestId('match-strength')).toHaveText(
    formatStrength(initial.matchStrength - 2),
  );
  await page.getByRole('combobox', { name: 'Deine Taktik' }).selectOption('possession');
  const expected = model.analyze(strengthInput(await readDraft(page), builder)).strength;
  for (const key of ['chemistryBonus', 'tacticalBonus', 'coachBonus', 'captainBonus'] as const)
    await expect(page.getByTestId(key)).toHaveText(`+${formatStrength(expected[key])}`);
  await expect(page.getByTestId('baseTeamStrength')).toHaveText(
    formatStrength(initial.baseTeamStrength),
  );
  await expect(page.getByTestId('match-strength')).toHaveText(
    formatStrength(expected.matchStrength),
  );
});

test('saving freezes player values and derived strength; editing the draft cannot rewrite the snapshot', async ({
  page,
}) => {
  const draft = completeDraft();
  await preload(page, draft);
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Aufstellung speichern', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'Spielerwerte und berechnete Matchstärke sind gesichert.',
  );
  const saved = await readTeam(page);
  expect(saved.lineup).toHaveLength(11);
  expect(saved.rulesVersion).toBe(data.rules.strength.modelVersion);
  expect(saved.strength.captainBonus).toBe(2);
  const other = builder.lineup(draft).find((pick) => !pick.player.naturalCaptain)!.player;
  await page.getByRole('combobox', { name: 'Captain wählen' }).selectOption(other.personId);
  expect(await readTeam(page)).toEqual(saved);
  await expect(page.getByText(/Deine zuletzt gespeicherte Elf bleibt erhalten/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('match-strength')).toHaveText(
    formatStrength(saved.strength.matchStrength - 2),
  );
  expect(await readTeam(page)).toEqual(saved);
  await page.goto('#/');
  await expect(page.getByTestId('saved-match-strength')).toHaveText(
    formatStrength(saved.strength.matchStrength),
  );
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Aufstellung speichern', exact: true }).click();
  const updated = await readTeam(page);
  expect(updated.captainPersonId).toBe(other.personId);
  expect(updated.strength.matchStrength).toBe(saved.strength.matchStrength - 2);
  expect(updated.lineup).toEqual(saved.lineup);
  await page.getByRole('button', { name: 'Neuer Draft' }).click();
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  expect((await readDraft(page)).picks).toHaveLength(0);
  expect(await readTeam(page)).toEqual(updated);
});

test('team storage failure is reported while draft autosave and the complete lineup keep working', async ({
  page,
}) => {
  const draft = completeDraft();
  await preload(page, draft);
  await page.addInitScript((teamKey) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === teamKey) throw new DOMException('Quota', 'QuotaExceededError');
      original.call(this, key, value);
    };
  }, keys.currentTeam);
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Aufstellung speichern', exact: true }).click();
  await expect(
    page.getByText('Dein Team konnte nicht dauerhaft im Browser gespeichert werden.', {
      exact: false,
    }),
  ).toBeVisible();
  expect((await readDraft(page)).picks).toHaveLength(11);
  expect(await page.evaluate((key) => localStorage.getItem(key), keys.currentTeam)).toBeNull();
  await page.reload();
  await expect(page.locator('.pitch-slot--filled')).toHaveCount(11);
  await expect(page.getByTestId('match-strength')).not.toHaveText('–');
});

test('the expanded strength details work by keyboard, pass accessibility checks and fit mobile', async ({
  page,
}) => {
  await preload(page, completeDraft());
  await page.goto('#/team-builder');
  const summary = page.getByText('Berechnung und Positionspassung ansehen', { exact: true });
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('table', { name: 'Spielerratings und Positionspassung der aktuellen Elf' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
});
