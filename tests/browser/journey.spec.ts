import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { getDatabase } from '../../src/data/index.ts';
import { createBuilder } from '../../src/engine/builder.ts';
import { createStrengthModel } from '../../src/engine/strength.ts';
import { createTournamentEngine } from '../../src/engine/tournament.ts';
import { parseBackup } from '../../src/engine/backup.ts';
import type { DraftState } from '../../src/types/application.ts';

const data = getDatabase();
const builder = createBuilder({
  teams: data.teams,
  formations: data.formations,
  tacticIds: data.tactics.map((t) => t.id),
  rules: data.rules.builder,
  defaultTactic: data.defaults.defaultTactic,
});
const model = createStrengthModel(data);
const tournament = createTournamentEngine({
  teams: data.teams,
  rules: data.rules,
  strengthModel: model,
  datasetVersion: data.datasetVersion,
  defaultTactic: data.defaults.defaultTactic,
});
const services = { builder, model, tournament };

async function navigate(page: Page, name: string) {
  await expect(page.locator('.app-shell')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Menü öffnen' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name, exact: true }).filter({ visible: true }).click();
}

test('a new player can draft, finish a tournament, inspect its archive and restore its downloaded backup in a fresh browser', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const observe = (target: Page) => {
    target.on('pageerror', (error) => errors.push(error.message));
    target.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
  };
  observe(page);
  await page.goto('');
  await expect(page.getByText('Noch kein Team zusammengestellt')).toBeVisible();
  await navigate(page, 'Team Builder');
  await page.getByRole('button', { name: 'Draft starten', exact: true }).click();
  let draft: DraftState = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).draft,
    data.rules.storage.keys.currentDraft,
  );
  while (draft.picks.length < 11) {
    const pick = builder
      .completion(draft)!
      .find((p) => builder.player(p.playerCardId)!.primeTeamId === builder.currentTeam(draft)!.id)!;
    const player = builder.player(pick.playerCardId)!;
    await page
      .getByRole('combobox', { name: 'Position wählen', exact: true })
      .selectOption(pick.slotId);
    await page.getByRole('button', { name: `Wählen: ${player.name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
    draft = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).draft,
      data.rules.storage.keys.currentDraft,
    );
  }
  await page
    .getByRole('combobox', { name: 'Coach wählen', exact: true })
    .selectOption(builder.team(draft.drawnPrimeTeamIds[0]!)!.coach!.id);
  await page
    .getByRole('combobox', { name: 'Captain wählen', exact: true })
    .selectOption(builder.player(draft.picks[0]!.playerCardId)!.personId);
  await page.getByRole('button', { name: 'Team speichern & Turnier starten', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dein Turnier');
  await page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restliche Ligaphase simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await page.getByRole('button', { name: 'Bis zum Finale simulieren', exact: true }).click();
  await page.getByRole('button', { name: 'Bestätigen', exact: true }).click();
  await expect(page.getByTestId('tournament-champion')).toBeVisible();
  await page.getByRole('link', { name: 'Zum Turnierarchiv', exact: true }).click();
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByRole('link', { name: 'Turnier ansehen', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Deine damalige Elf', exact: true }),
  ).toBeVisible();
  const archivedGames = await page
    .getByRole('table', { name: 'Deine archivierten Spiele', exact: true })
    .locator('tbody tr')
    .count();
  expect(archivedGames).toBeGreaterThanOrEqual(8);
  expect(archivedGames).toBeLessThanOrEqual(17);
  await navigate(page, 'Einstellungen');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung herunterladen', exact: true }).click();
  const file = await downloaded;
  const raw = await readFile((await file.path())!, 'utf8');
  const backup = parseBackup(raw, services);
  expect(backup.state.currentDraft!.picks).toHaveLength(11);
  expect(backup.state.currentTournament!.phase).toBe('completed');
  expect(backup.state.completedTournaments).toHaveLength(1);
  expect(backup.state.completedTournaments[0]!.matches).toHaveLength(archivedGames);
  expect(backup.state.completedTournaments[0]!.tournamentId).toBe(
    backup.state.currentTournament!.id,
  );
  const fresh = await browser.newContext({ viewport: page.viewportSize()! });
  try {
    const restored = await fresh.newPage();
    observe(restored);
    await restored.goto(new URL('#/settings', page.url()).href);
    await restored.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
      name: file.suggestedFilename(),
      mimeType: 'application/json',
      buffer: Buffer.from(raw),
    });
    await expect(restored.getByRole('region', { name: 'Sicherungsvorschau' })).toContainText(
      'Abgeschlossen',
    );
    await restored
      .getByRole('button', { name: 'Spielstand wiederherstellen', exact: true })
      .click();
    await restored.getByRole('button', { name: 'Sicherung übernehmen', exact: true }).click();
    await expect(restored.getByRole('status')).toContainText('wurde wiederhergestellt');
    await restored.reload();
    await navigate(restored, 'Historie');
    await expect(restored.getByTestId('history-entry')).toHaveCount(1);
    await navigate(restored, 'Turnier');
    for (const part of backup.state.completedTournaments[0]!.champion.label.split(' · '))
      await expect(restored.getByTestId('tournament-champion')).toContainText(part);
    await navigate(restored, 'Testspiel');
    await expect(restored.getByRole('combobox', { name: 'Heimteam', exact: true })).toHaveValue(
      backup.state.currentTeam!.id,
    );
    await restored.getByRole('button', { name: 'Anpfiff', exact: true }).click();
    await expect(restored.getByTestId('match-score')).not.toContainText('VS');
    expect(errors).toEqual([]);
  } finally {
    await fresh.close();
  }
});
