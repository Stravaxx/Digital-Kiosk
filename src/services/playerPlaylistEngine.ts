import { type PlaylistModel } from '../shared/playlistRegistry';

export interface PlayerMediaItem {
  id: string;
  title: string;
  duration: number;
  kind: 'iframe' | 'image' | 'video' | 'markdown';
  source?: string;
  markdown?: string;
}

export function isVideoSource(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url.trim());
}

export function isImageSource(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url.trim());
}

export function resolvePlaylistMediaItems(
  playlist: PlaylistModel | null,
  resolvedAssetUrls: Record<string, string>
): PlayerMediaItem[] {
  if (!playlist || playlist.items.length === 0) return [];

  return playlist.items
    .map((entry) => {
      if (entry.kind === 'asset') {
        const assetType = entry.assetType || 'other';
        const ref = assetType === 'image'
          ? `asset-image:${entry.assetId || ''}`
          : `asset-video:${entry.assetId || ''}`;
        const source = resolvedAssetUrls[ref];
        if (!source) return null;
        return {
          id: entry.id,
          title: entry.title,
          kind: assetType === 'video' ? 'video' : 'image',
          duration: assetType === 'video' ? 1 : Math.max(1, entry.duration || 15),
          source
        } as PlayerMediaItem;
      }

      if (entry.kind === 'iframe') {
        if (!entry.sourceUrl) return null;
        return {
          id: entry.id,
          title: entry.title,
          kind: 'iframe',
          duration: Math.max(1, entry.duration || 20),
          source: entry.sourceUrl
        } as PlayerMediaItem;
      }

      if (entry.kind === 'url') {
        const source = (entry.sourceUrl || '').trim();
        if (!source) return null;
        if (isVideoSource(source)) {
          return {
            id: entry.id,
            title: entry.title,
            kind: 'video',
            duration: 1,
            source
          } as PlayerMediaItem;
        }
        if (isImageSource(source)) {
          return {
            id: entry.id,
            title: entry.title,
            kind: 'image',
            duration: Math.max(1, entry.duration || 15),
            source
          } as PlayerMediaItem;
        }
        return {
          id: entry.id,
          title: entry.title,
          kind: 'iframe',
          duration: Math.max(1, entry.duration || 20),
          source
        } as PlayerMediaItem;
      }

      if (entry.kind === 'markdown') {
        const markdown = entry.markdown || '';
        if (!markdown.trim()) return null;
        return {
          id: entry.id,
          title: entry.title,
          kind: 'markdown',
          duration: Math.max(1, entry.duration || 15),
          markdown
        } as PlayerMediaItem;
      }

      return null;
    })
    .filter((item): item is PlayerMediaItem => Boolean(item));
}

export function computeNextMediaIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (Math.max(0, current) + 1) % total;
}
