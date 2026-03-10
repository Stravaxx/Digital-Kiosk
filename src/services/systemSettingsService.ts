import { mirrorLocalStorageKeyToDb, syncLocalStorageKeyFromSystem } from './clientDbStorage';

export const SYSTEM_SETTINGS_KEY = 'ds.system-settings';

export interface SystemSettings {
  timezone: string;
  dateFormat: string;
  defaultContentDurationSec: number;
  playerRefreshIntervalMin: number;
  heartbeatIntervalSec: number;
  transitionEffect: string;
  transitionDurationMs: number;
  maximumStorageGb: number;
  cacheLimitGb: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  timezone: 'Europe/Paris',
  dateFormat: 'DD/MM/YYYY',
  defaultContentDurationSec: 10,
  playerRefreshIntervalMin: 60,
  heartbeatIntervalSec: 30,
  transitionEffect: 'Fade',
  transitionDurationMs: 300,
  maximumStorageGb: 100,
  cacheLimitGb: 10
};

function normalizeNumber(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.round(parsed));
}

function normalizeSettings(input: unknown): SystemSettings {
  const row = (input && typeof input === 'object') ? input as Partial<SystemSettings> : {};
  return {
    timezone: String(row.timezone || DEFAULT_SYSTEM_SETTINGS.timezone),
    dateFormat: String(row.dateFormat || DEFAULT_SYSTEM_SETTINGS.dateFormat),
    defaultContentDurationSec: normalizeNumber(row.defaultContentDurationSec, DEFAULT_SYSTEM_SETTINGS.defaultContentDurationSec, 1),
    playerRefreshIntervalMin: normalizeNumber(row.playerRefreshIntervalMin, DEFAULT_SYSTEM_SETTINGS.playerRefreshIntervalMin, 1),
    heartbeatIntervalSec: normalizeNumber(row.heartbeatIntervalSec, DEFAULT_SYSTEM_SETTINGS.heartbeatIntervalSec, 1),
    transitionEffect: String(row.transitionEffect || DEFAULT_SYSTEM_SETTINGS.transitionEffect),
    transitionDurationMs: normalizeNumber(row.transitionDurationMs, DEFAULT_SYSTEM_SETTINGS.transitionDurationMs, 0),
    maximumStorageGb: normalizeNumber(row.maximumStorageGb, DEFAULT_SYSTEM_SETTINGS.maximumStorageGb, 1),
    cacheLimitGb: normalizeNumber(row.cacheLimitGb, DEFAULT_SYSTEM_SETTINGS.cacheLimitGb, 1)
  };
}

export function loadSystemSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export function saveSystemSettings(settings: SystemSettings): void {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(normalized));
  void mirrorLocalStorageKeyToDb(SYSTEM_SETTINGS_KEY);
}

export async function syncSystemSettingsFromDb(): Promise<SystemSettings> {
  await syncLocalStorageKeyFromSystem(SYSTEM_SETTINGS_KEY).catch(() => false);
  return loadSystemSettings();
}
