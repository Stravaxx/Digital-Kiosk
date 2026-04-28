const { spawn } = require('child_process');

const baseUrl = String(process.env.UPDATE_BASE_URL || process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const apiKey = String(process.env.UPDATE_API_KEY || '').trim();
const bearerToken = String(process.env.UPDATE_BEARER_TOKEN || '').trim();
const pollMs = Math.max(500, Number(process.env.UPDATE_POLL_MS || 1200));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store'
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || `HTTP ${response.status}`));
  }
  return payload;
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function printState(state) {
  const at = state?.timestamp || new Date().toISOString();
  const step = String(state?.currentStep || 'idle');
  const progress = Number(state?.progress || 0);
  const error = state?.error ? ` | error=${state.error}` : '';
  const worker = state?.workerStatus ? ` | worker=${state.workerStatus}` : '';
  console.log(`[${at}] step=${step} progress=${Math.round(progress)}%${worker}${error}`);
}

async function run() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Lancement de la mise a jour...');
  await requestJson(`${baseUrl}/api/system/update/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger: 'script' })
  });

  const updaterUrl = `${baseUrl}/updater`;
  console.log(`Ouverture de l'interface: ${updaterUrl}`);
  openBrowser(updaterUrl);

  console.log('Suivi read-only des logs d\'update (Ctrl+C pour quitter)');
  let lastSignature = '';
  while (true) {
    try {
      const state = await requestJson(`${baseUrl}/api/system/update/state`);
      const signature = JSON.stringify([state.currentStep, state.progress, state.error, state.workerStatus, state.timestamp]);
      if (signature !== lastSignature) {
        printState(state);
        lastSignature = signature;
      }

      if (!state.isRunning && (state.workerStatus === 'completed' || state.workerStatus === 'failed')) {
        console.log('Processus de mise a jour termine.');
        break;
      }
    } catch (error) {
      console.error(`Erreur monitor: ${error.message}`);
    }

    await sleep(pollMs);
  }
}

run().catch((error) => {
  console.error(`Echec: ${error.message}`);
  process.exitCode = 1;
});
