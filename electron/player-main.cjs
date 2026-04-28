const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const appIconSvgPath = path.join(projectRoot, 'public', 'branding', 'kiosk-icon.svg');
const appIconIcoPath = path.join(projectRoot, 'public', 'branding', 'kiosk-icon.ico');
const appIconSvgCompatPath = path.join(projectRoot, 'public', 'brandiing', 'kiosk-icon.svg');
const appIconIcoCompatPath = path.join(projectRoot, 'public', 'brandiing', 'kiosk-icon.ico');

let playerWindow = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeInstanceId(instanceId) {
  return String(instanceId || 'default').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'default';
}

function getPlayerStateDir() {
  return path.join(app.getPath('userData'), 'players');
}

function getPlayerStatePath(instanceId) {
  return path.join(getPlayerStateDir(), `${sanitizeInstanceId(instanceId)}.json`);
}

function loadAppIcon() {
  const preferredPaths = process.platform === 'win32'
    ? [appIconIcoPath, appIconIcoCompatPath, appIconSvgPath, appIconSvgCompatPath]
    : [appIconSvgPath, appIconSvgCompatPath, appIconIcoPath, appIconIcoCompatPath];

  for (const candidatePath of preferredPaths) {
    const iconFromFile = nativeImage.createFromPath(candidatePath);
    if (!iconFromFile.isEmpty()) {
      return iconFromFile;
    }
  }

  return nativeImage.createFromDataURL('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23020617"/><rect x="14" y="16" width="36" height="26" rx="5" fill="%230ea5e9"/><circle cx="32" cy="48" r="5" fill="%23f97316"/></svg>');
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'player-config.json');
}

function getCurrentAutoStartSetting() {
  try {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      return Boolean(app.getLoginItemSettings().openAtLogin);
    }
  } catch {
    return false;
  }
  return false;
}

function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const parsedUrl = String(source.playerUrl || '').trim();
  const sanitizedInstanceId = String(source.instanceId || '').trim() || 'windows-player';
  return {
    playerUrl: parsedUrl || 'http://127.0.0.1:4173/player',
    instanceId: sanitizeInstanceId(sanitizedInstanceId),
    launchFullscreen: source.launchFullscreen !== false,
    autoStartOnLogin: Boolean(source.autoStartOnLogin)
  };
}

function resolveConfiguredPlayerUrl(config) {
  const fallback = 'http://127.0.0.1:4173/player';
  const rawUrl = String(config?.playerUrl || '').trim() || fallback;
  const instanceId = sanitizeInstanceId(config?.instanceId || 'windows-player');
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set('instance', instanceId);
    return parsed.toString();
  } catch {
    try {
      const fallbackUrl = new URL(fallback);
      fallbackUrl.searchParams.set('instance', instanceId);
      return fallbackUrl.toString();
    } catch {
      return `${fallback}?instance=${encodeURIComponent(instanceId)}`;
    }
  }
}

function writeConfig(config) {
  const normalized = normalizeConfig(config);
  fs.writeFileSync(getConfigPath(), JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

function syncAutoStartSetting(openAtLogin) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    return false;
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(openAtLogin),
      openAsHidden: false,
      path: process.execPath,
      args: []
    });
    return true;
  } catch {
    return false;
  }
}

function getDefaultConfig() {
  return normalizeConfig({
    playerUrl: process.env.DIGITAL_KIOSK_PLAYER_URL || 'http://127.0.0.1:4173/player?instance=windows-player',
    instanceId: 'windows-player',
    launchFullscreen: true,
    autoStartOnLogin: getCurrentAutoStartSetting()
  });
}

function readConfig() {
  const defaults = getDefaultConfig();
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeConfig({
      ...defaults,
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    });
  } catch {
    return defaults;
  }
}

function applyConfigToWindow(config) {
  if (!playerWindow || playerWindow.isDestroyed()) {
    return false;
  }

  const targetUrl = resolveConfiguredPlayerUrl(config);
  if (config.launchFullscreen) {
    playerWindow.setFullScreen(true);
  } else {
    playerWindow.setFullScreen(false);
  }

  playerWindow.loadURL(targetUrl).catch(() => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    playerWindow.loadURL(createFallbackPage('Player indisponible', `Impossible de charger ${targetUrl}`));
  });

  return true;
}

function createFallbackPage(title, message) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <body style="background:#020617;color:#e2e8f0;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="max-width:680px;padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.05)">
          <h1 style="margin-top:0">${title}</h1>
          <p>${message}</p>
          <p style="opacity:.8">Raccourcis: F11 pour quitter le plein écran, Ctrl+Alt+R pour recharger, Ctrl+Alt+Q pour quitter.</p>
        </div>
      </body>
    </html>
  `)}`;
}

function readPlayerIdentity(instanceId) {
  try {
    const raw = fs.readFileSync(getPlayerStatePath(instanceId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writePlayerIdentity(instanceId, payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = {
    deviceId: String(payload.deviceId || '').trim(),
    deviceName: String(payload.deviceName || '').trim(),
    token: String(payload.token || '').trim(),
    updatedAt: new Date().toISOString()
  };

  if (!record.deviceId || !record.token) {
    return false;
  }

  ensureDir(getPlayerStateDir());
  fs.writeFileSync(getPlayerStatePath(instanceId), JSON.stringify(record, null, 2), 'utf-8');
  return true;
}

function createPlayerWindow() {
  const config = readConfig();
  playerWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: loadAppIcon(),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    fullscreen: Boolean(config.launchFullscreen),
    webPreferences: {
      partition: 'persist:digital-kiosk-player',
      preload: path.join(__dirname, 'preload-player.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  playerWindow.once('ready-to-show', () => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    if (config.launchFullscreen) {
      playerWindow.setFullScreen(true);
    }
    playerWindow.show();
  });

  playerWindow.loadURL(resolveConfiguredPlayerUrl(config)).catch(() => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    playerWindow.loadURL(createFallbackPage('Player indisponible', `Impossible de charger ${resolveConfiguredPlayerUrl(config)}`));
  });

  playerWindow.on('closed', () => {
    playerWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.stravaxx.digital-kiosk.player');
    app.setName('Digital Kiosk Player');
  }

  ipcMain.handle('player:identity-load', (_event, instanceId) => readPlayerIdentity(instanceId));
  ipcMain.handle('player:identity-save', (_event, instanceId, payload) => writePlayerIdentity(instanceId, payload));
  ipcMain.handle('player:settings-load', () => readConfig());
  ipcMain.handle('player:settings-save', (_event, payload) => {
    const current = readConfig();
    const next = writeConfig({ ...current, ...(payload && typeof payload === 'object' ? payload : {}) });
    syncAutoStartSetting(next.autoStartOnLogin);
    return next;
  });
  ipcMain.handle('player:settings-apply', () => applyConfigToWindow(readConfig()));

  globalShortcut.register('CommandOrControl+Alt+Q', () => app.quit());
  globalShortcut.register('CommandOrControl+Alt+R', () => playerWindow?.webContents.reloadIgnoringCache());
  globalShortcut.register('F11', () => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    playerWindow.setFullScreen(!playerWindow.isFullScreen());
  });

  createPlayerWindow();
  syncAutoStartSetting(readConfig().autoStartOnLogin);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});