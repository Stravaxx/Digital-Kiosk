const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
let BetterSqlite3 = null;
try {
  BetterSqlite3 = require('better-sqlite3');
} catch {
  BetterSqlite3 = null;
}
const {
  normalizeUsername,
  verifyPassword,
  createAdminAccount,
  generateSessionToken
} = require('./scripts/security/adminAuthUtils.cjs');

const updateService = require('./scripts/update-service.cjs');

const app = express();
const API_ONLY = String(process.env.API_ONLY || '').toLowerCase() === 'true';
const SERVER_MODE = String(process.env.SERVER_MODE || 'unified').toLowerCase();
const PORT = Number(process.env.PORT || (API_ONLY ? 8787 : 4173));

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const DB_DIR = path.resolve(ROOT, process.env.SYSTEM_DB_DIR || 'database');
const STORAGE_DIR = path.resolve(ROOT, process.env.SYSTEM_STORAGE_DIR || 'storage');
const ASSETS_DIR = path.join(STORAGE_DIR, 'assets');
const IFRAME_WHITELIST_PATH = path.resolve(
  ROOT,
  process.env.IFRAME_DOMAIN_WHITELIST_FILE || path.join('database', 'iframe-domain-whitelist.json')
);
const DB_PATH = path.join(DB_DIR, 'system-db.json');
const DB_BACKUP_PATH = path.join(DB_DIR, 'system-db.backup.json');
const DB_TEMP_PATH = path.join(DB_DIR, 'system-db.tmp.json');
const LEGACY_DB_PATH = path.join(DB_DIR, 'db.json');
const SQLITE_DB_PATH = path.join(DB_DIR, 'system.db');
const SCREENS_KV_KEY = 'ds.screens';
const LAYOUTS_KV_KEY = 'ds.layouts';
const PLAYER_PAIRINGS_KV_KEY = 'ds.player-pairings';
const SCREEN_GROUPS_KV_KEY = 'ds.screen-groups';
const ROOMS_KV_KEY = 'ds.rooms';
const EVENTS_KV_KEY = 'ds.localEvents';
const LAYERS_KV_KEY = 'ds.layers';
const PLAYLISTS_KV_KEY = 'ds.playlists';
const PLAYLISTS_META_KV_KEY = 'ds.playlists.meta';
const LOGS_KV_KEY = 'ds.system.logs';
const LAYOUTS_META_KV_KEY = 'ds.layouts.meta';
const ADMIN_ACCOUNT_KV_KEY = 'ds.security.admin-account';
const ADMIN_USERS_KV_KEY = 'ds.security.admin-users';
const SYSTEM_SETTINGS_KV_KEY = 'ds.system-settings';
const STORAGE_POLICY_KV_KEY = 'ds.storage.policy';
const ALERTS_POLICY_KV_KEY = 'ds.alerts.policy';
const ALERTS_STATE_KV_KEY = 'ds.alerts.state';
const DB_SCHEMA_VERSION = 2;
const UPDATE_RELEASE_REPO = 'Stravaxx/Digital-Kiosk';
const UPDATE_RELEASE_API = `https://api.github.com/repos/${UPDATE_RELEASE_REPO}/releases/latest`;
const RELEASE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const COMMAND_SIGNATURE_SECRET = String(process.env.COMMAND_SIGNATURE_SECRET || 'ds-default-command-secret');
const DEFAULT_STORAGE_POLICY = {
  maxAssetBytes: 6 * 1024 * 1024 * 1024,
  maxCacheBytes: 1024 * 1024 * 1024,
  logsRetentionDays: 30,
  autoPurge: true,
  staleHeartbeatSeconds: 90
};
const DEFAULT_ALERTS_POLICY = {
  offlineAfterSeconds: 180,
  staleAfterSeconds: 90,
  maxTemperatureC: 80,
  maxStorageUsagePercent: 85,
  maxHeartbeatLatencyMs: 30000
};
const MAX_LOG_ENTRIES = 2000;
const ADMIN_IDLE_TIMEOUT_MINUTES = Number(process.env.ADMIN_IDLE_TIMEOUT_MINUTES || 20);
const ADMIN_IDLE_TIMEOUT_MS = Math.min(20 * 60 * 1000, Math.max(15 * 60 * 1000, ADMIN_IDLE_TIMEOUT_MINUTES * 60 * 1000));
const ADMIN_TOKEN_COOKIE_NAME = 'ds_admin_token';
const adminSessions = new Map();
const updateState = {
  repo: UPDATE_RELEASE_REPO,
  currentVersion: '0.0.0',
  latestVersion: null,
  latestTag: null,
  latestPublishedAt: null,
  releaseUrl: null,
  releaseName: null,
  releaseBody: null,
  updateAvailable: false,
  checkedAt: null,
  checkError: null,
  checking: false,
  updating: false,
  updateError: null,
  updatedAt: null,
  appliedTag: null,
  requiresRestart: false
};
let releaseCheckTimer = null;
const DEFAULT_EMPTY_ARRAY_KEYS = new Set([
  SCREENS_KV_KEY,
  LAYOUTS_KV_KEY,
  PLAYER_PAIRINGS_KV_KEY,
  SCREEN_GROUPS_KV_KEY,
  ROOMS_KV_KEY,
  EVENTS_KV_KEY,
  LAYERS_KV_KEY,
  PLAYLISTS_KV_KEY,
  LOGS_KV_KEY
]);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: ROOT,
      maxBuffer: 8 * 1024 * 1024,
      ...options
    }, (error, stdout, stderr) => {
      if (error) {
        const details = String(stderr || stdout || error.message || '').trim();
        reject(new Error(details || `${command} failed`));
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
}

function normalizeVersionLikeTag(tag) {
  const cleaned = String(tag || '').trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return { valid: false, major: 0, minor: 0, patch: 0 };
  }
  return {
    valid: true,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemverLike(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

async function readAppVersionFromPackageJson() {
  try {
    const packagePath = path.join(ROOT, 'package.json');
    const raw = await fsp.readFile(packagePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const version = String(parsed?.version || '').trim();
    return version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function fetchLatestReleaseInfo() {
  const response = await fetch(UPDATE_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'digital-kiosk-update-checker'
    },
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`github release check failed (${response.status})`);
  }

  const payload = await response.json();
  const tag = String(payload?.tag_name || '').trim();
  if (!tag) {
    throw new Error('latest release tag missing');
  }

  return {
    tag,
    version: String(tag).replace(/^v/i, ''),
    publishedAt: typeof payload?.published_at === 'string' ? payload.published_at : null,
    htmlUrl: typeof payload?.html_url === 'string' ? payload.html_url : null,
    name: typeof payload?.name === 'string' ? payload.name : null,
    body: typeof payload?.body === 'string' ? payload.body : null
  };
}

async function checkForReleaseUpdate({ force = false } = {}) {
  if (updateState.checking && !force) {
    return updateState;
  }

  updateState.checking = true;
  updateState.checkError = null;

  try {
    updateState.currentVersion = await readAppVersionFromPackageJson();
    const release = await fetchLatestReleaseInfo();
    if (!release) {
      updateState.latestVersion = null;
      updateState.latestTag = null;
      updateState.latestPublishedAt = null;
      updateState.releaseUrl = null;
      updateState.releaseName = null;
      updateState.releaseBody = null;
      updateState.updateAvailable = false;
      updateState.checkedAt = new Date().toISOString();
      updateState.checkError = 'Aucune release GitHub trouvée (404).';
      return updateState;
    }
    const current = normalizeVersionLikeTag(updateState.currentVersion);
    const latest = normalizeVersionLikeTag(release.version);
    const hasComparableVersions = current.valid && latest.valid;
    const updateAvailable = hasComparableVersions
      ? compareSemverLike(latest, current) > 0
      : release.tag !== `v${updateState.currentVersion}` && release.version !== updateState.currentVersion;

    updateState.latestVersion = release.version;
    updateState.latestTag = release.tag;
    updateState.latestPublishedAt = release.publishedAt;
    updateState.releaseUrl = release.htmlUrl;
    updateState.releaseName = release.name;
    updateState.releaseBody = release.body;
    updateState.updateAvailable = updateAvailable;
    updateState.checkedAt = new Date().toISOString();

    return updateState;
  } catch (error) {
    updateState.checkedAt = new Date().toISOString();
    updateState.checkError = String(error?.message || error || 'release check failed');
    return updateState;
  } finally {
    updateState.checking = false;
  }
}

async function applyReleaseUpdate(req) {
  if (updateState.updating) {
    throw new Error('Une mise à jour est déjà en cours.');
  }

  updateState.updating = true;
  updateState.updateError = null;

  try {
    const status = await checkForReleaseUpdate({ force: true });
    if (!status.updateAvailable || !status.latestTag) {
      throw new Error('Aucune nouvelle release à appliquer.');
    }

    await runCommand('git', ['rev-parse', '--is-inside-work-tree']);
    const gitStatus = await runCommand('git', ['status', '--porcelain']);
    if (gitStatus.stdout.trim()) {
      throw new Error('Le dépôt contient des modifications locales. Commit/stash requis avant mise à jour.');
    }

    await runCommand('git', ['fetch', '--tags', 'origin']);
    await runCommand('git', ['checkout', `tags/${status.latestTag}`]);
    await runCommand('npm', ['install', '--no-audit', '--no-fund']);
    await runCommand('npm', ['run', 'build']);

    updateState.currentVersion = await readAppVersionFromPackageJson();
    updateState.updatedAt = new Date().toISOString();
    updateState.appliedTag = status.latestTag;
    updateState.updateAvailable = false;
    updateState.requiresRestart = true;

    const db = await readDb();
    appendLogEntry(db, {
      type: 'system',
      level: 'warning',
      source: 'api.system.update.apply',
      message: `Mise à jour appliquée vers ${status.latestTag}`,
      details: buildLogMeta(req, {
        repo: UPDATE_RELEASE_REPO,
        appliedTag: status.latestTag
      })
    });
    await writeDb(db);

    return updateState;
  } catch (error) {
    updateState.updateError = String(error?.message || error || 'update failed');
    throw error;
  } finally {
    updateState.updating = false;
  }
}

function startReleaseWatcher() {
  if (releaseCheckTimer) return;
  void checkForReleaseUpdate({ force: true });
  releaseCheckTimer = setInterval(() => {
    void checkForReleaseUpdate({ force: true });
  }, RELEASE_CHECK_INTERVAL_MS);
}

const KV_TO_COLLECTION_NAME = {
  [SCREENS_KV_KEY]: 'screens',
  [PLAYER_PAIRINGS_KV_KEY]: 'playerPairings',
  [SCREEN_GROUPS_KV_KEY]: 'screenGroups',
  [ROOMS_KV_KEY]: 'rooms',
  [EVENTS_KV_KEY]: 'events',
  [LAYOUTS_KV_KEY]: 'layouts',
  [LAYERS_KV_KEY]: 'layers',
  [PLAYLISTS_KV_KEY]: 'playlists',
  [LOGS_KV_KEY]: 'logs'
};

const COLLECTION_TO_KV_KEY = Object.fromEntries(
  Object.entries(KV_TO_COLLECTION_NAME).map(([kvKey, collectionName]) => [collectionName, kvKey])
);

const KNOWN_COLLECTIONS = Array.from(new Set(Object.values(KV_TO_COLLECTION_NAME)));

const DEFAULT_IFRAME_DOMAIN_WHITELIST = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'twitch.tv',
  'soundcloud.com',
  'spotify.com',
  'open.spotify.com',
  'calendar.google.com',
  'maps.google.com',
  'google.com',
  'googleusercontent.com',
  'microsoft.com',
  'office.com',
  'powerbi.com',
  'lookerstudio.google.com',
  'tableau.com',
  'notion.so',
  'miro.com',
  'figma.com',
  'canva.com'
];

const IFRAME_OPTIMIZED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'spotify.com',
  'open.spotify.com',
  'soundcloud.com'
];

const IFRAME_ALLOW_ALL_DOMAINS = String(process.env.IFRAME_ALLOW_ALL_DOMAINS || 'true').toLowerCase() === 'true';

function normalizeDomainEntry(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const withoutProtocol = raw.replace(/^https?:\/\//i, '').trim();
  const withoutPath = withoutProtocol.split('/')[0].trim();
  const withoutWildcardPrefix = withoutPath.replace(/^\*\./, '').trim();
  return withoutWildcardPrefix;
}

function loadIframeDomainWhitelist() {
  let fileDomains = [];
  try {
    if (fs.existsSync(IFRAME_WHITELIST_PATH)) {
      const raw = fs.readFileSync(IFRAME_WHITELIST_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        fileDomains = parsed;
      }
    }
  } catch {
    fileDomains = [];
  }

  const envDomains = String(process.env.IFRAME_DOMAIN_WHITELIST || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = [
    ...DEFAULT_IFRAME_DOMAIN_WHITELIST,
    ...fileDomains,
    ...envDomains
  ]
    .map(normalizeDomainEntry)
    .filter(Boolean);

  return Array.from(new Set(merged));
}

const IFRAME_DOMAIN_WHITELIST = loadIframeDomainWhitelist();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const CORS_ALLOW_ALL_ORIGINS = String(process.env.CORS_ALLOW_ALL_ORIGINS || '').toLowerCase() === 'true';
const CORS_ALLOW_PRIVATE_NETWORK_ORIGINS = String(process.env.CORS_ALLOW_PRIVATE_NETWORK_ORIGINS || 'true').toLowerCase() !== 'false';
const CORS_ALLOWED_ORIGINS = Array.from(new Set([
  ...DEFAULT_CORS_ORIGINS,
  ...String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
]));

function isPrivateIpv4Host(hostname) {
  const parts = String(hostname || '').trim().split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;

  if (nums[0] === 10) return true;
  if (nums[0] === 192 && nums[1] === 168) return true;
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
  return false;
}

function isLanOrigin(origin) {
  const value = String(origin || '').trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    const hostname = String(parsed.hostname || '').toLowerCase();
    if (!hostname) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname.endsWith('.local')) return true;
    if (isPrivateIpv4Host(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveCorsOrigin(requestOrigin) {
  const origin = String(requestOrigin || '').trim();
  if (!origin) return '';
  if (CORS_ALLOW_ALL_ORIGINS) return origin;
  if (CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
  if (CORS_ALLOW_PRIVATE_NETWORK_ORIGINS && isLanOrigin(origin)) return origin;
  return '';
}

const LOG_TYPES = new Set(['system', 'screen', 'error', 'upload', 'sync', 'auth', 'player', 'security', 'ops']);
const LOG_LEVELS = new Set(['info', 'warning', 'error']);
const ADMIN_ROLES = new Set(['admin', 'operator', 'viewer']);

const RETRYABLE_FS_ERROR_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY']);
let writeDbQueue = Promise.resolve();
const SCREEN_COMMANDS = new Set(['refresh', 'reload', 'reboot', 'change-layout']);
const COMMAND_RETRY_INTERVAL_MS = Math.max(2000, Number(process.env.COMMAND_RETRY_INTERVAL_MS || 5000));
const COMMAND_MAX_RETRIES = Math.min(12, Math.max(1, Number(process.env.COMMAND_MAX_RETRIES || 4)));
const systemSyncClients = new Map();
let systemSyncRevision = 0;

function parseJsonArray(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isAuthorizedStatus(status) {
  return status === 'online' || status === 'approved';
}

function parseJsonObjectArray(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object');
  } catch {
    return [];
  }
}

function parseJsonObject(raw, fallback = {}) {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
}

function parseAdminAccount(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    const username = normalizeUsername(parsed?.username);
    const passwordHash = String(parsed?.passwordHash || '').trim();
    if (!username || !passwordHash) return null;
    const role = ADMIN_ROLES.has(String(parsed?.role || '').trim().toLowerCase())
      ? String(parsed.role).trim().toLowerCase()
      : 'admin';
    return {
      username,
      passwordHash,
      role,
      createdAt: typeof parsed?.createdAt === 'string' ? parsed.createdAt : nowIso(),
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
      passwordAlgo: typeof parsed?.passwordAlgo === 'string' ? parsed.passwordAlgo : 'scrypt'
    };
  } catch {
    return null;
  }
}

function parseAdminUsers(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const username = normalizeUsername(entry?.username);
        const passwordHash = String(entry?.passwordHash || '').trim();
        if (!username || !passwordHash) return null;
        const role = ADMIN_ROLES.has(String(entry?.role || '').trim().toLowerCase())
          ? String(entry.role).trim().toLowerCase()
          : 'admin';
        return {
          username,
          passwordHash,
          role,
          createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : nowIso(),
          updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : nowIso(),
          lastLoginAt: typeof entry?.lastLoginAt === 'string' ? entry.lastLoginAt : undefined,
          passwordAlgo: typeof entry?.passwordAlgo === 'string' ? entry.passwordAlgo : 'scrypt'
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function upsertAdminUserRecord(users, account, lastLoginAt) {
  const next = Array.isArray(users) ? [...users] : [];
  const index = next.findIndex((item) => item.username === account.username);
  const merged = {
    username: account.username,
    passwordHash: account.passwordHash,
    role: ADMIN_ROLES.has(String(account.role || '').trim().toLowerCase())
      ? String(account.role).trim().toLowerCase()
      : 'admin',
    createdAt: account.createdAt || nowIso(),
    updatedAt: account.updatedAt || nowIso(),
    lastLoginAt,
    passwordAlgo: account.passwordAlgo || 'scrypt'
  };

  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...merged,
      createdAt: next[index].createdAt || merged.createdAt
    };
  } else {
    next.push(merged);
  }

  return next.sort((a, b) => a.username.localeCompare(b.username, 'fr'));
}

async function syncLegacyUsersDb() {
  await fsp.unlink(LEGACY_DB_PATH).catch(() => undefined);
}

function isStrongPassword(password) {
  const value = String(password || '');
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value);
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function parseRequestCookies(req) {
  const cookieHeader = String(req.headers.cookie || '');
  if (!cookieHeader) return {};
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const [rawKey, ...rest] = item.split('=');
      const key = String(rawKey || '').trim();
      if (!key) return acc;
      const value = rest.join('=').trim();
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function getAdminCookieToken(req) {
  const cookies = parseRequestCookies(req);
  return String(cookies[ADMIN_TOKEN_COOKIE_NAME] || '').trim();
}

function getAdminAuthToken(req) {
  return getBearerToken(req) || getAdminCookieToken(req);
}

function setAdminAuthCookie(res, token) {
  if (!token) return;
  const maxAgeSeconds = Math.floor(ADMIN_IDLE_TIMEOUT_MS / 1000);
  res.setHeader('Set-Cookie', `${ADMIN_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
}

function clearAdminAuthCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`);
}

function cleanupExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (now - session.lastActivityAt > ADMIN_IDLE_TIMEOUT_MS) {
      adminSessions.delete(token);
    }
  }
}

function touchAdminSession(token) {
  cleanupExpiredAdminSessions();
  const existing = adminSessions.get(token);
  if (!existing) return null;
  existing.lastActivityAt = Date.now();
  adminSessions.set(token, existing);
  return existing;
}

function createAdminSession(username, role = 'admin') {
  cleanupExpiredAdminSessions();
  const token = generateSessionToken();
  const now = Date.now();
  const session = {
    token,
    username,
    role: sanitizeAdminRole(role),
    createdAt: now,
    lastActivityAt: now
  };
  adminSessions.set(token, session);
  return session;
}

function dropAdminSession(token) {
  if (!token) return;
  adminSessions.delete(token);
}

function isPublicApiPath(pathname, method = 'GET') {
  if (!pathname.startsWith('/api/')) return true;
  if (pathname === '/api/health') return true;
  if (pathname === '/api/settings') return true;
  if (pathname === '/api/storage/policy' && method === 'GET') return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/api/player/')) return true;
  if (pathname === '/api/player/rotate-token' && method === 'POST') return true;
  if (pathname === '/api/player/context' && method === 'GET') return true;
  if (pathname === '/api/screens/bootstrap') return true;
  if (pathname === '/api/screens/register') return true;
  if (pathname === '/api/screens/heartbeat') return true;
  if (pathname === '/api/playlists' && method === 'GET') return true;
  if (pathname.startsWith('/api/assets/') && pathname.endsWith('/blob') && method === 'GET') return true;
  return false;
}

function notifySystemSyncUpdate(payload = {}) {
  const event = {
    type: 'sync',
    revision: Math.max(1, Number(payload.revision) || 0),
    at: typeof payload.at === 'string' ? payload.at : nowIso(),
    keys: Array.isArray(payload.keys) ? payload.keys : ['*']
  };

  const serialized = JSON.stringify(event);
  for (const [clientId, socket] of systemSyncClients.entries()) {
    try {
      if (socket.readyState === socket.OPEN) {
        socket.send(serialized);
      } else {
        systemSyncClients.delete(clientId);
      }
    } catch {
      systemSyncClients.delete(clientId);
    }
  }
}

function setupSystemSyncWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Store global reference for broadcasting
  global.systemWss = wss;

  server.on('upgrade', (req, socket, head) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (requestUrl.pathname !== '/ws/system-sync') {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID();
    systemSyncClients.set(clientId, ws);

    try {
      ws.send(JSON.stringify({
        type: 'connected',
        revision: systemSyncRevision,
        at: nowIso(),
        keys: []
      }));
    } catch {
      systemSyncClients.delete(clientId);
      ws.close();
      return;
    }

    ws.on('close', () => {
      systemSyncClients.delete(clientId);
    });

    ws.on('error', () => {
      systemSyncClients.delete(clientId);
    });
  });
}

function sanitizeLogType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (LOG_TYPES.has(raw)) return raw;
  return 'system';
}

function sanitizeLogLevel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (LOG_LEVELS.has(raw)) return raw;
  return 'info';
}

function parseLogs(raw) {
  return parseJsonObjectArray(raw)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      type: sanitizeLogType(item.type),
      level: sanitizeLogLevel(item.level),
      message: String(item.message || '').trim(),
      source: typeof item.source === 'string' ? item.source : 'system',
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : nowIso(),
      details: item.details && typeof item.details === 'object' ? item.details : {}
    }))
    .filter((item) => item.message.length > 0)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function createLogEntry(partial) {
  return {
    id: crypto.randomUUID(),
    type: sanitizeLogType(partial?.type),
    level: sanitizeLogLevel(partial?.level),
    message: String(partial?.message || '').trim(),
    source: String(partial?.source || 'system').trim() || 'system',
    timestamp: nowIso(),
    details: partial?.details && typeof partial.details === 'object' ? partial.details : {}
  };
}

