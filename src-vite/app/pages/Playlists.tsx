import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, List, Plus, Save, Trash2 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { MediaExplorerModal } from '../components/MediaExplorerModal';
import { MarkdownEditor } from '../components/MarkdownEditor';
import {
  type PlaylistEntryKind,
  type PlaylistEntryModel,
  type PlaylistModel
} from '../../shared/playlistRegistry';
import { ensureAssetIdsAvailableOnSystem, type AssetRecord } from '../../services/assetService';
import {
  deletePlaylistFromApi,
  listPlaylistsFromApi,
  upsertPlaylistFromApi
} from '../../services/playlistApiService';
import { useTranslation } from '../i18n';

const DEFAULT_IMAGE_DURATION = 15;
const DEFAULT_IFRAME_DURATION = 20;

function createAssetEntry(asset: AssetRecord, duration: number): PlaylistEntryModel {
  const fallbackDuration = asset.type === 'image' ? DEFAULT_IMAGE_DURATION : 1;
  return {
    id: `entry-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    title: asset.name,
    kind: 'asset',
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type,
    duration: asset.type === 'video' ? 1 : Math.max(1, duration || fallbackDuration)
  };
}

function createIframeEntry(url: string): PlaylistEntryModel {
  return {
    id: `entry-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    title: 'Page web (iframe)',
    kind: 'iframe',
    sourceUrl: url.trim(),
    duration: DEFAULT_IFRAME_DURATION
  };
}

function createUrlEntry(url: string): PlaylistEntryModel {
  const normalized = url.trim();
  const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(normalized);
  return {
    id: `entry-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    title: isVideo ? 'Vidéo web' : 'URL média',
    kind: 'url',
    sourceUrl: normalized,
    duration: isVideo ? 1 : DEFAULT_IFRAME_DURATION
  };
}

function createMarkdownEntry(markdown: string): PlaylistEntryModel {
  return {
    id: `entry-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    title: 'Bloc Markdown',
    kind: 'markdown',
    markdown,
    duration: DEFAULT_IMAGE_DURATION
  };
}

