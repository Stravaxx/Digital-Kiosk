import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Plus, Trash2, Save } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { MediaExplorerModal } from '../components/MediaExplorerModal';
import {
  type LayoutModel,
  type LayoutZoneModel,
  type LayoutZoneType
} from '../../shared/layoutRegistry';
import { type PlaylistModel } from '../../shared/playlistRegistry';
import { ensureAssetIdsAvailableOnSystem, getAssetBlob, type AssetRecord } from '../../services/assetService';
import { deleteLayoutFromApi, listLayoutsFromApi, upsertLayoutFromApi } from '../../services/layoutApiService';
import { listPlaylistsFromApi } from '../../services/playlistApiService';

const zoneTypeOptions: LayoutZoneType[] = ['header', 'main', 'sidebar', 'footer', 'calendar', 'widget', 'media'];

function extractAssetIdsFromLayout(layout: LayoutModel, playlists: PlaylistModel[]): string[] {
  const footerAssetIds = (layout.footerLogos ?? [])
    .map((logo) => logo.trim())
    .filter((logo) => logo.startsWith('asset-image:'))
    .map((logo) => logo.split(':', 2)[1])
    .filter(Boolean);

  const playlistMap = new Map(playlists.map((playlist) => [playlist.id, playlist]));

  const mediaAssetIds = layout.zones
    .filter((zone) => zone.type === 'media' && typeof zone.playlistId === 'string' && zone.playlistId.length > 0)
    .flatMap((zone) => {
      const playlist = playlistMap.get(zone.playlistId || '');
      if (!playlist) return [] as string[];
      return playlist.items
        .filter((entry) => entry.kind === 'asset' && (entry.assetType === 'image' || entry.assetType === 'video'))
        .map((entry) => entry.assetId)
        .filter((value): value is string => Boolean(value));
    });

  return [...footerAssetIds, ...mediaAssetIds];
}

