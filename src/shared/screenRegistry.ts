import { mirrorLocalStorageKeyToDb } from '../services/clientDbStorage';

export type ScreenStatus = 'pending' | 'approved' | 'online' | 'offline';

export type GroupThemeMode = 'light' | 'dark' | 'scheduled';
export type ScreenThemeMode = 'inherit-group' | GroupThemeMode;

export interface GroupThemeSettings {
  mode: GroupThemeMode;
  primaryColor: string;
  lightStart: string;
  darkStart: string;
}

export interface ScreenThemeSettings {
  mode: ScreenThemeMode;
  primaryColor?: string;
  lightStart?: string;
  darkStart?: string;
}

export interface ScreenModel {
  id: string;
  deviceId: string;
  name: string;
  hostname: string;
  ip: string;
  resolution: string;
  os: string;
  status: ScreenStatus;
  layoutId?: string;
  roomId?: string;
  roomIds?: string[];
  groupId?: string;
  theme?: ScreenThemeSettings;
  deviceToken: string;
  lastHeartbeat: string;
}

export const SCREENS_KEY = 'ds.screens';

export const DEFAULT_GROUP_THEME: GroupThemeSettings = {
  mode: 'dark',
  primaryColor: '#3b82f6',
  lightStart: '07:00',
  darkStart: '19:00'
};

const LEGACY_DEFAULT_PRIMARY = '#8dc63f';

function normalizePrimaryColor(color?: string): string {
  if (!color) return DEFAULT_GROUP_THEME.primaryColor;
  const lower = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(lower)) return DEFAULT_GROUP_THEME.primaryColor;
  if (lower === LEGACY_DEFAULT_PRIMARY) return DEFAULT_GROUP_THEME.primaryColor;
  return lower;
}

function normalizeScreenTheme(theme?: ScreenThemeSettings): ScreenThemeSettings {
  return {
    mode: theme?.mode ?? 'inherit-group',
    primaryColor: normalizePrimaryColor(theme?.primaryColor),
    lightStart: theme?.lightStart ?? DEFAULT_GROUP_THEME.lightStart,
    darkStart: theme?.darkStart ?? DEFAULT_GROUP_THEME.darkStart
  };
}

export function loadScreens(): ScreenModel[] {
  try {
    const raw = localStorage.getItem(SCREENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScreenModel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((screen) => ({
      ...screen,
      roomIds: Array.isArray(screen.roomIds)
        ? screen.roomIds
        : screen.roomId
          ? [screen.roomId]
          : [],
      theme: normalizeScreenTheme(screen.theme)
    }));
  } catch {
    return [];
  }
}

export function saveScreens(screens: ScreenModel[]): void {
  localStorage.setItem(SCREENS_KEY, JSON.stringify(screens));
  void mirrorLocalStorageKeyToDb(SCREENS_KEY);
}

export function registerPendingScreen(payload: {
  token: string;
  devname: string;
  deviceId: string;
  hostname?: string;
  os?: string;
}): ScreenModel[] {
  const current = loadScreens();
  const existing = current.find((item) => item.deviceToken === payload.token || item.deviceId === payload.deviceId);
  if (existing) return current;

  const next: ScreenModel[] = [
    ...current,
    {
      id: `screen-${Date.now()}`,
      deviceId: payload.deviceId,
      name: payload.devname,
      hostname: payload.hostname ?? payload.devname,
      ip: 'N/A',
      resolution: '1920x1080',
      os: payload.os?.trim() || 'Inconnu',
      status: 'pending',
      roomIds: [],
      groupId: undefined,
      theme: normalizeScreenTheme(),
      deviceToken: payload.token,
      lastHeartbeat: new Date().toISOString()
    }
  ];
  saveScreens(next);
  return next;
}

export function refreshOnlineOfflineStatus(timeoutMs = 30000): ScreenModel[] {
  const now = Date.now();
  const current = loadScreens();
  const next: ScreenModel[] = current.map((screen) => {
    if (screen.status === 'pending') return screen;
    const last = new Date(screen.lastHeartbeat).getTime();
    if (Number.isNaN(last)) return { ...screen, status: 'offline' as ScreenStatus };
    return {
      ...screen,
      status: (now - last <= timeoutMs ? 'online' : 'offline') as ScreenStatus
    };
  });

  saveScreens(next);
  return next;
}
