import { test, expect } from '@playwright/test';
import { legacyCatalogFixture } from '../helpers/legacy-catalog.ts';
import { parseBackup, serializeBackup } from '../../src/engine/backup.ts';
import { snapshotStorageKey } from '../../src/utils/game-storage.ts';
import { equalMatchResults } from '../../src/engine/comparison.ts';
import type { TournamentState } from '../../src/types/application.ts';

const f = legacyCatalogFixture();
const services = { builder: f.builder, model: f.model, tournament: f.engine };
const raw = serializeBackup(
  f.legacy.state,
  { builder: f.legacy.builder, model: f.model, tournament: f.legacy.engine },
  f.now,
);
test('a 0.2.0 backup can be restored after the nationality correction and keeps old frozen match values', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('#/settings');
  await page.getByLabel('Sicherungsdatei auswählen', { exact: true }).setInputFiles({
    name: 'legacy-prime-xi.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByRole('region', { name: 'Sicherungsvorschau' })).toContainText(
    'älteren Drafts',
  );
  await page.getByRole('button', { name: 'Spielstand wiederherstellen', exact: true }).click();
  await page.getByRole('button', { name: 'Sicherung übernehmen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('wurde wiederhergestellt');
  await page.goto('#/team-builder');
  await expect(page.getByRole('alert').filter({ hasText: 'Länderzuordnungen' })).toBeVisible();
  await expect(page.locator('.pitch-slot--filled')).toHaveCount(11);
  await page.goto('#/tournament');
  await page.getByRole('button', { name: 'Spieltag 1 simulieren', exact: true }).click();
  const advanced: TournamentState = await page.evaluate(
    ({ key, master }) =>
      JSON.parse(JSON.parse(localStorage.getItem(master)!).records[key]).tournament,
    { key: f.data.rules.storage.keys.currentTournament, master: snapshotStorageKey },
  );
  const expected = f.legacy.engine.nextMatchday(f.legacy.tournament);
  expect({ ...advanced, matches: [] }).toEqual({ ...expected, matches: [] });
  expect(advanced.matches.map(({ result: _, ...fixture }) => fixture)).toEqual(
    expected.matches.map(({ result: _, ...fixture }) => fixture),
  );
  for (const [index, match] of expected.matches.entries()) {
    const actual = advanced.matches[index]!;
    if (match.status === 'played')
      expect(equalMatchResults(actual.result, match.result)).toBe(true);
    else expect(actual.result).toBeNull();
  }
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Spieltag 2 simulieren', exact: true }),
  ).toBeVisible();
  await page.goto('#/history');
  await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.goto('#/settings');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sicherung herunterladen', exact: true }).click();
  const download = await pending;
  const { readFile } = await import('node:fs/promises');
  const backup = parseBackup(await readFile((await download.path())!, 'utf8'), services);
  expect(backup.state.currentTeam).toEqual(f.legacy.team);
  expect(backup.state.currentTournament).toEqual(advanced);
  expect(backup.state.completedTournaments).toEqual(f.legacy.state.completedTournaments);
  expect(errors).toEqual([]);
});
