/**
 * Update Service - Background update manager with backup/restore
 * Handles: backup DB/storage, npm install, build, restore, reload
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(BASE_DIR, 'database', 'system.db');
const BACKUP_DIR = path.join(BASE_DIR, 'database', 'backups');
const STORAGE_DIR = path.join(BASE_DIR, 'storage');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Global update state
 */
let updateState = {
  isRunning: false,
  currentStep: 'idle',
  progress: 0,
  timestamp: null,
  error: null,
  backupPath: null,
  backupDateTime: null,
  startedAt: null,
  completedAt: null,
};

const steps = {
  BACKUP_DB: { order: 1, label: 'Sauvegarde de la base de données', weight: 15 },
  BACKUP_STORAGE: { order: 2, label: 'Sauvegarde des fichiers', weight: 15 },
  NPM_INSTALL: { order: 3, label: 'Installation des dépendances', weight: 35 },
  BUILD: { order: 4, label: 'Compilation du projet', weight: 25 },
  RESTORE_DB: { order: 5, label: 'Restauration de la base', weight: 5 },
  RESTORE_STORAGE: { order: 6, label: 'Restauration des fichiers', weight: 5 },
  RELOAD: { order: 7, label: 'Rechargement du système', weight: 5 },
};

function createDefaultState() {
  return {
    isRunning: false,
    currentStep: 'idle',
    progress: 0,
    timestamp: null,
    error: null,
    backupPath: null,
    backupDateTime: null,
    startedAt: null,
    completedAt: null,
  };
}

function copyDirectoryRecursive(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  fs.readdirSync(sourceDir, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
      return;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  });
}

function removeDirectoryRecursive(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  fs.readdirSync(targetDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      removeDirectoryRecursive(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  });

  fs.rmdirSync(targetDir);
}

function emitState(runContext) {
  const onStateChange = typeof runContext?.onStateChange === 'function' ? runContext.onStateChange : null;
  if (!onStateChange) {
    return;
  }
  try {
    onStateChange(getUpdateState());
  } catch {
    // noop
  }
}

function setStep(stepName, runContext, error = null) {
  const step = steps[stepName];
  if (!step) {
    console.warn(`Unknown step: ${stepName}`);
    return;
  }

  const prevProgress = Object.values(steps)
    .filter((s) => s.order < step.order)
    .reduce((sum, s) => sum + s.weight, 0);

  updateState.currentStep = stepName;
  updateState.progress = Math.min(prevProgress + step.weight / 2, 99);
  updateState.error = error;
  updateState.timestamp = new Date();

  console.log(`[UPDATE] ${step.label} - Progress: ${Math.round(updateState.progress)}%`);
  emitState(runContext);
}

function completeStep(runContext) {
  const step = steps[updateState.currentStep];
  if (step) {
    const prevProgress = Object.values(steps)
      .filter((s) => s.order < step.order)
      .reduce((sum, s) => sum + s.weight, 0);
    updateState.progress = prevProgress + step.weight;
    updateState.timestamp = new Date();
    emitState(runContext);
  }
}

/**
 * Backup database and storage
 */
async function backupSystem(runContext) {
  try {
    setStep('BACKUP_DB', runContext);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubdir = path.join(BACKUP_DIR, `update-${timestamp}`);

    if (!fs.existsSync(backupSubdir)) {
      fs.mkdirSync(backupSubdir, { recursive: true });
    }

    // Backup database
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, path.join(backupSubdir, 'system.db'));
      console.log('✅ Database backed up');
    }

    completeStep(runContext);
    setStep('BACKUP_STORAGE', runContext);

    // Backup storage (if not too large, limit to 100MB)
    if (fs.existsSync(STORAGE_DIR)) {
      const backupStoragePath = path.join(backupSubdir, 'storage');
      fs.mkdirSync(backupStoragePath, { recursive: true });

      copyDirectoryRecursive(STORAGE_DIR, backupStoragePath);
      console.log('✅ Storage backed up');
    }

    completeStep(runContext);
    updateState.backupPath = backupSubdir;
    updateState.backupDateTime = new Date();
    emitState(runContext);
    return backupSubdir;
  } catch (e) {
    setStep('BACKUP_DB', runContext, `Erreur de sauvegarde: ${e.message}`);
    throw e;
  }
}

/**
 * Run npm install
 */