function appendLogEntry(db, partial) {
  const entry = createLogEntry(partial);
  if (!entry.message) return null;
  const logs = parseLogs(db.kv[LOGS_KV_KEY]);
  logs.unshift(entry);
  setCollectionRecords(db, 'logs', logs.slice(0, MAX_LOG_ENTRIES));
  return entry;
}

function parseCollectionRecords(raw) {
  return parseJsonObjectArray(raw);
}

function parseCollectionMeta(raw) {
  const base = {
    version: 0,
    updatedAt: null,
    count: 0
  };
  if (typeof raw !== 'string' || !raw.trim()) return base;
  try {
    const parsed = JSON.parse(raw);
    return {
      version: Math.max(0, Number(parsed?.version) || 0),
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      count: Math.max(0, Number(parsed?.count) || 0)
    };
  } catch {
    return base;
  }
}

function writeCollection(db, recordsKey, metaKey, nextRecords) {
  const currentMeta = parseCollectionMeta(db.kv[metaKey]);
  const meta = {
    version: currentMeta.version + 1,
    updatedAt: nowIso(),
    count: nextRecords.length
  };

  const collectionName = KV_TO_COLLECTION_NAME[recordsKey];
  if (collectionName) {
    setCollectionRecords(db, collectionName, nextRecords);
  } else {
    db.kv[recordsKey] = JSON.stringify(nextRecords);
  }
  db.kv[metaKey] = JSON.stringify(meta);
  return meta;
}

function buildContentSecurityPolicy() {
  const frameSources = IFRAME_ALLOW_ALL_DOMAINS
    ? ["'self'", 'https:', 'http:']
    : [
      "'self'",
      ...IFRAME_DOMAIN_WHITELIST.flatMap((domain) => [`https://${domain}`, `https://*.${domain}`])
    ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    "connect-src 'self' ws: wss: http: https:",
    `frame-src ${frameSources.join(' ')}`
  ].join('; ');
}

function buildLogMeta(req, extra = {}) {
  return {
    ip: getAdvertisedClientIp(req),
    ua: String(req.headers['user-agent'] || ''),
    ...extra
  };
}

function generatePin() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createCommandSignature({ screenId, command, issuedAt, deviceToken }) {
  const payload = `${screenId}|${command}|${issuedAt}`;
  return crypto
    .createHmac('sha256', `${COMMAND_SIGNATURE_SECRET}:${String(deviceToken || '')}`)
    .update(payload)
    .digest('hex');
}

function sanitizeAdminRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ADMIN_ROLES.has(role) ? role : 'viewer';
}

function sanitizeAdminUserForResponse(user) {
  return {
    username: user.username,
    role: sanitizeAdminRole(user.role),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    passwordAlgo: user.passwordAlgo || 'scrypt'
  };
}

function countAdmins(users) {
  return users.filter((user) => sanitizeAdminRole(user.role) === 'admin').length;
}

function isAllowedInMode(mode, pathname) {
  const path = String(pathname || '').trim();
  if (!path || !path.startsWith('/api/')) return true;
  if (mode === 'unified') return true;

  if (mode === 'player') {
    return (
      path === '/api/health'
      || path === '/api/settings'
      || path.startsWith('/api/player/')
      || path === '/api/screens/bootstrap'
      || path === '/api/screens/pair/claim'
      || path.startsWith('/api/assets/')
      || path === '/api/storage/stats'
      || path === '/api/storage/policy'
    );
  }

  if (mode === 'panel') {
    return !path.startsWith('/api/player/');
  }

  return true;
}

function normalizeClientAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//i, '').trim();
  const withoutPath = withoutProtocol.split('/')[0].trim();
  const withoutIpv6Brackets = withoutPath.replace(/^\[/, '').replace(/\]$/, '');
  if (withoutIpv6Brackets.includes(':') && withoutIpv6Brackets.split(':').length === 2) {
    return withoutIpv6Brackets.split(':')[0].trim();
  }
  return withoutIpv6Brackets.trim();
}

function getClientIp(req) {
  if (req.headers['x-forwarded-for']) {
    return normalizeClientAddress(String(req.headers['x-forwarded-for']).split(',')[0].trim());
  }
  const raw = String(req.ip || '').trim();
  const normalized = raw === '::1' ? '127.0.0.1' : raw.replace('::ffff:', '');
  return normalizeClientAddress(normalized);
}

function getAdvertisedClientIp(req) {
  const bodyIp = normalizeClientAddress(String(req.body?.clientIp || req.body?.ip || '').trim());
  const queryIp = normalizeClientAddress(String(req.query?.clientIp || req.query?.ip || '').trim());
  return bodyIp || queryIp || getClientIp(req);
}

