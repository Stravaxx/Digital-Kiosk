import { getSystemApiBase } from './systemApiBase';

const ADMIN_SESSION_KEY = 'ds.security.admin-session';
const ADMIN_SESSIONS_KEY = 'ds.security.admin-sessions';
const ADMIN_ACTIVE_USERNAME_KEY = 'ds.security.admin-active-username';
const ADMIN_LAST_ERROR_KEY = 'ds.security.admin-last-error';
const ADMIN_TOKEN_COOKIE_NAME = 'ds_admin_token';
const ADMIN_FETCH_PATCHED = '__dsAdminFetchPatched__';

interface AdminSession {
  token: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  idleTimeoutMs: number;
  lastActivityAt: number;
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}

export interface AdminAuthStatusResult {
  configured: boolean;
  idleTimeoutMs: number;
}

interface SessionPayload {
  ok?: boolean;
  username?: string;
  role?: 'admin' | 'operator' | 'viewer' | string;
  idleTimeoutMs?: number;
  lastActivityAt?: number;
  error?: string;
}

interface AuthStatusPayload {
  configured?: boolean;
  idleTimeoutMs?: number;
  error?: string;
}

export interface StoredAdminAccount {
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  lastActivityAt: number;
}

type AdminSessionMap = Record<string, AdminSession>;

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const initMethod = String(init?.method || '').trim().toUpperCase();
  if (initMethod) return initMethod;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return String(input.method || 'GET').trim().toUpperCase() || 'GET';
  }
  return 'GET';
}

function getRequestPathname(requestUrl: string): string {
  try {
    return new URL(requestUrl, window.location.origin).pathname || '/';
  } catch {
    return '/';
  }
}

function isPublicApiRequest(pathname: string, method: string): boolean {
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

function normalizeRole(raw: unknown): 'admin' | 'operator' | 'viewer' {
  return raw === 'admin' || raw === 'operator' || raw === 'viewer' ? raw : 'admin';
}

function setLastAuthError(message: string): void {
  const value = String(message || '').trim();
  if (!value) {
    sessionStorage.removeItem(ADMIN_LAST_ERROR_KEY);
    return;
  }
  sessionStorage.setItem(ADMIN_LAST_ERROR_KEY, value);
}

function clearLastAuthError(): void {
  sessionStorage.removeItem(ADMIN_LAST_ERROR_KEY);
}

export function consumeLastAuthError(): string {
  const message = String(sessionStorage.getItem(ADMIN_LAST_ERROR_KEY) || '').trim();
  clearLastAuthError();
  return message;
}

function getCookieToken(): string {
  const cookie = String(document.cookie || '');
  if (!cookie) return '';
  const entries = cookie.split(';').map((item) => item.trim());
  const found = entries.find((item) => item.startsWith(`${ADMIN_TOKEN_COOKIE_NAME}=`));
  if (!found) return '';
  const value = found.slice(`${ADMIN_TOKEN_COOKIE_NAME}=`.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function setCookieToken(token: string, maxAgeSeconds = 20 * 60): void {
  if (!token) return;
  document.cookie = `${ADMIN_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function clearCookieToken(): void {
  document.cookie = `${ADMIN_TOKEN_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

function readSessionMap(): AdminSessionMap {
  try {
    const raw = localStorage.getItem(ADMIN_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<AdminSession>>;
    const result: AdminSessionMap = {};
    for (const [username, session] of Object.entries(parsed || {})) {
      if (!session?.token || !session?.username) continue;
      result[String(username).toLowerCase()] = {
        token: String(session.token),
        username: String(session.username),
        role: normalizeRole(session.role),
        idleTimeoutMs: Number(session.idleTimeoutMs) > 0 ? Number(session.idleTimeoutMs) : 20 * 60 * 1000,
        lastActivityAt: Number(session.lastActivityAt) > 0 ? Number(session.lastActivityAt) : Date.now()
      };
    }
    return result;
  } catch {
    return {};
  }
}

function writeSessionMap(sessions: AdminSessionMap): void {
  localStorage.setItem(ADMIN_SESSIONS_KEY, JSON.stringify(sessions));
}

function getActiveUsername(): string {
  return String(localStorage.getItem(ADMIN_ACTIVE_USERNAME_KEY) || '').trim().toLowerCase();
}

function setActiveUsername(username: string): void {
  localStorage.setItem(ADMIN_ACTIVE_USERNAME_KEY, String(username || '').trim().toLowerCase());
}

function getStoredSession(): AdminSession | null {
  const sessions = readSessionMap();
  const activeUsername = getActiveUsername();
  if (activeUsername && sessions[activeUsername]) {
    return sessions[activeUsername];
  }

  const fallbackSession = Object.values(sessions)[0] || null;
  if (fallbackSession?.username) {
    setActiveUsername(fallbackSession.username);
    return fallbackSession;
  }

  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    if (!parsed.token || !parsed.username) return null;
    const migrated: AdminSession = {
      token: String(parsed.token),
      username: String(parsed.username),
      role: normalizeRole(parsed.role),
      idleTimeoutMs: Number(parsed.idleTimeoutMs) > 0 ? Number(parsed.idleTimeoutMs) : 20 * 60 * 1000,
      lastActivityAt: Number(parsed.lastActivityAt) > 0 ? Number(parsed.lastActivityAt) : Date.now()
    };
    const nextSessions = { [migrated.username.toLowerCase()]: migrated };
    writeSessionMap(nextSessions);
    setActiveUsername(migrated.username);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return migrated;
  } catch {
    return null;
  }
}

function saveSession(session: AdminSession): void {
  const sessions = readSessionMap();
  sessions[session.username.toLowerCase()] = session;
  writeSessionMap(sessions);
  setActiveUsername(session.username);
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  setCookieToken(session.token, Math.floor(session.idleTimeoutMs / 1000));
  clearLastAuthError();
}

function clearSession(): void {
  const activeUsername = getActiveUsername();
  const sessions = readSessionMap();
  if (activeUsername && sessions[activeUsername]) {
    delete sessions[activeUsername];
    writeSessionMap(sessions);
  }
  const nextActive = Object.keys(sessions)[0] || '';
  if (nextActive) {
    setActiveUsername(nextActive);
  } else {
    localStorage.removeItem(ADMIN_ACTIVE_USERNAME_KEY);
  }
  localStorage.removeItem(ADMIN_SESSION_KEY);
  clearCookieToken();
}

function clearAllSessions(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSIONS_KEY);
  localStorage.removeItem(ADMIN_ACTIVE_USERNAME_KEY);
  clearCookieToken();
}

function touchSessionByUsername(username: string): void {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return;
  const sessions = readSessionMap();
  const current = sessions[key];
  if (!current) return;
  sessions[key] = { ...current, lastActivityAt: Date.now() };
  writeSessionMap(sessions);
  if (getActiveUsername() === key) {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessions[key]));
  }
}

function getFallbackSession(excludedToken: string): AdminSession | null {
  const sessions = Object.values(readSessionMap());
  for (const session of sessions) {
    if (!session?.token || session.token === excludedToken) continue;
    if (isSessionExpired(session)) continue;
    return session;
  }
  return null;
}

export function listStoredAdminAccounts(): StoredAdminAccount[] {
  const active = getActiveUsername();
  return Object.values(readSessionMap())
    .filter((session) => !isSessionExpired(session))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .map((session) => ({
      username: session.username,
      role: session.role,
      isActive: session.username.toLowerCase() === active,
      lastActivityAt: session.lastActivityAt
    }));
}

export function switchAdminAccount(username: string): boolean {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return false;
  const sessions = readSessionMap();
  const session = sessions[key];
  if (!session || isSessionExpired(session)) {
    if (sessions[key]) {
      delete sessions[key];
      writeSessionMap(sessions);
    }
    return false;
  }

  setActiveUsername(session.username);
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  touchSessionByUsername(session.username);
  return true;
}

export function removeStoredAdminAccount(username: string): void {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return;
  const sessions = readSessionMap();
  delete sessions[key];
  writeSessionMap(sessions);

  if (getActiveUsername() === key) {
    const next = Object.keys(sessions)[0] || '';
    if (next) {
      setActiveUsername(next);
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessions[next]));
    } else {
      clearAllSessions();
    }
  }
}

