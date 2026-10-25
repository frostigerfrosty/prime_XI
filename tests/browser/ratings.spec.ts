import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('season ratings expose five judgments and historical gates without overrunning small screens', async ({
  page,
}) => {
  await page.goto('#/teams/barcelona-2024-2025');
  const yamal = page.locator('.roster-table tbody tr').filter({ hasText: 'Lamine Yamal' });
  await expect(yamal.locator('.roster-rating')).toHaveText('92');
  await yamal.getByText('Bewertung erklären', { exact: true }).click();
  await expect(yamal).toContainText('kein Aufschlag für Alter');
  await expect(yamal.locator('.rating-explanation dl > div')).toHaveCount(5);
  await expect(yamal).toContainText('Positionsleistung (35 %)');
  await expect(yamal).toContainText('Historischer Vergleich (10 %)');
  await expect(yamal.locator('.rating-explanation a')).toHaveAttribute('href', /wikipedia/);
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
  await page.goto('#/teams/barcelona-2010-2011');
  const messi = page.locator('.roster-table tbody tr').filter({ hasText: 'Lionel Messi' });
  await expect(messi.locator('.roster-rating')).toHaveText('98');
  await messi.getByText('Bewertung erklären', { exact: true }).click();
  await expect(messi).toContainText('Historische Ausnahmesaison');
  await expect(messi).toContainText('Einzelbewertung mit historischem Referenzvergleich.');
});
