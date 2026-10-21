import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { tournamentFixture } from '../helpers/tournament.ts';
import type { SavedTeam, ScheduledMatch, TournamentState } from '../../src/types/application.ts';

const f = tournamentFixture(),
  keys = f.data.rules.storage.keys;
function matchExpectation(match: ScheduledMatch) {
  if (match.status === 'scheduled') return match;
  // V8/Chromium Math.exp may differ by one ULP. Scores, seeds and all table
  // fields still compare exactly; only unrounded xG use numerical tolerance.
  return {
    ...match,
    result: {
      ...match.result,
      expectedGoals: {
        home: expect.closeTo(match.result.expectedGoals.home, 10),
        away: expect.closeTo(match.result.expectedGoals.away, 10),
      },
    },
  };
}
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

async function preload(page: Page, options = { draft: false, team: true }) {
  await page.addInitScript(
    ({ keys, options, team, draft, version }) => {
      if (options.team && !localStorage.getItem(keys.currentTeam))
        localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
      if (options.draft && !localStorage.getItem(keys.currentDraft))
        localStorage.setItem(
          keys.currentDraft,
          JSON.stringify({ schemaVersion: 1, datasetVersion: version, draft }),
        );
    },
    { keys, options, team: f.team, draft: f.draft, version: f.data.datasetVersion },
  );
}
const read = (page: Page): Promise<TournamentState> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).tournament, keys.currentTournament);
const readTeam = (page: Page): Promise<SavedTeam> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).team, keys.currentTeam);
async function begin(page: Page, seed = 'browser-league') {
  await page.goto('#/tournament');
  await page.getByRole('textbox', { name: 'Turniercode', exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Turnier starten', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ligatabelle', exact: true })).toBeVisible();
}

test('the completed Builder saves the actual XI and starts a real 36-team league', async ({
  page,
}) => {
  await preload(page, { draft: true, team: false });
  await page.goto('#/team-builder');
  await expect(
    page.getByRole('button', { name: 'Team speichern & Turnier starten' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Team speichern & Turnier starten' }).click();
  await expect(page).toHaveURL(/#\/tournament$/);
  await expect(
    page.getByRole('table', { name: 'Ligatabelle', exact: true }).locator('tbody tr'),
  ).toHaveCount(36);
  const state = await read(page),
    saved = await readTeam(page);
  expect(state.participants).toHaveLength(36);
  expect(state.matches).toHaveLength(144);
  expect(state.matches.every((m) => m.status === 'scheduled')).toBe(true);
  expect(state.participants.find((p) => p.kind === 'user')!.team).toEqual(saved);
  expect(saved.lineup).toEqual(f.team.lineup);
  expect(
    new Set(state.participants.filter((p) => p.kind === 'prime').map((p) => p.team.id)).size,
  ).toBe(35);
  await expect(page.locator('.own-league-fixtures > li')).toHaveCount(8);
  await expect(page.locator('.own-league-fixtures').getByText(/Heimspiel/)).toHaveCount(4);
  await expect(page.locator('.own-league-fixtures').getByText(/Auswärtsspiel/)).toHaveCount(4);
  await expect(page.getByTestId('user-league-rank')).toHaveText('–');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), keys.completedTournaments),
  ).toBeNull();
});

test('a complete matchday updates all 36 rows, uses the seeded engine and resumes after reload', async ({
  page,
}) => {
  await preload(page);
  await begin(page);
  await page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }).click();
  const expected = f.engine.nextMatchday(f.engine.start(f.team, 'browser-league', f.now));
  await expect(page.getByRole('status')).toContainText('Spieltag 1 simuliert');
  await expect(page.getByRole('region', { name: 'Dein Ligastand', exact: true })).toBeFocused();
  const state = await read(page);
  expect(state.matches).toEqual(expected.matches.map(matchExpectation));
  expect(state.standings).toEqual(expected.standings);
  expect(state.standings.every((row) => row.played === 1)).toBe(true);
  const row = state.standings.find((r) => r.participantId === state.userParticipantId)!;
  await expect(page.getByTestId('user-league-points')).toHaveText(String(row.points));
  await expect(page.getByTestId('user-league-rank')).toHaveText(String(row.rank));
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }),
  ).toBeVisible();
  expect(await read(page)).toEqual(state);
  await page.goto('#/');
  await expect(page.getByText('Dein Turnier läuft', { exact: true })).toBeVisible();
  await expect(
    page.getByText(`1 / 8 Spieltage · ${row.points} Punkte · Platz ${row.rank}`, { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Turnier öffnen', exact: true }).click();
  await page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }).click();
  expect((await read(page)).matches.filter((m) => m.status === 'played')).toHaveLength(36);
});