export function Layouts() {
  const [layouts, setLayouts] = useState<LayoutModel[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistModel[]>([]);
  const [editing, setEditing] = useState<LayoutModel | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [footerLogoPickerOpen, setFooterLogoPickerOpen] = useState(false);
  const [footerLogoPreviewUrls, setFooterLogoPreviewUrls] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    void listLayoutsFromApi().then(setLayouts).catch(() => setLayouts([]));
    void listPlaylistsFromApi().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    const logos = (editing?.footerLogos ?? [])
      .map((logo) => logo.trim())
      .filter((logo) => logo.startsWith('asset-image:'));

    if (logos.length === 0) {
      setFooterLogoPreviewUrls({});
      return;
    }

    const refs = Array.from(new Set(logos));
    const createdUrls: string[] = [];
    const nextMap: Record<string, string> = {};

    const run = async () => {
      for (const ref of refs) {
        const assetId = ref.split(':', 2)[1];
        if (!assetId) continue;
        const blob = await getAssetBlob(assetId);
        if (!blob) continue;
        const objectUrl = URL.createObjectURL(blob);
        nextMap[ref] = objectUrl;
        createdUrls.push(objectUrl);
      }
      setFooterLogoPreviewUrls(nextMap);
    };

    void run();

    return () => {
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editing?.footerLogos]);

  const createLayout = () => {
    setEditing({
      id: `layout-${Date.now()}`,
      name: '',
      mode: 'standard',
      displayTemplate: 'classic',
      resolution: '1920x1080',
      headerText: '',
      footerText: '',
      footerLogos: [],
      zones: []
    });
  };

  const createPresetLayout = (preset: 'meeting-room' | 'info-screen') => {
    const base: LayoutModel = {
      id: `layout-${Date.now()}`,
      name: preset === 'meeting-room' ? 'Meeting Room Standard' : 'Info Screen Standard',
      mode: 'standard',
      displayTemplate: 'classic',
      resolution: '1920x1080',
      headerText: preset === 'meeting-room' ? 'Salle de réunion' : 'Écran d’information',
      footerText: preset === 'meeting-room' ? 'Merci de respecter les horaires' : 'Bienvenue',
      footerLogos: [],
      zones:
        preset === 'meeting-room'
          ? [
              { id: `zone-${Date.now()}-1`, name: 'Réunion en cours', type: 'calendar', content: 'Titre, horaire, animateur' },
              { id: `zone-${Date.now()}-2`, name: 'Prochaine réunion', type: 'calendar', content: 'Prochain créneau' },
              { id: `zone-${Date.now()}-3`, name: 'Informations', type: 'widget', content: 'Règles de salle / messages' }
            ]
          : [
              { id: `zone-${Date.now()}-1`, name: 'Contenu principal', type: 'main', content: 'Playlist principale' },
              { id: `zone-${Date.now()}-2`, name: 'Bandeau', type: 'footer', content: 'News / annonces' }
            ]
    };

    void upsertLayoutFromApi(base);
    const next = [...layouts, base];
    setLayouts(next);
    setEditing(base);
  };

  const addZone = () => {
    if (!editing) return;
    const zone: LayoutZoneModel = {
      id: `zone-${Date.now()}`,
      name: `Zone ${editing.zones.length + 1}`,
      type: 'main',
      content: ''
    };
    setEditing({ ...editing, zones: [...editing.zones, zone] });
  };

  const addQuickZone = (type: LayoutZoneType) => {
    if (!editing) return;

    const labels: Record<LayoutZoneType, string> = {
      header: 'Header',
      main: 'Zone principale',
      sidebar: 'Sidebar',
      footer: 'Footer',
      calendar: 'Calendrier',
      widget: 'Widget',
      media: 'Média'
    };

    const zone: LayoutZoneModel = {
      id: `zone-${Date.now()}`,
      name: labels[type],
      type,
      content: '',
      playlistId: type === 'media' ? '' : undefined
    };

    setEditing({ ...editing, zones: [...editing.zones, zone] });
  };

  const reorderZones = (sourceId: string, targetId: string) => {
    if (!editing || sourceId === targetId) return;
    const sourceIndex = editing.zones.findIndex((zone) => zone.id === sourceId);
    const targetIndex = editing.zones.findIndex((zone) => zone.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const nextZones = [...editing.zones];
    const [moved] = nextZones.splice(sourceIndex, 1);
    nextZones.splice(targetIndex, 0, moved);
    setEditing({ ...editing, zones: nextZones });
  };

  const updateZone = (zoneId: string, patch: Partial<LayoutZoneModel>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      zones: editing.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone))
    });
  };

  const removeZone = (zoneId: string) => {
    if (!editing) return;
    setEditing({ ...editing, zones: editing.zones.filter((zone) => zone.id !== zoneId) });
  };

  const assignPlaylistToZone = (zoneId: string, playlistId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      zones: editing.zones.map((zone) => {
        if (zone.id !== zoneId) return zone;
        return {
          ...zone,
          playlistId,
          content: zone.type === 'media' ? '' : zone.content
        };
      })
    });
  };

  const addFooterLogoFromExplorer = async (asset: AssetRecord) => {
    if (!editing || asset.type !== 'image') return;
    setSaveError('');
    await ensureAssetIdsAvailableOnSystem([asset.id]).catch(() => {
      setSaveError(`Impossible de synchroniser le logo ${asset.originalFileName}.`);
    });
    const value = `asset-image:${asset.id}`;
    const next = [...(editing.footerLogos ?? []), value];
    setEditing({ ...editing, footerLogos: next });
  };

  const removeFooterLogoAt = (index: number) => {
    if (!editing) return;
    const next = (editing.footerLogos ?? []).filter((_, i) => i !== index);
    setEditing({ ...editing, footerLogos: next });
  };

  const moveFooterLogo = (index: number, direction: -1 | 1) => {
    if (!editing) return;
    const logos = [...(editing.footerLogos ?? [])];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= logos.length) return;
    const [moved] = logos.splice(index, 1);
    logos.splice(nextIndex, 0, moved);
    setEditing({ ...editing, footerLogos: logos });
  };

  const saveCurrentLayout = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return;

    const missingPlaylistZone = editing.zones.find((zone) => zone.type === 'media' && !(zone.playlistId || '').trim());
    if (missingPlaylistZone) {
      setSaveError(`La zone média "${missingPlaylistZone.name}" doit être liée à une playlist.`);
      return;
    }

    setSaveError('');
    try {
      await ensureAssetIdsAvailableOnSystem(extractAssetIdsFromLayout(editing, playlists));
    } catch {
      setSaveError('Le layout a été enregistré, mais certains assets/logo n’ont pas pu être copiés vers le serveur.');
    }
    const nextRecord = { ...editing, name: editing.name.trim() };
    await upsertLayoutFromApi(nextRecord);
    const next = await listLayoutsFromApi();
    setLayouts(next);
    setEditing(null);
  };

  const deleteLayout = async (layoutId: string) => {
    await deleteLayoutFromApi(layoutId);
    setLayouts(await listLayoutsFromApi());
    if (editing?.id === layoutId) setEditing(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Layouts</h1>
          <p className="text-[#9ca3af]">Personnalisez les zones et les informations affichées côté player</p>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="ghost" onClick={() => createPresetLayout('meeting-room')}>Preset salle</GlassButton>
          <GlassButton variant="ghost" onClick={() => createPresetLayout('info-screen')}>Preset info</GlassButton>
          <GlassButton onClick={createLayout}>
            <Plus size={20} className="inline mr-2" />
            Nouveau layout
          </GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-lg text-[#e5e7eb] mb-4">Layouts enregistrés</h2>
          {layouts.length === 0 ? (
            <p className="text-[#9ca3af]">Aucun layout enregistré.</p>
          ) : (
            <div className="space-y-3">
              {layouts.map((layout) => (
                <div key={layout.id} className="p-3 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[#e5e7eb] font-medium">{layout.name}</p>
                      <p className="text-[#9ca3af] text-sm">{layout.resolution} • {layout.zones.length} zone(s)</p>
                    </div>
                    <div className="flex gap-2">
                      <GlassButton size="sm" variant="ghost" onClick={() => setEditing(layout)}>
                        Éditer
                      </GlassButton>
                      <button
                        type="button"
                        aria-label="Supprimer le layout"
                        title="Supprimer le layout"
                        onClick={() => deleteLayout(layout.id)}
                        className="p-2 hover:bg-[rgba(239,68,68,0.1)] rounded-[8px]"
                      >
                        <Trash2 size={15} className="text-[#ef4444]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg text-[#e5e7eb] mb-4">Éditeur</h2>
          {!editing ? (
            <p className="text-[#9ca3af]">Sélectionnez un layout ou créez-en un nouveau.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-name">Nom du layout</label>
                <input
                  id="layout-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-resolution">Résolution</label>
                <select
                  id="layout-resolution"
                  value={editing.resolution}
                  onChange={(event) => setEditing({ ...editing, resolution: event.target.value })}
                  className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                >
                  <option className="bg-[#111827] text-[#e5e7eb]" value="1920x1080">1920x1080</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="1080x1920">1080x1920</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="3840x2160">3840x2160</option>
                </select>
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-mode">Mode d’affichage</label>
                <select
                  id="layout-mode"
                  value={editing.mode ?? 'standard'}
                  onChange={(event) => setEditing({ ...editing, mode: event.target.value as LayoutModel['mode'] })}
                  className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                >
                  <option className="bg-[#111827] text-[#e5e7eb]" value="standard">Standard</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="room-door-display">Room Door Display</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="room-status-board">Room Status Board (tableau)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-display-template">Template d’affichage</label>
                <select
                  id="layout-display-template"
                  value={editing.displayTemplate ?? 'classic'}
                  onChange={(event) => setEditing({ ...editing, displayTemplate: event.target.value as LayoutModel['displayTemplate'] })}
                  className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                >
                  <option className="bg-[#111827] text-[#e5e7eb]" value="classic">Classique</option>
                  <option className="bg-[#111827] text-[#e5e7eb]" value="low-vision">Aide Personnes Malvoyantes</option>
                </select>
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-header">Texte header</label>
                <input
                  id="layout-header"
                  value={editing.headerText}
                  onChange={(event) => setEditing({ ...editing, headerText: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-footer">Texte footer</label>
                <input
                  id="layout-footer"
                  value={editing.footerText}
                  onChange={(event) => setEditing({ ...editing, footerText: event.target.value })}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="layout-footer-logos">Footer entreprise (logos défilants)</label>
                <div className="flex gap-2 mb-2">
                  <GlassButton size="sm" onClick={() => setFooterLogoPickerOpen(true)}>Ajouter logo depuis l’explorateur</GlassButton>
                </div>
                {(editing.footerLogos ?? []).length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {(editing.footerLogos ?? []).map((logo, index) => (
                      <div key={`${logo}-${index}`} className="flex items-center gap-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2">
                        <div className="w-16 h-12 rounded-[8px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] flex items-center justify-center overflow-hidden shrink-0">
                          {logo.startsWith('asset-image:') && footerLogoPreviewUrls[logo.trim()] ? (
                            <img src={footerLogoPreviewUrls[logo.trim()]} alt="Logo footer" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-[#9ca3af] px-2 text-center">Aperçu</span>
                          )}
                        </div>
                        <span className="text-[#e5e7eb] text-sm flex-1 truncate">{logo.startsWith('asset-image:') ? `Logo local (${logo.replace('asset-image:', '')})` : logo}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveFooterLogo(index, -1)}
                            className="text-[#9ca3af] text-xs disabled:opacity-30"
                            disabled={index === 0}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFooterLogo(index, 1)}
                            className="text-[#9ca3af] text-xs disabled:opacity-30"
                            disabled={index === (editing.footerLogos?.length ?? 0) - 1}
                          >
                            →
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFooterLogoAt(index)}
                          className="text-[#ef4444] text-xs"
                        >
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9ca3af]">Aucun logo ajouté.</p>
                )}
                <p className="text-xs text-[#9ca3af] mt-1">
                  Les logos sont choisis via l’explorateur de fichiers (assets images) puis affichés en bas du player avec défilement.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-[#e5e7eb] font-medium">Zones ({editing.zones.length})</h3>
                <GlassButton size="sm" variant="ghost" onClick={addZone}>
                  <Plus size={15} className="mr-1" />
                  Ajouter zone
                </GlassButton>
              </div>

              <div className="flex flex-wrap gap-2">
                {zoneTypeOptions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addQuickZone(type)}
                    className="px-3 py-1 rounded-[10px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-[#e5e7eb] text-xs"
                  >
                    + {type}
                  </button>
                ))}
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {editing.zones.map((zone) => (
                  <div
                    key={zone.id}
                    draggable
                    onDragStart={() => setDraggingZoneId(zone.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingZoneId) reorderZones(draggingZoneId, zone.id);
                      setDraggingZoneId(null);
                    }}
                    className="p-3 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] space-y-2 cursor-move"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={zone.name}
                        onChange={(event) => updateZone(zone.id, { name: event.target.value })}
                        className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                        placeholder="Nom de zone"
                        aria-label="Nom de zone"
                      />
                      <select
                        value={zone.type}
                        onChange={(event) => updateZone(zone.id, { type: event.target.value as LayoutZoneType })}
                        className="appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                        aria-label="Type de zone"
                      >
                        {zoneTypeOptions.map((type) => (
                          <option className="bg-[#111827] text-[#e5e7eb]" key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={zone.content}
                      onChange={(event) => updateZone(zone.id, { content: event.target.value })}
                      className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                      rows={2}
                      placeholder={zone.type === 'media' ? 'Contenu géré via la playlist liée à cette zone.' : 'Contenu affiché dans cette zone'}
                      aria-label="Contenu de zone"
                      disabled={zone.type === 'media'}
                    />
                    {zone.type === 'media' && (
                      <div className="space-y-2">
                        <select
                          value={zone.playlistId ?? ''}
                          onChange={(event) => assignPlaylistToZone(zone.id, event.target.value)}
                          aria-label="Choisir une playlist pour la zone média"
                          className="w-full bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb] text-sm"
                        >
                          <option value="">Choisir une playlist</option>
                          {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-[#9ca3af]">
                          Cette zone lit exclusivement la playlist sélectionnée, dans l’ordre défini dans l’éditeur Playlists.
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeZone(zone.id)}
                      className="text-[#ef4444] text-sm"
                    >
                      Supprimer la zone
                    </button>
                  </div>
                ))}
              </div>

              <GlassButton onClick={saveCurrentLayout} className="w-full">
                <Save size={16} className="mr-2" />
                Enregistrer le layout
              </GlassButton>
              {saveError ? <p className="text-[#ef4444] text-sm">{saveError}</p> : null}
            </div>
          )}
        </GlassCard>
      </div>

      {editing && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <LayoutDashboard className="text-[#3b82f6]" size={20} />
            <h3 className="text-[#e5e7eb]">Aperçu des informations enregistrées</h3>
          </div>
          <p className="text-[#e5e7eb] mb-2">Header: {editing.headerText || '—'}</p>
          <div className="space-y-1">
            {editing.zones.map((zone) => (
              <p key={zone.id} className="text-[#9ca3af] text-sm">
                {zone.name} ({zone.type}): {zone.type === 'media'
                  ? (playlists.find((item) => item.id === zone.playlistId)?.name || 'Playlist non définie')
                  : (zone.content || '—')}
              </p>
            ))}
          </div>
          <p className="text-[#e5e7eb] mt-2">Footer: {editing.footerText || '—'}</p>
          <p className="text-[#9ca3af] text-sm mb-3">Logos footer: {(editing.footerLogos ?? []).length}</p>
          {(editing.footerLogos ?? []).length > 0 ? (
            <div className="rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-3 overflow-hidden">
              <div className="flex items-center gap-4 overflow-x-auto">
                {(editing.footerLogos ?? []).map((logo, index) => (
                  <div key={`${logo}-preview-${index}`} className="h-12 min-w-20 rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 flex items-center justify-center">
                    {logo.startsWith('asset-image:') && footerLogoPreviewUrls[logo.trim()] ? (
                      <img src={footerLogoPreviewUrls[logo.trim()]} alt="Logo footer aperçu" className="max-h-8 w-auto object-contain" />
                    ) : (
                      <span className="text-[#9ca3af] text-xs">Logo</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </GlassCard>
      )}

      <MediaExplorerModal
        open={footerLogoPickerOpen}
        title="Choisir un logo footer"
        onClose={() => setFooterLogoPickerOpen(false)}
        onSelect={(asset) => addFooterLogoFromExplorer(asset)}
        allowedTypes={['image']}
        showDuration={false}
      />
    </div>
  );
}
