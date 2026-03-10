import { getSystemApiBase } from './systemApiBase';
import { mirrorLocalStorageKeyToDb } from './clientDbStorage';

export type SystemLogType = 'system' | 'screen' | 'error' | 'upload' | 'sync' | 'auth' | 'player';
export type SystemLogLevel = 'info' | 'warning' | 'error';

export interface SystemLogRecord {
  id: string;
  type: SystemLogType;
  level: SystemLogLevel;
  message: string;
  source: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ListLogsOptions {
  type?: SystemLogType | 'all';
  level?: SystemLogLevel | 'all';
  search?: string;
  limit?: number;
}

export const LOGS_STORAGE_KEY = 'ds.system.logs';

function normalizeLogType(value: unknown): SystemLogType {
  const raw = String(value || '').toLowerCase();
  if (raw === 'screen' || raw === 'error' || raw === 'upload' || raw === 'sync' || raw === 'auth' || raw === 'player') {
    return raw;
  }
  return 'system';
}

function normalizeLogLevel(value: unknown): SystemLogLevel {
  const raw = String(value || '').toLowerCase();
  if (raw === 'warning' || raw === 'error') return raw;
  return 'info';
}

function normalizeLogRecord(value: unknown): SystemLogRecord | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<SystemLogRecord>;
  const message = String(row.message || '').trim();
  if (!message) return null;

  return {
    id: String(row.id || globalThis.crypto?.randomUUID?.() || `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    type: normalizeLogType(row.type),
    level: normalizeLogLevel(row.level),
    message,
    source: String(row.source || 'client').trim() || 'client',
    timestamp: String(row.timestamp || new Date().toISOString()),
    details: row.details && typeof row.details === 'object' ? row.details : {}
  };
}

async function isSystemApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function loadLocalLogs(): SystemLogRecord[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLogRecord)
      .filter((item): item is SystemLogRecord => Boolean(item))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

function persistLocalLogs(rows: SystemLogRecord[]): void {
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(rows.slice(0, 2000)));
  void mirrorLocalStorageKeyToDb(LOGS_STORAGE_KEY);
}

function filterLocalLogs(rows: SystemLogRecord[], options: ListLogsOptions = {}): SystemLogRecord[] {
  const type = options.type?.trim().toLowerCase();
  const level = options.level?.trim().toLowerCase();
  const search = options.search?.trim().toLowerCase();
  const limit = Math.min(1000, Math.max(1, options.limit ?? 300));

  return rows
    .filter((row) => !type || type === 'all' || row.type === normalizeLogType(type))
    .filter((row) => !level || level === 'all' || row.level === normalizeLogLevel(level))
    .filter((row) => {
      if (!search) return true;
      const haystack = `${row.message} ${row.source} ${JSON.stringify(row.details || {})}`.toLowerCase();
      return haystack.includes(search);
    })
    .slice(0, limit);
}

export async function listSystemLogs(options: ListLogsOptions = {}): Promise<SystemLogRecord[]> {
  if (await isSystemApiAvailable()) {
    const query = new URLSearchParams();
    if (options.type) query.set('type', options.type);
    if (options.level) query.set('level', options.level);
    if (options.search) query.set('search', options.search);
    if (options.limit) query.set('limit', String(options.limit));

    try {
      const response = await fetch(`${getSystemApiBase()}/api/logs?${query.toString()}`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const rows = (Array.isArray(payload?.records) ? payload.records : [])
          .map(normalizeLogRecord)
          .filter((item: SystemLogRecord | null): item is SystemLogRecord => Boolean(item));
        persistLocalLogs(rows);
        return rows;
      }
    } catch {
      // fallback localStorage
    }
  }

  return filterLocalLogs(loadLocalLogs(), options);
}

export async function appendSystemLog(input: Omit<SystemLogRecord, 'id' | 'timestamp'>): Promise<void> {
  const payload = {
    type: normalizeLogType(input.type),
    level: normalizeLogLevel(input.level),
    message: String(input.message || '').trim(),
    source: String(input.source || 'client').trim() || 'client',
    details: input.details && typeof input.details === 'object' ? input.details : {}
  };

  if (!payload.message) return;

  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) return;
    } catch {
      // fallback localStorage
    }
  }

  const next: SystemLogRecord = {
    id: globalThis.crypto?.randomUUID?.() ?? `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...payload
  };
  const current = loadLocalLogs();
  persistLocalLogs([next, ...current]);
}

export async function clearSystemLogs(type?: SystemLogType | 'all'): Promise<void> {
  const normalizedType = type?.trim().toLowerCase();

  if (await isSystemApiAvailable()) {
    try {
      const query = new URLSearchParams();
      if (normalizedType) query.set('type', normalizedType);
      const response = await fetch(`${getSystemApiBase()}/api/logs?${query.toString()}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        if (!normalizedType || normalizedType === 'all') {
          persistLocalLogs([]);
        }
        return;
      }
    } catch {
      // fallback localStorage
    }
  }

  if (!normalizedType || normalizedType === 'all') {
    persistLocalLogs([]);
    return;
  }

  const next = loadLocalLogs().filter((row) => row.type !== normalizeLogType(normalizedType));
  persistLocalLogs(next);
}

export function buildLogsExportContent(rows: SystemLogRecord[]): string {
  return rows
    .map((row) => {
      const ts = new Date(row.timestamp).toLocaleString('fr-FR');
      const details = row.details && Object.keys(row.details).length > 0
        ? ` | details=${JSON.stringify(row.details)}`
        : '';
      return `[${ts}] [${row.level.toUpperCase()}] [${row.type}] ${row.message} (source=${row.source})${details}`;
    })
    .join('\n');
}