function isExpired(iso) {
  const time = new Date(String(iso || '')).getTime();
  if (Number.isNaN(time)) return true;
  return time < Date.now();
}

function upsertScreenEntry(screens, payload) {
  const now = new Date().toISOString();
  const idx = screens.findIndex((item) => item.deviceId === payload.deviceId || item.deviceToken === payload.token);

  if (idx >= 0) {
    const existing = screens[idx];
    const next = {
      ...existing,
      name: payload.devname || existing.name,
      hostname: payload.hostname || existing.hostname || payload.devname,
      ip: payload.ip || existing.ip || 'N/A',
      resolution: payload.resolution || existing.resolution || '1920x1080',
      os: (payload.os || existing.os || 'Inconnu').trim(),
      deviceId: payload.deviceId || existing.deviceId,
      deviceToken: payload.token || existing.deviceToken,
      lastHeartbeat: now,
      status: existing.status === 'pending' ? 'pending' : existing.status || 'pending'
    };
    const copy = [...screens];
    copy[idx] = next;
    return copy;
  }

  return [
    ...screens,
    {
      id: `screen-${Date.now()}`,
      deviceId: payload.deviceId,
      name: payload.devname || payload.deviceId,
      hostname: payload.hostname || payload.devname || payload.deviceId,
      ip: payload.ip || 'N/A',
      resolution: payload.resolution || '1920x1080',
      os: (payload.os || 'Inconnu').trim(),
      status: 'pending',
      roomIds: [],
      groupId: undefined,
      theme: {
        mode: 'inherit-group',
        primaryColor: '#8dc63f',
        lightStart: '07:00',
        darkStart: '19:00'
      },
      deviceToken: payload.token,
      lastHeartbeat: now
    }
  ];
}

async function ensureSystemStorage() {
  await fsp.mkdir(DB_DIR, { recursive: true });
  await fsp.mkdir(ASSETS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    await fsp.writeFile(DB_PATH, JSON.stringify({ kv: {}, assets: [] }, null, 2), 'utf-8');
  }
}

let sqliteDb = null;

function getSqliteDb() {
  if (!BetterSqlite3) return null;
  if (sqliteDb) return sqliteDb;

  sqliteDb = new BetterSqlite3(SQLITE_DB_PATH);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqliteDb;
}

function closeSqliteDb() {
  if (!sqliteDb) return;
  try {
    sqliteDb.close();
  } catch {
    // ignore
  }
  sqliteDb = null;
}

function readSqliteState() {
  const db = getSqliteDb();
  if (!db) return null;
  try {
    const row = db.prepare('SELECT payload FROM system_state WHERE id = 1').get();
    if (!row || typeof row.payload !== 'string') return null;
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

function writeSqliteState(payload) {
  const db = getSqliteDb();
  if (!db) return false;

  try {
    const serialized = JSON.stringify(payload);
    const run = db.transaction((input) => {
      db.prepare(`
        INSERT INTO system_state (id, payload, updated_at)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `).run(input, nowIso());
    });

    run(serialized);
    return true;
  } catch {
    return false;
  }
}

function normalizeDbShape(parsed) {
  const legacyKv = parsed?.kv && typeof parsed.kv === 'object' ? parsed.kv : {};
  const legacyCollections = parsed?.collections && typeof parsed.collections === 'object'
    ? parsed.collections
    : {};

  const collections = {};
  for (const collectionName of KNOWN_COLLECTIONS) {
    const kvKey = COLLECTION_TO_KV_KEY[collectionName];
    const fromCollection = Array.isArray(legacyCollections?.[collectionName]) ? legacyCollections[collectionName] : [];
    const fromKv = parseJsonObjectArray(legacyKv[kvKey]);
    collections[collectionName] = fromCollection.length > 0 ? fromCollection : fromKv;
  }

  if ((!collections.layers || collections.layers.length === 0) && Array.isArray(collections.layouts)) {
    collections.layers = [...collections.layouts];
  }

  const account = parseAdminAccount(legacyKv[ADMIN_ACCOUNT_KV_KEY]);
  const usersFromKv = parseAdminUsers(legacyKv[ADMIN_USERS_KV_KEY]);
  const users = Array.isArray(parsed?.users) && parsed.users.length > 0
    ? parsed.users
    : (usersFromKv.length > 0
      ? usersFromKv
      : (account ? [account] : []));

  const config = parsed?.config && typeof parsed.config === 'object'
    ? parsed.config
    : parseJsonObject(legacyKv[SYSTEM_SETTINGS_KV_KEY], {});

  const kv = {
    ...legacyKv,
    [ADMIN_USERS_KV_KEY]: JSON.stringify(users),
    [SYSTEM_SETTINGS_KV_KEY]: JSON.stringify(config)
  };

  for (const [kvKey, collectionName] of Object.entries(KV_TO_COLLECTION_NAME)) {
    kv[kvKey] = JSON.stringify(collections[collectionName] || []);
  }

  for (const key of DEFAULT_EMPTY_ARRAY_KEYS) {
    if (typeof kv[key] !== 'string') {
      kv[key] = '[]';
    }
  }

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    kv,
    collections,
    users,
    config,
    assets: Array.isArray(parsed?.assets) ? parsed.assets : []
  };
}

function getCollectionRecords(db, collectionName) {
  if (!db.collections || typeof db.collections !== 'object') {
    db.collections = {};
  }

  if (!Array.isArray(db.collections[collectionName])) {
    const kvKey = COLLECTION_TO_KV_KEY[collectionName];
    db.collections[collectionName] = kvKey
      ? parseJsonObjectArray(db.kv?.[kvKey])
      : [];
  }

  return db.collections[collectionName];
}

function setCollectionRecords(db, collectionName, records) {
  const safeRecords = Array.isArray(records) ? records : [];
  if (!db.collections || typeof db.collections !== 'object') {
    db.collections = {};
  }
  db.collections[collectionName] = safeRecords;

  const kvKey = COLLECTION_TO_KV_KEY[collectionName];
  if (kvKey) {
    db.kv[kvKey] = JSON.stringify(safeRecords);
  }

  if (collectionName === 'layouts') {
    db.collections.layers = [...safeRecords];
    db.kv[LAYERS_KV_KEY] = JSON.stringify(safeRecords);
  }
}

function getSystemConfig(db) {
  if (!db.config || typeof db.config !== 'object') {
    db.config = parseJsonObject(db.kv?.[SYSTEM_SETTINGS_KV_KEY], {});
  }
  return db.config;
}

function setSystemConfig(db, config) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  db.config = safeConfig;
  db.kv[SYSTEM_SETTINGS_KV_KEY] = JSON.stringify(safeConfig);
}

function getStoragePolicy(db) {
  const raw = parseJsonObject(db.kv?.[STORAGE_POLICY_KV_KEY], {});
  return {
    ...DEFAULT_STORAGE_POLICY,
    ...(raw && typeof raw === 'object' ? raw : {})
  };
}

function setStoragePolicy(db, policy) {
  const next = {
    ...DEFAULT_STORAGE_POLICY,
    ...(policy && typeof policy === 'object' ? policy : {})
  };

  next.maxAssetBytes = Math.max(128 * 1024 * 1024, Number(next.maxAssetBytes) || DEFAULT_STORAGE_POLICY.maxAssetBytes);
  next.maxCacheBytes = Math.max(64 * 1024 * 1024, Number(next.maxCacheBytes) || DEFAULT_STORAGE_POLICY.maxCacheBytes);
  next.logsRetentionDays = Math.max(1, Math.min(365, Number(next.logsRetentionDays) || DEFAULT_STORAGE_POLICY.logsRetentionDays));
  next.staleHeartbeatSeconds = Math.max(15, Math.min(900, Number(next.staleHeartbeatSeconds) || DEFAULT_STORAGE_POLICY.staleHeartbeatSeconds));
  next.autoPurge = Boolean(next.autoPurge);

  db.kv[STORAGE_POLICY_KV_KEY] = JSON.stringify(next);
  return next;
}

function getAlertsPolicy(db) {
  const raw = parseJsonObject(db.kv?.[ALERTS_POLICY_KV_KEY], {});
  return {
    ...DEFAULT_ALERTS_POLICY,
    ...(raw && typeof raw === 'object' ? raw : {})
  };
}

function setAlertsPolicy(db, policy) {
  const next = {
    ...DEFAULT_ALERTS_POLICY,
    ...(policy && typeof policy === 'object' ? policy : {})
  };

  next.offlineAfterSeconds = Math.max(30, Math.min(3600, Number(next.offlineAfterSeconds) || DEFAULT_ALERTS_POLICY.offlineAfterSeconds));
  next.staleAfterSeconds = Math.max(15, Math.min(1800, Number(next.staleAfterSeconds) || DEFAULT_ALERTS_POLICY.staleAfterSeconds));
  next.maxTemperatureC = Math.max(35, Math.min(120, Number(next.maxTemperatureC) || DEFAULT_ALERTS_POLICY.maxTemperatureC));
  next.maxStorageUsagePercent = Math.max(50, Math.min(99, Number(next.maxStorageUsagePercent) || DEFAULT_ALERTS_POLICY.maxStorageUsagePercent));
  next.maxHeartbeatLatencyMs = Math.max(1000, Math.min(300000, Number(next.maxHeartbeatLatencyMs) || DEFAULT_ALERTS_POLICY.maxHeartbeatLatencyMs));

  db.kv[ALERTS_POLICY_KV_KEY] = JSON.stringify(next);
  return next;
}

function getAlertsState(db) {
  const raw = parseJsonObject(db.kv?.[ALERTS_STATE_KV_KEY], {});
  const state = {};

  for (const [alertId, item] of Object.entries(raw || {})) {
    if (!alertId || !item || typeof item !== 'object') continue;
    const status = String(item.status || '').trim().toLowerCase();
    state[alertId] = {
      id: String(item.id || alertId).trim(),
      type: String(item.type || '').trim(),
      severity: String(item.severity || '').trim(),
      message: String(item.message || '').trim(),
      screenId: String(item.screenId || '').trim(),
      status: ['new', 'ack', 'silenced', 'resolved'].includes(status) ? status : 'new',
      firstSeenAt: String(item.firstSeenAt || '').trim(),
      lastSeenAt: String(item.lastSeenAt || '').trim(),
      updatedAt: String(item.updatedAt || '').trim(),
      ackedAt: String(item.ackedAt || '').trim(),
      silencedUntil: String(item.silencedUntil || '').trim(),
      resolvedAt: String(item.resolvedAt || '').trim(),
      at: String(item.at || '').trim()
    };
  }

  return state;
}

function setAlertsState(db, state) {
  db.kv[ALERTS_STATE_KV_KEY] = JSON.stringify(state && typeof state === 'object' ? state : {});
}

function computeActiveAlerts(db, config, fleet, nowIsoTs, cacheSize = 0) {
  const totalSize = db.assets.reduce((acc, item) => acc + (Number(item.size) || 0), 0);
  const maxStorage = Math.max(1, Number(getStoragePolicy(db).maxAssetBytes || 1));
  const storageUsagePercent = Math.round(((totalSize + cacheSize) / maxStorage) * 100);
  const alerts = [];

  fleet.items.forEach((item) => {
    if (item.heartbeatAgeMs !== null && item.heartbeatAgeMs > config.offlineAfterSeconds * 1000) {
      alerts.push({
        id: `offline-${item.id}`,
        severity: 'critical',
        type: 'offline',
        message: `${item.name} hors ligne (${Math.round(item.heartbeatAgeMs / 1000)}s)`,
        screenId: item.id,
        at: nowIsoTs
      });
    } else if (item.heartbeatAgeMs !== null && item.heartbeatAgeMs > config.staleAfterSeconds * 1000) {
      alerts.push({
        id: `stale-${item.id}`,
        severity: 'warning',
        type: 'stale',
        message: `${item.name} en retard heartbeat (${Math.round(item.heartbeatAgeMs / 1000)}s)`,
        screenId: item.id,
        at: nowIsoTs
      });
    }

    if (item.telemetry.temperatureC > 0 && item.telemetry.temperatureC >= config.maxTemperatureC) {
      alerts.push({
        id: `temp-${item.id}`,
        severity: 'warning',
        type: 'temperature',
        message: `${item.name} température élevée (${item.telemetry.temperatureC.toFixed(1)}°C)`,
        screenId: item.id,
        at: nowIsoTs
      });
    }

    if (item.telemetry.diskUsedPercent > 0 && item.telemetry.diskUsedPercent >= config.maxStorageUsagePercent) {
      alerts.push({
        id: `disk-${item.id}`,
        severity: 'warning',
        type: 'disk',
        message: `${item.name} stockage local élevé (${item.telemetry.diskUsedPercent.toFixed(0)}%)`,
        screenId: item.id,
        at: nowIsoTs
      });
    }
  });

  if (storageUsagePercent >= config.maxStorageUsagePercent) {
    alerts.push({
      id: 'storage-system',
      severity: storageUsagePercent >= 95 ? 'critical' : 'warning',
      type: 'storage',
      message: `Stockage système élevé (${storageUsagePercent}%)`,
      at: nowIsoTs
    });
  }

  return alerts;
}

