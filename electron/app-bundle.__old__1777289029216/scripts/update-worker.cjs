const fs = require('fs');
const path = require('path');
const updateService = require('./update-service.cjs');

const BASE_DIR = path.resolve(__dirname, '..');
const UPDATE_STATE_FILE = path.resolve(BASE_DIR, process.env.UPDATE_STATE_FILE || path.join('database', 'update-runtime-state.json'));

function ensureDirectory(filePath) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function serializeState(state) {
  const normalized = {
    ...state,
    workerPid: process.pid,
    timestamp: state?.timestamp instanceof Date
      ? state.timestamp.toISOString()
      : (typeof state?.timestamp === 'string' ? state.timestamp : null),
    startedAt: state?.startedAt instanceof Date
      ? state.startedAt.toISOString()
      : (typeof state?.startedAt === 'string' ? state.startedAt : null),
    completedAt: state?.completedAt instanceof Date
      ? state.completedAt.toISOString()
      : (typeof state?.completedAt === 'string' ? state.completedAt : null),
    backupDateTime: state?.backupDateTime instanceof Date
      ? state.backupDateTime.toISOString()
      : (typeof state?.backupDateTime === 'string' ? state.backupDateTime : null)
  };

  return normalized;
}

function writeState(state) {
  try {
    ensureDirectory(UPDATE_STATE_FILE);
    const payload = JSON.stringify(serializeState(state), null, 2);
    fs.writeFileSync(UPDATE_STATE_FILE, payload, 'utf-8');
  } catch (error) {
    console.error('[update-worker] failed to persist update state:', error);
  }
}

async function run() {
  writeState({
    ...updateService.createDefaultState(),
    isRunning: true,
    currentStep: 'queued',
    progress: 0,
    timestamp: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    error: null,
    workerStatus: 'starting'
  });

  try {
    const result = await updateService.runUpdate({
      onStateChange: (state) => {
        writeState({
          ...state,
          workerStatus: state?.isRunning ? 'running' : 'completed'
        });
      },
      onReloadRequested: async () => {
        writeState({
          ...updateService.getUpdateState(),
          workerStatus: 'awaiting-restart',
          requiresRestart: true,
          reloadRequestedAt: new Date().toISOString()
        });
      }
    });

    writeState({
      ...result?.state,
      isRunning: false,
      progress: 100,
      workerStatus: 'completed',
      requiresRestart: true,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    writeState({
      ...updateService.getUpdateState(),
      isRunning: false,
      workerStatus: 'failed',
      error: String(error?.message || error || 'Update worker failed'),
      completedAt: new Date().toISOString()
    });
  }
}

void run();