test('finishing requires confirmation and ends at a final league table without a fabricated champion', async ({
  page,
}) => {
  await preload(page);
  await begin(page);
  const initial = await read(page);
  await page.getByRole('button', { name: 'Restliche Ligaphase simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await read(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Restliche Ligaphase simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ligaphase beendet');
  const final = await read(page),
    expected = f.engine.finishLeague(initial);
  expect(final).toEqual({ ...expected, matches: expected.matches.map(matchExpectation) });
  expect(final.matches.every((m) => m.status === 'played')).toBe(true);
  expect(final.championParticipantId).toBeNull();
  expect(final.completedAt).toBeNull();
  expect(final.knockoutTies).toEqual([]);
  await expect(page.getByRole('button', { name: /Spieltag \d+ simulieren/ })).toHaveCount(0);
  const rank = final.standings.find((r) => r.participantId === 'user')!.rank;
  const qualification = {
    direct: 'Achtelfinale',
    playoff: 'Playoffs',
    eliminated: 'Ausgeschieden',
  }[f.engine.qualification(rank)];
  await expect(page.locator('#qualification-title')).toHaveText(qualification);
  await page.getByRole('combobox', { name: 'Spieltag anzeigen', exact: true }).selectOption('2');
  await expect(page.locator('.all-league-fixtures > li')).toHaveCount(18);
  await expect(
    page.locator('.all-league-fixtures').getByText('90 Min.', { exact: true }),
  ).toHaveCount(18);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), keys.completedTournaments),
  ).toBeNull();
  await page.reload();
  await expect(page.locator('#qualification-title')).toHaveText(qualification);
});

test('draft changes cannot rewrite a running tournament and both restart entry points ask first', async ({
  page,
}) => {
  await preload(page, { draft: true, team: true });
  await begin(page);
  const initial = await read(page);
  await page.goto('#/team-builder');
  const different = f.builder.lineup(f.draft).find((p) => !p.player.naturalCaptain)!.player;
  await page.getByRole('combobox', { name: 'Captain wählen' }).selectOption(different.personId);
  await page.getByRole('button', { name: 'Aufstellung speichern', exact: true }).click();
  const changed = await readTeam(page);
  expect(changed.captainPersonId).toBe(different.personId);
  expect(await read(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Team speichern & Turnier starten' }).click();
  await expect(page.getByRole('dialog')).toContainText('Bisheriges Turnier ersetzen?');
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await read(page)).toEqual(initial);
  expect(await readTeam(page)).toEqual(changed);
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Neues Turnier', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await read(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Neues Turnier', exact: true }).click();
  await page.getByRole('textbox', { name: 'Turniercode', exact: true }).fill('new-league');
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  const next = await read(page);
  expect(next.id).not.toBe(initial.id);
  expect(next.seed).toBe('new-league');
  expect(next.participants.find((p) => p.kind === 'user')!.team).toEqual(changed);
  expect(next.matches.every((m) => m.status === 'scheduled')).toBe(true);
});

test('corrupt saved tournaments are preserved until an explicit new start and do not block the saved XI', async ({
  page,
}) => {
  await preload(page);
  await page.addInitScript((key) => {
    localStorage.setItem(key, '{corrupt');
  }, keys.currentTournament);
  await page.goto('#/tournament');
  await expect(page.getByRole('alert')).toContainText('nicht gelesen');
  expect(await page.evaluate((key) => localStorage.getItem(key), keys.currentTournament)).toBe(
    '{corrupt',
  );
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Turnier starten', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ligatabelle', exact: true })).toBeVisible();
  expect(f.engine.isValid(await read(page))).toBe(true);
});

test('quota failures keep the advanced session but accurately restore the last persisted matchday', async ({
  page,
}) => {
  const initial = f.engine.start(f.team, 'quota-fixture', f.now);
  await page.addInitScript(
    ({ team, tournament, keys }) => {
      localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
      if (!localStorage.getItem(keys.currentTournament))
        localStorage.setItem(
          keys.currentTournament,
          JSON.stringify({ schemaVersion: 1, tournament }),
        );
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === keys.currentTournament) throw new DOMException('Quota', 'QuotaExceededError');
        original.call(this, key, value);
      };
    },
    { team: f.team, tournament: initial, keys },
  );
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'beim Neuladen kann der letzte gespeicherte Stand zurückkehren',
  );
  await expect(
    page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Nur in dieser Sitzung', { exact: true })).toBeVisible();
  expect(await read(page)).toEqual(initial);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }),
  ).toBeVisible();
  expect(await readTeam(page)).toEqual(f.team);
});

test('tables, matchdays and confirmation dialogs pass accessibility checks and remain contained on mobile', async ({
  page,
}) => {
  await preload(page);
  await begin(page);
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }).click();
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
  const table = page.getByRole('region', { name: 'Vollständige Ligatabelle horizontal scrollen' });
  await table.focus();
  await expect(table).toBeFocused();
  await page.getByRole('button', { name: 'Neues Turnier', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Neues Turnier', exact: true })).toBeFocused();
});
