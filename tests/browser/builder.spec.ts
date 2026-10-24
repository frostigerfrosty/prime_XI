import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getDatabase, getDatasetVersion } from '../../src/data/index.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import type { DraftState } from '../../src/types/application.ts';

const data = getDatabase();
const engine = createBuilder({
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((tactic) => tactic.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
});
const key = data.rules.storage.keys.currentDraft;
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
const read = (page: Page): Promise<DraftState> =>
  page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).draft, key);
async function pick(page: Page, selection: DraftState['picks'][number]) {
  const draft = await read(page);
  const player = engine.player(selection.playerCardId)!;
  await page.getByRole('combobox', { name: 'Position wählen' }).selectOption(selection.slotId);
  if (draft.mode !== 'sequential')
    await page
      .getByRole('combobox', { name: 'Prime-Team', exact: true })
      .selectOption(player.primeTeamId);
  await page.getByRole('button', { name: `Wählen: ${player.name}`, exact: true }).click();
  if (draft.mode === 'sequential')
    await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
}
function nextPick(draft: DraftState) {
  return engine
    .completion(draft)!
    .find((p) => engine.player(p.playerCardId)!.primeTeamId === engine.currentTeam(draft)!.id)!;
}
function completeFixture() {
  let draft = engine.newPoolDraft('browser-complete', '4-3-3', '2020-01-01T00:00:00.000Z');
  for (const selection of engine.completion(draft)!)
    draft = engine.change(draft, {
      type: 'player',
      slotId: selection.slotId,
      cardId: selection.playerCardId,
    });
  draft = engine.change(draft, {
    type: 'coach',
    cardId: engine.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id,
  });
  return engine.change(draft, {
    type: 'captain',
    personId: engine.lineup(draft)[0]!.player.personId,
  });
}
async function preload(page: Page, draft: DraftState) {
  await page.addInitScript(
    ({ storageKey, envelope }) => {
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    },
    { storageKey: key, envelope: { schemaVersion: 1, datasetVersion: getDatasetVersion(), draft } },
  );
}