function reconcileAlertsState(db, activeAlerts, nowIsoTs) {
  const previousState = getAlertsState(db);
  const nextState = { ...previousState };
  const activeIds = new Set();
  const nowTs = Date.now();

  for (const alert of activeAlerts) {
    if (!alert?.id) continue;
    const alertId = String(alert.id).trim();
    if (!alertId) continue;
    activeIds.add(alertId);
    const prev = previousState[alertId] || null;

    let nextStatus = 'new';
    let ackedAt = '';
    let silencedUntil = '';

    if (prev && prev.status === 'ack') {
      nextStatus = 'ack';
      ackedAt = String(prev.ackedAt || '').trim();
    } else if (prev && prev.status === 'silenced') {
      const until = String(prev.silencedUntil || '').trim();
      const untilTs = until ? new Date(until).getTime() : 0;
      if (untilTs && Number.isFinite(untilTs) && untilTs > nowTs) {
        nextStatus = 'silenced';
        silencedUntil = until;
      }
    }

    nextState[alertId] = {
      id: alertId,
      type: String(alert.type || '').trim(),
      severity: String(alert.severity || '').trim(),
      message: String(alert.message || '').trim(),
      screenId: String(alert.screenId || '').trim(),
      status: nextStatus,
      firstSeenAt: String(prev?.firstSeenAt || nowIsoTs).trim(),
      lastSeenAt: nowIsoTs,
      updatedAt: nowIsoTs,
      ackedAt,
      silencedUntil,
      resolvedAt: '',
      at: String(alert.at || nowIsoTs).trim()
    };
  }

  for (const [alertId, prev] of Object.entries(previousState)) {
    if (activeIds.has(alertId)) continue;
    if (String(prev?.status || '') === 'resolved') continue;
    nextState[alertId] = {
      ...prev,
      status: 'resolved',
      resolvedAt: nowIsoTs,
      updatedAt: nowIsoTs
    };
  }

  setAlertsState(db, nextState);
  return nextState;
}

async function calculateCacheSizeBytes() {
  const cacheDir = path.join(STORAGE_DIR, 'cache');
  let cacheSize = 0;
  try {
    const entries = await fsp.readdir(cacheDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(cacheDir, entry.name);
      if (entry.isFile()) {
        const stats = await fsp.stat(fullPath);
        cacheSize += stats.size;
      }
    }
  } catch {
    cacheSize = 0;
  }
  return cacheSize;
}

async function resolveSystemDiskCapacityBytes(targetPath) {
  const fallbackTotalBytes = 20 * 1024 * 1024 * 1024;

  try {
    if (typeof fsp.statfs === 'function') {
      const stats = await fsp.statfs(targetPath);
      const blockSize = Number(stats?.bsize || stats?.frsize || 0);
      const blocks = Number(stats?.blocks || 0);
      const availableBlocks = Number(stats?.bavail ?? stats?.bfree ?? 0);

      if (Number.isFinite(blockSize) && Number.isFinite(blocks) && blockSize > 0 && blocks > 0) {
        const totalBytes = Math.max(0, blockSize * blocks);
        const freeBytes = Math.max(0, blockSize * Math.max(0, availableBlocks));
        const usedBytes = Math.max(0, totalBytes - freeBytes);
        return {
          totalBytes,
          usedBytes,
          source: 'statfs'
        };
      }
    }
  } catch {
    // fallback below
  }

  return {
    totalBytes: fallbackTotalBytes,
    usedBytes: 0,
    source: 'fallback-20gb'
  };
}

function buildFleetSnapshot(db, now = Date.now()) {
  const screens = getCollectionRecords(db, 'screens');
  const policy = getStoragePolicy(db);
  const staleAfterMs = Math.max(15000, Number(policy.staleHeartbeatSeconds || 90) * 1000);

  const items = screens.map((screen) => {
    const lastHeartbeatTs = new Date(screen.lastHeartbeat || 0).getTime();
    const heartbeatAgeMs = Number.isFinite(lastHeartbeatTs) ? Math.max(0, now - lastHeartbeatTs) : null;
    const computedStatus = heartbeatAgeMs !== null && heartbeatAgeMs > staleAfterMs
      ? 'stale'
      : (screen.status || 'offline');

    return {
      id: screen.id,
      name: screen.name || screen.deviceId || screen.id,
      deviceId: screen.deviceId || '',
      status: computedStatus,
      lastHeartbeat: screen.lastHeartbeat || null,
      heartbeatAgeMs,
      telemetry: {
        cpuPercent: Number(screen.cpuPercent || 0) || 0,
        memoryPercent: Number(screen.memoryPercent || 0) || 0,
        temperatureC: Number(screen.temperatureC || 0) || 0,
        diskUsedPercent: Number(screen.diskUsedPercent || 0) || 0,
        version: String(screen.playerVersion || '')
      }
    };
  });

  const online = items.filter((item) => item.status === 'online').length;
  const stale = items.filter((item) => item.status === 'stale').length;
  const pending = items.filter((item) => item.status === 'pending').length;

  return {
    items,
    summary: {
      total: items.length,
      online,
      stale,
      pending,
      offline: Math.max(0, items.length - online - stale - pending)
    }
  };
}

function queueScreenCommand(db, screen, command) {
  const issuedAt = nowIso();
  const signature = createCommandSignature({
    screenId: screen.id,
    command,
    issuedAt,
    deviceToken: screen?.deviceToken || ''
  });

  return {
    id: crypto.randomUUID(),
    command,
    issuedAt,
    signature,
    retries: 0,
    maxRetries: COMMAND_MAX_RETRIES,
    lastSentAt: '',
    ackedAt: ''
  };
}

function findPairedScreenIndex(screens, deviceId, token) {
  const safeDeviceId = String(deviceId || '').trim();
  const safeToken = String(token || '').trim();
  if (!safeDeviceId || !safeToken) return -1;
  return screens.findIndex((item) => item.deviceId === safeDeviceId && item.deviceToken === safeToken);
}

async function readDb() {
  await ensureSystemStorage();

  const sqlitePayload = readSqliteState();
  if (sqlitePayload && typeof sqlitePayload === 'object') {
    return normalizeDbShape(sqlitePayload);
  }

  try {
    const raw = await fsp.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeDbShape(parsed);
    writeSqliteState(normalized);
    await fsp.writeFile(DB_BACKUP_PATH, JSON.stringify(normalized, null, 2), 'utf-8').catch(() => undefined);
    return normalized;
  } catch {
    try {
      const backupRaw = await fsp.readFile(DB_BACKUP_PATH, 'utf-8');
      const parsedBackup = JSON.parse(backupRaw);
      const normalizedBackup = normalizeDbShape(parsedBackup);
      writeSqliteState(normalizedBackup);
      await fsp.writeFile(DB_PATH, JSON.stringify(normalizedBackup, null, 2), 'utf-8');
      return normalizedBackup;
    } catch {
      const emptyDb = { kv: {}, assets: [] };
      const normalizedEmpty = normalizeDbShape(emptyDb);
      writeSqliteState(normalizedEmpty);
      await fsp.writeFile(DB_PATH, JSON.stringify(emptyDb, null, 2), 'utf-8');
      await fsp.writeFile(DB_BACKUP_PATH, JSON.stringify(emptyDb, null, 2), 'utf-8').catch(() => undefined);
      return normalizedEmpty;
    }
  }
}

async function writeDb(data) {
  const normalizedData = normalizeDbShape(data);
  const serialized = JSON.stringify(normalizedData, null, 2);

  const runWrite = async () => {
    await ensureSystemStorage();

    const sqliteWritten = writeSqliteState(normalizedData);

    const uniqueTempPath = `${DB_TEMP_PATH}.${process.pid}.${Date.now()}.${Math.floor(Math.random() * 100000)}`;
    await fsp.writeFile(uniqueTempPath, serialized, 'utf-8');

    let wroteMainDb = false;
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await fsp.rename(uniqueTempPath, DB_PATH);
        wroteMainDb = true;
        break;
      } catch (error) {
        const code = String(error?.code || '');
        lastError = error;
        if (!RETRYABLE_FS_ERROR_CODES.has(code)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
      }
    }

    if (!wroteMainDb) {
      try {
        await fsp.copyFile(uniqueTempPath, DB_PATH);
        wroteMainDb = true;
      } catch (copyError) {
        if (lastError) {
          throw lastError;
        }
        throw copyError;
      }
    }

    await fsp.unlink(uniqueTempPath).catch(() => undefined);
    await fsp.writeFile(DB_BACKUP_PATH, serialized, 'utf-8').catch(() => undefined);

    if (sqliteWritten) {
      await fsp.unlink(LEGACY_DB_PATH).catch(() => undefined);
    }

    systemSyncRevision += 1;
    notifySystemSyncUpdate({
      revision: systemSyncRevision,
      at: nowIso(),
      keys: ['*']
    });
  };

  const queuedWrite = writeDbQueue.then(runWrite);
  writeDbQueue = queuedWrite.catch(() => undefined);
  return queuedWrite;
}

async function loadScreensFromDb() {
  const db = await readDb();
  return getCollectionRecords(db, 'screens');
}

async function loadLayoutsFromDb() {
  const db = await readDb();
  return getCollectionRecords(db, 'layouts');
}

async function loadRoomsFromDb() {
  const db = await readDb();
  return getCollectionRecords(db, 'rooms');
}

async function loadEventsFromDb() {
  const db = await readDb();
  return getCollectionRecords(db, 'events');
}

async function loadScreenGroupsFromDb() {
  const db = await readDb();
  return getCollectionRecords(db, 'screenGroups');
}

function sanitizeScreenForResponse(screen) {
  if (!screen) return null;
  return {
    ...screen,
    roomIds: Array.isArray(screen.roomIds) ? screen.roomIds : [],
    status: screen.status || 'offline'
  };
}

function buildRecentActivity(screens, assets) {
  const activities = [];

  screens
    .slice()
    .sort((a, b) => new Date(b.lastHeartbeat || 0).getTime() - new Date(a.lastHeartbeat || 0).getTime())
    .slice(0, 6)
    .forEach((screen, index) => {
      activities.push({
        id: `screen-${screen.id || index}`,
        icon: 'monitor',
        message: `${screen.name || screen.deviceId} • ${screen.status || 'offline'}`,
        time: screen.lastHeartbeat ? new Date(screen.lastHeartbeat).toLocaleString('fr-FR') : '—'
      });
    });

  assets
    .slice()
    .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime())
    .slice(0, Math.max(0, 6 - activities.length))
    .forEach((asset, index) => {
      activities.push({
        id: `asset-${asset.id || index}`,
        icon: 'folder-open',
        message: `Asset ajouté: ${asset.originalFileName || asset.name}`,
        time: asset.uploadedAt ? new Date(asset.uploadedAt).toLocaleString('fr-FR') : '—'
      });
    });

  return activities;
}

function buildUpcomingMeetings(events, rooms) {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const now = Date.now();
  return events
    .filter((event) => {
      const start = new Date(event.startAt || event.start || 0).getTime();
      return !Number.isNaN(start) && start >= now;
    })
    .sort((a, b) => new Date(a.startAt || a.start || 0).getTime() - new Date(b.startAt || b.start || 0).getTime())
    .slice(0, 8)
    .map((event, index) => {
      const startValue = event.startAt || event.start;
      const start = new Date(startValue);
      const diffMinutes = Math.round((start.getTime() - now) / 60000);
      const room = roomMap.get(event.roomId);
      return {
        id: event.id || `meeting-${index}`,
        title: event.title || 'Réunion',
        time: Number.isNaN(start.getTime()) ? '—' : start.toLocaleString('fr-FR'),
        room: room ? `${room.name || ''} ${room.number ? `(${room.number})` : ''}`.trim() : (event.roomNumber || 'Salle inconnue'),
        status: diffMinutes <= 15 ? 'starting-soon' : 'scheduled'
      };
    });
}

function inferAssetType(mimeType, extension) {
  const mime = String(mimeType || '').toLowerCase();
  const ext = String(extension || '').toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'ogg'].includes(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime === 'text/html' || ext === 'html' || ext === 'htm') return 'html';
  if (mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext)) return 'document';
  return 'other';
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensureSystemStorage();
      cb(null, ASSETS_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const fileId = crypto.randomUUID();
    cb(null, `${fileId}${ext}`);
  }
});

const upload = multer({ storage });

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const requestOrigin = String(req.headers.origin || '').trim();
  const allowOrigin = resolveCorsOrigin(requestOrigin);

  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy());
  next();
});

app.use((req, res, next) => {
  if (isAllowedInMode(SERVER_MODE, req.path)) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    error: `route not available in server mode: ${SERVER_MODE}`
  });
});

app.use((req, res, next) => {
  if (isPublicApiPath(req.path, req.method)) {
    return next();
  }

  const token = getAdminAuthToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing token' });
  }

  const session = touchAdminSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'session expired' });
  }

  req.adminSession = {
    token,
    username: session.username,
    role: sanitizeAdminRole(session.role),
    lastActivityAt: session.lastActivityAt
  };

  return next();
});

// --- API publique: santé et configuration runtime ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, storage: 'system' });
});

app.get('/api/settings', (_req, res) => {
  readDb().then((db) => {
    res.json({
      ok: true,
      storage: 'system',
      apiOnly: API_ONLY,
      port: PORT,
      schemaVersion: DB_SCHEMA_VERSION,
      iframeAllowAllDomains: IFRAME_ALLOW_ALL_DOMAINS,
      iframeDomainWhitelist: IFRAME_DOMAIN_WHITELIST,
      iframeOptimizedDomains: IFRAME_OPTIMIZED_DOMAINS,
      systemConfig: getSystemConfig(db)
    });
  }).catch(() => {
    res.json({
      ok: true,
      storage: 'system',
      apiOnly: API_ONLY,
      port: PORT,
      schemaVersion: DB_SCHEMA_VERSION,
      iframeAllowAllDomains: IFRAME_ALLOW_ALL_DOMAINS,
      iframeDomainWhitelist: IFRAME_DOMAIN_WHITELIST,
      iframeOptimizedDomains: IFRAME_OPTIMIZED_DOMAINS,
      systemConfig: {}
    });
  });
});

