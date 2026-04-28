const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Keep Chromium cache inside a dedicated app-owned folder to avoid lock/permission issues.
const sessionDataPath = path.join(app.getPath('userData'), 'session-data');
if (!fs.existsSync(sessionDataPath)) {
  fs.mkdirSync(sessionDataPath, { recursive: true });
}
app.setPath('sessionData', sessionDataPath);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const projectRoot = path.resolve(__dirname, '..');
const bundleRoot = app.isPackaged ? path.join(process.resourcesPath, 'app-bundle') : projectRoot;
const appIconSvgPath = path.join(projectRoot, 'public', 'branding', 'kiosk-icon.svg');
const appIconIcoPath = path.join(projectRoot, 'public', 'branding', 'kiosk-icon.ico');
const appIconSvgCompatPath = path.join(projectRoot, 'public', 'brandiing', 'kiosk-icon.svg');
const appIconIcoCompatPath = path.join(projectRoot, 'public', 'brandiing', 'kiosk-icon.ico');
const electronRendererDistPath = path.join(projectRoot, 'electron', 'dist', 'index.html');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getRuntimeRoot() {
  return path.join(app.getPath('userData'), 'runtime');
}

function getRuntimeDatabaseDir() {
  return path.join(getRuntimeRoot(), 'database');
}

function getRuntimeStorageDir() {
  return path.join(getRuntimeRoot(), 'storage');
}

function getPlayerStateDir() {
  return path.join(app.getPath('userData'), 'players');
}

function sanitizeInstanceId(instanceId) {
  return String(instanceId || 'default').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) || 'default';
}

function getPlayerStatePath(instanceId) {
  return path.join(getPlayerStateDir(), `${sanitizeInstanceId(instanceId)}.json`);
}

function copyMissingRecursive(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyMissingRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  if (!fs.existsSync(targetPath)) {
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function ensureWritableRuntimeData() {
  const runtimeRoot = getRuntimeRoot();
  const runtimeDatabaseDir = getRuntimeDatabaseDir();
  const runtimeStorageDir = getRuntimeStorageDir();

  ensureDir(runtimeRoot);
  ensureDir(runtimeDatabaseDir);
  ensureDir(runtimeStorageDir);

  copyMissingRecursive(path.join(bundleRoot, 'database'), runtimeDatabaseDir);
  copyMissingRecursive(path.join(bundleRoot, 'storage'), runtimeStorageDir);
}

function getBundledServerEntryPath() {
  return path.join(bundleRoot, 'server.cjs');
}

function getServerDefaults() {
  if (app.isPackaged) {
    return {
      serverCommand: process.execPath,
      serverArgs: [getBundledServerEntryPath()],
      serverCwd: bundleRoot
    };
  }

  return {
    serverCommand: 'node',
    serverArgs: ['server.cjs'],
    serverCwd: projectRoot
  };
}

function normalizeConfig(config) {
  const next = {
    ...(config && typeof config === 'object' ? config : {})
  };

  if (app.isPackaged) {
    const serverDefaults = getServerDefaults();
    next.serverCommand = serverDefaults.serverCommand;
    next.serverArgs = serverDefaults.serverArgs;
    next.serverCwd = serverDefaults.serverCwd;
    if (!String(next.adminUrl || '').trim()) {
      next.adminUrl = 'http://127.0.0.1:4173';
    }
    if (!String(next.playerUrl || '').trim()) {
      next.playerUrl = 'http://127.0.0.1:4173/player?instance=desktop';
    }
  }

  return next;
}

function readPlayerIdentity(instanceId) {
  try {
    const raw = fs.readFileSync(getPlayerStatePath(instanceId), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      deviceId: String(parsed.deviceId || '').trim(),
      deviceName: String(parsed.deviceName || '').trim(),
      token: String(parsed.token || '').trim()
    };
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

  return nativeImage.createFromDataURL('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%230f172a"/><rect x="14" y="18" width="36" height="24" rx="4" fill="%233b82f6"/><circle cx="21" cy="47" r="4" fill="%2322c55e"/><circle cx="32" cy="47" r="4" fill="%23f59e0b"/><circle cx="43" cy="47" r="4" fill="%23ef4444"/></svg>');
}

function getNotificationIconPath() {
  if (process.platform === 'win32' && fs.existsSync(appIconIcoPath)) {
    return appIconIcoPath;
  }
  if (process.platform === 'win32' && fs.existsSync(appIconIcoCompatPath)) {
    return appIconIcoCompatPath;
  }
  if (fs.existsSync(appIconSvgPath)) {
    return appIconSvgPath;
  }
  if (fs.existsSync(appIconSvgCompatPath)) {
    return appIconSvgCompatPath;
  }
  return '';
}

function getCustomFrameOptions() {
  const config = readConfig();
  const mode = String(config.titleBarMode || 'custom').toLowerCase() === 'system' ? 'system' : 'custom';
  if (mode === 'system') {
    return {};
  }

  if (process.platform !== 'win32' && process.platform !== 'linux') {
    if (process.platform === 'darwin') {
      return {
        titleBarStyle: 'hiddenInset'
      };
    }
    return {};
  }

  return {
    frame: false
  };
}

let tray = null;
let managerWindow = null;
let settingsWindow = null;
let playerWindow = null;
let adminWindow = null;
let serverProcess = null;
let restartTimer = null;
let stoppingServer = false;
let state = {
  status: 'stopped',
  pid: null,
  startedAt: null,
  exitCode: null,
  signal: null,
  restartCount: 0,
  lastCrashAt: null,
  lastError: null
};
let logLines = [];

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'desktop-config.json');
}

function getLogFilePath() {
  return path.join(app.getPath('userData'), 'desktop-runtime.log');
}

function getDefaultConfig() {
  const serverDefaults = getServerDefaults();
  return {
    uiLanguage: 'fr',
    titleBarMode: 'custom',
    autoRestartServer: true,
    autoStartServer: true,
    playerUrl: 'http://127.0.0.1:4173/player?instance=desktop',
    adminUrl: 'http://127.0.0.1:4173',
    serverCommand: serverDefaults.serverCommand,
    serverArgs: serverDefaults.serverArgs,
    serverCwd: serverDefaults.serverCwd
  };
}

function ensureLogFile() {
  const logFile = getLogFilePath();
  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '', 'utf-8');
  }
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
    return normalizeConfig(defaults);
  }
}

