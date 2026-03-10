import { describe, expect, it } from 'vitest';
import { computeNextMediaIndex, resolvePlaylistMediaItems } from '../../src/services/playerPlaylistEngine';
import type { PlaylistModel } from '../../src/shared/playlistRegistry';

describe('playerPlaylistEngine', () => {
  const playlist: PlaylistModel = {
    id: 'p1',
    name: 'Playlist test',
    description: '',
    loop: true,
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'a1',
        title: 'Image locale',
        kind: 'asset',
        assetId: 'img-1',
        assetType: 'image',
        duration: 15
      },
      {
        id: 'u1',
        title: 'Video URL',
        kind: 'url',
        sourceUrl: 'https://cdn.example.com/video.mp4',
        duration: 20
      },
      {
        id: 'm1',
        title: 'Markdown',
        kind: 'markdown',
        markdown: '# Hello',
        duration: 9
      }
    ]
  };

  it('resolves mixed playlist entries for player', () => {
    const media = resolvePlaylistMediaItems(playlist, {
      'asset-image:img-1': 'blob:local-image-1'
    });

    expect(media).toHaveLength(3);
    expect(media[0].kind).toBe('image');
    expect(media[0].source).toBe('blob:local-image-1');
    expect(media[1].kind).toBe('video');
    expect(media[1].duration).toBe(1);
    expect(media[2].kind).toBe('markdown');
  });

  it('computes next index with loop', () => {
    expect(computeNextMediaIndex(0, 3)).toBe(1);
    expect(computeNextMediaIndex(2, 3)).toBe(0);
    expect(computeNextMediaIndex(5, 0)).toBe(0);
  });
});
