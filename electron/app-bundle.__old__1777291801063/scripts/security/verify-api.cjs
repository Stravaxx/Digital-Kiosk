const baseUrl = String(process.env.API_VERIFY_BASE_URL || process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const apiKey = String(process.env.API_VERIFY_API_KEY || '').trim();
const bearerToken = String(process.env.API_VERIFY_BEARER_TOKEN || '').trim();

const checks = [
  { method: 'GET', path: '/api/health', expectMin: 200, expectMax: 399, auth: false },
  { method: 'GET', path: '/api/settings', expectMin: 200, expectMax: 399, auth: false },
  { method: 'GET', path: '/api/system/update/state', expectMin: 200, expectMax: 399, auth: false },
  { method: 'GET', path: '/api/system/maintenance/status', expectMin: 200, expectMax: 399, auth: false },
  { method: 'GET', path: '/api/playlists', expectMin: 200, expectMax: 399, auth: false },
  { method: 'GET', path: '/api/assets', expectMin: 200, expectMax: 399, auth: true },
  { method: 'GET', path: '/api/logs', expectMin: 200, expectMax: 399, auth: true },
  { method: 'GET', path: '/api/auth/session', expectMin: 200, expectMax: 399, auth: true }
];

function buildHeaders(authRequired) {
  const headers = { Accept: 'application/json' };
  if (authRequired) {
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    method: check.method,
    headers: buildHeaders(check.auth),
    cache: 'no-store'
  });
  const ok = response.status >= check.expectMin && response.status <= check.expectMax;
  return { ...check, status: response.status, ok };
}

(async () => {
  console.log(`Verification API: ${baseUrl}`);
  const results = [];
  for (const check of checks) {
    try {
      const result = await runCheck(check);
      results.push(result);
      console.log(`${result.ok ? 'OK ' : 'ERR'} ${check.method} ${check.path} -> ${result.status}`);
    } catch (error) {
      results.push({ ...check, ok: false, status: 0, error: String(error?.message || error) });
      console.log(`ERR ${check.method} ${check.path} -> ${error.message}`);
    }
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} endpoint(s) en echec.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nToutes les verifications API sont OK.');
})();