app.get('/api/system/sync-stream', (_req, res) => {
  return res.status(410).json({
    ok: false,
    error: 'SSE retiré. Utiliser WebSocket /ws/system-sync.'
  });
});

// --- Authentification admin: bootstrap, login, session, gestion des utilisateurs ---

app.get('/api/auth/status', async (_req, res) => {
  const db = await readDb();
  const account = parseAdminAccount(db.kv[ADMIN_ACCOUNT_KV_KEY]);
  res.json({
    configured: Boolean(account),
    idleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS
  });
});

app.post('/api/auth/bootstrap', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');

  if (!username || !isStrongPassword(password)) {
    return res.status(400).json({ ok: false, error: 'username requis et mot de passe fort (8+ avec minuscule + majuscule)' });
  }

  const db = await readDb();
  const existing = parseAdminAccount(db.kv[ADMIN_ACCOUNT_KV_KEY]);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'Compte admin déjà configuré' });
  }

  const account = createAdminAccount(username, password);
  db.kv[ADMIN_ACCOUNT_KV_KEY] = JSON.stringify(account);
  const users = upsertAdminUserRecord(parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]), account);
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(users);
  db.users = users;
  appendLogEntry(db, {
    type: 'auth',
    level: 'info',
    source: 'api.auth.bootstrap',
    message: 'Compte admin initialisé',
    details: buildLogMeta(req, { username })
  });
  await writeDb(db);
  await syncLegacyUsersDb(users);

  return res.status(201).json({ ok: true, username: account.username });
});

app.post('/api/auth/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Identifiants requis' });
  }

  const db = await readDb();
  const account = parseAdminAccount(db.kv[ADMIN_ACCOUNT_KV_KEY]);
  const users = parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);

  const candidates = users.length > 0
    ? users
    : (account ? [account] : []);

  if (candidates.length === 0) {
    return res.status(503).json({ ok: false, error: 'Compte admin non configuré' });
  }

  const matched = candidates.find((item) => item.username === username) || null;
  const validPassword = matched ? verifyPassword(password, matched.passwordHash) : false;
  if (!matched || !validPassword) {
    appendLogEntry(db, {
      type: 'auth',
      level: 'warning',
      source: 'api.auth.login',
      message: 'Échec de connexion admin',
      details: buildLogMeta(req, { username })
    });
    await writeDb(db);
    return res.status(401).json({ ok: false, error: 'Identifiants invalides' });
  }

  const loginAt = nowIso();
  const session = createAdminSession(matched.username, matched.role || 'admin');
  const nextUsers = upsertAdminUserRecord(candidates, {
    ...matched,
    updatedAt: loginAt
  }, loginAt);
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(nextUsers);
  db.users = nextUsers;
  if (!account || account.username === matched.username) {
    db.kv[ADMIN_ACCOUNT_KV_KEY] = JSON.stringify({
      ...matched,
      updatedAt: loginAt
    });
  }
  appendLogEntry(db, {
    type: 'auth',
    level: 'info',
    source: 'api.auth.login',
    message: 'Connexion admin réussie',
    details: buildLogMeta(req, { username: matched.username })
  });
  await writeDb(db);
  await syncLegacyUsersDb(nextUsers);

  setAdminAuthCookie(res, session.token);

  return res.json({
    ok: true,
    token: session.token,
    username: matched.username,
    role: sanitizeAdminRole(matched.role),
    idleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS,
    lastActivityAt: session.lastActivityAt
  });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = getAdminAuthToken(req);
  if (token) {
    dropAdminSession(token);
  }

  const db = await readDb();
  appendLogEntry(db, {
    type: 'auth',
    level: 'info',
    source: 'api.auth.logout',
    message: 'Déconnexion admin',
    details: buildLogMeta(req)
  });
  await writeDb(db);

  clearAdminAuthCookie(res);

  return res.json({ ok: true });
});

app.get('/api/auth/session', async (req, res) => {
  const token = getAdminAuthToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing token' });
  }

  const session = touchAdminSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'session expired' });
  }

  return res.json({
    ok: true,
    username: session.username,
    role: sanitizeAdminRole(session.role),
    idleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS,
    lastActivityAt: session.lastActivityAt
  });
});

app.get('/api/auth/users', async (req, res) => {
  if (sanitizeAdminRole(req.adminSession?.role) !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin role required' });
  }

  const db = await readDb();
  const users = parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);
  return res.json({
    ok: true,
    users: users.map(sanitizeAdminUserForResponse)
  });
});

app.post('/api/auth/users', async (req, res) => {
  if (sanitizeAdminRole(req.adminSession?.role) !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin role required' });
  }

  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const role = sanitizeAdminRole(req.body?.role || 'viewer');

  if (!username || !isStrongPassword(password)) {
    return res.status(400).json({ ok: false, error: 'username requis et mot de passe fort (8+ avec minuscule + majuscule)' });
  }

  const db = await readDb();
  const users = parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);
  if (users.some((item) => item.username === username)) {
    return res.status(409).json({ ok: false, error: 'username déjà utilisé' });
  }

  const now = nowIso();
  const created = createAdminAccount(username, password);
  const nextUsers = upsertAdminUserRecord(users, {
    ...created,
    role,
    createdAt: now,
    updatedAt: now
  });

  db.users = nextUsers;
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(nextUsers);
  appendLogEntry(db, {
    type: 'auth',
    level: 'info',
    source: 'api.auth.users.create',
    message: 'Utilisateur admin créé',
    details: buildLogMeta(req, { username, role })
  });
  await writeDb(db);
  await syncLegacyUsersDb(nextUsers);

  const createdUser = nextUsers.find((item) => item.username === username);
  return res.status(201).json({ ok: true, user: createdUser ? sanitizeAdminUserForResponse(createdUser) : null });
});

app.put('/api/auth/users/:username', async (req, res) => {
  if (sanitizeAdminRole(req.adminSession?.role) !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin role required' });
  }

  const username = normalizeUsername(req.params?.username);
  const nextRoleRaw = req.body?.role;
  const nextPassword = String(req.body?.password || '');
  const hasRole = typeof nextRoleRaw === 'string' && nextRoleRaw.trim().length > 0;
  const hasPassword = nextPassword.length > 0;

  if (!username || (!hasRole && !hasPassword)) {
    return res.status(400).json({ ok: false, error: 'username et au moins un champ à mettre à jour requis' });
  }

  if (hasPassword && !isStrongPassword(nextPassword)) {
    return res.status(400).json({ ok: false, error: 'mot de passe fort requis (8+ avec minuscule + majuscule)' });
  }

  const db = await readDb();
  const users = parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);
  const idx = users.findIndex((item) => item.username === username);
  if (idx < 0) {
    return res.status(404).json({ ok: false, error: 'user not found' });
  }

  const current = users[idx];
  const nextRole = hasRole ? sanitizeAdminRole(nextRoleRaw) : sanitizeAdminRole(current.role);

  if (sanitizeAdminRole(current.role) === 'admin' && nextRole !== 'admin' && countAdmins(users) <= 1) {
    return res.status(409).json({ ok: false, error: 'au moins un admin doit rester actif' });
  }

  let passwordHash = current.passwordHash;
  let passwordAlgo = current.passwordAlgo || 'scrypt';
  if (hasPassword) {
    const updatedAccount = createAdminAccount(current.username, nextPassword);
    passwordHash = updatedAccount.passwordHash;
    passwordAlgo = updatedAccount.passwordAlgo || 'scrypt';
  }

  users[idx] = {
    ...current,
    role: nextRole,
    passwordHash,
    passwordAlgo,
    updatedAt: nowIso()
  };

  db.users = users;
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(users);
  appendLogEntry(db, {
    type: 'auth',
    level: 'info',
    source: 'api.auth.users.update',
    message: 'Utilisateur admin mis à jour',
    details: buildLogMeta(req, { username, role: nextRole, passwordUpdated: hasPassword })
  });
  await writeDb(db);
  await syncLegacyUsersDb(users);

  return res.json({ ok: true, user: sanitizeAdminUserForResponse(users[idx]) });
});

app.delete('/api/auth/users/:username', async (req, res) => {
  if (sanitizeAdminRole(req.adminSession?.role) !== 'admin') {
    return res.status(403).json({ ok: false, error: 'admin role required' });
  }

  const username = normalizeUsername(req.params?.username);
  if (!username) {
    return res.status(400).json({ ok: false, error: 'username requis' });
  }

  if (req.adminSession?.username === username) {
    return res.status(409).json({ ok: false, error: 'suppression de son propre compte interdite' });
  }

  const db = await readDb();
  const users = parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);
  const target = users.find((item) => item.username === username);
  if (!target) {
    return res.status(404).json({ ok: false, error: 'user not found' });
  }

  if (sanitizeAdminRole(target.role) === 'admin' && countAdmins(users) <= 1) {
    return res.status(409).json({ ok: false, error: 'au moins un admin doit rester actif' });
  }

  const nextUsers = users.filter((item) => item.username !== username);
  db.users = nextUsers;
  db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(nextUsers);
  appendLogEntry(db, {
    type: 'auth',
    level: 'warning',
    source: 'api.auth.users.delete',
    message: 'Utilisateur admin supprimé',
    details: buildLogMeta(req, { username })
  });
  await writeDb(db);
  await syncLegacyUsersDb(nextUsers);

  return res.json({ ok: true });
});

app.get('/api/layouts', async (_req, res) => {
  const db = await readDb();
  const records = getCollectionRecords(db, 'layouts');
  const meta = parseCollectionMeta(db.kv[LAYOUTS_META_KV_KEY]);
  res.json({ records, meta });
});

app.post('/api/layouts', async (req, res) => {
  const record = req.body?.record;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ ok: false, error: 'record is required' });
  }
  if (typeof record.id !== 'string' || !record.id.trim()) {
    return res.status(400).json({ ok: false, error: 'record.id is required' });
  }

  const db = await readDb();
  const current = getCollectionRecords(db, 'layouts');
  const next = current.some((item) => item.id === record.id)
    ? current.map((item) => (item.id === record.id ? record : item))
    : [...current, record];

  const meta = writeCollection(db, LAYOUTS_KV_KEY, LAYOUTS_META_KV_KEY, next);
  appendLogEntry(db, {
    type: 'sync',
    level: 'info',
    source: 'api.layouts.upsert',
    message: `Layout upsert: ${record.id}`,
    details: buildLogMeta(req, { layoutId: record.id, version: meta.version })
  });
  await writeDb(db);
  res.json({ ok: true, record, meta });
});

app.delete('/api/layouts/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const db = await readDb();
  const current = getCollectionRecords(db, 'layouts');
  const next = current.filter((item) => item.id !== id);
  const removed = current.length - next.length;
  const meta = writeCollection(db, LAYOUTS_KV_KEY, LAYOUTS_META_KV_KEY, next);
  appendLogEntry(db, {
    type: 'sync',
    level: removed > 0 ? 'warning' : 'info',
    source: 'api.layouts.delete',
    message: `Layout delete: ${id}`,
    details: buildLogMeta(req, { layoutId: id, removed, version: meta.version })
  });
  await writeDb(db);
  res.json({ ok: true, removed, meta });
});

app.get('/api/playlists', async (_req, res) => {
  const db = await readDb();
  const records = getCollectionRecords(db, 'playlists');
  const meta = parseCollectionMeta(db.kv[PLAYLISTS_META_KV_KEY]);
  res.json({ records, meta });
});

app.post('/api/playlists', async (req, res) => {
  const record = req.body?.record;
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ ok: false, error: 'record is required' });
  }
  if (typeof record.id !== 'string' || !record.id.trim()) {
    return res.status(400).json({ ok: false, error: 'record.id is required' });
  }

  const db = await readDb();
  const current = getCollectionRecords(db, 'playlists');
  const next = current.some((item) => item.id === record.id)
    ? current.map((item) => (item.id === record.id ? record : item))
    : [...current, record];

  const meta = writeCollection(db, PLAYLISTS_KV_KEY, PLAYLISTS_META_KV_KEY, next);
  appendLogEntry(db, {
    type: 'sync',
    level: 'info',
    source: 'api.playlists.upsert',
    message: `Playlist upsert: ${record.id}`,
    details: buildLogMeta(req, { playlistId: record.id, version: meta.version })
  });
  await writeDb(db);
  res.json({ ok: true, record, meta });
});

app.delete('/api/playlists/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

  const db = await readDb();
  const current = getCollectionRecords(db, 'playlists');
  const next = current.filter((item) => item.id !== id);
  const removed = current.length - next.length;
  const meta = writeCollection(db, PLAYLISTS_KV_KEY, PLAYLISTS_META_KV_KEY, next);
  appendLogEntry(db, {
    type: 'sync',
    level: removed > 0 ? 'warning' : 'info',
    source: 'api.playlists.delete',
    message: `Playlist delete: ${id}`,
    details: buildLogMeta(req, { playlistId: id, removed, version: meta.version })
  });
  await writeDb(db);
  res.json({ ok: true, removed, meta });
});

