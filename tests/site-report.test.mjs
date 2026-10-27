import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { siteReportPath } from '../scripts/site-report.mjs';

test('default site reports use distinct private temporary directories; explicit paths stay intentional', async () => {
  const paths = await Promise.all([siteReportPath(), siteReportPath()]);
  try {
    assert.notEqual(dirname(paths[0]), dirname(paths[1]));
    for (const path of paths) {
      const directory = await stat(dirname(path));
      assert.ok(directory.isDirectory());
      if (process.platform !== 'win32') assert.equal(directory.mode & 0o777, 0o700);
    }
    assert.equal(
      await siteReportPath('review-results/published-site.json'),
      'review-results/published-site.json',
    );
  } finally {
    for (const path of paths) await rm(dirname(path), { recursive: true, force: true });
  }
});
