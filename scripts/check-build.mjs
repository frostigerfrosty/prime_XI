import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const directory = resolve(process.argv[2] ?? 'dist');
const configuredBase = process.env['VITE_BASE_PATH'] ?? '/prime_XI/';
const base =
  configuredBase === ''
    ? './'
    : configuredBase.endsWith('/')
      ? configuredBase
      : `${configuredBase}/`;
const manifest = JSON.parse(await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'));
function filePath(file) {
  const path = resolve(directory, file);
  const inside = relative(directory, path);
  assert.ok(
    inside !== '' && inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside),
    `Invalid output path: ${file}`,
  );
  return path;
}
const entry = Object.values(manifest).find((item) => item.isEntry && item.file.endsWith('.js'));
assert.ok(entry, 'The application entry is missing from the build manifest.');
const initial = new Set();
function visit(item) {
  if (initial.has(item.file)) return;
  initial.add(item.file);
  for (const imported of item.imports ?? []) {
    assert.ok(manifest[imported], `Missing imported chunk: ${imported}`);
    visit(manifest[imported]);
  }
}
visit(entry);
let total = 0,
  compressed = 0;
for (const file of initial) {
  const content = await readFile(filePath(file));
  total += content.length;
  compressed += gzipSync(content).length;
}
assert.ok(total <= 300 * 1024, `Initial JavaScript exceeds 300 KiB: ${total} bytes.`);
assert.ok(compressed <= 90 * 1024, `Initial JavaScript exceeds 90 KiB gzip: ${compressed} bytes.`);
for (const item of Object.values(manifest).filter((item) => item.file.endsWith('.js')))
  assert.ok(
    (await stat(filePath(item.file))).size <= 400 * 1024,
    `JavaScript chunk exceeds 400 KiB: ${item.file}`,
  );
const catalog = Object.values(manifest).find((item) => item.src === 'src/data/database.json');
assert.ok(catalog?.file.endsWith('.json'), 'The catalog must be emitted as a separate JSON asset.');
const expected = JSON.parse(
  await readFile(new URL('../src/data/database.json', import.meta.url), 'utf8'),
);
assert.deepEqual(
  JSON.parse(await readFile(filePath(catalog.file), 'utf8')),
  expected,
  'The emitted catalog differs from the checked-in snapshot.',
);
const html = await readFile(resolve(directory, 'index.html'), 'utf8');
assert.ok(
  html.includes('Dein Spielfeld wird vorbereitet.'),
  'The initial HTML must show the loading screen before JavaScript starts.',
);
assert.ok(html.includes('JavaScript aktivieren'), 'The no-JavaScript message is missing.');
const policy = html
  .match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]
  ?.replaceAll('&#39;', "'");
assert.ok(policy, 'The production Content Security Policy is missing.');
for (const directive of [
  "default-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
])
  assert.ok(
    policy
      .split(';')
      .map((part) => part.trim())
      .includes(directive),
    `Missing CSP directive: ${directive}`,
  );
assert.ok(!policy.includes("'unsafe-eval'"), 'Dynamic code execution must remain blocked.');
assert.ok(!/<style[\s>]/i.test(html), 'Inline style blocks are forbidden.');
assert.ok(
  !/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html),
  'Inline scripts are forbidden.',
);
assert.ok(html.includes('name="referrer" content="no-referrer"'), 'Referrer policy is missing.');
assert.match(
  html,
  /<noscript>\s*<link[^>]+no-script\.css[^>]*>\s*<\/noscript>/,
  'No-script CSS must remain conditional.',
);
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith(base), `Asset URL does not use base ${base}: ${url}`);
  const file = url.slice(base.length);
  assert.ok((await stat(filePath(file))).isFile(), `Missing HTML asset: ${file}`);
}
assert.ok(
  (await stat(resolve(directory, '.nojekyll'))).isFile(),
  'The static hosting marker is missing.',
);
console.log(
  `Static build verified (${base}): initial JavaScript ${(total / 1024).toFixed(1)} KiB, ${(compressed / 1024).toFixed(1)} KiB gzip; separate catalog and all HTML assets present.`,
);