function readPlayerDesktopSettings() {
  const config = readConfig();
  const defaultPlayerUrl = 'http://127.0.0.1:4173/player';
  const rawPlayerUrl = String(config.playerUrl || '').trim() || defaultPlayerUrl;

  try {
    const parsed = new URL(rawPlayerUrl);
    return {
      playerUrl: `${parsed.origin}${parsed.pathname}`,
      instanceId: String(parsed.searchParams.get('instance') || 'desktop').trim() || 'desktop',
      launchFullscreen: true,
      autoStartOnLogin: false
    };
  } catch {
    return {
      playerUrl: defaultPlayerUrl,
      instanceId: 'desktop',
      launchFullscreen: true,
      autoStartOnLogin: false
    };
  }
}

function savePlayerDesktopSettings(payload) {
  const current = readPlayerDesktopSettings();
  const next = {
    ...current,
    ...(payload && typeof payload === 'object' ? payload : {})
  };

  const playerUrl = String(next.playerUrl || '').trim() || current.playerUrl;
  const instanceId = sanitizeInstanceId(String(next.instanceId || '').trim() || current.instanceId || 'desktop');

  let resolvedUrl = `${playerUrl}?instance=${encodeURIComponent(instanceId)}`;
  try {
    const parsed = new URL(playerUrl);
    parsed.searchParams.set('instance', instanceId);
    resolvedUrl = parsed.toString();
  } catch {
    // keep fallback query string composition
  }

  writeConfig({
    playerUrl: resolvedUrl
  });

  return {
    playerUrl,
    instanceId,
    launchFullscreen: next.launchFullscreen !== false,
    autoStartOnLogin: false
  };
}

