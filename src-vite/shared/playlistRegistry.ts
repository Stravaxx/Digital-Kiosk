import { mirrorLocalStorageKeyToDb } from '../services/clientDbStorage';

export type PlaylistEntryKind = 'asset' | 'iframe' | 'url' | 'markdown';

export interface PlaylistEntryModel {
  id: string;
  title: string;
  kind: PlaylistEntryKind;
  assetId?: string;
  assetName?: string;
  assetType?: 'image' | 'video' | 'pdf' | 'html' | 'document' | 'other';
  sourceUrl?: string;
  markdown?: string;
  duration: number;
}

export interface PlaylistModel {
  id: string;
  name: string;
  description: string;
  loop: boolean;
  items: PlaylistEntryModel[];
  updatedAt: string;
}

export const PLAYLISTS_KEY = 'ds.playlists';

export function loadPlaylists(): PlaylistModel[] {
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaylistModel[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((playlist) => ({
      ...playlist,
      items: Array.isArray(playlist.items)
        ? playlist.items
          .map((entry) => {
            const kind = String((entry as PlaylistEntryModel).kind || '').trim().toLowerCase();
            const normalizedKind: PlaylistEntryKind = kind === 'asset' || kind === 'iframe' || kind === 'url' || kind === 'markdown'
              ? kind
              : ((entry as PlaylistEntryModel).assetId ? 'asset' : 'url');

            const fallbackTitle = (entry as PlaylistEntryModel).assetName
              || (entry as PlaylistEntryModel).sourceUrl
              || `Media ${(entry as PlaylistEntryModel).id || ''}`;

            return {
              ...entry,
              kind: normalizedKind,
              title: String((entry as PlaylistEntryModel).title || fallbackTitle || 'Média').trim(),
              duration: Math.max(1, Number((entry as PlaylistEntryModel).duration) || 15),
              markdown: typeof (entry as PlaylistEntryModel).markdown === 'string'
                ? (entry as PlaylistEntryModel).markdown
                : ''
            } as PlaylistEntryModel;
          })
        : []
    }));
  } catch {
    return [];
  }
}

export function savePlaylists(playlists: PlaylistModel[]): void {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  void mirrorLocalStorageKeyToDb(PLAYLISTS_KEY);
}

export function upsertPlaylist(playlist: PlaylistModel): PlaylistModel[] {
  const current = loadPlaylists();
  const idx = current.findIndex((item) => item.id === playlist.id);
  const normalized: PlaylistModel = { ...playlist, updatedAt: new Date().toISOString() };
  const next = idx === -1
    ? [...current, normalized]
    : current.map((item) => (item.id === playlist.id ? normalized : item));
  savePlaylists(next);
  return next;
}

export function deletePlaylistById(playlistId: string): PlaylistModel[] {
  const next = loadPlaylists().filter((item) => item.id !== playlistId);
  savePlaylists(next);
  return next;
}
