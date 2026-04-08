import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wifi, WifiOff, QrCode, Menu, X, RefreshCcw } from 'lucide-react';
import { type LayoutModel } from '../../shared/layoutRegistry';
import { DEFAULT_GROUP_THEME, type GroupThemeSettings, type ScreenModel } from '../../shared/screenRegistry';
import { expandEventsForPeriod, type LocalCalendarEvent, type LocalCalendarOccurrence, type RoomModel } from '../../shared/localCalendar';
import { getAssetBlob } from '../../services/assetService';
import { type ScreenGroupModel } from '../../shared/screenGroupRegistry';
import { resolvePlayerTheme } from '../../shared/playerTheme';
import { type PlaylistModel } from '../../shared/playlistRegistry';
import { markdownToHtml } from '../../services/markdownService';
import { computeNextMediaIndex, isVideoSource, resolvePlaylistMediaItems, type PlayerMediaItem } from '../../services/playerPlaylistEngine';
import { hydrateLocalStorageKeyFromDb, mirrorLocalStorageKeyToDb, syncLocalStorageKeyFromSystem } from '../../services/clientDbStorage';
import { getClientEnv } from '../../services/runtimeEnv';

interface PlayerIdentity {
  deviceId: string;
  deviceName: string;
  token: string;
}

type PlayerMode = 'loading' | 'enroll' | 'display';

interface PlayerBoardRow {
  kind: 'date' | 'event';
  dateLabel?: string;
  event?: LocalCalendarOccurrence;
}

interface EventStatus {
  label: 'En Cours' | 'Commence bientôt' | 'Prochainement' | 'Annulé';
  textClass: string;
}

interface PairingPinPayload {
  pin: string;
  expiresAt: string;
}

type PlayerCommandName = 'refresh' | 'reload' | 'reboot' | 'change-layout';

interface PlayerCommandPayload {
  id: string;
  command: PlayerCommandName;
}

interface PlayerLastKnownGoodSnapshot {
  savedAt: string;
  screen: ScreenModel | null;
  layout: LayoutModel | null;
  playlists: PlaylistModel[];
  rooms: RoomModel[];
  events: LocalCalendarEvent[];
  iframeOptimizedDomains: string[];
  groupTheme: GroupThemeSettings;
}

interface IframeSiteProfile {
  key: string;
  domains: string[];
  allow: string;
  sandbox: string;
  normalize: (url: URL) => string;
}

const DEVICE_KEY = 'ds.player.identity';
const LAST_KNOWN_GOOD_KEY = 'ds.player.last-known-good';
const API_PROBE_PATHS = ['/api/health', '/api/settings', '/api/storage/stats', '/api/screens'];
const DEFAULT_IFRAME_DOMAIN_WHITELIST = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'x.com',
  'twitter.com'
];

const DEFAULT_IFRAME_OPTIMIZED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'facebook.com',
  'spotify.com',
  'open.spotify.com',
  'soundcloud.com'
];

const DEFAULT_IFRAME_SITE_PROFILES: IframeSiteProfile[] = [
  {
    key: 'youtube',
    domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    normalize: (url) => {
      const host = url.hostname.toLowerCase();
      if (host.includes('youtu.be')) {
        const id = url.pathname.replace('/', '').trim();
        return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1&enablejsapi=1` : url.toString();
      }
      if (host.includes('youtube.com') && url.pathname === '/watch') {
        const id = url.searchParams.get('v')?.trim();
        return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=1&mute=1&enablejsapi=1` : url.toString();
      }
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '1');
      url.searchParams.set('playsinline', '1');
      return url.toString();
    }
  },
  {
    key: 'vimeo',
    domains: ['vimeo.com'],
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    normalize: (url) => {
      if (url.hostname.toLowerCase().includes('player.vimeo.com')) {
        url.searchParams.set('autoplay', '1');
        url.searchParams.set('muted', '1');
        return url.toString();
      }
      const id = url.pathname.split('/').filter(Boolean).at(-1)?.trim();
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1&muted=1` : url.toString();
    }
  },
  {
    key: 'dailymotion',
    domains: ['dailymotion.com'],
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    normalize: (url) => {
      const segments = url.pathname.split('/').filter(Boolean);
      const videoIndex = segments.findIndex((segment) => segment === 'video');
      const id = videoIndex >= 0 ? segments[videoIndex + 1] : '';
      return id ? `https://www.dailymotion.com/embed/video/${id}?autoplay=1&mute=1` : url.toString();
    }
  },
  {
    key: 'facebook',
    domains: ['facebook.com'],
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    normalize: (url) => {
      if (url.pathname.includes('/plugins/video.php')) {
        url.searchParams.set('autoplay', 'true');
        return url.toString();
      }
      return url.toString();
    }
  },
  {
    key: 'spotify',
    domains: ['spotify.com', 'open.spotify.com'],
    allow: 'autoplay; encrypted-media',
    sandbox: 'allow-scripts allow-same-origin allow-popups',
    normalize: (url) => {
      const host = url.hostname.toLowerCase();
      if (!host.includes('spotify.com')) return url.toString();
      const trimmed = url.pathname.replace(/^\//, '');
      if (trimmed.startsWith('embed/')) return url.toString();
      return `${url.origin}/embed/${trimmed}`;
    }
  }
];

function getPlayerClientAddress(): string {
  return window.location.hostname.trim();
}

function detectSystemOs(): string {
  const ua = navigator.userAgent || '';
  const platform = (navigator.platform || '').toLowerCase();

  if (/windows nt 11|windows nt 10\.0/i.test(ua) || platform.includes('win')) return 'Windows';
  if (/mac os x/i.test(ua) || platform.includes('mac')) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/raspberry|armv7l|aarch64/i.test(ua)) return 'Raspberry Pi OS';
  if (/linux/i.test(ua) || platform.includes('linux')) return 'Linux';

  return navigator.platform || 'Inconnu';
}

async function collectPlayerTelemetry(version: string, startedAtMs: number) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let diskUsedPercent = 0;
  try {
    const estimate = await navigator.storage?.estimate?.();
    const quota = Number(estimate?.quota || 0);
    const usage = Number(estimate?.usage || 0);
    if (quota > 0) {
      diskUsedPercent = Math.round((usage / quota) * 100);
    }
  } catch {
    diskUsedPercent = 0;
  }

  return {
    cpuPercent: Math.min(100, Math.max(0, Math.round((navigator.hardwareConcurrency || 0) * 8))),
    memoryPercent: Math.min(100, Math.max(0, Math.round((Number(nav.deviceMemory || 0) / 16) * 100))),
    temperatureC: 0,
    diskUsedPercent,
    heartbeatLatencyMs: Math.max(0, Date.now() - startedAtMs),
    version
  };
}

function isItemAllowedByLocalSchedule(entry: any, now = new Date()): boolean {
  if (!entry || typeof entry !== 'object') return true;

  const startAt = String(entry.startAt || '').trim();
  const endAt = String(entry.endAt || '').trim();
  const nowTs = now.getTime();

  if (startAt) {
    const startTs = new Date(startAt).getTime();
    if (Number.isFinite(startTs) && nowTs < startTs) return false;
  }

  if (endAt) {
    const endTs = new Date(endAt).getTime();
    if (Number.isFinite(endTs) && nowTs > endTs) return false;
  }

  if (Array.isArray(entry.daysOfWeek) && entry.daysOfWeek.length > 0) {
    const day = now.getDay();
    const allowed = entry.daysOfWeek.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value));
    if (allowed.length > 0 && !allowed.includes(day)) return false;
  }

  return true;
}

function detectDefaultPlayerName(seed: string): string {
  const host = window.location.hostname?.trim();
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;

  const platform = navigator.platform?.toLowerCase() ?? '';
  const ua = navigator.userAgent?.toLowerCase() ?? '';

  if (platform.includes('win') || ua.includes('windows')) {
    return `DESKTOP-${seed.slice(0, 8).toUpperCase()}`;
  }
  if (platform.includes('linux') || ua.includes('linux')) {
    if (ua.includes('arm') || ua.includes('raspberry')) return `Raspberry-${seed.slice(0, 4)}`;
    return 'Debian';
  }
  if (platform.includes('mac') || ua.includes('mac os')) return 'macOS';

  return `Player-${seed.slice(0, 6)}`;
}

