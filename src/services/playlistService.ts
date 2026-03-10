// Service pour gestion dynamique des playlists
import { readJson, writeJson } from './dbJsonService';

export type PlaylistItemType = 'image' | 'video' | 'html-widget' | 'calendar' | 'iframe' | 'rss' | 'text' | 'weather';

export interface PlaylistItem {
  id: string;
  type: PlaylistItemType;
  name: string;
  duration: number;
  zoneId?: string;
  scheduling?: {
    startDate?: string;
    endDate?: string;
    daysOfWeek?: number[];
    timeRange?: { start: string; end: string };
  };
  priority?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  zones: string[];
  layoutId: string;
  isActive: boolean;
}

export async function getPlaylists(): Promise<Playlist[]> {
  return await readJson<Playlist[]>('/database/playlists.json');
}

export async function addPlaylist(playlist: Playlist): Promise<void> {
  const playlists = await getPlaylists();
  playlists.push(playlist);
  await writeJson('/database/playlists.json', playlists);
}

export async function updatePlaylist(playlist: Playlist): Promise<void> {
  const playlists = await getPlaylists();
  const idx = playlists.findIndex(p => p.id === playlist.id);
  if (idx !== -1) {
    playlists[idx] = playlist;
    await writeJson('/database/playlists.json', playlists);
  }
}
