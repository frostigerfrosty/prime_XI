/** Pages setup uses the workflow's own scoped token; authorization failures stay explicit. */
export async function inspectPages({ repository, token, enable = false, request = fetch }) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.test(repository))
    throw new Error('Invalid repository.');
  const endpoint = `https://api.github.com/repos/${repository}/pages`;
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  async function call(method = 'GET') {
    const response = await request(endpoint, {
      method,
      headers: { ...headers, ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method !== 'GET' ? { body: JSON.stringify({ build_type: 'workflow' }) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => ({}));
    return {
      httpStatus: response.status,
      available: response.ok,
      url: body.html_url ?? null,
      buildType: body.build_type ?? null,
      status: body.status ?? null,
      message: response.ok ? null : (body.message ?? 'Request failed'),
    };
  }
  const result = { pages: await call(), enablement: null };
  if (
    enable &&
    (result.pages.httpStatus === 404 ||
      (result.pages.available && result.pages.buildType !== 'workflow'))
  ) {
    if (!token) {
      result.enablement = {
        attempted: false,
        message: 'A Pages administration token is required to enable this site.',
      };
    } else {
      const method = result.pages.httpStatus === 404 ? 'POST' : 'PUT';
      const attempt = await call(method);
      result.enablement = { attempted: true, method, ...attempt };
      if (attempt.available || attempt.httpStatus === 409) result.pages = await call();
    }
  }
  return result;
}