app.get('/api/logs', async (req, res) => {
  const db = await readDb();
  const type = String(req.query?.type || '').trim().toLowerCase();
  const level = String(req.query?.level || '').trim().toLowerCase();
  const search = String(req.query?.search || '').trim().toLowerCase();
  const requestedLimit = Number(req.query?.limit || 200);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(1000, Math.max(1, Math.floor(requestedLimit)))
    : 200;

  let rows = parseLogs(db.kv[LOGS_KV_KEY]);

  if (type && type !== 'all') {
    rows = rows.filter((item) => item.type === sanitizeLogType(type));
  }

  if (level && level !== 'all') {
    rows = rows.filter((item) => item.level === sanitizeLogLevel(level));
  }

  if (search) {
    rows = rows.filter((item) => {
      const haystack = `${item.message} ${item.source} ${JSON.stringify(item.details || {})}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  res.json({ records: rows.slice(0, limit), total: rows.length });
});

app.post('/api/logs', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) {
    return res.status(400).json({ ok: false, error: 'message is required' });
  }

  const db = await readDb();
  const entry = appendLogEntry(db, {
    type: req.body?.type,
    level: req.body?.level,
    message,
    source: req.body?.source,
    details: {
      ...(req.body?.details && typeof req.body.details === 'object' ? req.body.details : {}),
      ...buildLogMeta(req)
    }
  });
  await writeDb(db);
  res.status(201).json({ ok: true, entry });
});

app.delete('/api/logs', async (req, res) => {
  const type = String(req.query?.type || '').trim().toLowerCase();
  const db = await readDb();
  const logs = parseLogs(db.kv[LOGS_KV_KEY]);

  if (!type || type === 'all') {
    setCollectionRecords(db, 'logs', []);
    await writeDb(db);
    return res.json({ ok: true, removed: logs.length, remaining: 0 });
  }

  const normalizedType = sanitizeLogType(type);
  const remaining = logs.filter((item) => item.type !== normalizedType);
  setCollectionRecords(db, 'logs', remaining);
  await writeDb(db);
  return res.json({ ok: true, removed: logs.length - remaining.length, remaining: remaining.length });
});

app.get('/api/player/context', async (_req, res) => {
  const [rooms, events, groups] = await Promise.all([
    loadRoomsFromDb(),
    loadEventsFromDb(),
    loadScreenGroupsFromDb()
  ]);
  res.json({ rooms, events, groups });
});

app.get('/api/screens', async (_req, res) => {
  const screens = await loadScreensFromDb();
  res.json(screens.map(sanitizeScreenForResponse));
});

app.post('/api/screens/register', async (req, res) => {
  return res.status(410).json({
    ok: false,
    error: 'Découverte réseau retirée. Utilisez /api/player/pair/start puis /api/screens/pair/claim.'
  });
});

app.post('/api/screens/heartbeat', async (req, res) => {
  return res.status(410).json({
    ok: false,
    error: 'Heartbeat écran legacy retiré. Utilisez /api/player/heartbeat après pairage PIN/QR.'
  });
});

app.get('/api/meetings', async (_req, res) => {
  const [events, rooms] = await Promise.all([loadEventsFromDb(), loadRoomsFromDb()]);
  res.json(buildUpcomingMeetings(events, rooms));
});

app.get('/api/activity', async (_req, res) => {
  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  res.json(buildRecentActivity(screens, db.assets || []));
});

app.get('/api/storage/stats', async (_req, res) => {
  const db = await readDb();
  const totalAssets = db.assets.length;
  const totalSize = db.assets.reduce((acc, item) => acc + (Number(item.size) || 0), 0);
  const logsRaw = typeof db.kv[LOGS_KV_KEY] === 'string' ? db.kv[LOGS_KV_KEY] : '[]';
  let sqliteEnabled = false;
  try {
    sqliteEnabled = Boolean(getSqliteDb());
  } catch {
    sqliteEnabled = false;
  }
  const cacheSize = await calculateCacheSizeBytes();
  const diskCapacity = await resolveSystemDiskCapacityBytes(STORAGE_DIR);

  res.json({
    totalAssets,
    totalSize,
    cacheSize,
    logsCount: parseLogs(logsRaw).length,
    logsSize: Buffer.byteLength(logsRaw, 'utf-8'),
    assetsDir: ASSETS_DIR,
    dbPath: sqliteEnabled ? SQLITE_DB_PATH : DB_PATH,
    dbEngine: sqliteEnabled ? 'sqlite' : 'json',
    diskTotalBytes: Number(diskCapacity.totalBytes) || 0,
    diskUsedBytes: Number(diskCapacity.usedBytes) || 0,
    diskCapacitySource: String(diskCapacity.source || 'fallback-20gb'),
    policy: getStoragePolicy(db)
  });
});

app.get('/api/storage/policy', async (_req, res) => {
  const db = await readDb();
  return res.json({ ok: true, policy: getStoragePolicy(db) });
});

app.put('/api/storage/policy', async (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const candidate = payload.policy && typeof payload.policy === 'object' ? payload.policy : payload;

  const db = await readDb();
  const policy = setStoragePolicy(db, candidate);
  appendLogEntry(db, {
    type: 'system',
    level: 'info',
    source: 'api.storage.policy.put',
    message: 'Politique de stockage mise à jour',
    details: buildLogMeta(req, {
      maxAssetBytes: policy.maxAssetBytes,
      maxCacheBytes: policy.maxCacheBytes,
      logsRetentionDays: policy.logsRetentionDays,
      autoPurge: policy.autoPurge
    })
  });
  await writeDb(db);

  return res.json({ ok: true, policy });
});

app.get('/api/monitoring/fleet', async (_req, res) => {
  const db = await readDb();
  const fleet = buildFleetSnapshot(db);

  return res.json({
    ok: true,
    summary: fleet.summary,
    items: fleet.items
  });
});

app.get('/api/alerts/config', async (_req, res) => {
  const db = await readDb();
  return res.json({ ok: true, config: getAlertsPolicy(db) });
});

app.put('/api/alerts/config', async (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const candidate = payload.config && typeof payload.config === 'object' ? payload.config : payload;

  const db = await readDb();
  const config = setAlertsPolicy(db, candidate);
  appendLogEntry(db, {
    type: 'ops',
    level: 'info',
    source: 'api.alerts.config.put',
    message: 'Configuration alertes mise à jour',
    details: buildLogMeta(req, config)
  });
  await writeDb(db);
  return res.json({ ok: true, config });
});

app.get('/api/alerts', async (_req, res) => {
  const db = await readDb();
  const config = getAlertsPolicy(db);
  const fleet = buildFleetSnapshot(db);
  const cacheSize = await calculateCacheSizeBytes();
  const nowIsoTs = nowIso();
  const activeAlerts = computeActiveAlerts(db, config, fleet, nowIsoTs, cacheSize);
  const stateMap = reconcileAlertsState(db, activeAlerts, nowIsoTs);
  const alerts = activeAlerts.map((alert) => {
    const state = stateMap[String(alert.id || '').trim()] || null;
    return {
      ...alert,
      status: state?.status || 'new',
      firstSeenAt: state?.firstSeenAt || nowIsoTs,
      lastSeenAt: state?.lastSeenAt || nowIsoTs,
      ackedAt: state?.ackedAt || '',
      silencedUntil: state?.silencedUntil || ''
    };
  });

  const visibleAlerts = alerts.filter((item) => item.status !== 'silenced');

  await writeDb(db);

  return res.json({
    ok: true,
    summary: {
      total: visibleAlerts.length,
      critical: visibleAlerts.filter((item) => item.severity === 'critical').length,
      warning: visibleAlerts.filter((item) => item.severity === 'warning').length,
      silenced: alerts.filter((item) => item.status === 'silenced').length,
      acked: alerts.filter((item) => item.status === 'ack').length
    },
    alerts: visibleAlerts
  });
});

app.post('/api/alerts/:alertId/ack', async (req, res) => {
  const alertId = String(req.params?.alertId || '').trim();
  if (!alertId) {
    return res.status(400).json({ ok: false, error: 'alertId is required' });
  }

  const db = await readDb();
  const state = getAlertsState(db);
  const existing = state[alertId];

  if (!existing || existing.status === 'resolved') {
    return res.status(404).json({ ok: false, error: 'alert not found' });
  }

  const ackedAt = nowIso();
  state[alertId] = {
    ...existing,
    status: 'ack',
    ackedAt,
    updatedAt: ackedAt
  };
  setAlertsState(db, state);
  appendLogEntry(db, {
    type: 'ops',
    level: 'info',
    source: 'api.alerts.ack',
    message: `Alerte acquittée: ${alertId}`,
    details: buildLogMeta(req, { alertId, status: 'ack' })
  });
  await writeDb(db);

  return res.json({ ok: true, alert: state[alertId] });
});

app.post('/api/alerts/:alertId/silence', async (req, res) => {
  const alertId = String(req.params?.alertId || '').trim();
  const requestedDurationMinutes = Number(req.body?.durationMinutes || 30);
  const durationMinutes = Number.isFinite(requestedDurationMinutes)
    ? Math.max(1, Math.min(7 * 24 * 60, Math.floor(requestedDurationMinutes)))
    : 30;

  if (!alertId) {
    return res.status(400).json({ ok: false, error: 'alertId is required' });
  }

  const db = await readDb();
  const state = getAlertsState(db);
  const existing = state[alertId];

  if (!existing || existing.status === 'resolved') {
    return res.status(404).json({ ok: false, error: 'alert not found' });
  }

  const updatedAt = nowIso();
  const silencedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  state[alertId] = {
    ...existing,
    status: 'silenced',
    silencedUntil,
    updatedAt
  };
  setAlertsState(db, state);
  appendLogEntry(db, {
    type: 'ops',
    level: 'info',
    source: 'api.alerts.silence',
    message: `Alerte silencée: ${alertId}`,
    details: buildLogMeta(req, { alertId, durationMinutes, silencedUntil })
  });
  await writeDb(db);

  return res.json({ ok: true, alert: state[alertId] });
});

app.get('/api/audit', async (req, res) => {
  const db = await readDb();
  const actor = String(req.query?.actor || '').trim().toLowerCase();
  const type = String(req.query?.type || '').trim().toLowerCase();
  const search = String(req.query?.search || '').trim().toLowerCase();
  const requestedLimit = Number(req.query?.limit || 300);
  const limit = Number.isFinite(requestedLimit) ? Math.min(1000, Math.max(1, Math.floor(requestedLimit))) : 300;

  let rows = parseLogs(db.kv[LOGS_KV_KEY]);
  rows = rows.filter((row) => ['sync', 'screen', 'upload', 'auth', 'security', 'ops', 'system', 'player'].includes(String(row.type || '')));

  if (type && type !== 'all') {
    rows = rows.filter((row) => String(row.type || '') === type);
  }

  if (actor) {
    rows = rows.filter((row) => String(row.details?.adminUser || '').toLowerCase().includes(actor));
  }

  if (search) {
    rows = rows.filter((row) => (`${row.message} ${row.source} ${JSON.stringify(row.details || {})}`).toLowerCase().includes(search));
  }

  return res.json({ ok: true, total: rows.length, records: rows.slice(0, limit) });
});

app.get('/api/ops/sla', async (_req, res) => {
  const db = await readDb();
  const fleet = buildFleetSnapshot(db);
  const logs = parseLogs(db.kv[LOGS_KV_KEY]);
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);

  const incidents = logs.filter((row) => {
    const ts = new Date(row.timestamp || row.at || 0).getTime();
    if (!Number.isFinite(ts) || ts < dayAgo) return false;
    return row.level === 'error' || row.level === 'warning';
  });

  const availability = fleet.summary.total > 0
    ? Number(((fleet.summary.online / fleet.summary.total) * 100).toFixed(2))
    : 100;

  return res.json({
    ok: true,
    sla: {
      availabilityPercent: availability,
      incidentsLast24h: incidents.length,
      mttrMinutes: incidents.length > 0 ? 15 : 0
    },
    fleet: fleet.summary
  });
});

app.post('/api/storage/clear-cache', async (req, res) => {
  const cacheDir = path.join(STORAGE_DIR, 'cache');
  await fsp.mkdir(cacheDir, { recursive: true });

  const entries = await fsp.readdir(cacheDir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    const target = path.join(cacheDir, entry.name);
    if (entry.isDirectory()) {
      await fsp.rm(target, { recursive: true, force: true });
      removed += 1;
    } else {
      await fsp.unlink(target).catch(() => undefined);
      removed += 1;
    }
  }

  const db = await readDb();
  appendLogEntry(db, {
    type: 'system',
    level: 'warning',
    source: 'api.storage.clear-cache',
    message: 'Cache storage vidé',
    details: buildLogMeta(req, { removed })
  });
  await writeDb(db);

  return res.json({ ok: true, removed });
});

app.get('/api/system/kv/:key', async (req, res) => {
  const key = req.params.key;
  const db = await readDb();

  if (key === SYSTEM_SETTINGS_KV_KEY) {
    return res.json({ key, value: JSON.stringify(getSystemConfig(db)) });
  }

  if (key === ADMIN_USERS_KV_KEY) {
    const users = Array.isArray(db.users) ? db.users : parseAdminUsers(db.kv[ADMIN_USERS_KV_KEY]);
    return res.json({ key, value: JSON.stringify(users.map(sanitizeAdminUserForResponse)) });
  }

  const collectionName = KV_TO_COLLECTION_NAME[key];
  if (collectionName) {
    return res.json({ key, value: JSON.stringify(getCollectionRecords(db, collectionName)) });
  }

  const value = db.kv[key];
  if (typeof value !== 'string') {
    if (DEFAULT_EMPTY_ARRAY_KEYS.has(key)) {
      return res.json({ key, value: '[]' });
    }
    return res.status(404).json({ error: 'Key not found' });
  }
  return res.json({ key, value });
});

app.get('/api/system/update/status', async (_req, res) => {
  const status = await checkForReleaseUpdate();
  return res.json({ ok: true, ...status });
});

app.post('/api/system/update/check', async (_req, res) => {
  const status = await checkForReleaseUpdate({ force: true });
  return res.json({ ok: true, ...status });
});

app.post('/api/system/update/apply', async (req, res) => {
  try {
    const status = await applyReleaseUpdate(req);
    return res.json({ ok: true, ...status });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error?.message || error || 'Impossible d’appliquer la mise à jour.'),
      ...updateState
    });
  }
});

// Background update service endpoints
app.get('/api/system/update/state', async (_req, res) => {
  const state = updateService.getUpdateState();
  return res.json({ ok: true, ...state });
});

app.post('/api/system/update/execute', async (req, res) => {
  try {
    // Check auth (admin only)
    const token = req.cookies?.[ADMIN_TOKEN_COOKIE_NAME];
    if (!token || !adminSessions.has(token)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const state = updateService.getUpdateState();
    if (state.isRunning) {
      return res.status(409).json({
        ok: false,
        error: 'Update déjà en cours',
        state
      });
    }

    // Start update in background (non-blocking)
    res.json({ ok: true, message: 'Mise à jour démarrée en arrière-plan', state: updateService.getUpdateState() });

    // Run update asynchronously
    updateService.runUpdate().then((result) => {
      console.log('Background update completed:', result);
      // Broadcast to WebSocket clients that update is done
      if (global.systemWss) {
        broadcastUpdateStatus(global.systemWss);
      }
    }).catch((error) => {
      console.error('Background update error:', error);
      if (global.systemWss) {
        broadcastUpdateStatus(global.systemWss);
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error?.message || error || 'Erreur lors du démarrage de la mise à jour')
    });
  }
});

/**
 * Broadcast update status to all WebSocket clients
 */
function broadcastUpdateStatus(wss) {
  const state = updateService.getUpdateState();
  if (wss && wss.clients) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(JSON.stringify({
            type: 'update-status',
            payload: state
          }));
        } catch (e) {
          // ignore send errors
        }
      }
    });
  }
}

app.put('/api/system/kv/:key', async (req, res) => {
  const key = req.params.key;
  const value = req.body?.value;
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' });
  }

  const db = await readDb();
  if (key === SYSTEM_SETTINGS_KV_KEY) {
    setSystemConfig(db, parseJsonObject(value, {}));
  } else if (key === ADMIN_USERS_KV_KEY) {
    const users = parseAdminUsers(value);
    db.users = users;
    db.kv[ADMIN_USERS_KV_KEY] = JSON.stringify(users);
  } else {
    const collectionName = KV_TO_COLLECTION_NAME[key];
    if (collectionName) {
      setCollectionRecords(db, collectionName, parseJsonObjectArray(value));
    } else {
      db.kv[key] = value;
    }
  }
  appendLogEntry(db, {
    type: 'sync',
    level: 'info',
    source: 'api.system.kv.put',
    message: `System key updated: ${key}`,
    details: buildLogMeta(req, { key, valueLength: value.length })
  });
  await writeDb(db);
  return res.json({ ok: true });
});

app.get('/api/assets', async (_req, res) => {
  const db = await readDb();
  const records = [...db.assets].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  res.json({ records });
});

app.post('/api/assets', upload.array('files'), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const db = await readDb();
  const records = files.map((file) => {
    const extension = path.extname(file.originalname || '').replace('.', '').toLowerCase();
    const id = path.basename(file.filename, path.extname(file.filename));
    return {
      id,
      name: String(file.originalname || '').replace(/\.[^/.]+$/, ''),
      originalFileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      extension,
      type: inferAssetType(file.mimetype, extension),
      size: file.size,
      uploadedAt: new Date().toISOString(),
      systemPath: path.join(ASSETS_DIR, file.filename),
      systemFileName: file.filename
    };
  });

  db.assets = [...db.assets, ...records];
  appendLogEntry(db, {
    type: 'upload',
    level: 'info',
    source: 'api.assets.upload',
    message: `${records.length} asset(s) uploaded`,
    details: buildLogMeta(req, {
      count: records.length,
      names: records.map((item) => item.originalFileName).slice(0, 10)
    })
  });
  await writeDb(db);

  res.json({ records });
});

app.post('/api/assets/import', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const assetId = String(req.body?.assetId || '').trim();
  if (!assetId) {
    return res.status(400).json({ error: 'assetId is required' });
  }

  const db = await readDb();
  const existing = db.assets.find((item) => item.id === assetId);
  if (existing) {
    if (file.path && fs.existsSync(file.path)) {
      await fsp.unlink(file.path).catch(() => undefined);
    }
    return res.json({ record: existing, reused: true });
  }

  const extension = String(req.body?.extension || path.extname(file.originalname || '').replace('.', '')).toLowerCase();
  const name = String(req.body?.name || file.originalname || '').replace(/\.[^/.]+$/, '');
  const originalFileName = String(req.body?.originalFileName || file.originalname || `${assetId}.${extension}`);
  const mimeType = String(req.body?.mimeType || file.mimetype || 'application/octet-stream');
  const type = String(req.body?.type || inferAssetType(mimeType, extension));
  const uploadedAt = String(req.body?.uploadedAt || new Date().toISOString());
  const targetFileName = `${assetId}${extension ? `.${extension}` : ''}`;
  const targetPath = path.join(ASSETS_DIR, targetFileName);

  await fsp.rename(file.path, targetPath).catch(async () => {
    await fsp.copyFile(file.path, targetPath);
    await fsp.unlink(file.path).catch(() => undefined);
  });

  const record = {
    id: assetId,
    name,
    originalFileName,
    mimeType,
    extension,
    type,
    size: file.size,
    uploadedAt,
    systemPath: targetPath,
    systemFileName: targetFileName
  };

  db.assets = [...db.assets, record];
  appendLogEntry(db, {
    type: 'upload',
    level: 'info',
    source: 'api.assets.import',
    message: `Asset imported: ${record.originalFileName}`,
    details: buildLogMeta(req, { assetId: record.id, size: record.size })
  });
  await writeDb(db);
  res.json({ record });
});

app.get('/api/assets/:id/blob', async (req, res) => {
  const db = await readDb();
  const asset = db.assets.find((item) => item.id === req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (!asset.systemPath || !fs.existsSync(asset.systemPath)) return res.status(404).json({ error: 'Asset file missing' });

  res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
  res.sendFile(asset.systemPath);
});

app.delete('/api/assets/:id', async (req, res) => {
  const db = await readDb();
  const asset = db.assets.find((item) => item.id === req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  if (asset.systemPath && fs.existsSync(asset.systemPath)) {
    await fsp.unlink(asset.systemPath).catch(() => {});
  }

  db.assets = db.assets.filter((item) => item.id !== req.params.id);
  appendLogEntry(db, {
    type: 'upload',
    level: 'warning',
    source: 'api.assets.delete',
    message: `Asset deleted: ${asset.originalFileName || asset.name || req.params.id}`,
    details: buildLogMeta(req, { assetId: req.params.id })
  });
  await writeDb(db);

  res.json({ ok: true });
});

app.get('/api/screens/bootstrap', (_req, res) => {
  const deviceId = String(_req.query?.deviceId || '').trim();
  const token = String(_req.query?.token || '').trim();

  if (!deviceId && !token) {
    return res.status(400).json({ error: 'deviceId or token is required' });
  }

  readDb().then((db) => {
    const screens = getCollectionRecords(db, 'screens');
    const layouts = getCollectionRecords(db, 'layouts');
    const screen = screens.find((item) => item.deviceId === deviceId || item.deviceToken === token) || null;
    const layout = screen?.layoutId ? (layouts.find((item) => item.id === screen.layoutId) || null) : null;
    res.json({ screen, layout });
  }).catch((error) => {
    res.status(500).json({ error: 'bootstrap failed', detail: String(error?.message || error) });
  });
});

app.get('/api/player/bootstrap', (req, res) => {
  const deviceId = String(req.query?.deviceId || '').trim();
  const token = String(req.query?.token || '').trim();

  if (!deviceId && !token) {
    return res.status(400).json({ error: 'deviceId or token is required' });
  }

  readDb().then((db) => {
    const screens = getCollectionRecords(db, 'screens');
    const layouts = getCollectionRecords(db, 'layouts');
    const screen = screens.find((item) => item.deviceId === deviceId || item.deviceToken === token) || null;
    const layout = screen?.layoutId ? (layouts.find((item) => item.id === screen.layoutId) || null) : null;
    res.json({ screen, layout });
  }).catch((error) => {
    res.status(500).json({ error: 'bootstrap failed', detail: String(error?.message || error) });
  });
});

app.get('/api/player/authorize', (req, res) => {
  const deviceId = String(req.query?.deviceId || '').trim();
  const token = String(req.query?.token || '').trim();

  if (!deviceId && !token) {
    return res.status(400).json({ authorized: false, reason: 'missing identifiers' });
  }

  readDb().then((db) => {
    const screens = getCollectionRecords(db, 'screens');
    const screen = screens.find((item) => item.deviceId === deviceId || item.deviceToken === token);
    const authorized = Boolean(screen && isAuthorizedStatus(screen.status));
    res.json({
      authorized,
      status: screen?.status || null,
      screenId: screen?.id || null
    });
  }).catch((error) => {
    res.status(500).json({ authorized: false, reason: String(error?.message || error) });
  });
});

app.post('/api/player/pair/start', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const devname = String(req.body?.devname || req.body?.deviceName || '').trim();
  const os = String(req.body?.os || '').trim();

  if (!token || !deviceId) {
    return res.status(400).json({ ok: false, error: 'token and deviceId are required' });
  }

  const db = await readDb();
  const pairings = getCollectionRecords(db, 'playerPairings').filter((item) => !isExpired(item.expiresAt));
  const existingIndex = pairings.findIndex((item) => item.deviceId === deviceId || item.token === token);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const ip = getAdvertisedClientIp(req);

  const baseEntry = {
    token,
    deviceId,
    devname: devname || deviceId,
    os,
    ip,
    lastSeenAt: nowIso(),
    expiresAt
  };

  if (existingIndex >= 0) {
    const current = pairings[existingIndex];
    const pin = !isExpired(current.expiresAt) ? String(current.pin || generatePin()) : generatePin();
    pairings[existingIndex] = {
      ...current,
      ...baseEntry,
      pin
    };
    setCollectionRecords(db, 'playerPairings', pairings);
    await writeDb(db);
    return res.json({ ok: true, pin, expiresAt, ip });
  }

  const pin = generatePin();
  pairings.push({
    ...baseEntry,
    pin,
    createdAt: nowIso()
  });

  setCollectionRecords(db, 'playerPairings', pairings);
  appendLogEntry(db, {
    type: 'player',
    level: 'info',
    source: 'api.player.pair.start',
    message: `Pairing updated: ${deviceId}`,
    details: buildLogMeta(req, { deviceId, pinSuffix: pin.slice(-2), expiresAt })
  });
  appendLogEntry(db, {
    type: 'player',
    level: 'info',
    source: 'api.player.pair.start',
    message: `Pairing started: ${deviceId}`,
    details: buildLogMeta(req, { deviceId, pinSuffix: pin.slice(-2), expiresAt })
  });
  await writeDb(db);
  return res.json({ ok: true, pin, expiresAt, ip });
});

app.post('/api/screens/pair/claim', async (req, res) => {
  const pin = String(req.body?.pin || '').trim();

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ ok: false, error: 'PIN invalide (6 chiffres requis)' });
  }

  const db = await readDb();
  const pairings = getCollectionRecords(db, 'playerPairings').filter((item) => !isExpired(item.expiresAt));
  const targetIndex = pairings.findIndex((item) => String(item.pin) === pin);

  if (targetIndex < 0) {
    return res.status(404).json({ ok: false, error: 'PIN introuvable ou expiré' });
  }

  const target = pairings[targetIndex];

  const screens = getCollectionRecords(db, 'screens');
  const nextScreens = upsertScreenEntry(screens, {
    token: String(target.token || ''),
    devname: String(target.devname || target.deviceId || ''),
    deviceId: String(target.deviceId || ''),
    os: String(target.os || ''),
    hostname: '',
    ip: String(target.ip || 'N/A'),
    resolution: ''
  }).map((screen) => (
    (screen.deviceId === target.deviceId || screen.deviceToken === target.token)
      ? { ...screen, status: 'online', lastHeartbeat: nowIso() }
      : screen
  ));

  const remainingPairings = pairings.filter((_, index) => index !== targetIndex);
  setCollectionRecords(db, 'screens', nextScreens);
  setCollectionRecords(db, 'playerPairings', remainingPairings);
  appendLogEntry(db, {
    type: 'screen',
    level: 'info',
    source: 'api.screens.pair.claim',
    message: `Screen paired: ${target.deviceId}`,
    details: buildLogMeta(req, { deviceId: target.deviceId, ip: target.ip || '' })
  });
  await writeDb(db);

  const screen = nextScreens.find((item) => item.deviceId === target.deviceId || item.deviceToken === target.token) || null;
  return res.json({ ok: true, screen });
});

app.post('/api/screens/:screenId/command', async (req, res) => {
  const screenId = String(req.params?.screenId || '').trim();
  const command = String(req.body?.command || '').trim().toLowerCase();

  if (!screenId) {
    return res.status(400).json({ ok: false, error: 'screenId is required' });
  }

  if (!SCREEN_COMMANDS.has(command)) {
    return res.status(400).json({ ok: false, error: 'unsupported command' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const idx = screens.findIndex((item) => item.id === screenId);

  if (idx < 0) {
    return res.status(404).json({ ok: false, error: 'screen not found' });
  }

  const queuedCommand = queueScreenCommand(db, screens[idx], command);
  screens[idx] = {
    ...screens[idx],
    pendingCommand: queuedCommand
  };

  setCollectionRecords(db, 'screens', screens);
  appendLogEntry(db, {
    type: 'screen',
    level: 'info',
    source: 'api.screens.command',
    message: `Screen command queued: ${command}`,
    details: buildLogMeta(req, {
      screenId,
      deviceId: screens[idx].deviceId || '',
      command,
      issuedAt: queuedCommand.issuedAt
    })
  });
  await writeDb(db);

  return res.json({
    ok: true,
    command: queuedCommand
  });
});

app.post('/api/screens/commands/bulk', async (req, res) => {
  const command = String(req.body?.command || '').trim().toLowerCase();
  const screenIds = Array.isArray(req.body?.screenIds)
    ? req.body.screenIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (!SCREEN_COMMANDS.has(command)) {
    return res.status(400).json({ ok: false, error: 'unsupported command' });
  }

  if (screenIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'screenIds is required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const targetSet = new Set(screenIds);
  const queued = [];

  const nextScreens = screens.map((screen) => {
    if (!targetSet.has(screen.id)) return screen;
    const queuedCommand = queueScreenCommand(db, screen, command);
    queued.push({ screenId: screen.id, deviceId: screen.deviceId || '', command: queuedCommand });
    return {
      ...screen,
      pendingCommand: queuedCommand
    };
  });

  setCollectionRecords(db, 'screens', nextScreens);
  appendLogEntry(db, {
    type: 'ops',
    level: 'info',
    source: 'api.screens.commands.bulk',
    message: `Commande groupée: ${command}`,
    details: buildLogMeta(req, { command, count: queued.length, screenIds })
  });
  await writeDb(db);

  return res.json({ ok: true, queuedCount: queued.length, queued });
});

app.post('/api/screens/rotate-token/bulk', async (req, res) => {
  const screenIds = Array.isArray(req.body?.screenIds)
    ? req.body.screenIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (screenIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'screenIds is required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const targetSet = new Set(screenIds);
  const rotated = [];

  const nextScreens = screens.map((screen) => {
    if (!targetSet.has(screen.id)) return screen;
    const nextToken = crypto.randomBytes(24).toString('base64url');
    rotated.push({ screenId: screen.id, deviceId: screen.deviceId || '', token: nextToken });
    return {
      ...screen,
      deviceToken: nextToken,
      updatedAt: nowIso()
    };
  });

  setCollectionRecords(db, 'screens', nextScreens);
  appendLogEntry(db, {
    type: 'security',
    level: 'warning',
    source: 'api.screens.rotate-token.bulk',
    message: 'Rotation groupée des tokens player',
    details: buildLogMeta(req, { count: rotated.length, screenIds })
  });
  await writeDb(db);

  return res.json({ ok: true, rotatedCount: rotated.length, rotated });
});

app.post('/api/player/rotate-token', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();

  if (!token || !deviceId) {
    return res.status(400).json({ ok: false, error: 'token and deviceId are required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const index = screens.findIndex((item) => item.deviceId === deviceId && item.deviceToken === token);

  if (index < 0) {
    return res.status(401).json({ ok: false, error: 'screen not paired' });
  }

  const nextToken = crypto.randomBytes(24).toString('base64url');
  screens[index] = {
    ...screens[index],
    deviceToken: nextToken,
    updatedAt: nowIso()
  };

  setCollectionRecords(db, 'screens', screens);
  appendLogEntry(db, {
    type: 'player',
    level: 'info',
    source: 'api.player.rotate-token',
    message: `Player token rotated: ${deviceId}`,
    details: buildLogMeta(req, { deviceId })
  });
  await writeDb(db);

  return res.json({ ok: true, token: nextToken });
});

app.post('/api/player/enroll', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const devname = String(req.body?.devname || req.body?.deviceName || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const os = String(req.body?.os || '').trim();

  if (!token || !deviceId) {
    return res.status(400).json({ ok: false, error: 'token and deviceId are required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const nextScreens = upsertScreenEntry(screens, {
    token,
    devname: devname || deviceId,
    deviceId,
    os,
    hostname: req.hostname,
    ip: getAdvertisedClientIp(req),
    resolution: ''
  });

  setCollectionRecords(db, 'screens', nextScreens);
  appendLogEntry(db, {
    type: 'player',
    level: 'info',
    source: 'api.player.enroll',
    message: `Player enrolled: ${deviceId}`,
    details: buildLogMeta(req, { deviceId, status: 'pending' })
  });
  await writeDb(db);
  res.json({ ok: true, status: 'pending' });
});

app.post('/api/player/heartbeat', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const os = String(req.body?.os || '').trim();
  const telemetry = req.body?.telemetry && typeof req.body.telemetry === 'object' ? req.body.telemetry : {};

  if (!token || !deviceId) {
    return res.status(400).json({ ok: false, error: 'token and deviceId are required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const idx = findPairedScreenIndex(screens, deviceId, token);
  let pendingCommand = null;

  if (idx >= 0) {
    const existing = screens[idx];
    const nextPending = existing?.pendingCommand && typeof existing.pendingCommand === 'object'
      ? {
          id: String(existing.pendingCommand.id || '').trim(),
          command: String(existing.pendingCommand.command || '').trim().toLowerCase(),
          issuedAt: String(existing.pendingCommand.issuedAt || '').trim(),
          signature: String(existing.pendingCommand.signature || '').trim(),
          retries: Number(existing.pendingCommand.retries || 0) || 0,
          maxRetries: Number(existing.pendingCommand.maxRetries || COMMAND_MAX_RETRIES) || COMMAND_MAX_RETRIES,
          lastSentAt: String(existing.pendingCommand.lastSentAt || '').trim(),
          ackedAt: String(existing.pendingCommand.ackedAt || '').trim()
        }
      : null;

    if (nextPending && SCREEN_COMMANDS.has(nextPending.command)) {
      const expectedSignature = createCommandSignature({
        screenId: existing.id,
        command: nextPending.command,
        issuedAt: nextPending.issuedAt,
        deviceToken: existing.deviceToken || ''
      });

      pendingCommand = (expectedSignature === nextPending.signature) ? nextPending : null;

      if (!pendingCommand) {
        appendLogEntry(db, {
          type: 'security',
          level: 'warning',
          source: 'api.player.heartbeat',
          message: `Commande ignorée (signature invalide): ${deviceId}`,
          details: buildLogMeta(req, { deviceId, command: nextPending.command })
        });
      }
    }

    const now = Date.now();
    let nextStoredPending = null;
    let commandForResponse = null;

    if (pendingCommand && !pendingCommand.ackedAt) {
      const lastSentMs = pendingCommand.lastSentAt ? new Date(pendingCommand.lastSentAt).getTime() : 0;
      const retryAllowed = pendingCommand.retries < pendingCommand.maxRetries;
      const intervalElapsed = !lastSentMs || !Number.isFinite(lastSentMs) || (now - lastSentMs >= COMMAND_RETRY_INTERVAL_MS);

      if (retryAllowed && intervalElapsed) {
        commandForResponse = {
          id: pendingCommand.id,
          command: pendingCommand.command,
          issuedAt: pendingCommand.issuedAt,
          signature: pendingCommand.signature,
          retries: pendingCommand.retries,
          maxRetries: pendingCommand.maxRetries
        };
        nextStoredPending = {
          ...pendingCommand,
          retries: pendingCommand.retries + 1,
          lastSentAt: new Date(now).toISOString()
        };
      } else if (!retryAllowed) {
        const failedAt = nowIso();
        screens[idx] = {
          ...existing,
          os: (os || existing.os || 'Inconnu').trim(),
          ip: getAdvertisedClientIp(req) || existing.ip || 'N/A',
          lastHeartbeat: new Date().toISOString(),
          cpuPercent: Number(telemetry.cpuPercent || existing.cpuPercent || 0) || 0,
          memoryPercent: Number(telemetry.memoryPercent || existing.memoryPercent || 0) || 0,
          temperatureC: Number(telemetry.temperatureC || existing.temperatureC || 0) || 0,
          diskUsedPercent: Number(telemetry.diskUsedPercent || existing.diskUsedPercent || 0) || 0,
          heartbeatLatencyMs: Number(telemetry.heartbeatLatencyMs || existing.heartbeatLatencyMs || 0) || 0,
          playerVersion: String(telemetry.version || existing.playerVersion || '').trim(),
          status: existing.status === 'pending' ? 'pending' : 'online',
          pendingCommand: null,
          lastCommandStatus: {
            id: pendingCommand.id,
            command: pendingCommand.command,
            status: 'failed',
            ackedAt: failedAt,
            error: 'timeout-no-ack'
          }
        };

        setCollectionRecords(db, 'screens', screens);
        appendLogEntry(db, {
          type: 'ops',
          level: 'warning',
          source: 'api.player.heartbeat',
          message: `Commande expirée sans ACK: ${deviceId}`,
          details: buildLogMeta(req, {
            deviceId,
            commandId: pendingCommand.id,
            command: pendingCommand.command,
            retries: pendingCommand.retries,
            maxRetries: pendingCommand.maxRetries
          })
        });
        await writeDb(db);
        return res.json({ ok: true, status: screens[idx].status, command: null });
      } else {
        nextStoredPending = pendingCommand;
      }
    }

    screens[idx] = {
      ...existing,
      os: (os || existing.os || 'Inconnu').trim(),
      ip: getAdvertisedClientIp(req) || existing.ip || 'N/A',
      lastHeartbeat: new Date().toISOString(),
      cpuPercent: Number(telemetry.cpuPercent || existing.cpuPercent || 0) || 0,
      memoryPercent: Number(telemetry.memoryPercent || existing.memoryPercent || 0) || 0,
      temperatureC: Number(telemetry.temperatureC || existing.temperatureC || 0) || 0,
      diskUsedPercent: Number(telemetry.diskUsedPercent || existing.diskUsedPercent || 0) || 0,
      heartbeatLatencyMs: Number(telemetry.heartbeatLatencyMs || existing.heartbeatLatencyMs || 0) || 0,
      playerVersion: String(telemetry.version || existing.playerVersion || '').trim(),
      status: existing.status === 'pending' ? 'pending' : 'online',
      pendingCommand: nextStoredPending
    };

    pendingCommand = commandForResponse;
  } else {
    appendLogEntry(db, {
      type: 'player',
      level: 'warning',
      source: 'api.player.heartbeat',
      message: `Heartbeat refusé (écran non pairé): ${deviceId}`,
      details: buildLogMeta(req, { deviceId })
    });
    await writeDb(db);
    return res.status(401).json({ ok: false, error: 'screen not paired' });
  }

  setCollectionRecords(db, 'screens', screens);
  appendLogEntry(db, {
    type: 'player',
    level: 'info',
    source: 'api.player.heartbeat',
    message: `Player heartbeat: ${deviceId}`,
    details: buildLogMeta(req, { deviceId, status: screens[idx].status })
  });
  await writeDb(db);
  res.json({ ok: true, status: screens[idx].status, command: pendingCommand });
});

app.post('/api/player/command-ack', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim();
  const commandId = String(req.body?.commandId || '').trim();
  const status = String(req.body?.status || 'done').trim().toLowerCase();
  const error = String(req.body?.error || '').trim();

  if (!token || !deviceId || !commandId) {
    return res.status(400).json({ ok: false, error: 'token, deviceId and commandId are required' });
  }

  const db = await readDb();
  const screens = getCollectionRecords(db, 'screens');
  const idx = findPairedScreenIndex(screens, deviceId, token);

  if (idx < 0) {
    return res.status(401).json({ ok: false, error: 'screen not paired' });
  }

  const current = screens[idx];
  const pending = current?.pendingCommand && typeof current.pendingCommand === 'object'
    ? current.pendingCommand
    : null;

  if (!pending || String(pending.id || '') !== commandId) {
    return res.status(404).json({ ok: false, error: 'command not found' });
  }

  const command = String(pending.command || '').trim().toLowerCase();
  const issuedAt = String(pending.issuedAt || '').trim();
  const signature = String(pending.signature || '').trim();
  const expectedSignature = createCommandSignature({
    screenId: current.id,
    command,
    issuedAt,
    deviceToken: current.deviceToken || ''
  });

  if (!SCREEN_COMMANDS.has(command) || !issuedAt || expectedSignature !== signature) {
    return res.status(400).json({ ok: false, error: 'invalid command signature' });
  }

  const ackedAt = nowIso();
  screens[idx] = {
    ...current,
    pendingCommand: null,
    lastCommandStatus: {
      id: commandId,
      command,
      status: status === 'failed' ? 'failed' : 'done',
      ackedAt,
      error
    }
  };

  setCollectionRecords(db, 'screens', screens);
  appendLogEntry(db, {
    type: 'player',
    level: status === 'failed' ? 'warning' : 'info',
    source: 'api.player.command-ack',
    message: `Commande ${command} acquittée: ${deviceId}`,
    details: buildLogMeta(req, { deviceId, commandId, command, status, error })
  });
  await writeDb(db);

  return res.json({ ok: true });
});

if (!API_ONLY && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

async function startServer() {
  await readDb();
  startReleaseWatcher();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`System DB: ${DB_PATH}`);
    console.log(`Assets dir: ${ASSETS_DIR}`);
    console.log(`System sync WS: ws://0.0.0.0:${PORT}/ws/system-sync`);
  });
  setupSystemSyncWebSocketServer(server);
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start server', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  parseLogs,
  createLogEntry
};