function applyPlayerDesktopSettings() {
  const config = readConfig();
  if (!playerWindow || playerWindow.isDestroyed()) {
    return false;
  }

  playerWindow.loadURL(config.playerUrl).catch(() => {
    if (!playerWindow || playerWindow.isDestroyed()) return;
    playerWindow.loadURL(createFallbackPage('Player indisponible', `Impossible de charger ${config.playerUrl}`));
  });
  return true;
}

function writeConfig(partialConfig) {
  const next = normalizeConfig({
    ...readConfig(),
    ...(partialConfig && typeof partialConfig === 'object' ? partialConfig : {})
  });
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');
  rebuildTray();
  return next;
}

function appendLog(level, source, message, details = {}) {
  ensureLogFile();
  const record = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    details
  };
  fs.appendFileSync(getLogFilePath(), `${JSON.stringify(record)}\n`, 'utf-8');
  logLines.push(record);
  if (logLines.length > 500) {
    logLines = logLines.slice(-500);
  }
  broadcastState();
}

function splitAndLog(level, source, chunk) {
  const text = String(chunk || '');
  text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => appendLog(level, source, line));
}

function getSnapshot() {
  return {
    ...state,
    platform: process.platform,
    configPath: getConfigPath(),
    logFilePath: getLogFilePath(),
    config: readConfig()
  };
}

function broadcastState() {
  const payload = getSnapshot();
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('monitor:state', payload);
    }
  });
}

function createFallbackPage(title, message) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <body style="background:#0f172a;color:#e5e7eb;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
        <div style="max-width:640px;padding:24px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.05)">
          <h1 style="margin-top:0">${title}</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>
  `)}`;
}

function loadRendererPage(window, view = 'manager') {
  if (fs.existsSync(electronRendererDistPath)) {
    window.loadFile(electronRendererDistPath, {
      query: { view }
    });
    return;
  }

  window.loadURL(
    createFallbackPage(
      'UI Electron introuvable',
      'Le renderer Electron n\'est pas buildé. Exécutez: npm --prefix electron run build'
    )
  );
}

function openManagerWindow() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.show();
    managerWindow.focus();
    return managerWindow;
  }

  managerWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 840,
    minHeight: 1280,
    title: 'Digital Kiosk Desktop Manager',
    icon: loadAppIcon(),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...getCustomFrameOptions()
  });

  loadRendererPage(managerWindow, 'manager');
  managerWindow.on('closed', () => {
    managerWindow = null;
  });
  return managerWindow;
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 620,
    height: 700,
    minWidth: 560,
    minHeight: 620,
    title: 'Digital Kiosk Settings',
    parent: openManagerWindow(),
    modal: false,
    icon: loadAppIcon(),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...getCustomFrameOptions()
  });

  loadRendererPage(settingsWindow, 'settings');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  return settingsWindow;
}

function openPlayerWindow() {
  const config = readConfig();
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.show();
    playerWindow.focus();
    return playerWindow;
  }

  playerWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Digital Kiosk Player',
    icon: loadAppIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    fullscreen: true,
    webPreferences: {
      partition: 'persist:digital-kiosk-player',
      preload: path.join(__dirname, 'preload-player.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...getCustomFrameOptions()
  });

  playerWindow.once('ready-to-show', () => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.setFullScreen(true);
      playerWindow.show();
    }
  });

  playerWindow.loadURL(config.playerUrl).catch(() => {
    playerWindow.loadURL(createFallbackPage('Player indisponible', `Impossible de charger ${config.playerUrl}`));
  });

  playerWindow.webContents.on('render-process-gone', (_event, details) => {
    appendLog('error', 'electron.player', 'Le renderer du player a quitté de manière inattendue.', details || {});
  });

  playerWindow.on('closed', () => {
    playerWindow = null;
  });

  return playerWindow;
}

function openAdminWindow() {
  const config = readConfig();
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.show();
    adminWindow.focus();
    return adminWindow;
  }

  adminWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    title: 'Digital Kiosk Panel',
    icon: loadAppIcon(),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...getCustomFrameOptions()
  });

  adminWindow.loadURL(config.adminUrl).catch(() => {
    adminWindow.loadURL(createFallbackPage('Admin indisponible', `Impossible de charger ${config.adminUrl}`));
  });

  adminWindow.on('closed', () => {
    adminWindow = null;
  });

  return adminWindow;
}

