import {
  deletePlaylistById,
  loadPlaylists,
  savePlaylists,
  PLAYLISTS_KEY,
  type PlaylistModel
} from '../shared/playlistRegistry';
import { getSystemApiBase } from './systemApiBase';

async function readPlaylistsFromLegacyKv(): Promise<PlaylistModel[] | null> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/system/kv/${encodeURIComponent(PLAYLISTS_KEY)}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    const raw = String(payload?.value || '[]');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PlaylistModel[];
  } catch {
    return null;
  }
}

async function writePlaylistsToLegacyKv(rows: PlaylistModel[]): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/system/kv/${encodeURIComponent(PLAYLISTS_KEY)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(rows) })
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function isSystemApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getSystemApiBase()}/api/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listPlaylistsFromApi(): Promise<PlaylistModel[]> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/playlists`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const records = Array.isArray(payload?.records) ? payload.records as PlaylistModel[] : [];
        savePlaylists(records);
        return records;
      }

      if (response.status === 404) {
        const legacy = await readPlaylistsFromLegacyKv();
        if (legacy) {
          savePlaylists(legacy);
          return legacy;
        }
      }
    } catch {
      // fallback local
    }
  }

  return loadPlaylists();
}

export async function upsertPlaylistFromApi(record: PlaylistModel): Promise<void> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record })
      });
      if (response.ok) return;

      if (response.status === 404) {
        const current = (await readPlaylistsFromLegacyKv()) ?? loadPlaylists();
        const next = current.some((item) => item.id === record.id)
          ? current.map((item) => (item.id === record.id ? record : item))
          : [...current, record];
        if (await writePlaylistsToLegacyKv(next)) {
          savePlaylists(next);
          return;
        }
      }
    } catch {
      // fallback local
    }
  }

  savePlaylists(
    (() => {
      const current = loadPlaylists();
      const idx = current.findIndex((item) => item.id === record.id);
      return idx === -1
        ? [...current, record]
        : current.map((item) => (item.id === record.id ? record : item));
    })()
  );
}

export async function deletePlaylistFromApi(playlistId: string): Promise<void> {
  if (await isSystemApiAvailable()) {
    try {
      const response = await fetch(`${getSystemApiBase()}/api/playlists/${encodeURIComponent(playlistId)}`, {
        method: 'DELETE'
      });
      if (response.ok) return;

      if (response.status === 404) {
        const current = (await readPlaylistsFromLegacyKv()) ?? loadPlaylists();
        const next = current.filter((item) => item.id !== playlistId);
        if (await writePlaylistsToLegacyKv(next)) {
          savePlaylists(next);
          return;
        }
      }
    } catch {
      // fallback local
    }
  }

  deletePlaylistById(playlistId);
}