function isSessionExpired(session: AdminSession): boolean {
  return Date.now() - session.lastActivityAt > session.idleTimeoutMs;
}

function touchLocalSession(): void {
  const session = getStoredSession();
  if (!session || isSessionExpired(session)) {
    clearSession();
    return;
  }
  touchSessionByUsername(session.username);
}

export function isAdminAuthenticated(): boolean {
  const session = getStoredSession();
  if (!session) {
    return Boolean(getCookieToken());
  }
  if (isSessionExpired(session)) {
    clearSession();
    return false;
  }
  return true;
}

export function getAdminToken(): string | null {
  const session = getStoredSession();
  if (!session || isSessionExpired(session)) {
    const cookieToken = getCookieToken();
    if (cookieToken) return cookieToken;
    clearSession();
    return null;
  }
  return session.token;
}

export async function adoptAdminToken(token: string): Promise<LoginResult> {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    setLastAuthError('Token manquant.');
    return { ok: false, message: 'Token manquant.' };
  }

  try {
    const response = await fetch(`${getSystemApiBase()}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${trimmedToken}`
      }
    });

    const payload = await response.json().catch(() => ({} as SessionPayload));
    if (!response.ok || !payload?.username) {
      const message = String(payload?.error || 'Token invalide ou expiré.');
      setLastAuthError(message);
      return { ok: false, message };
    }

    saveSession({
      token: trimmedToken,
      username: String(payload.username),
      role: normalizeRole(payload.role),
      idleTimeoutMs: Number(payload.idleTimeoutMs) > 0 ? Number(payload.idleTimeoutMs) : 20 * 60 * 1000,
      lastActivityAt: Number(payload.lastActivityAt) > 0 ? Number(payload.lastActivityAt) : Date.now()
    });

    return { ok: true };
  } catch {
    setLastAuthError('Serveur indisponible.');
    return { ok: false, message: 'Serveur indisponible.' };
  }
}