function resolveIframeProfile(source: string, optimizedDomains: string[]): IframeSiteProfile | null {
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    const enabled = new Set(optimizedDomains.map((value) => value.toLowerCase()));
    return DEFAULT_IFRAME_SITE_PROFILES.find((profile) =>
      profile.domains.some((domain) =>
        enabled.has(domain.toLowerCase())
        && (host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`))
      )
    ) || null;
  } catch {
    return null;
  }
}

function normalizeIframeSource(source: string, optimizedDomains: string[]): string {
  try {
    const url = new URL(source);
    const profile = resolveIframeProfile(source, optimizedDomains);
    if (!profile) return url.toString();
    return profile.normalize(url);
  } catch {
    return source;
  }
}

function fitIframeEmbedToZone(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const iframes = Array.from(doc.querySelectorAll('iframe'));

    iframes.forEach((iframe) => {
      iframe.removeAttribute('width');
      iframe.removeAttribute('height');
      const style = iframe.getAttribute('style') || '';
      iframe.setAttribute(
        'style',
        `${style};width:100%;height:100%;max-width:100%;max-height:100%;display:block;`.trim()
      );
    });

    return doc.body.innerHTML || html;
  } catch {
    return html;
  }
}

function buildIdentity(instanceId: string, forcedDeviceId?: string): PlayerIdentity {
  const identityKey = `${DEVICE_KEY}.${instanceId}`;

  const persistIdentity = (identity: PlayerIdentity): PlayerIdentity => {
    localStorage.setItem(identityKey, JSON.stringify(identity));
    return identity;
  };

  const createFreshIdentity = (): PlayerIdentity => {
    const deviceSeed = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.floor(Math.random() * 9999)}`).replace(/-/g, '');
    return {
      deviceId: forcedDeviceId || globalThis.crypto?.randomUUID?.() || `rpi-${Date.now()}-${instanceId}`,
      deviceName: detectDefaultPlayerName(deviceSeed),
      token: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, '')
    };
  };

  const raw = localStorage.getItem(identityKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
      const next: PlayerIdentity = {
        deviceId: String(forcedDeviceId || parsed?.deviceId || '').trim() || globalThis.crypto?.randomUUID?.() || `rpi-${Date.now()}-${instanceId}`,
        deviceName: String(parsed?.deviceName || '').trim() || detectDefaultPlayerName((globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, '')),
        token: String(parsed?.token || '').trim() || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, '')
      };
      return persistIdentity(next);
    } catch {
      localStorage.removeItem(identityKey);
    }
  }

  return persistIdentity(createFreshIdentity());
}

function getOccurrenceSourceId(occurrence: LocalCalendarOccurrence): string {
  return occurrence.sourceEventId || occurrence.recurrenceParentId || occurrence.id;
}

function keepSingleUpcomingOccurrencePerSeries(occurrences: LocalCalendarOccurrence[], nowMs: number): LocalCalendarOccurrence[] {
  const grouped = new Map<string, LocalCalendarOccurrence[]>();

  occurrences.forEach((occurrence) => {
    const key = getOccurrenceSourceId(occurrence);
    const list = grouped.get(key) ?? [];
    list.push(occurrence);
    grouped.set(key, list);
  });

  const picked: LocalCalendarOccurrence[] = [];
  grouped.forEach((list) => {
    const next = [...list]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .find((item) => new Date(item.endAt).getTime() >= nowMs);
    if (next) picked.push(next);
  });

  return picked.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function selectBoardDisplayWindow(occurrences: LocalCalendarOccurrence[], nowMs: number): LocalCalendarOccurrence[] {
  if (occurrences.length === 0) return [];

  const today = dayKey(new Date(nowMs).toISOString());
  const todayItems = occurrences.filter((item) => dayKey(item.startAt) === today);
  if (todayItems.length > 0) {
    return todayItems;
  }

  const first = occurrences[0];
  const firstDay = dayKey(first.startAt);
  if (!firstDay) return occurrences;
  return occurrences.filter((item) => dayKey(item.startAt) === firstDay);
}

function formatDayLabelFr(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('fr-FR');
}

function formatHeaderDateFr(date: Date): string {
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', '');
  const day = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date).replace('.', '');
  const year = new Intl.DateTimeFormat('fr-FR', { year: 'numeric' }).format(date);
  return `(${weekday} ${day}, ${month} ${year})`;
}

