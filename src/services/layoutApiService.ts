import {
  deleteLayoutById,
  loadLayouts,
  saveLayouts,
  type LayoutModel
} from '../shared/layoutRegistry';
import { getSystemApiBase } from './systemApiBase';

async function isSystemApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listLayoutsFromApi(): Promise<LayoutModel[]> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/layouts`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const records = Array.isArray(payload?.records) ? payload.records as LayoutModel[] : [];
        saveLayouts(records);
        return records;
      }
    } catch {
      // fallback local
    }
  }

  return loadLayouts();
}

export async function upsertLayoutFromApi(record: LayoutModel): Promise<void> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record })
      });
      if (response.ok) return;
    } catch {
      // fallback local
    }
  }

  saveLayouts(
    (() => {
      const current = loadLayouts();
      const idx = current.findIndex((item) => item.id === record.id);
      return idx === -1
        ? [...current, record]
        : current.map((item) => (item.id === record.id ? record : item));
    })()
  );
}

export async function deleteLayoutFromApi(layoutId: string): Promise<void> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/layouts/${encodeURIComponent(layoutId)}`, {
        method: 'DELETE'
      });
      if (response.ok) return;
    } catch {
      // fallback local
    }
  }

  deleteLayoutById(layoutId);
}
