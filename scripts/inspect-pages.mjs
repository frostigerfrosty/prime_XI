import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inspectPages } from './pages-api.mjs';

const repository = process.env['GITHUB_REPOSITORY'] ?? 'frostigerfrosty/prime_XI';
if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.test(repository)) throw new Error('Invalid repository.');
const output = process.argv[2];
if (!output) throw new Error('An output path is required.');
const result = {
  repository,
  commit: process.env['GITHUB_SHA'] ?? null,
  checkedAt: new Date().toISOString(),
};
try {
  Object.assign(
    result,
    await inspectPages({
      repository,
      token: process.env['GH_TOKEN'],
      enable: process.argv.includes('--enable'),
    }),
  );
} catch (error) {
  result.pages = {
    available: false,
    error: error instanceof Error ? error.message : 'Request failed',
  };
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (
  process.argv.includes('--enable') &&
  (!result.pages.available || result.pages.buildType !== 'workflow')
)
  process.exitCode = 1;
