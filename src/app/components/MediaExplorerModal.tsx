import React, { useEffect, useMemo, useState } from 'react';
import { Search, Image, Video, FileText } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { formatAssetSize, listAssets, type AssetRecord } from '../../services/assetService';

interface MediaExplorerModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (asset: AssetRecord, duration: number) => void;
  allowedTypes?: Array<'image' | 'video'>;
  showDuration?: boolean;
  defaultDuration?: number;
}

export function MediaExplorerModal({
  open,
  title,
  onClose,
  onSelect,
  allowedTypes,
  showDuration = true,
  defaultDuration = 10
}: MediaExplorerModalProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState(Math.max(1, defaultDuration));
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDuration(Math.max(1, defaultDuration));
    listAssets().then(setAssets).catch(() => setAssets([]));
  }, [defaultDuration, open]);

  const visibleAssets = useMemo(() => {
    const base = assets.filter((asset) => {
      if (allowedTypes && !allowedTypes.includes(asset.type as 'image' | 'video')) return false;
      if (filter === 'all') return true;
      return asset.type === filter;
    });

    const q = search.trim().toLowerCase();
    if (!q) return base;

    return base.filter((asset) =>
      asset.name.toLowerCase().includes(q)
      || asset.originalFileName.toLowerCase().includes(q)
      || asset.type.toLowerCase().includes(q)
    );
  }, [allowedTypes, assets, filter, search]);

  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedId) ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-3xl max-h-[88vh] overflow-hidden">
        <div className="p-4 border-b border-[rgba(255,255,255,0.12)]">
          <h2 className="text-[#e5e7eb] text-lg mb-3">{title}</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un média"
                className="w-full pl-9 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as 'all' | 'image' | 'video')}
              title="Filtrer les médias"
              aria-label="Filtrer les médias"
              className="bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
            >
              <option value="all">Tous</option>
              {(allowedTypes ? allowedTypes.includes('image') : true) ? <option value="image">Images</option> : null}
              {(allowedTypes ? allowedTypes.includes('video') : true) ? <option value="video">Vidéos</option> : null}
            </select>
            {showDuration ? (
              <input
                type="number"
                min={3}
                value={duration}
                onChange={(event) => setDuration(Math.max(3, Number.parseInt(event.target.value || '10', 10) || 10))}
                className="w-[100px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                title="Durée en secondes"
                aria-label="Durée en secondes"
              />
            ) : null}
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-2">
          {visibleAssets.length === 0 ? (
            <p className="text-[#9ca3af] text-sm text-center py-8">Aucun média trouvé.</p>
          ) : (
            visibleAssets.map((asset) => (
              <button
                type="button"
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                className={`w-full text-left rounded-[10px] border px-3 py-3 transition-colors ${selectedId === asset.id
                  ? 'bg-[rgba(59,130,246,0.16)] border-[rgba(59,130,246,0.55)]'
                  : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.08)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {asset.type === 'image' ? <Image size={16} className="text-[#3b82f6]" /> : asset.type === 'video' ? <Video size={16} className="text-[#22c55e]" /> : <FileText size={16} className="text-[#f59e0b]" />}
                    <span className="text-[#e5e7eb] text-sm">{asset.name}</span>
                  </div>
                  <span className="text-[#9ca3af] text-xs">{formatAssetSize(asset.size)}</span>
                </div>
                <p className="text-[#9ca3af] text-xs mt-1">{asset.originalFileName}</p>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[rgba(255,255,255,0.12)] flex gap-2">
          <GlassButton variant="ghost" className="flex-1" onClick={onClose}>Annuler</GlassButton>
          <GlassButton
            className="flex-1"
            disabled={!selectedAsset}
            onClick={() => {
              if (!selectedAsset) return;
              onSelect(selectedAsset, showDuration ? duration : 0);
              onClose();
            }}
          >
            Ajouter
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