async function canReachFunctionalApi(baseUrl: string): Promise<boolean> {
  for (const path of API_PROBE_PATHS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      if (response.status !== 404 && response.status < 500) return true;
    } catch {
      // continue probing endpoints
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

async function fetchPlayerContext(baseUrl: string): Promise<{
  rooms: RoomModel[];
  events: LocalCalendarEvent[];
  groups: ScreenGroupModel[];
}> {
  const response = await fetch(`${baseUrl}/api/player/context`, {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(`player-context-unavailable:${response.status}`);
    }
    return { rooms: [], events: [], groups: [] };
  }

  const payload = await response.json();
  return {
    rooms: Array.isArray(payload?.rooms) ? payload.rooms as RoomModel[] : [],
    events: Array.isArray(payload?.events) ? payload.events as LocalCalendarEvent[] : [],
    groups: Array.isArray(payload?.groups) ? payload.groups as ScreenGroupModel[] : []
  };
}

async function fetchSystemPlaylists(baseUrl: string): Promise<PlaylistModel[]> {
  const response = await fetch(`${baseUrl}/api/playlists`, {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(`playlists-unavailable:${response.status}`);
    }
    return [];
  }
  const payload = await response.json();
  return Array.isArray(payload?.records) ? payload.records as PlaylistModel[] : [];
}

async function isPlayerAuthorized(baseUrl: string, identity: PlayerIdentity): Promise<boolean> {
  try {
    const response = await fetch(
      `${baseUrl}/api/player/authorize?deviceId=${encodeURIComponent(identity.deviceId)}&token=${encodeURIComponent(identity.token)}`,
      { method: 'GET', cache: 'no-store' }
    );

    if (!response.ok) return false;
    const payload = await response.json();
    return Boolean(payload?.authorized);
  } catch {
    return false;
  }
}

function getEventStatus(startMs: number, endMs: number, nowMs: number, status?: LocalCalendarOccurrence['status']): EventStatus {
  if (status === 'cancelled') {
    return { label: 'Annulé', textClass: 'text-[var(--player-danger)]' };
  }

  if (nowMs >= startMs && nowMs < endMs) {
    return { label: 'En Cours', textClass: 'text-[var(--player-danger)]' };
  }

  const minutesBeforeStart = (startMs - nowMs) / (60 * 1000);
  if (minutesBeforeStart >= 5 && minutesBeforeStart <= 10) {
    return { label: 'Commence bientôt', textClass: 'text-[var(--player-warning)]' };
  }

  return { label: 'Prochainement', textClass: 'text-[var(--player-success)]' };
}

function dayKey(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildBoardRows(events: LocalCalendarOccurrence[], nowMs: number): PlayerBoardRow[] {
  const rows: PlayerBoardRow[] = [];
  const todayKey = dayKey(new Date(nowMs).toISOString());
  let lastDay: string | null = null;

  events.forEach((event) => {
    const eventDay = dayKey(event.startAt);
    const shouldInsertDate = (lastDay === null && eventDay !== todayKey) || (lastDay !== null && eventDay !== lastDay);
    if (shouldInsertDate) {
      rows.push({ kind: 'date', dateLabel: formatDayLabelFr(event.startAt) });
    }
    rows.push({ kind: 'event', event });
    lastDay = eventDay;
  });

  return rows;
}

async function postHeartbeat(baseUrl: string, identity: PlayerIdentity, os: string, clientIp: string, playerVersion: string): Promise<PlayerCommandPayload | null> {
  const startedAtMs = Date.now();
  try {
    const telemetry = await collectPlayerTelemetry(playerVersion, startedAtMs);
    const response = await fetch(`${baseUrl}/api/player/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        os,
        clientIp,
        telemetry,
        at: new Date().toISOString()
      })
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const commandId = String(payload?.command?.id || '').trim();
    const command = String(payload?.command?.command || '').trim().toLowerCase();
    if (commandId && (command === 'refresh' || command === 'reload' || command === 'reboot' || command === 'change-layout')) {
      return {
        id: commandId,
        command
      };
    }
    return null;
  } catch {
    // best effort
    return null;
  }
}

async function sendCommandAck(baseUrl: string, identity: PlayerIdentity, command: PlayerCommandPayload, status: 'done' | 'failed', error?: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/player/command-ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        commandId: command.id,
        status,
        error: error || ''
      })
    });
  } catch {
    // best effort
  }
}

async function tryAutoEnroll(baseUrl: string, identity: PlayerIdentity, os: string, clientIp: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/player/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        devname: identity.deviceName,
        os,
        clientIp
      })
    });
  } catch {
    // best effort
  }
}

async function startPairingPin(baseUrl: string, identity: PlayerIdentity, os: string, clientIp: string): Promise<PairingPinPayload | null> {
  try {
    const response = await fetch(`${baseUrl}/api/player/pair/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        token: identity.token,
        devname: identity.deviceName,
        os,
        clientIp
      })
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const pin = String(payload?.pin || '').trim();
    if (!/^\d{6}$/.test(pin)) return null;

    const expiresAt = String(payload?.expiresAt || '').trim();
    return {
      pin,
      expiresAt
    };
  } catch {
    return null;
  }
}

export function Player() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const instanceId = query.get('instance') || '1';
  const forcedDeviceId = query.get('deviceId') || undefined;
  const detectedOs = useMemo(() => detectSystemOs(), []);
  const playerVersion = String(getClientEnv('VITE_APP_VERSION') || 'dev');

  const [mode, setMode] = useState<PlayerMode>('loading');
  const [online, setOnline] = useState(false);
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [assignedScreen, setAssignedScreen] = useState<ScreenModel | null>(null);
  const [layout, setLayout] = useState<LayoutModel | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistModel[]>([]);
  const [adminBase, setAdminBase] = useState('');
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [events, setEvents] = useState<LocalCalendarEvent[]>([]);
  const [visibleRows, setVisibleRows] = useState<LocalCalendarOccurrence[]>([]);
  const [removingRows, setRemovingRows] = useState<Record<string, boolean>>({});
  const [clockNow, setClockNow] = useState(new Date());
  const [boardRows, setBoardRows] = useState<PlayerBoardRow[]>([]);
  const [resolvedAssetUrls, setResolvedAssetUrls] = useState<Record<string, string>>({});
  const [resolvedFooterLogoUrls, setResolvedFooterLogoUrls] = useState<Record<string, string>>({});
  const footerLogoUrlCacheRef = useRef<Record<string, string>>({});
  const [mediaIndexByZone, setMediaIndexByZone] = useState<Record<string, number>>({});
  const [iframeOptimizedDomains, setIframeOptimizedDomains] = useState<string[]>(DEFAULT_IFRAME_OPTIMIZED_DOMAINS);
  const [groupTheme, setGroupTheme] = useState<GroupThemeSettings>(DEFAULT_GROUP_THEME);
  const [pairingPin, setPairingPin] = useState<PairingPinPayload | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const lastSyncOkRef = useRef<number>(Date.now());
  const footerMarqueeTrackRef = useRef<HTMLDivElement | null>(null);
  const boardScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const effectiveTheme = useMemo(
    () => resolvePlayerTheme(groupTheme, assignedScreen?.theme, clockNow),
    [assignedScreen?.theme, clockNow, groupTheme]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--player-bg', effectiveTheme.background);
    root.style.setProperty('--player-fg', effectiveTheme.foreground);
    root.style.setProperty('--player-card-bg', effectiveTheme.cardBackground);
    root.style.setProperty('--player-border-strong', effectiveTheme.borderStrong);
    root.style.setProperty('--player-muted', effectiveTheme.mutedForeground);
    root.style.setProperty('--player-accent', effectiveTheme.primaryColor);
    root.style.setProperty('--player-accent-soft', effectiveTheme.accentSoft);
    root.style.setProperty('--player-success', effectiveTheme.success);
    root.style.setProperty('--player-warning', effectiveTheme.warning);
    root.style.setProperty('--player-danger', effectiveTheme.danger);
    root.style.setProperty('--player-info-soft-bg', effectiveTheme.infoSoftBackground);
    root.style.setProperty('--player-divider', effectiveTheme.divider);

    return () => {
      root.style.removeProperty('--player-bg');
      root.style.removeProperty('--player-fg');
      root.style.removeProperty('--player-card-bg');
      root.style.removeProperty('--player-border-strong');
      root.style.removeProperty('--player-muted');
      root.style.removeProperty('--player-accent');
      root.style.removeProperty('--player-accent-soft');
      root.style.removeProperty('--player-success');
      root.style.removeProperty('--player-warning');
      root.style.removeProperty('--player-danger');
      root.style.removeProperty('--player-info-soft-bg');
      root.style.removeProperty('--player-divider');
    };
  }, [effectiveTheme]);

  useEffect(() => {
    const base = getClientEnv('VITE_ADMIN_API_BASE');
    const resolvedBase = base || window.location.origin;
    setAdminBase(resolvedBase);
    const playerClientIp = getPlayerClientAddress();
    const identityKey = `${DEVICE_KEY}.${instanceId}`;
    const lastKnownGoodKey = `${LAST_KNOWN_GOOD_KEY}.${instanceId}`;

    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const bootstrap = async () => {
      await syncLocalStorageKeyFromSystem(identityKey).catch(() => false);
      await hydrateLocalStorageKeyFromDb(identityKey).catch(() => undefined);

      const id = buildIdentity(instanceId, forcedDeviceId);
      if (active) {
        setIdentity(id);
      }
      await mirrorLocalStorageKeyToDb(identityKey).catch(() => undefined);

      const apiIsReachable = await canReachFunctionalApi(resolvedBase);
      if (!active) return;
      setOnline(apiIsReachable);

      if (!apiIsReachable) {
        const raw = localStorage.getItem(lastKnownGoodKey);
        if (raw) {
          try {
            const cached = JSON.parse(raw) as PlayerLastKnownGoodSnapshot;
            setAssignedScreen(cached?.screen ?? null);
            setLayout(cached?.layout ?? null);
            setPlaylists(Array.isArray(cached?.playlists) ? cached.playlists : []);
            setRooms(Array.isArray(cached?.rooms) ? cached.rooms : []);
            setEvents(Array.isArray(cached?.events) ? cached.events : []);
            setIframeOptimizedDomains(
              Array.isArray(cached?.iframeOptimizedDomains) && cached.iframeOptimizedDomains.length > 0
                ? cached.iframeOptimizedDomains
                : DEFAULT_IFRAME_OPTIMIZED_DOMAINS
            );
            setGroupTheme(cached?.groupTheme ?? DEFAULT_GROUP_THEME);
            setMediaIndexByZone({});
            setPairingPin(null);
            setMode(cached?.layout ? 'display' : 'enroll');
            return;
          } catch {
            localStorage.removeItem(lastKnownGoodKey);
          }
        }

        setAssignedScreen(null);
        setLayout(null);
        setPlaylists([]);
        setRooms([]);
        setEvents([]);
        setMediaIndexByZone({});
        setPairingPin(null);
        setMode('enroll');
        return;
      }

      const command = await postHeartbeat(resolvedBase, id, detectedOs, playerClientIp, playerVersion);
      if (command) {
        await sendCommandAck(resolvedBase, id, command, 'done');
        window.location.reload();
        return;
      }

      const authorized = await isPlayerAuthorized(resolvedBase, id);
      if (!authorized) {
        await tryAutoEnroll(resolvedBase, id, detectedOs, playerClientIp);
        const pinPayload = await startPairingPin(resolvedBase, id, detectedOs, playerClientIp);
        setPairingPin(pinPayload);
        setAssignedScreen(null);
        setLayout(null);
        setPlaylists([]);
        setMediaIndexByZone({});
        setMode('enroll');
        return;
      }

      setPairingPin(null);

      try {
        const [response, playlistsRows] = await Promise.all([
          fetch(`${resolvedBase}/api/screens/bootstrap?deviceId=${encodeURIComponent(id.deviceId)}&token=${encodeURIComponent(id.token)}`, {
            cache: 'no-store'
          }),
          fetchSystemPlaylists(resolvedBase)
        ]);
        if (!response.ok) throw new Error('bootstrap failed');
        const payload = await response.json();
        const nextScreen = (payload.screen ?? null) as ScreenModel | null;
        const nextLayout = (payload.layout ?? null) as LayoutModel | null;
        setAssignedScreen(nextScreen);
        setLayout(nextLayout);
        setPlaylists(playlistsRows);
        setIframeOptimizedDomains(DEFAULT_IFRAME_OPTIMIZED_DOMAINS);
        setMediaIndexByZone({});
        setMode('display');
        lastSyncOkRef.current = Date.now();

        const snapshot: PlayerLastKnownGoodSnapshot = {
          savedAt: new Date().toISOString(),
          screen: nextScreen,
          layout: nextLayout,
          playlists: playlistsRows,
          rooms,
          events,
          iframeOptimizedDomains,
          groupTheme
        };
        localStorage.setItem(lastKnownGoodKey, JSON.stringify(snapshot));
      } catch {
        setOnline(false);
        const raw = localStorage.getItem(lastKnownGoodKey);
        if (raw) {
          try {
            const cached = JSON.parse(raw) as PlayerLastKnownGoodSnapshot;
            setAssignedScreen(cached?.screen ?? null);
            setLayout(cached?.layout ?? null);
            setPlaylists(Array.isArray(cached?.playlists) ? cached.playlists : playlists);
            setRooms(Array.isArray(cached?.rooms) ? cached.rooms : rooms);
            setEvents(Array.isArray(cached?.events) ? cached.events : events);
            setIframeOptimizedDomains(
              Array.isArray(cached?.iframeOptimizedDomains) && cached.iframeOptimizedDomains.length > 0
                ? cached.iframeOptimizedDomains
                : DEFAULT_IFRAME_OPTIMIZED_DOMAINS
            );
            setGroupTheme(cached?.groupTheme ?? groupTheme);
            setMediaIndexByZone({});
            setMode(cached?.layout ? 'display' : mode);
          } catch {
            // keep in-memory state when cache read fails
          }
        }
      }

      if (Date.now() - lastSyncOkRef.current > 45000) {
        window.location.reload();
      }
    };

    void bootstrap();
    interval = setInterval(() => {
      void bootstrap();
    }, 8000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [detectedOs, forcedDeviceId, instanceId]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const close = () => setShowMobileMenu(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [showMobileMenu]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (layout?.mode !== 'room-status-board') return;
    const container = boardScrollContainerRef.current;
    if (!container) return;
    const lowVisionEnabled = (layout?.displayTemplate ?? 'classic') === 'low-vision';

    // Pause en haut et en bas pour améliorer la lisibilité sur écran mural.
    const PAUSE_MS = 3500;
    // Vitesse configurable (px/s), volontairement lente pour laisser le temps de lecture.
    const SCROLL_SPEED_PX_PER_SECOND = lowVisionEnabled ? 24 : 24;

    // Machine d'états du board pour un comportement lisible et prévisible.
    type ScrollPhase = 'pause-top' | 'scroll-down' | 'pause-bottom' | 'scroll-up';
    let frameId = 0;
    let phase: ScrollPhase = 'pause-top';
    let phaseStartedAt = performance.now();
    let previousTimestamp = 0;
    let animatedOffset = 0;

    // Réinitialise toujours la position au démarrage de l'animation sur la div cible.
    container.scrollTop = 0;
    animatedOffset = 0;

    // Boucle d'animation: pilotage unique via requestAnimationFrame.
    const tick = (timestamp: number) => {
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);

      // Pas de débordement: on garde la position en haut et on n'anime pas.
      if (maxScrollTop <= 0.5) {
        animatedOffset = 0;
        container.scrollTop = 0;
        phase = 'pause-top';
        phaseStartedAt = timestamp;
        previousTimestamp = timestamp;
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const elapsedSeconds = previousTimestamp > 0
        ? Math.max(0, (timestamp - previousTimestamp) / 1000)
        : 0;
      previousTimestamp = timestamp;

      if (phase === 'pause-top') {
        animatedOffset = 0;
        container.scrollTop = 0;
        if (timestamp - phaseStartedAt >= PAUSE_MS) {
          phase = 'scroll-down';
          previousTimestamp = timestamp;
        }
      } else if (phase === 'scroll-down') {
        // Easing in-out: plus rapide au centre, plus lent aux extrémités.
        const progress = maxScrollTop > 0 ? Math.min(1, Math.max(0, animatedOffset / maxScrollTop)) : 0;
        const easeFactor = 0.55 + (0.9 * Math.sin(progress * Math.PI));
        animatedOffset = Math.min(maxScrollTop, animatedOffset + (SCROLL_SPEED_PX_PER_SECOND * easeFactor * elapsedSeconds));
        container.scrollTop = animatedOffset;
        const next = animatedOffset;
        if (next >= maxScrollTop - 0.5) {
          animatedOffset = maxScrollTop;
          container.scrollTop = maxScrollTop;
          phase = 'pause-bottom';
          phaseStartedAt = timestamp;
          previousTimestamp = timestamp;
        }
      } else if (phase === 'pause-bottom') {
        animatedOffset = maxScrollTop;
        container.scrollTop = maxScrollTop;
        if (timestamp - phaseStartedAt >= PAUSE_MS) {
          phase = 'scroll-up';
          previousTimestamp = timestamp;
        }
      } else {
        // Même profil d'easing au retour pour un mouvement symétrique.
        const progress = maxScrollTop > 0 ? Math.min(1, Math.max(0, animatedOffset / maxScrollTop)) : 0;
        const easeFactor = 0.55 + (0.9 * Math.sin(progress * Math.PI));
        animatedOffset = Math.max(0, animatedOffset - (SCROLL_SPEED_PX_PER_SECOND * easeFactor * elapsedSeconds));
        container.scrollTop = animatedOffset;
        const next = animatedOffset;
        if (next <= 0.5) {
          animatedOffset = 0;
          container.scrollTop = 0;
          phase = 'pause-top';
          phaseStartedAt = timestamp;
          previousTimestamp = timestamp;
        }
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [layout?.mode, layout?.displayTemplate, boardRows.length, visibleRows.length]);

  const selectedRoomIds = useMemo(() => {
    if (!assignedScreen) return [] as string[];
    if (assignedScreen.roomIds && assignedScreen.roomIds.length > 0) return assignedScreen.roomIds;
    if (assignedScreen.roomId) return [assignedScreen.roomId];
    return [] as string[];
  }, [assignedScreen]);

  useEffect(() => {
    if (!adminBase) return undefined;
    const lastKnownGoodKey = `${LAST_KNOWN_GOOD_KEY}.${instanceId}`;

    const syncData = async () => {
      try {
        const [{ rooms: nextRooms, events: nextEvents, groups: nextGroups }, playlistRows] = await Promise.all([
          fetchPlayerContext(adminBase),
          fetchSystemPlaylists(adminBase)
        ]);
        setOnline(true);
        setRooms(nextRooms);
        setEvents(nextEvents);
        setPlaylists(playlistRows);
        setIframeOptimizedDomains(DEFAULT_IFRAME_OPTIMIZED_DOMAINS);
        let nextTheme = DEFAULT_GROUP_THEME;
        if (assignedScreen?.groupId) {
          const foundGroup = nextGroups.find((group) => group.id === assignedScreen.groupId);
          nextTheme = foundGroup?.theme ?? DEFAULT_GROUP_THEME;
          setGroupTheme(nextTheme);
        } else {
          setGroupTheme(nextTheme);
        }

        const snapshot: PlayerLastKnownGoodSnapshot = {
          savedAt: new Date().toISOString(),
          screen: assignedScreen,
          layout,
          playlists: playlistRows,
          rooms: nextRooms,
          events: nextEvents,
          iframeOptimizedDomains: DEFAULT_IFRAME_OPTIMIZED_DOMAINS,
          groupTheme: nextTheme
        };
        localStorage.setItem(lastKnownGoodKey, JSON.stringify(snapshot));
      } catch {
        setOnline(false);
      }
    };

    void syncData();
    const timer = setInterval(() => {
      void syncData();
    }, 3000);
    return () => clearInterval(timer);
  }, [adminBase, assignedScreen, assignedScreen?.groupId, instanceId, layout]);

  useEffect(() => {
    const now = Date.now();
    const expanded = expandEventsForPeriod(events, new Date(now - 24 * 60 * 60 * 1000), new Date(now + 30 * 24 * 60 * 60 * 1000));
    const activeRaw = [...expanded]
      .filter((event) => selectedRoomIds.length === 0 || selectedRoomIds.includes(event.roomId))
      .filter((event) => {
        const end = event.endAt ? new Date(event.endAt).getTime() : new Date(event.startAt).getTime() + 60 * 60 * 1000;
        return end > now;
      })
      .sort((a, b) => {
        const startDiff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        if (startDiff !== 0) return startDiff;
        const titleDiff = a.title.localeCompare(b.title, 'fr');
        if (titleDiff !== 0) return titleDiff;
        return a.roomNumber.localeCompare(b.roomNumber, 'fr');
      });
    const deduped = keepSingleUpcomingOccurrencePerSeries(activeRaw, now);
    const active = selectBoardDisplayWindow(deduped, now);
    setBoardRows(buildBoardRows(active, now));

    const activeIds = new Set(active.map((event) => event.id));
    const currentlyVisibleIds = new Set(visibleRows.map((event) => event.id));
    const toRemove = [...currentlyVisibleIds].filter((id) => !activeIds.has(id));

    if (toRemove.length > 0) {
      const map: Record<string, boolean> = {};
      toRemove.forEach((id) => {
        map[id] = true;
      });
      setRemovingRows((prev) => ({ ...prev, ...map }));

      const timeout = setTimeout(() => {
        setVisibleRows(active);
        setRemovingRows({});
      }, 450);

      return () => clearTimeout(timeout);
    }

    setVisibleRows(active);
  }, [events, selectedRoomIds]);

  useEffect(() => {
    if (!layout) {
      setResolvedAssetUrls({});
      return;
    }

    const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
    const sources = layout.zones
      .filter((zone) => zone.type === 'media' && typeof zone.playlistId === 'string' && zone.playlistId.length > 0)
      .flatMap((zone) => {
        const playlist = playlistById.get(zone.playlistId || '');
        if (!playlist) return [] as string[];
        return playlist.items
          .filter((entry) => entry.kind === 'asset' && (entry.assetType === 'image' || entry.assetType === 'video'))
          .map((entry) => `${entry.assetType === 'video' ? 'asset-video' : 'asset-image'}:${entry.assetId || ''}`);
      })
      .filter((source) => source.endsWith(':') === false);

    const refs = Array.from(new Set(sources));
    const nextMap: Record<string, string> = {};
    const createdUrls: string[] = [];

    const run = async () => {
      for (const ref of refs) {
        const assetId = ref.split(':', 2)[1];
        if (!assetId) continue;
        const blob = await getAssetBlob(assetId);
        if (!blob) continue;
        const objectUrl = URL.createObjectURL(blob);
        nextMap[ref] = objectUrl;
        createdUrls.push(objectUrl);
      }
      setResolvedAssetUrls(nextMap);
    };

    run().catch(() => setResolvedAssetUrls({}));

    return () => {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [layout, playlists]);

  const registerUrl = useMemo(() => {
    if (!identity) return '';
    return `${adminBase}/screens`;
  }, [adminBase, identity]);

  const formatDateTime = (value: string) => new Date(value).toLocaleString('fr-FR');
  const formatDateOnly = (value: string) => new Date(value).toLocaleDateString('fr-FR');
  const formatTimeOnly = (value: string) => new Date(value).toLocaleTimeString('fr-FR');

  const roomById = (roomId: string) => rooms.find((room) => room.id === roomId);

  const currentEvent = visibleRows.find((event) => {
    if (event.status === 'cancelled') return false;
    const now = Date.now();
    const start = new Date(event.startAt).getTime();
    const end = event.endAt ? new Date(event.endAt).getTime() : start + 60 * 60 * 1000;
    return start <= now && now < end;
  }) ?? null;

  const nextEvent = visibleRows.find((event) => event.status !== 'cancelled' && new Date(event.startAt).getTime() > Date.now()) ?? null;
  const headerDateLabel = formatHeaderDateFr(clockNow);
  const centeredTitle = layout?.headerText?.trim() || assignedScreen?.name || 'Digital Signage Player';
  const isLowVisionTemplate = (layout?.displayTemplate ?? 'classic') === 'low-vision';
  const footerLogoListKey = JSON.stringify(layout?.footerLogos ?? []);

  const displayedFooterLogos = useMemo(() => {
    const footerLogos = (layout?.footerLogos ?? [])
      .map((logo) => logo.trim())
      .filter((logo) => logo.length > 0);

    if (footerLogos.length === 0) return [] as string[];
    return Array.from({ length: Math.max(2, Math.ceil(8 / footerLogos.length)) }, () => footerLogos).flat();
  }, [footerLogoListKey]);

  const marqueeLogos = useMemo(
    () => [...displayedFooterLogos, ...displayedFooterLogos],
    [displayedFooterLogos]
  );

  useEffect(() => {
    const track = footerMarqueeTrackRef.current;
    if (!track || marqueeLogos.length <= 1) {
      if (track) {
        track.style.transform = 'translate3d(0, 0, 0)';
      }
      return;
    }

    const SPEED_PX_PER_SECOND = isLowVisionTemplate ? 26 : 30;

    let frameId = 0;
    let lastTs = 0;
    let offsetPx = 0;

    track.style.transform = 'translate3d(0, 0, 0)';

    // Marquee logos en boucle continue (sens unique) avec easing périodique.
    const tick = (timestamp: number) => {
      const viewportWidth = track.parentElement?.clientWidth ?? 0;
      const loopWidth = track.scrollWidth / 2;
      const maxOffset = Math.max(0, loopWidth - viewportWidth);

      if (maxOffset <= 1) {
        offsetPx = 0;
        lastTs = timestamp;
        track.style.transform = 'translate3d(0, 0, 0)';
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const deltaSeconds = lastTs > 0 ? Math.max(0, (timestamp - lastTs) / 1000) : 0;
      lastTs = timestamp;

      // Défilement continu dans un seul sens (gauche), avec boucle infinie.
      const loopProgress = loopWidth > 0 ? (offsetPx % loopWidth) / loopWidth : 0;
      const easeFactor = 0.7 + (0.8 * Math.sin(loopProgress * Math.PI));
      offsetPx += (SPEED_PX_PER_SECOND * easeFactor) * deltaSeconds;
      if (offsetPx >= loopWidth) {
        offsetPx = offsetPx % loopWidth;
      }
      track.style.transform = `translate3d(${-offsetPx}px, 0, 0)`;

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isLowVisionTemplate, marqueeLogos.length, footerLogoListKey]);

  const mediaItemsByZone = useMemo(() => {
    if (!layout) return {} as Record<string, PlayerMediaItem[]>;
    const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
    const result: Record<string, PlayerMediaItem[]> = {};
    const now = new Date();

    layout.zones
      .filter((zone) => zone.type === 'media')
      .forEach((zone) => {
        const playlist = zone.playlistId ? (playlistById.get(zone.playlistId) || null) : null;
        const scheduledPlaylist = playlist
          ? {
              ...playlist,
              items: playlist.items.filter((entry) => isItemAllowedByLocalSchedule(entry as any, now))
            }
          : null;
        result[zone.id] = resolvePlaylistMediaItems(scheduledPlaylist as PlaylistModel | null, resolvedAssetUrls);
      });

    return result;
  }, [layout, playlists, resolvedAssetUrls]);

  useEffect(() => {
    if (!layout || !adminBase || !('caches' in window)) return;
    const playlistById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
    const assetIds = new Set<string>();

    layout.zones
      .filter((zone) => zone.type === 'media' && zone.playlistId)
      .forEach((zone) => {
        const playlist = zone.playlistId ? playlistById.get(zone.playlistId) : undefined;
        playlist?.items.forEach((entry) => {
          if (entry.kind === 'asset' && (entry.assetType === 'image' || entry.assetType === 'video') && entry.assetId) {
            assetIds.add(entry.assetId);
          }
        });
      });

    const refs = Array.from(assetIds);
    if (refs.length === 0) return;

    let cancelled = false;
    const run = async () => {
      try {
        const cache = await caches.open('ds-player-media-v1');
        await Promise.all(refs.map(async (assetId) => {
          if (cancelled) return;
          const url = `${adminBase}/api/assets/${encodeURIComponent(assetId)}/blob`;
          try {
            await cache.add(url);
          } catch {
            // best effort prefetch
          }
        }));
      } catch {
        // best effort prefetch
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [layout, playlists, adminBase]);

  const goToNextMedia = (zoneId: string) => {
    const list = mediaItemsByZone[zoneId] || [];
    if (list.length === 0) return;
    setMediaIndexByZone((prev) => {
      const currentIndex = prev[zoneId] ?? 0;
      const nextIndex = computeNextMediaIndex(currentIndex, list.length);
      return { ...prev, [zoneId]: nextIndex };
    });
  };

  useEffect(() => {
    const timers: number[] = [];

    Object.entries(mediaItemsByZone).forEach(([zoneId, items]) => {
      if (items.length === 0) return;
      const currentIndex = mediaIndexByZone[zoneId] ?? 0;
      const current = items[currentIndex % items.length] || items[0];
      if (!current) return;

      if (current.kind !== 'image') return;

      const timer = window.setTimeout(() => {
        goToNextMedia(zoneId);
      }, Math.max(1, current.duration) * 1000);
      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [mediaItemsByZone, mediaIndexByZone]);

  useEffect(() => {
    setMediaIndexByZone((prev) => {
      const next: Record<string, number> = {};
      Object.entries(mediaItemsByZone).forEach(([zoneId, items]) => {
        if (items.length === 0) {
          next[zoneId] = 0;
          return;
        }
        const previous = prev[zoneId] ?? 0;
        next[zoneId] = previous % items.length;
      });
      return next;
    });
  }, [mediaItemsByZone]);

  useEffect(() => {
    Object.entries(mediaItemsByZone).forEach(([zoneId, items]) => {
      if (items.length === 0) return;
      const index = mediaIndexByZone[zoneId] ?? 0;
      const current = items[index % items.length];
      if (!current) return;

      if ((current.kind === 'image' || current.kind === 'video' || current.kind === 'iframe') && !current.source) {
        setTimeout(() => goToNextMedia(zoneId), 10);
      }
    });
  }, [mediaItemsByZone, mediaIndexByZone]);

  useEffect(() => {
    const refs = Array.from(new Set(displayedFooterLogos.filter((logo) => logo.startsWith('asset-image:'))));
    const active = new Set(refs);

    Object.entries(footerLogoUrlCacheRef.current).forEach(([ref, url]) => {
      if (!active.has(ref)) {
        URL.revokeObjectURL(url);
        delete footerLogoUrlCacheRef.current[ref];
      }
    });

    if (refs.length === 0) {
      setResolvedFooterLogoUrls({});
      return;
    }

    let cancelled = false;

    const run = async () => {
      for (const ref of refs) {
        if (footerLogoUrlCacheRef.current[ref]) continue;
        const assetId = ref.split(':', 2)[1];
        if (!assetId) continue;
        const blob = await getAssetBlob(assetId);
        if (!blob) continue;
        const objectUrl = URL.createObjectURL(blob);
        footerLogoUrlCacheRef.current[ref] = objectUrl;
      }

      if (!cancelled) {
        setResolvedFooterLogoUrls({ ...footerLogoUrlCacheRef.current });
      }
    };

    run().catch(() => {
      if (!cancelled) {
        setResolvedFooterLogoUrls({ ...footerLogoUrlCacheRef.current });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [displayedFooterLogos]);

  useEffect(() => {
    return () => {
      Object.values(footerLogoUrlCacheRef.current).forEach((url) => URL.revokeObjectURL(url));
      footerLogoUrlCacheRef.current = {};
    };
  }, []);

  const renderMediaZoneContent = (
    zone: { id: string; name: string; playlistId?: string },
    mediaClassName = 'w-full h-[min(320px,40vh)] max-w-full max-h-full'
  ) => {
    const zoneItems = mediaItemsByZone[zone.id] || [];
    const currentIndex = mediaIndexByZone[zone.id] ?? 0;
    const current = zoneItems.length > 0
      ? zoneItems[currentIndex % zoneItems.length]
      : null;

    if (!zone.playlistId) {
      return <p className="text-[var(--player-muted)]">Aucune playlist liée à cette zone média.</p>;
    }

    if (!current) {
      return <p className="text-[var(--player-muted)]">Playlist vide ou médias non disponibles.</p>;
    }

    if (current.kind === 'iframe') {
      const rawSource = (current.source || '').trim();
      const isHtmlEmbed = /<\s*(iframe|div|script)\b/i.test(rawSource) || rawSource.startsWith('<');

      if (isHtmlEmbed) {
        const embedHtml = fitIframeEmbedToZone(rawSource);
        return (
          <div
            className={`${mediaClassName} overflow-hidden rounded-[12px] border border-[var(--player-border-strong)] [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:max-w-full [&_iframe]:max-h-full`}
            dangerouslySetInnerHTML={{ __html: embedHtml }}
          />
        );
      }

      const iframeSource = rawSource;

      if (isVideoSource(iframeSource)) {
        return (
          <video
            src={iframeSource}
            className={`${mediaClassName} object-contain rounded-[12px] border border-[var(--player-border-strong)]`}
            muted
            autoPlay
            onEnded={() => goToNextMedia(zone.id)}
            playsInline
            controls
          />
        );
      }

      return (
        <iframe
          src={iframeSource}
          title={`media-${zone.id}`}
          className={`${mediaClassName} rounded-[12px] border border-[var(--player-border-strong)] overflow-hidden`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      );
    }

    if (current.kind === 'image') {
      const source = current.source;
      if (!source) return <p className="text-[var(--player-muted)]">Chargement du média…</p>;
      return (
        <img
          src={source}
          alt={zone.name}
          className={`${mediaClassName} object-contain rounded-[12px] border border-[var(--player-border-strong)]`}
        />
      );
    }

    if (current.kind === 'video') {
      const source = current.source;
      if (!source) return <p className="text-[var(--player-muted)]">Chargement du média…</p>;
      return (
        <video
          src={source}
          className={`${mediaClassName} object-contain rounded-[12px] border border-[var(--player-border-strong)]`}
          muted
          autoPlay
          onEnded={() => goToNextMedia(zone.id)}
          playsInline
          controls
        />
      );
    }

    return (
      <div
        className={`${mediaClassName} overflow-auto rounded-[12px] border border-[var(--player-border-strong)] p-4 markdown-content`}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(current.markdown || '') }}
      />
    );
  };

  const renderFooterMarquee = () => (
    <div className="mt-auto pt-4 border-t border-[var(--player-border-strong)]">
      <div className={`border rounded-[14px] px-4 py-3 space-y-2 bg-[#21293a] border-[#21293a] text-[var(--player-muted)] ${isLowVisionTemplate ? 'text-2xl leading-9 font-medium' : ''}`}>
        {layout?.footerText ? <div className={isLowVisionTemplate ? 'text-3xl leading-10 font-semibold' : ''}>{layout.footerText}</div> : null}
        {displayedFooterLogos.length > 0 ? (
          <div className="overflow-hidden rounded-[10px] border py-4 border-[var(--player-border-strong)] bg-[#21293a]">
            <div ref={footerMarqueeTrackRef} className="player-logo-marquee-track">
              {marqueeLogos.map((logo, index) => {
                const normalizedLogo = logo.trim();
                const src = normalizedLogo.startsWith('asset-image:')
                  ? resolvedFooterLogoUrls[normalizedLogo]
                  : normalizedLogo;
                if (!src) return null;
                return (
                  <img
                    key={`${logo}-${index}`}
                    src={src}
                    alt="Logo entreprise"
                    className={`${isLowVisionTemplate ? 'h-20' : 'h-12'} w-auto object-contain opacity-95`}
                    loading="eager"
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!identity || mode === 'loading') {
    return <div className="min-h-screen bg-[var(--player-bg)] text-[var(--player-fg)] flex items-center justify-center">Initialisation du player…</div>;
  }

  if (mode === 'enroll') {
    const baseForQr = adminBase || window.location.origin;
    const pairUrl = new URL('/screens', baseForQr);
    if (pairingPin?.pin) {
      pairUrl.searchParams.set('pin', pairingPin.pin);
    }
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=0&format=png&data=${encodeURIComponent(pairUrl.toString())}`;
    return (
      <div className="h-[100dvh] overflow-hidden p-2 sm:p-6 bg-[var(--player-bg)] text-[var(--player-fg)] flex flex-col">
        <div className="mb-2 flex justify-end sm:hidden">
          <button
            type="button"
            aria-label="Ouvrir le menu player"
            className="p-2 rounded-[12px] border border-[var(--player-border-strong)] bg-[var(--player-card-bg)]"
            onClick={() => setShowMobileMenu((value) => !value)}
          >
            {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {showMobileMenu ? (
          <div className="mb-3 sm:hidden rounded-[12px] border border-[var(--player-border-strong)] bg-[var(--player-card-bg)] p-3 text-sm text-[var(--player-muted)]">
            <p className="font-semibold text-[var(--player-fg)]">Player</p>
            <p>Device: {identity.deviceName}</p>
            <p>ID: {identity.deviceId}</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 rounded-[10px] border border-[var(--player-border-strong)] px-3 py-2 text-[var(--player-fg)]"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw size={14} /> Redémarrer l&apos;affichage
            </button>
          </div>
        ) : null}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="max-w-2xl w-full rounded-[16px] p-6 border bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)]">
            <h1 className="text-4xl mb-2 font-semibold">Liaison de l'écran</h1>
            <div className="grid md:grid-cols-2 gap-6 items-start">
              <div className="bg-white p-3 rounded-[12px] w-[256px] h-[256px] aspect-square overflow-hidden flex items-center justify-center">
                <img src={qr} alt="QR Code ajout device" className="w-full h-full aspect-square object-contain" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-2xl text-[var(--player-muted)]"><QrCode size={24} />Infos de liaison</div>
                <p className="text-3xl"><span className="text-[var(--player-muted)]">PIN:</span> <span className="font-semibold text-[var(--player-accent)] tracking-wider">{pairingPin?.pin || '------'}</span></p>
                <p className="text-xl text-[var(--player-muted)]">Expire: {pairingPin?.expiresAt ? new Date(pairingPin.expiresAt).toLocaleTimeString('fr-FR') : '—'}</p>
              </div>
            </div>
          </div>
        </div>
        {renderFooterMarquee()}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden p-2 sm:p-6 bg-[var(--player-bg)] text-[var(--player-fg)] flex flex-col">
      <div className="relative flex items-center justify-between mb-6 min-h-[56px]">
        <div>
          <h1 className={`${isLowVisionTemplate ? 'text-6xl' : 'text-3xl'} font-semibold leading-none`}>{clockNow.toLocaleTimeString('fr-FR')}</h1>
          <p className={`${isLowVisionTemplate ? 'text-3xl' : 'text-sm'} text-[var(--player-muted)] mt-1`}>{headerDateLabel}</p>
        </div>
        <h2 className={`absolute left-1/2 -translate-x-1/2 text-center min-w-0 max-w-[65%] break-words [overflow-wrap:anywhere] ${isLowVisionTemplate ? 'text-4xl' : 'text-xl'} font-semibold text-[var(--player-accent)]`}>{centeredTitle}</h2>
        <div className="flex items-center gap-2">
          {online ? <Wifi size={isLowVisionTemplate ? 28 : 16} className="text-[var(--player-success)]" /> : <WifiOff size={isLowVisionTemplate ? 28 : 16} className="text-[var(--player-danger)]" />}
          <span className={`${online ? 'text-[var(--player-success)]' : 'text-[var(--player-danger)]'} ${isLowVisionTemplate ? 'text-2xl font-medium' : ''}`}>{online ? 'Connecté' : 'Déconnecté'}</span>
          <button
            type="button"
            aria-label="Menu player"
            className="sm:hidden p-2 rounded-[12px] border border-[var(--player-border-strong)] bg-[var(--player-card-bg)]"
            onClick={() => setShowMobileMenu((value) => !value)}
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {showMobileMenu ? (
        <div className="mb-3 sm:hidden rounded-[12px] border border-[var(--player-border-strong)] bg-[var(--player-card-bg)] p-3 text-sm text-[var(--player-muted)]">
          <p className="font-semibold text-[var(--player-fg)]">Actions</p>
          <p>Écran: {assignedScreen?.name || identity.deviceName}</p>
          <p>Device ID: {identity.deviceId}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--player-border-strong)] px-3 py-2 text-[var(--player-fg)]"
              onClick={() => window.location.reload()}
            >
              <RefreshCcw size={14} /> Recharger
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--player-border-strong)] px-3 py-2 text-[var(--player-fg)]"
              onClick={() => setShowMobileMenu(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex-1 min-h-0 space-y-4 ${layout?.mode === 'room-status-board' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      {!layout ? (
        <div className="space-y-4">
          <div className="border rounded-[16px] p-10 text-center bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)]">
            <p className="text-lg mb-3 text-[var(--player-muted)]">Aucun layout assigné</p>
            <p className="text-base mb-4 text-[var(--player-accent)] break-words [overflow-wrap:anywhere]">Device: {assignedScreen?.name || identity.deviceName}</p>
            <h2 className="text-6xl font-semibold mb-2">{clockNow.toLocaleTimeString('fr-FR')}</h2>
            <p className="text-xl text-[var(--player-muted)]">{headerDateLabel}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {layout.mode === 'room-status-board' ? (
            <div className="space-y-4 h-full min-h-0 flex flex-col">
              <div className="border rounded-[16px] overflow-hidden bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)]">
                <div className="overflow-x-auto">
                  <div className={isLowVisionTemplate ? 'min-w-[1800px]' : 'min-w-[1200px]'}>
                    <div className={`grid grid-cols-6 [&>div]:min-w-0 [&>div]:text-center [&>div]:whitespace-normal [&>div]:break-words [&>div]:[overflow-wrap:anywhere] [&>div]:leading-tight uppercase tracking-wide text-[var(--player-muted)] bg-[#21293a] ${isLowVisionTemplate ? 'px-6 py-5 text-3xl font-black [&>div]:min-w-[260px]' : 'px-4 py-3 text-xs font-bold'}`}>
                      <div>Nom</div>
                      <div>Salle</div>
                      <div>Emplacement</div>
                      <div className={isLowVisionTemplate ? 'whitespace-normal' : 'whitespace-nowrap'}>Date et heure de début</div>
                      <div className={isLowVisionTemplate ? 'whitespace-normal' : 'whitespace-nowrap'}>Date et heure de fin</div>
                      <div>Statut</div>
                    </div>
                    <div
                      ref={boardScrollContainerRef}
                      className={`${isLowVisionTemplate ? 'max-h-[68vh]' : 'max-h-[62vh]'} overflow-y-auto player-board-scroll`}
                    >
                      <div className="divide-y divide-[var(--player-divider)]">
                        {visibleRows.length === 0 ? (
                          <div className={`${isLowVisionTemplate ? 'p-6 text-3xl' : 'p-6'} text-[var(--player-muted)]`}>Aucun événement pour le moment.</div>
                        ) : (
                          boardRows.map((row, index) => {
                          if (row.kind === 'date') {
                            return (
                              <div
                                key={`date-${row.dateLabel}-${index}`}
                                className={`grid grid-cols-6 [&>div]:min-w-0 [&>div]:text-center [&>div]:whitespace-normal [&>div]:break-words [&>div]:[overflow-wrap:anywhere] [&>div]:leading-tight bg-[var(--player-info-soft-bg)] ${isLowVisionTemplate ? 'px-6 py-4 text-3xl font-black [&>div]:min-w-[260px]' : 'px-4 py-3 text-sm font-bold'}`}
                              >
                                <div className={`text-[var(--player-accent)] ${isLowVisionTemplate ? 'font-black' : 'font-medium'}`}>{row.dateLabel}</div>
                                <div />
                                <div />
                                <div />
                                <div />
                                <div />
                              </div>
                            );
                          }

                          const event = row.event;
                          if (!event) return null;
                          const room = roomById(event.roomId);
                          const now = Date.now();
                          const start = new Date(event.startAt).getTime();
                          const end = event.endAt ? new Date(event.endAt).getTime() : start + 60 * 60 * 1000;
                          const status = getEventStatus(start, end, now, event.status);
                          const isCancelled = event.status === 'cancelled';

                          return (
                            <div
                              key={event.id}
                              className={`grid grid-cols-6 [&>div]:min-w-0 [&>div]:text-center [&>div]:whitespace-normal [&>div]:break-words [&>div]:[overflow-wrap:anywhere] [&>div]:leading-tight transition-all duration-300 ${isLowVisionTemplate ? 'px-6 py-5 text-3xl font-black [&>div]:min-w-[260px]' : 'px-4 py-3 text-sm'} ${removingRows[event.id] ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}
                            >
                              <div className={`${isCancelled ? 'text-[var(--player-danger)] line-through' : 'text-[var(--player-fg)]'}`}>{event.title}</div>
                              <div className={`${isCancelled ? 'text-[var(--player-danger)] line-through' : 'text-[var(--player-fg)]'}`}>{event.roomNumber}</div>
                              <div className={`${isCancelled ? 'text-[var(--player-danger)] line-through' : 'text-[var(--player-muted)]'}`}>{room?.location ?? '—'}</div>
                              <div className={isCancelled ? `text-[var(--player-danger)] line-through ${isLowVisionTemplate ? 'tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]' : ''}` : `${isLowVisionTemplate ? 'text-[var(--player-fg)] tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]' : 'text-[var(--player-muted)]'}`}>
                                {isLowVisionTemplate ? (
                                  <div className="flex flex-col items-center justify-center gap-3 leading-tight">
                                    <span className="font-black">{formatDateOnly(event.startAt)}</span>
                                    <span className="text-[var(--player-accent)]">{formatTimeOnly(event.startAt)}</span>
                                  </div>
                                ) : (
                                  formatDateTime(event.startAt)
                                )}
                              </div>
                              <div className={isCancelled ? `text-[var(--player-danger)] line-through ${isLowVisionTemplate ? 'tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]' : ''}` : `${isLowVisionTemplate ? 'text-[var(--player-fg)] tabular-nums whitespace-normal break-words [overflow-wrap:anywhere]' : 'text-[var(--player-muted)]'}`}>
                                {isLowVisionTemplate ? (
                                  <div className="flex flex-col items-center justify-center gap-3 leading-tight">
                                    <span className="font-black">{formatDateOnly(event.endAt)}</span>
                                    <span className="text-[var(--player-accent)]">{formatTimeOnly(event.endAt)}</span>
                                  </div>
                                ) : (
                                  formatDateTime(event.endAt)
                                )}
                              </div>
                              <div className={`${status.textClass} ${isLowVisionTemplate ? 'font-black break-words [overflow-wrap:anywhere]' : ''}`}>{status.label}</div>
                            </div>
                          );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : layout.mode === 'room-door-display' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-[16px] p-4 bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)]">
                <p className={`${isLowVisionTemplate ? 'text-2xl' : 'text-sm'} mb-1 text-[var(--player-muted)]`}>Statut actuel</p>
                {currentEvent ? (
                  <>
                    <h3 className={`text-[var(--player-danger)] ${isLowVisionTemplate ? 'text-4xl' : 'text-xl'} font-semibold mb-2`}>En Cours</h3>
                    <p className={`${isLowVisionTemplate ? 'text-3xl' : ''} text-[var(--player-fg)] break-words [overflow-wrap:anywhere]`}>{currentEvent.title}</p>
                    <p className={`${isLowVisionTemplate ? 'text-2xl' : ''} text-[var(--player-muted)]`}>{formatDateTime(currentEvent.startAt)} → {formatDateTime(currentEvent.endAt)}</p>
                  </>
                ) : (
                  <h3 className={`text-[var(--player-success)] ${isLowVisionTemplate ? 'text-4xl' : 'text-xl'} font-semibold`}>Libre</h3>
                )}
              </div>
              <div className="border rounded-[16px] p-4 bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)]">
                <p className={`${isLowVisionTemplate ? 'text-2xl' : 'text-sm'} mb-1 text-[var(--player-muted)]`}>Prochain événement</p>
                {nextEvent ? (
                  <>
                    <p className={`${isLowVisionTemplate ? 'text-3xl' : ''} text-[var(--player-fg)] break-words [overflow-wrap:anywhere]`}>{nextEvent.title}</p>
                    <p className={`${isLowVisionTemplate ? 'text-2xl' : ''} text-[var(--player-muted)]`}>{formatDateTime(nextEvent.startAt)}</p>
                  </>
                ) : (
                  <p className={`${isLowVisionTemplate ? 'text-3xl' : ''} text-[var(--player-muted)]`}>Aucun</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {layout.zones.map((zone) => (
                <div key={zone.id} className={`border rounded-[16px] p-4 bg-[var(--player-card-bg)] border-[var(--player-border-strong)] text-[var(--player-fg)] ${zone.type === 'media' ? 'md:col-span-2' : ''}`}>
                  <p className={`${isLowVisionTemplate ? 'text-xl' : 'text-sm'} mb-1 text-[var(--player-muted)]`}>{zone.type}</p>
                  <h3 className={`${isLowVisionTemplate ? 'text-3xl' : ''} text-[var(--player-fg)] font-semibold mb-2 break-words [overflow-wrap:anywhere]`}>{zone.name}</h3>
                  {zone.type === 'media' ? (
                    <div className="w-full min-h-[40vh] flex items-center justify-center">
                      {renderMediaZoneContent(zone, 'w-full h-full max-w-full max-h-full')}
                    </div>
                  ) : (
                    <p className={`${isLowVisionTemplate ? 'text-2xl leading-10' : ''} text-[var(--player-fg)] whitespace-pre-wrap`}>{zone.content || 'Aucun contenu renseigné'}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      </div>

      {renderFooterMarquee()}
    </div>
  );
}