function stopServer() {
  clearRestartTimer();

  if (!serverProcess) {
    stoppingServer = false;
    state.status = 'stopped';
    state.pid = null;
    state.lastError = null;
    broadcastState();
    return;
  }

  stoppingServer = true;
  appendLog('warning', 'server.control', 'Arrêt du serveur demandé.');
  serverProcess.kill();
}

function startServer() {
  if (serverProcess) {
    return getSnapshot();
  }

  const config = readConfig();
  ensureWritableRuntimeData();
  stoppingServer = false;
  clearRestartTimer();

  appendLog('info', 'server.control', 'Démarrage du serveur.', {
    command: config.serverCommand,
    args: config.serverArgs,
    cwd: config.serverCwd
  });

  const serverEnv = {
    ...process.env,
    ...(app.isPackaged ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    SYSTEM_DB_DIR: getRuntimeDatabaseDir(),
    SYSTEM_STORAGE_DIR: getRuntimeStorageDir()
  };

  if (app.isPackaged) {
    const appPath = app.getAppPath();
    const nodePathCandidates = [
      path.join(appPath, 'node_modules'),
      path.join(process.resourcesPath, 'app', 'node_modules')
    ].filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);

    if (nodePathCandidates.length > 0) {
      const existingNodePath = String(serverEnv.NODE_PATH || '').trim();
      serverEnv.NODE_PATH = [
        ...nodePathCandidates,
        ...(existingNodePath ? existingNodePath.split(path.delimiter).filter(Boolean) : [])
      ].filter((value, index, all) => value && all.indexOf(value) === index).join(path.delimiter);
    }
  }

  serverProcess = spawn(config.serverCommand, config.serverArgs, {
    cwd: config.serverCwd,
    env: serverEnv,
    windowsHide: true
  });

  state = {
    ...state,
    status: 'running',
    pid: serverProcess.pid || null,
    startedAt: new Date().toISOString(),
    exitCode: null,
    signal: null,
    lastError: null
  };
  broadcastState();

  serverProcess.stdout.on('data', (chunk) => splitAndLog('info', 'server.stdout', chunk));
  serverProcess.stderr.on('data', (chunk) => splitAndLog('error', 'server.stderr', chunk));
  serverProcess.on('error', (error) => {
    appendLog('error', 'server.process', 'Erreur de démarrage du serveur.', { message: error.message, stack: error.stack || '' });
    clearRestartTimer();
    state = {
      ...state,
      status: 'crashed',
      lastCrashAt: new Date().toISOString(),
      lastError: error.message
    };
    serverProcess = null;
    broadcastState();
  });
  serverProcess.on('exit', (code, signal) => {
    clearRestartTimer();
    const unexpected = !stoppingServer;
    appendLog(unexpected ? 'error' : 'warning', 'server.process', unexpected ? 'Le serveur a quitté de manière inattendue.' : 'Le serveur a été arrêté.', { code, signal });
    state = {
      ...state,
      status: unexpected ? 'crashed' : 'stopped',
      pid: null,
      exitCode: Number.isInteger(code) ? code : null,
      signal: signal || null,
      lastCrashAt: unexpected ? new Date().toISOString() : state.lastCrashAt,
      lastError: unexpected ? `exit code=${code ?? 'null'} signal=${signal ?? 'none'}` : null,
      restartCount: unexpected ? state.restartCount + 1 : state.restartCount
    };
    serverProcess = null;
    broadcastState();
    if (unexpected && readConfig().autoRestartServer) {
      restartTimer = setTimeout(() => {
        restartTimer = null;
        startServer();
      }, 2000);
    }
    stoppingServer = false;
  });

  return getSnapshot();
}

function restartServer() {
  clearRestartTimer();

  if (!serverProcess) {
    stoppingServer = false;
    return startServer();
  }

  stoppingServer = true;
  serverProcess.once('exit', () => {
    stoppingServer = false;
    startServer();
  });
  serverProcess.kill();
  return getSnapshot();
}

