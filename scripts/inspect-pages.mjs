import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

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
  const token = process.env['GH_TOKEN'];
  const response = await fetch(`https://api.github.com/repos/${repository}/pages`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  result.pages = {
    httpStatus: response.status,
    available: response.ok,
    url: body.html_url ?? null,
    buildType: body.build_type ?? null,
    status: body.status ?? null,
    message: response.ok ? null : (body.message ?? 'Request failed'),
  };
} catch (error) {
  result.pages = {
    available: false,
    error: error instanceof Error ? error.message : 'Request failed',
  };
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
