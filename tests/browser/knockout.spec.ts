import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  tournamentFixture,
  championTestTeam,
  playoffShootoutFixture,
} from '../helpers/tournament.ts';
import type { SavedTeam, TournamentState } from '../../src/types/application.ts';
import { roundLabels } from '../../src/utils/tournament-display.ts';

const f = tournamentFixture(),
  keys = f.data.rules.storage.keys;
const league = f.engine.finishLeague(f.engine.start(f.team, 'knockout-0', f.now));
const drawn = f.engine.drawNextRound(league);
const firstLeg = f.engine.nextKnockoutLeg(drawn, f.now);
const playoffs = f.engine.nextKnockoutLeg(firstLeg, f.now);
const complete = f.engine.finishTournament(league, f.now);
const shootout = playoffShootoutFixture(f);
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

async function preload(page: Page, state: TournamentState, team: SavedTeam = f.team) {
  await page.addInitScript(
    ({ keys, state, team }) => {
      if (!localStorage.getItem(keys.currentTeam))
        localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
      if (!localStorage.getItem(keys.currentTournament))
        localStorage.setItem(
          keys.currentTournament,
          JSON.stringify({ schemaVersion: 1, tournament: state }),
        );
    },
    { keys, state, team },
  );
}
const read = (page: Page): Promise<TournamentState> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).tournament, keys.currentTournament);

test('a Phase-6 save resumes unchanged and upgrades when the first playoff draw is requested', async ({
  page,
}) => {
  const legacy = f.engine.nextMatchday(f.engine.start(f.team, 'knockout-0', f.now));
  legacy.rulesVersion = '1.3.0';
  delete legacy.knockoutVersion;
  await preload(page, legacy);
  await page.goto('#/tournament');
  await expect(
    page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }),
  ).toBeVisible();
  expect(await read(page)).toEqual(legacy);
  await page.getByRole('button', { name: 'Restliche Ligaphase simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Playoffs auslosen', exact: true })).toBeVisible();
  const before = await read(page);
  expect(before.rulesVersion).toBe('1.3.0');
  expect(before.knockoutVersion).toBeUndefined();
  await page.getByRole('button', { name: 'Playoffs auslosen', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Playoffs: Hinspiele simulieren', exact: true }),
  ).toBeVisible();
  const after = await read(page);
  expect(after.rulesVersion).toBe('1.4.0');
  expect(after.knockoutVersion).toBe('1.0.0');
  expect(after.matches.slice(0, 144)).toEqual(before.matches);
  expect(after.participants).toEqual(before.participants);
  expect(after.standings).toEqual(before.standings);
  await expect(page.getByTestId('knockout-user-status')).toContainText('überspringst die Playoffs');
  expect(after.knockoutTies.some((tie) => tie.teamAId === 'user' || tie.teamBId === 'user')).toBe(
    false,
  );
});

test('every draw and leg can be played through the UI, with a real neutral final and an unchanged league table', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await preload(page, league);
  await page.goto('#/tournament');
  for (const round of [
    'playoffs',
    'round-of-16',
    'quarter-finals',
    'semi-finals',
    'final',
  ] as const) {
    await page.getByRole('button', { name: `${roundLabels[round]} auslosen`, exact: true }).click();
    if (round === 'final')
      await page.getByRole('button', { name: 'Finale simulieren', exact: true }).click();
    else {
      await page
        .getByRole('button', { name: `${roundLabels[round]}: Hinspiele simulieren`, exact: true })
        .click();
      const half = await read(page);
      expect(
        half.knockoutTies
          .filter((tie) => tie.round === round)
          .every((tie) => tie.winnerParticipantId === null),
      ).toBe(true);
      await page.reload();
      await page
        .getByRole('button', { name: `${roundLabels[round]}: Rückspiele simulieren`, exact: true })
        .click();
    }
  }
  await expect(page.getByTestId('tournament-champion')).toBeVisible();
  const state = await read(page);
  expect(state.phase).toBe('completed');
  expect(state.matches).toHaveLength(189);
  expect(state.knockoutTies).toHaveLength(23);
  expect(state.championParticipantId).toBe(complete.championParticipantId);
  expect(state.knockoutTies).toEqual(complete.knockoutTies);
  expect(state.standings).toEqual(league.standings);
  expect(f.engine.isValid(state)).toBe(true);
  expect(
    state.matches.filter((m) => m.phase === 'final').every((m) => m.neutralVenue && m.leg === null),
  ).toBe(true);
  await page.getByText('Ligatabelle und Spielplan ansehen', { exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Ligatabelle', exact: true }).locator('tbody tr'),
  ).toHaveCount(36);
  await expect(page.getByText('36 Teams · 144 / 144 Spiele', { exact: false })).toBeVisible();
  await expect(page.locator('.own-league-fixtures > li')).toHaveCount(8);
  const archive = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    keys.completedTournaments,
  );
  expect(archive.entries).toHaveLength(1);
  expect(archive.entries[0].tournamentId).toBe(state.id);
});