function getTrayLabels() {
  const language = readConfig().uiLanguage === 'en' ? 'en' : 'fr';
  if (language === 'en') {
    return {
      openManager: 'Open manager',
      openPlayer: 'Open player',
      openAdmin: 'Open admin',
      settings: 'Settings',
      start: 'Start server',
      restart: 'Restart server',
      stop: 'Stop server',
      quit: 'Quit'
    };
  }
  return {
    openManager: 'Ouvrir le manager',
    openPlayer: 'Ouvrir le player',
    openAdmin: 'Ouvrir l’admin',
    settings: 'Paramètres',
    start: 'Démarrer le serveur',
    restart: 'Redémarrer le serveur',
    stop: 'Arrêter le serveur',
    quit: 'Quitter'
  };
}

function rebuildTray() {
  const labels = getTrayLabels();
  if (!tray) {
    tray = new Tray(loadAppIcon());
    tray.setToolTip('Digital Kiosk Desktop');
    tray.on('double-click', () => openManagerWindow());
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: labels.openManager, click: () => openManagerWindow() },
    { label: labels.openPlayer, click: () => openPlayerWindow() },
    { label: labels.openAdmin, click: () => openAdminWindow() },
    { type: 'separator' },
    { label: labels.settings, click: () => openSettingsWindow() },
    { type: 'separator' },
    { label: labels.start, click: () => startServer() },
    { label: labels.restart, click: () => restartServer() },
    { label: labels.stop, click: () => stopServer() },
    { type: 'separator' },
    { label: labels.quit, click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
}

ipcMain.handle('monitor:get-state', () => getSnapshot());
ipcMain.handle('monitor:get-logs', () => ({ lines: logLines.slice(-250), logFilePath: getLogFilePath() }));
ipcMain.handle('monitor:start-server', () => startServer());
ipcMain.handle('monitor:stop-server', () => {
  stopServer();
  return getSnapshot();
});
ipcMain.handle('monitor:restart-server', () => restartServer());
ipcMain.handle('monitor:open-player', () => {
  openPlayerWindow();
  return true;
});
ipcMain.handle('monitor:open-admin', () => {
  openAdminWindow();
  return true;
});
ipcMain.handle('monitor:open-settings', () => {
  openSettingsWindow();
  return true;
});
ipcMain.handle('player:identity-load', (_event, instanceId) => readPlayerIdentity(instanceId));
ipcMain.handle('player:identity-save', (_event, instanceId, payload) => writePlayerIdentity(instanceId, payload));
ipcMain.handle('player:settings-load', () => readPlayerDesktopSettings());
ipcMain.handle('player:settings-save', (_event, payload) => savePlayerDesktopSettings(payload));
ipcMain.handle('player:settings-apply', () => applyPlayerDesktopSettings());
ipcMain.handle('monitor:show-log-file', () => shell.showItemInFolder(getLogFilePath()));
ipcMain.handle('monitor:get-config', () => readConfig());
ipcMain.handle('monitor:save-config', (_event, payload) => writeConfig(payload));
ipcMain.handle('monitor:window-minimize', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.minimize();
    return true;
  }
  return false;
});
ipcMain.handle('monitor:window-toggle-maximize', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow.isDestroyed()) {
    return { ok: false, isMaximized: false };
  }
  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize();
  } else {
    targetWindow.maximize();
  }
  return { ok: true, isMaximized: targetWindow.isMaximized() };
});
ipcMain.handle('monitor:window-close', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.close();
    return true;
  }
  return false;
});
ipcMain.handle('monitor:quit-app', () => {
  app.quit();
  return true;
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.stravaxx.digital-kiosk.desktop');
    app.setName('Digital Kiosk Desktop');
  }

  // Keep a global reference so native notifications can resolve the app icon on Windows.
  process.env.DIGITAL_KIOSK_APP_ICON = getNotificationIconPath();

  ensureLogFile();
  ensureWritableRuntimeData();
  appendLog('info', 'electron.lifecycle', 'Application Electron initialisée.');
  rebuildTray();
  openManagerWindow();
  if (readConfig().autoStartServer) {
    startServer();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openManagerWindow();
  }
});

app.on('before-quit', () => {
  clearRestartTimer();
  if (serverProcess) {
    stoppingServer = true;
    serverProcess.kill();
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows.
});