test('only one team is revealed; confirmation locks the pick and the exact round survives reload and navigation', async ({
  page,
}) => {
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  await expect(page.locator('.drawn-team')).toHaveCount(0);
  await expect(page.getByText('Team 1 von 11', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Prime-Team', exact: true })).toHaveCount(0);
  const draft = await read(page);
  expect(draft.drawnPrimeTeamIds).toHaveLength(1);
  const first = nextPick(draft);
  const player = engine.player(first.playerCardId)!;
  await page.getByRole('combobox', { name: 'Position wählen' }).selectOption(first.slotId);
  await page.getByRole('button', { name: `Wählen: ${player.name}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Dieser Pick kann nicht geändert oder entfernt werden',
  );
  expect(await read(page)).toEqual(draft);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await read(page)).toEqual(draft);
  await pick(page, first);
  await expect(page.getByText('Team 2 von 11', { exact: true })).toBeVisible();
  await expect(page.locator('.drawn-team')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Formation', exact: true })).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Coach wählen' })
    .selectOption(engine.team(engine.player(first.playerCardId)!.primeTeamId)!.coach!.id);
  await page.getByRole('combobox', { name: 'Deine Taktik' }).selectOption('counter-attack');
  const saved = await read(page);
  await page.reload();
  await expect(page.locator('.pitch-slot--filled')).toHaveCount(1);
  expect(await read(page)).toEqual(saved);
  await page.goto('#/');
  await expect(page.getByText('Dein Draft läuft')).toBeVisible();
  await expect(page.getByText('1 / 11 Spieler · Coach gewählt · 4-3-3')).toBeVisible();
  await page.goto('#/team-builder');
  await expect(page.locator('.pitch-slot--filled')).toBeDisabled();
  await expect(page.getByRole('button', { name: `${player.name} entfernen` })).toHaveCount(0);
  expect((await read(page)).picks).toHaveLength(1);
  expect((await read(page)).coachCardId).toBe(saved.coachCardId);
});

test('eleven players, coach and captain can be selected and saved entirely through the UI', async ({
  page,
}) => {
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  let draft = await read(page);
  const first = nextPick(draft);
  await expect(
    page.getByRole('button', { name: 'Aufstellung speichern', exact: true }),
  ).toBeDisabled();
  while (draft.picks.length < 11) {
    await pick(page, nextPick(draft));
    draft = await read(page);
    expect(new Set(draft.drawnPrimeTeamIds).size).toBe(draft.drawnPrimeTeamIds.length);
  }
  await expect(page.getByRole('heading', { name: 'Elf Picks bestätigt.' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Spielerkarten' })).toHaveCount(0);
  expect(draft.drawnPrimeTeamIds).toHaveLength(11);
  await expect(
    page.getByRole('button', { name: 'Aufstellung speichern', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Coach wählen' })
    .selectOption(engine.team(engine.player(first.playerCardId)!.primeTeamId)!.coach!.id);
  await page
    .getByRole('combobox', { name: 'Captain wählen' })
    .selectOption(engine.player(first.playerCardId)!.personId);
  await expect(page.getByRole('heading', { name: 'Deine Elf steht.' })).toBeVisible();
  await page.getByRole('button', { name: 'Aufstellung speichern', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Aufstellung gespeichert.');
  const saved = await read(page);
  const selected = saved.picks.map((selection) => engine.player(selection.playerCardId)!);
  expect(new Set(selected.map((player) => player.personId)).size).toBe(11);
  expect(new Set(selected.map((player) => player.primeTeamId)).size).toBe(11);
  await page.reload();
  await expect(page.locator('.pitch-slot--filled')).toHaveCount(11);
  expect(await read(page)).toEqual(saved);
  await expect(
    page.getByRole('button', { name: 'Team speichern & Turnier starten' }),
  ).toBeEnabled();
  await page.goto('#/tournament');
  await expect(page.getByRole('heading', { name: 'Die große Bühne wartet.' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('redraw asks for confirmation, cancellation preserves picks and confirmation replaces them', async ({
  page,
}) => {
  const draft = completeFixture();
  await preload(page, draft);
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Neuer Draft' }).click();
  await expect(page.getByRole('dialog')).toContainText('Einen neuen Draft starten?');
  await page.keyboard.press('Escape');
  expect(await read(page)).toEqual(draft);
  await page.getByRole('button', { name: 'Neuer Draft' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  expect(await read(page)).toEqual(draft);
  await page.getByRole('button', { name: 'Neuer Draft' }).click();
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  const next = await read(page);
  expect(next.id).not.toBe(draft.id);
  expect(next.picks).toHaveLength(0);
  expect(next.coachCardId).toBeNull();
  expect(next.captainPersonId).toBeNull();
  await expect(page.locator('.drawn-team')).toHaveCount(0);
  expect(next.mode).toBe('sequential');
  expect(next.drawnPrimeTeamIds).toHaveLength(1);
});

test('formation changes warn before removing picks and preserve the original if cancelled', async ({
  page,
}) => {
  const draft = completeFixture();
  const target = data.formations.find((formation) => {
    try {
      return (
        engine.change(draft, { type: 'formation', formationId: formation.id }).picks.length < 11
      );
    } catch {
      return false;
    }
  });
  expect(target).toBeTruthy();
  await preload(page, draft);
  await page.goto('#/team-builder');
  await page.getByRole('combobox', { name: 'Formation', exact: true }).selectOption(target!.id);
  await expect(page.getByRole('dialog')).toContainText('Formation wirklich ändern?');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  expect(await read(page)).toEqual(draft);
  await page.getByRole('combobox', { name: 'Formation', exact: true }).selectOption(target!.id);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  expect((await read(page)).formationId).toBe(target!.id);
  expect((await read(page)).picks.length).toBeLessThan(11);
  await expect(
    page.getByRole('button', { name: 'Aufstellung speichern', exact: true }),
  ).toBeDisabled();
});

test('corrupt storage and denied writes produce useful warnings while the session remains playable', async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, '{broken');
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  }, key);
  await page.goto('#/team-builder');
  await expect(page.getByRole('alert')).toContainText('nicht aus dem Browserspeicher gelesen');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('nur für diese Sitzung');
  await expect(page.locator('.drawn-team')).toHaveCount(0);
  await page.locator('button.pick-button:not(:disabled)').first().click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.locator('.pitch-slot--filled')).toHaveCount(1);
});

test('sequential picks are accessible by keyboard and keep future teams out of the DOM and coach options', async ({
  page,
}) => {
  await page.goto('#/team-builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  const draft = await read(page);
  const revealed = engine.currentTeam(draft)!;
  const hidden = data.teams.filter((t) => t.id !== revealed.id);
  await expect(page.getByRole('combobox', { name: 'Coach wählen' }).locator('option')).toHaveCount(
    2,
  );
  for (const team of hidden) {
    await expect(
      page.getByRole('option', { name: `${team.clubName} ${team.season}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: `${team.clubName} ${team.season}`, exact: true }),
    ).toHaveCount(0);
  }
  const selection = nextPick(draft);
  await page.getByRole('combobox', { name: 'Position wählen' }).selectOption(selection.slotId);
  const choose = page.getByRole('button', {
    name: `Wählen: ${engine.player(selection.playerCardId)!.name}`,
    exact: true,
  });
  await choose.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  expect(await read(page)).toEqual(draft);
  await choose.focus();
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('button', { name: 'Bestätigen', exact: true });
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', {
      name: `${engine.currentTeam(await read(page))!.clubName} ${engine.currentTeam(await read(page))!.season}`,
      exact: true,
    }),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('active and complete drafts are accessible and fit mobile and tablet widths', async ({
  page,
}) => {
  await preload(page, completeFixture());
  await page.goto('#/team-builder');
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  const cards = page.getByRole('list', { name: 'Spielerkarten' });
  await cards.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => cards.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Neuer Draft' }).click();
  const modal = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(modal.violations).toEqual([]);
});
