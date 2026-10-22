import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/data/index.ts';
import { loadCatalog } from '../src/data/load.ts';

test('the browser transport loads the complete checked-in catalog without altering content', async () => {
  const database = getDatabase();
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, '/prime_XI/assets/database-example.json');
    assert.ok(options?.signal instanceof AbortSignal);
    return Response.json(database);
  };
  assert.deepEqual(await loadCatalog('/prime_XI/assets/database-example.json', fetcher), database);
});

test('HTTP failures are rejected instead of being interpreted as an empty playable catalog', async () => {
  for (const status of [404, 503]) {
    await assert.rejects(
      loadCatalog('/catalog.json', async () => new Response('', { status })),
      new RegExp(String(status)),
    );
  }
});

test('HTML fallback pages, malformed JSON, future schemas and incomplete catalog shapes are rejected', async () => {
  const database = getDatabase();
  for (const raw of [
    '<!doctype html><html></html>',
    '{',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...database, schemaVersion: 999 }),
    JSON.stringify({ ...database, teams: null }),
    JSON.stringify({ ...database, rules: [] }),
  ]) {
    await assert.rejects(loadCatalog('/catalog.json', async () => new Response(raw)));
  }
});

test('network errors and timeouts remain startup failures rather than fabricating fallback data', async () => {
  for (const error of [new TypeError('offline'), new DOMException('Timed out', 'TimeoutError')]) {
    await assert.rejects(
      loadCatalog('/catalog.json', async () => {
        throw error;
      }),
      (reason) => reason === error,
    );
  }
});
