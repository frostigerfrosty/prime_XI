import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPages } from '../scripts/pages-api.mjs';

const repository = 'example/prime-xi';
function service(responses) {
  const calls = [];
  return {
    calls,
    request: async (url, options) => {
      calls.push({ url, ...options });
      assert.equal(url, 'https://api.github.com/repos/example/prime-xi/pages');
      const response = responses.shift();
      assert.ok(response, 'Unexpected API operation');
      return Response.json(response.body, { status: response.status });
    },
  };
}
const ready = {
  status: 200,
  body: { build_type: 'workflow', html_url: 'https://example.github.io/prime-xi/' },
};
test('an existing workflow site is read without changing it', async () => {
  const api = service([ready]);
  const result = await inspectPages({ repository, enable: true, request: api.request });
  assert.equal(result.pages.available, true);
  assert.equal(result.enablement, null);
  assert.equal(api.calls.length, 1);
});
test('a missing site is enabled only after the explicit enable flag with a token', async () => {
  const missing = { status: 404, body: { message: 'Not Found' } };
  const api = service([missing, { status: 201, body: {} }, ready]);
  const result = await inspectPages({
    repository,
    token: 'test-token',
    enable: true,
    request: api.request,
  });
  assert.deepEqual(
    api.calls.map((call) => call.method),
    ['GET', 'POST', 'GET'],
  );
  assert.deepEqual(JSON.parse(api.calls[1].body), { build_type: 'workflow' });
  assert.equal(result.pages.buildType, 'workflow');
  const readonly = service([missing]);
  await inspectPages({ repository, token: 'test-token', request: readonly.request });
  assert.equal(readonly.calls.length, 1);
});
test('an administration denial remains a failed enablement without retries or a fabricated URL', async () => {
  const api = service([
    { status: 404, body: {} },
    { status: 403, body: { message: 'Resource not accessible by integration' } },
  ]);
  const result = await inspectPages({
    repository,
    token: 'test-token',
    enable: true,
    request: api.request,
  });
  assert.equal(result.pages.available, false);
  assert.equal(result.pages.url, null);
  assert.equal(result.enablement.httpStatus, 403);
  assert.equal(api.calls.length, 2);
  assert.ok(!JSON.stringify(result).includes('test-token'));
});
test('a branch site can be switched to workflow publishing and a missing token cannot create a site', async () => {
  const api = service([{ status: 200, body: { build_type: 'legacy' } }, ready, ready]);
  await inspectPages({ repository, token: 'test-token', enable: true, request: api.request });
  assert.equal(api.calls[1].method, 'PUT');
  const missing = service([{ status: 404, body: {} }]);
  const result = await inspectPages({ repository, enable: true, request: missing.request });
  assert.equal(result.enablement.attempted, false);
  assert.equal(missing.calls.length, 1);
});
test('a repository path cannot redirect the authorization header to another endpoint', async () => {
  await assert.rejects(
    inspectPages({ repository: 'https://other.example/path', token: 'test-token' }),
    /Invalid repository/,
  );
});