function npmInstall(runContext) {
  try {
    setStep('NPM_INSTALL', runContext);
    console.log('Running npm install...');

    execSync('npm install', {
      cwd: BASE_DIR,
      stdio: 'inherit',
      timeout: 600000, // 10 minutes
    });

    console.log('✅ npm install completed');
    completeStep(runContext);
  } catch (e) {
    setStep('NPM_INSTALL', runContext, `Erreur npm install: ${e.message}`);
    throw e;
  }
}

/**
 * Build project (npm run build)
 */
function buildProject(runContext) {
  try {
    setStep('BUILD', runContext);
    console.log('Running npm run build...');

    execSync('npm run build', {
      cwd: BASE_DIR,
      stdio: 'inherit',
      timeout: 600000, // 10 minutes
    });

    console.log('✅ Build completed');
    completeStep(runContext);
  } catch (e) {
    setStep('BUILD', runContext, `Erreur de compilation: ${e.message}`);
    throw e;
  }
}

/**
 * Restore from backup
 */
async function restoreSystem(backupSubdir, runContext) {
  try {
    setStep('RESTORE_DB', runContext);

    const backupDbPath = path.join(backupSubdir, 'system.db');
    if (fs.existsSync(backupDbPath) && fs.existsSync(DB_PATH)) {
      fs.copyFileSync(backupDbPath, DB_PATH);
      console.log('✅ Database restored');
    }

    completeStep(runContext);
    setStep('RESTORE_STORAGE', runContext);

    const backupStoragePath = path.join(backupSubdir, 'storage');
    if (fs.existsSync(backupStoragePath)) {
      removeDirectoryRecursive(STORAGE_DIR);
      copyDirectoryRecursive(backupStoragePath, STORAGE_DIR);
      console.log('✅ Storage restored');
    }

    completeStep(runContext);
  } catch (e) {
    setStep('RESTORE_DB', runContext, `Erreur de restauration: ${e.message}`);
    throw e;
  }
}

/**
 * Signal reload to all connected clients
 */
async function signalReload(runContext) {
  try {
    setStep('RELOAD', runContext);

    if (typeof runContext?.onReloadRequested === 'function') {
      await Promise.resolve(runContext.onReloadRequested(getUpdateState()));
    }

    console.log('✅ Update completed - clients should reload');
    completeStep(runContext);
    updateState.progress = 100;
    updateState.timestamp = new Date();
    emitState(runContext);
  } catch (e) {
    setStep('RELOAD', runContext, `Erreur lors du rechargement: ${e.message}`);
    throw e;
  }
}

/**
 * Main update process
 */
async function runUpdate(options = {}) {
  const runContext = {
    onStateChange: typeof options.onStateChange === 'function' ? options.onStateChange : null,
    onReloadRequested: typeof options.onReloadRequested === 'function' ? options.onReloadRequested : null,
  };

  if (updateState.isRunning) {
    console.warn('Update already in progress');
    return updateState;
  }

  updateState.isRunning = true;
  updateState.currentStep = 'idle';
  updateState.progress = 0;
  updateState.error = null;
  updateState.timestamp = new Date();
  updateState.startedAt = updateState.timestamp;
  updateState.completedAt = null;
  emitState(runContext);

  let backupPath = null;

  try {
    // Backup
    backupPath = await backupSystem(runContext);

    // Update
    npmInstall(runContext);
    buildProject(runContext);

    // Restore
    await restoreSystem(backupPath, runContext);

    // Signal reload
    await signalReload(runContext);

    updateState.isRunning = false;
    updateState.completedAt = new Date();
    updateState.timestamp = updateState.completedAt;
    emitState(runContext);
    return { success: true, state: updateState };
  } catch (error) {
    console.error('❌ Update failed:', error);

    if (backupPath) {
      try {
        await restoreSystem(backupPath, runContext);
      } catch (restoreError) {
        console.error('❌ Restore failed after update error:', restoreError);
      }
    }

    updateState.isRunning = false;
    updateState.error = error.message;
    updateState.completedAt = new Date();
    updateState.timestamp = updateState.completedAt;
    emitState(runContext);
    return { success: false, error: error.message, state: updateState };
  }
}

/**
 * Get current update state
 */
function getUpdateState() {
  return {
    ...updateState,
    steps
  };
}

/**
 * Reset update state (admin only)
 */
function resetUpdateState() {
  updateState = createDefaultState();
}

module.exports = {
  runUpdate,
  getUpdateState,
  resetUpdateState,
  steps,
};