test('extra time displays the cumulative leg score and the shootout remains separate from aggregate goals', async ({
  page,
}) => {
  await preload(page, shootout.state);
  await page.goto('#/tournament');
  const tie = shootout.tie;
  const last = shootout.state.matches.find((m) => m.id === tie.matchIds.at(-1))!;
  if (last.status !== 'played') throw new Error('Missing fixture');
  expect(last.result.penalties).not.toBeNull();
  const card = page.getByTestId(`tie-${tie.id}`);
  await expect(card.locator('.knockout-team-row > strong').nth(0)).toHaveText(
    String(tie.aggregateGoals.teamA),
  );
  await expect(card.locator('.knockout-team-row > strong').nth(1)).toHaveText(
    String(tie.aggregateGoals.teamB),
  );
  await expect(card.locator('.knockout-penalty-score')).toContainText(
    `Elfmeterschießen ${last.result.penalties!.home} : ${last.result.penalties!.away}`,
  );
  const details = card.getByText('Hin- und Rückspiel ansehen', { exact: true });
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(
    card.getByText(
      `Nach 90 Minuten ${last.result.regularTime.home} : ${last.result.regularTime.away}`,
      { exact: false },
    ),
  ).toBeVisible();
  const cumulative = last.result.afterExtraTime!;
  await expect(card.locator('.league-match-score').last()).toContainText(
    `${cumulative.home} : ${cumulative.away}`,
  );
  await card.getByText('Elfmeterschießen ansehen', { exact: true }).click();
  await expect(card.locator('.match-penalties li')).toHaveCount(last.result.shootoutKicks.length);
  const before = await read(page);
  await page.reload();
  expect(await read(page)).toEqual(before);
});

test('bulk completion asks first, shows a real user champion and preserves the completed tournament after reload', async ({
  page,
}) => {
  const team = championTestTeam(f);
  const state = f.engine.finishLeague(f.engine.start(team, 'user-champion-1', f.now));
  await preload(page, state, team);
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(await read(page)).toEqual(state);
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByTestId('tournament-champion')).toContainText(team.name);
  await expect(page.getByTestId('knockout-user-status')).toHaveText('Du bist Turniersieger!');
  const final = await read(page);
  expect(final.championParticipantId).toBe('user');
  expect(f.engine.isValid(final)).toBe(true);
  await page.reload();
  await expect(page.getByTestId('tournament-champion')).toContainText(team.name);
  expect(await read(page)).toEqual(final);
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: 'Turnier beendet', exact: true })).toBeVisible();
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await expect(page.getByTestId('history-entry')).toContainText('Turniersieger');
  await page.getByRole('link', { name: 'Turnier ansehen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deine damalige Elf' })).toBeVisible();
  expect(await read(page)).toEqual(final);
  const archive = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    keys.completedTournaments,
  );
  expect(archive.entries).toHaveLength(1);
  expect(archive.entries[0].tournamentId).toBe(final.id);
});

test('an eliminated user can follow the remaining tournament without re-entering it', async ({
  page,
}) => {
  const state = f.engine.finishLeague(f.engine.start(f.team, 'knockout-1', f.now));
  await preload(page, state);
  await page.goto('#/tournament');
  await expect(page.getByTestId('knockout-user-status')).toHaveText(
    'Nach der Ligaphase ausgeschieden',
  );
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByTestId('tournament-champion')).toBeVisible();
  const final = await read(page);
  expect(final.knockoutTies.some((tie) => tie.teamAId === 'user' || tie.teamBId === 'user')).toBe(
    false,
  );
  expect(final.championParticipantId).not.toBe('user');
  await expect(page.getByTestId('knockout-user-status')).toHaveText(
    'Nach der Ligaphase ausgeschieden',
  );
});

test('a corrupt aggregate is preserved and does not replace a valid saved XI', async ({ page }) => {
  const corrupt = structuredClone(playoffs);
  corrupt.knockoutTies[0]!.aggregateGoals.teamA++;
  await preload(page, corrupt);
  await page.goto('#/tournament');
  await expect(page.getByRole('alert')).toContainText('beschädigt');
  await expect(page.getByRole('button', { name: 'Turnier starten', exact: true })).toBeVisible();
  expect(await read(page)).toEqual(corrupt);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).team, keys.currentTeam),
  ).toEqual(f.team);
});

test('failed knockout writes keep the session usable and reload the last saved first leg', async ({
  page,
}) => {
  await page.addInitScript(
    ({ keys, team, state }) => {
      localStorage.setItem(keys.currentTeam, JSON.stringify({ schemaVersion: 1, team }));
      if (!localStorage.getItem(keys.currentTournament))
        localStorage.setItem(
          keys.currentTournament,
          JSON.stringify({ schemaVersion: 1, tournament: state }),
        );
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === keys.currentTournament) throw new DOMException('Quota', 'QuotaExceededError');
        original.call(this, key, value);
      };
    },
    { keys, team: f.team, state: firstLeg },
  );
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Playoffs: Rückspiele simulieren', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Achtelfinale auslosen', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('nicht dauerhaft');
  expect(await read(page)).toEqual(firstLeg);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Playoffs: Rückspiele simulieren', exact: true }),
  ).toBeVisible();
});

test('round navigation, match details and the finish dialog are accessible and fit mobile screens', async ({
  page,
}) => {
  await preload(page, shootout.state);
  await page.goto('#/tournament');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.knockout-round-navigation button').nth(1)).toBeDisabled();
  const card = page.getByTestId(`tie-${shootout.tie.id}`);
  await card.getByText('Hin- und Rückspiel ansehen', { exact: true }).click();
  await card.getByText('Elfmeterschießen ansehen', { exact: true }).click();
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
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }),
  ).toBeFocused();
});