export function Playlists() {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<PlaylistModel[]>([]);
  const [editing, setEditing] = useState<PlaylistModel | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showExplorer, setShowExplorer] = useState(false);
  const [newIframeUrl, setNewIframeUrl] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMarkdown, setNewMarkdown] = useState('');
  const [editorError, setEditorError] = useState('');

  useEffect(() => {
    void listPlaylistsFromApi().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  const selectedEntry = useMemo(() => {
    if (!editing || !selectedEntryId) return null;
    return editing.items.find((item) => item.id === selectedEntryId) ?? null;
  }, [editing, selectedEntryId]);

  const createPlaylist = () => {
    setEditorError('');
    setEditing({
      id: `playlist-${Date.now()}`,
      name: '',
      description: '',
      loop: true,
      items: [],
      updatedAt: new Date().toISOString()
    });
    setSelectedEntryId(null);
  };

  const savePlaylist = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setEditorError('Le nom de la playlist est requis.');
      return;
    }
    if (editing.items.length === 0) {
      setEditorError('Ajoutez au moins un média dans la playlist.');
      return;
    }

    const assetIds = editing.items
      .filter((item) => item.kind === 'asset' && (item.assetType === 'image' || item.assetType === 'video'))
      .map((item) => item.assetId)
      .filter((value): value is string => Boolean(value));

    setEditorError('');
    await ensureAssetIdsAvailableOnSystem(assetIds).catch(() => {
      setEditorError('Playlist sauvegardée, mais certains assets n’ont pas pu être copiés vers le serveur.');
    });

    const nextRecord = { ...editing, name: editing.name.trim() };
    await upsertPlaylistFromApi(nextRecord);
    const next = await listPlaylistsFromApi();
    setPlaylists(next);
    setEditing(null);
    setSelectedEntryId(null);
  };

  const removePlaylist = async (playlistId: string) => {
    await deletePlaylistFromApi(playlistId);
    const next = await listPlaylistsFromApi();
    setPlaylists(next);
    if (editing?.id === playlistId) {
      setEditing(null);
      setSelectedEntryId(null);
    }
  };

  const patchEntry = (entryId: string, patch: Partial<PlaylistEntryModel>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      items: editing.items.map((item) => {
        if (item.id !== entryId) return item;
        const nextDuration = patch.duration !== undefined
          ? Math.max(1, Number(patch.duration) || 1)
          : item.duration;
        return {
          ...item,
          ...patch,
          duration: nextDuration
        };
      })
    });
  };

  const removeEntry = (entryId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      items: editing.items.filter((entry) => entry.id !== entryId)
    });
    if (selectedEntryId === entryId) setSelectedEntryId(null);
  };

  const moveEntry = (entryId: string, direction: -1 | 1) => {
    if (!editing) return;
    const currentIndex = editing.items.findIndex((entry) => entry.id === entryId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= editing.items.length) return;

    const nextItems = [...editing.items];
    const [moved] = nextItems.splice(currentIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    setEditing({ ...editing, items: nextItems });
  };

  const addAssetToPlaylist = (asset: AssetRecord, duration: number) => {
    if (!editing) return;
    const entry = createAssetEntry(asset, duration || DEFAULT_IMAGE_DURATION);
    setEditing({ ...editing, items: [...editing.items, entry] });
    setSelectedEntryId(entry.id);
  };

  const addIframeToPlaylist = () => {
    if (!editing) return;
    if (!newIframeUrl.trim()) return;
    const entry = createIframeEntry(newIframeUrl);
    setEditing({ ...editing, items: [...editing.items, entry] });
    setSelectedEntryId(entry.id);
    setNewIframeUrl('');
  };

  const addUrlToPlaylist = () => {
    if (!editing) return;
    if (!newMediaUrl.trim()) return;
    const entry = createUrlEntry(newMediaUrl);
    setEditing({ ...editing, items: [...editing.items, entry] });
    setSelectedEntryId(entry.id);
    setNewMediaUrl('');
  };

  const addMarkdownToPlaylist = () => {
    if (!editing) return;
    if (!newMarkdown.trim()) return;
    const entry = createMarkdownEntry(newMarkdown);
    setEditing({ ...editing, items: [...editing.items, entry] });
    setSelectedEntryId(entry.id);
    setNewMarkdown('');
  };

  const renderItemSummary = (item: PlaylistEntryModel) => {
    if (item.kind === 'asset') {
      return `${item.assetType || 'media'} • ${item.assetName || item.title}`;
    }
    if (item.kind === 'iframe') {
      return `iframe • ${item.sourceUrl || ''}`;
    }
    if (item.kind === 'url') {
      return `url • ${item.sourceUrl || ''}`;
    }
    return 'markdown';
  };

  const isVideoItem = (item: PlaylistEntryModel): boolean => {
    if (item.kind === 'asset') return item.assetType === 'video';
    if (item.kind === 'url') return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(item.sourceUrl || '');
    return false;
  };

  const kindLabel = (kind: PlaylistEntryKind): string => {
    if (kind === 'asset') return 'Asset local';
    if (kind === 'iframe') return 'Page iframe';
    if (kind === 'url') return 'URL média';
    return 'Markdown';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('playlists.pageTitle')}</h1>
          <p className="text-[#9ca3af]">{t('playlists.pageHint')}</p>
        </div>
        <GlassButton onClick={createPlaylist}>
          <Plus size={18} className="mr-1" />
          {t('playlists.new')}
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-lg text-[#e5e7eb] mb-4">{t('playlists.list')}</h2>
          {playlists.length === 0 ? (
            <div className="text-center py-16">
              <List size={56} className="mx-auto text-[#9ca3af] opacity-50 mb-3" />
              <p className="text-[#9ca3af]">{t('playlists.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="p-3 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[#e5e7eb]">{playlist.name}</p>
                      <p className="text-[#9ca3af] text-xs">{playlist.items.length} média(s) • {playlist.loop ? 'boucle active' : 'lecture unique'}</p>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton size="sm" variant="ghost" onClick={() => {
                        setEditing(playlist);
                        setSelectedEntryId(playlist.items[0]?.id ?? null);
                        setEditorError('');
                      }}>
                        Éditer
                      </GlassButton>
                      <GlassButton size="sm" variant="ghost" onClick={() => void removePlaylist(playlist.id)}>
                        <Trash2 size={14} className="text-[#ef4444]" />
                      </GlassButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg text-[#e5e7eb] mb-4">{t('playlists.builder')}</h2>
          {!editing ? (
            <p className="text-[#9ca3af]">Choisissez une playlist à éditer ou créez-en une nouvelle.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="playlist-name">{t('playlists.name')}</label>
                <input
                  id="playlist-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="playlist-description">{t('playlists.description')}</label>
                <textarea
                  id="playlist-description"
                  rows={2}
                  value={editing.description}
                  onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                />
              </div>

              <label className="flex items-center gap-2 text-[#e5e7eb]">
                <input
                  type="checkbox"
                  checked={editing.loop}
                  onChange={(event) => setEditing({ ...editing, loop: event.target.checked })}
                />
                {t('playlists.loop')}
              </label>

              <div className="space-y-3 border border-[rgba(255,255,255,0.12)] rounded-[12px] p-3 bg-[rgba(255,255,255,0.03)]">
                <h3 className="text-[#e5e7eb]">Ajouter des médias</h3>
                <div className="flex flex-wrap gap-2">
                  <GlassButton size="sm" onClick={() => setShowExplorer(true)}>
                    <Plus size={14} className="mr-1" />
                    {t('playlists.addAsset')}
                  </GlassButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    value={newMediaUrl}
                    onChange={(event) => setNewMediaUrl(event.target.value)}
                    className="md:col-span-2 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                    placeholder="URL média (image/vidéo/fichier)"
                  />
                  <GlassButton size="sm" variant="ghost" onClick={addUrlToPlaylist} disabled={!newMediaUrl.trim()}>{t('playlists.addUrl')}</GlassButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    value={newIframeUrl}
                    onChange={(event) => setNewIframeUrl(event.target.value)}
                    className="md:col-span-2 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                    placeholder="URL page web à afficher en iframe"
                  />
                  <GlassButton size="sm" variant="ghost" onClick={addIframeToPlaylist} disabled={!newIframeUrl.trim()}>{t('playlists.addIframe')}</GlassButton>
                </div>

                <div className="space-y-2">
                  <MarkdownEditor
                    value={newMarkdown}
                    onChange={setNewMarkdown}
                    popupOnly
                    popupTitle="Nouveau média Markdown"
                  />
                  <GlassButton size="sm" variant="ghost" onClick={addMarkdownToPlaylist} disabled={!newMarkdown.trim()}>
                    {t('playlists.addMarkdown')}
                  </GlassButton>
                </div>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                <h3 className="text-[#e5e7eb]">Ordre de lecture ({editing.items.length})</h3>
                {editing.items.length === 0 ? (
                  <p className="text-[#9ca3af] text-sm">Aucun média dans cette playlist.</p>
                ) : editing.items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-[10px] border ${selectedEntryId === item.id
                      ? 'bg-[rgba(59,130,246,0.14)] border-[rgba(59,130,246,0.45)]'
                      : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left flex-1"
                        onClick={() => setSelectedEntryId(item.id)}
                      >
                        <p className="text-[#e5e7eb] text-sm">{index + 1}. {item.title || 'Média sans titre'}</p>
                        <p className="text-[#9ca3af] text-xs mt-0.5">{renderItemSummary(item)}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <button type="button" className="text-[#9ca3af]" onClick={() => moveEntry(item.id, -1)} disabled={index === 0} aria-label="Monter le média" title="Monter le média"><ArrowUp size={14} /></button>
                        <button type="button" className="text-[#9ca3af]" onClick={() => moveEntry(item.id, 1)} disabled={index === editing.items.length - 1} aria-label="Descendre le média" title="Descendre le média"><ArrowDown size={14} /></button>
                        <button type="button" className="text-[#ef4444]" onClick={() => removeEntry(item.id)} aria-label="Supprimer le média" title="Supprimer le média"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedEntry ? (
                <div className="space-y-3 border border-[rgba(255,255,255,0.12)] rounded-[12px] p-3 bg-[rgba(255,255,255,0.03)]">
                  <h3 className="text-[#e5e7eb]">Modifier l’item sélectionné</h3>
                  <p className="text-[#9ca3af] text-xs">Type: {kindLabel(selectedEntry.kind)}</p>
                  <input
                    value={selectedEntry.title}
                    onChange={(event) => patchEntry(selectedEntry.id, { title: event.target.value })}
                    className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                    placeholder="Titre affiché"
                  />

                  {selectedEntry.kind === 'markdown' ? (
                    <MarkdownEditor
                      value={selectedEntry.markdown || ''}
                      onChange={(value: string) => patchEntry(selectedEntry.id, { markdown: value })}
                      popupOnly
                      popupTitle="Modifier le média Markdown"
                    />
                  ) : null}

                  {selectedEntry.kind === 'iframe' || selectedEntry.kind === 'url' ? (
                    <input
                      value={selectedEntry.sourceUrl || ''}
                      onChange={(event) => patchEntry(selectedEntry.id, { sourceUrl: event.target.value })}
                      className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                      placeholder="URL"
                    />
                  ) : null}

                  {!isVideoItem(selectedEntry) ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[#9ca3af] text-xs">Durée (sec)</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedEntry.duration}
                        aria-label="Durée en secondes"
                        title="Durée en secondes"
                        onChange={(event) => patchEntry(selectedEntry.id, { duration: Math.max(1, Number.parseInt(event.target.value || '15', 10) || 15) })}
                        className="w-24 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[8px] px-2 py-1 text-[#e5e7eb]"
                      />
                    </div>
                  ) : (
                    <p className="text-[#9ca3af] text-xs">Vidéo détectée: la durée est ignorée et le player attend la fin du média.</p>
                  )}
                </div>
              ) : null}

              <GlassButton className="w-full" onClick={savePlaylist}>
                <Save size={15} className="mr-2" />
                Enregistrer playlist
              </GlassButton>

              {editorError ? <p className="text-[#ef4444] text-sm">{editorError}</p> : null}
            </div>
          )}
        </GlassCard>
      </div>

      <MediaExplorerModal
        open={showExplorer}
        title="Ajouter un asset local"
        onClose={() => setShowExplorer(false)}
        onSelect={addAssetToPlaylist}
        allowedTypes={['image', 'video']}
        showDuration
        defaultDuration={DEFAULT_IMAGE_DURATION}
      />
    </div>
  );
}