export async function verifyCurrentAdminConnection(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;

  const result = await adoptAdminToken(token);
  if (!result.ok) {
    clearSession();
  }
  return result.ok;
}

export async function loginAdmin(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: username.trim(), password })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.token) {
      const message = String(payload?.error || 'Identifiants invalides.');
      setLastAuthError(message);
      return { ok: false, message };
    }

    saveSession({
      token: String(payload.token),
      username: String(payload.username || username.trim()),
      role: payload.role === 'admin' || payload.role === 'operator' || payload.role === 'viewer'
        ? payload.role
        : 'admin',
      idleTimeoutMs: Number(payload.idleTimeoutMs) > 0 ? Number(payload.idleTimeoutMs) : 20 * 60 * 1000,
      lastActivityAt: Number(payload.lastActivityAt) > 0 ? Number(payload.lastActivityAt) : Date.now()
    });

    return { ok: true };
  } catch {
    setLastAuthError('Serveur indisponible. Vérifiez la connexion au serveur.');
    return { ok: false, message: 'Serveur indisponible.' };
  }
}

export async function getAdminAuthStatus(): Promise<AdminAuthStatusResult> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/auth/status`, {
      method: 'GET',
      credentials: 'include'
    });
    const payload = await response.json().catch(() => ({} as AuthStatusPayload));
    return {
      configured: Boolean(payload?.configured),
      idleTimeoutMs: Number(payload?.idleTimeoutMs) > 0 ? Number(payload.idleTimeoutMs) : 20 * 60 * 1000
    };
  } catch {
    return {
      configured: true,
      idleTimeoutMs: 20 * 60 * 1000
    };
  }
}

export async function bootstrapAdminAccount(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: String(username || '').trim(), password })
    });

    const payload = await response.json().catch(() => ({} as SessionPayload));
    if (!response.ok || !payload?.ok) {
      const message = String(payload?.error || 'Initialisation admin impossible.');
      setLastAuthError(message);
      return { ok: false, message };
    }

    return { ok: true };
  } catch {
    const message = 'Serveur indisponible.';
    setLastAuthError(message);
    return { ok: false, message };
  }
}

export async function logoutAdmin(): Promise<void> {
  const token = getAdminToken();
  if (token) {
    await fetch(`${getSystemApiBase()}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).catch(() => undefined);
  }
  clearSession();
  clearLastAuthError();
}

export function getCurrentAdminSession(): { username: string; role: 'admin' | 'operator' | 'viewer' } | null {
  const session = getStoredSession();
  if (!session || isSessionExpired(session)) {
    clearSession();
    return null;
  }
  return {
    username: session.username,
    role: session.role
  };
}

export function installAdminAuthClient(): void {
  if ((window as unknown as Record<string, unknown>)[ADMIN_FETCH_PATCHED]) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getAdminToken();
    const requestUrl = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input.url);
    const isApiRequest = requestUrl.includes('/api/');
    const requestMethod = getRequestMethod(input, init);
    const requestPathname = getRequestPathname(requestUrl);
    const isPublicRequest = isPublicApiRequest(requestPathname, requestMethod);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && isApiRequest && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
      touchLocalSession();
    }

    const response = await originalFetch(input as RequestInfo, {
      ...init,
      credentials: init?.credentials || (isApiRequest ? 'include' : undefined),
      headers
    });

    if (response.status === 401 && isApiRequest && !isPublicRequest) {
      const fallbackSession = token ? getFallbackSession(token) : null;
      if (fallbackSession) {
        switchAdminAccount(fallbackSession.username);
        const retryHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        retryHeaders.set('Authorization', `Bearer ${fallbackSession.token}`);
        const retryResponse = await originalFetch(input as RequestInfo, {
          ...init,
          credentials: init?.credentials || (isApiRequest ? 'include' : undefined),
          headers: retryHeaders
        });

        if (retryResponse.status !== 401) {
          touchSessionByUsername(fallbackSession.username);
          return retryResponse;
        }
      }

      const currentToken = getAdminToken();
      if (currentToken) {
        const sessionCheckHeaders = new Headers();
        sessionCheckHeaders.set('Authorization', `Bearer ${currentToken}`);
        const sessionCheckResponse = await originalFetch(`${getSystemApiBase()}/api/auth/session`, {
          method: 'GET',
          credentials: 'include',
          headers: sessionCheckHeaders
        }).catch(() => null);

        if (sessionCheckResponse?.ok) {
          touchLocalSession();
          return response;
        }
      }

      setLastAuthError('Session admin invalide ou expirée. Reconnectez-vous.');
      clearAllSessions();
      const isPlayerPage = window.location.pathname.startsWith('/player');
      if (!isPlayerPage && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return response;
  };

  const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => touchLocalSession(), { passive: true });
  });

  window.setInterval(() => {
    const session = getStoredSession();
    if (!session) return;
    if (isSessionExpired(session)) {
      setLastAuthError('Session expirée (inactivité).');
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
  }, 5000);

  (window as unknown as Record<string, unknown>)[ADMIN_FETCH_PATCHED] = true;
}
