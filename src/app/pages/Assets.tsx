import React, { useEffect, useRef, useState } from 'react';
import { Upload, Image, Video, FileText, Download, Eye, Trash2 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import {
  deleteAsset,
  downloadAsset,
  formatAssetSize,
  listAssets,
  openAssetPreview,
  uploadAssets,
  type AssetRecord
} from '../../services/assetService';

export function Assets() {
  const [showUpload, setShowUpload] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshAssets = async () => {
    const rows = await listAssets();
    setAssets(rows);
  };

  useEffect(() => {
    refreshAssets().catch(() => setAssets([]));
  }, []);

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await uploadAssets(Array.from(files));
      await refreshAssets();
      setShowUpload(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Échec upload assets');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Assets Library</h1>
          <p className="text-[#9ca3af]">Manage your media files and content</p>
        </div>
        <GlassButton onClick={() => setShowUpload(true)}>
          <Upload size={20} className="inline mr-2" />
          Upload Assets
        </GlassButton>
      </div>

      <GlassCard className="p-6">
        {assets.length === 0 ? (
          <div className="text-center py-20">
            <Upload size={64} className="mx-auto text-[#9ca3af] opacity-50 mb-4" />
            <h3 className="text-lg text-[#e5e7eb] mb-2">Aucun asset uploadé</h3>
            <p className="text-[#9ca3af] mb-6">Upload images, vidéos ou documents pour démarrer</p>
            <GlassButton onClick={() => setShowUpload(true)}>
              <Upload size={20} className="inline mr-2" />
              Upload premier asset
            </GlassButton>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <div key={asset.id} className="p-3 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {asset.type === 'image' ? <Image size={16} className="text-[#3b82f6]" /> : asset.type === 'video' ? <Video size={16} className="text-[#22c55e]" /> : <FileText size={16} className="text-[#f59e0b]" />}
                    <div className="min-w-0">
                      <p className="text-[#e5e7eb] text-sm truncate">{asset.name}</p>
                      <p className="text-[#9ca3af] text-xs">{asset.originalFileName} • {formatAssetSize(asset.size)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setError('');
                        try {
                          await openAssetPreview(asset);
                        } catch (previewError) {
                          setError(previewError instanceof Error ? previewError.message : 'Prévisualisation impossible');
                        }
                      }}
                    >
                      <Eye size={14} />
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setError('');
                        try {
                          await downloadAsset(asset);
                        } catch (downloadError) {
                          setError(downloadError instanceof Error ? downloadError.message : 'Téléchargement impossible');
                        }
                      }}
                    >
                      <Download size={14} />
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        setError('');
                        try {
                          await deleteAsset(asset.id);
                          await refreshAssets();
                        } catch (deleteError) {
                          setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible');
                        }
                      }}
                    >
                      <Trash2 size={14} className="text-[#ef4444]" />
                    </GlassButton>
                  </div>
                </div>
              </div>
            ))}
            {error ? <p className="text-[#ef4444] text-sm mt-1">{error}</p> : null}
          </div>
        )}
      </GlassCard>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <GlassCard className="w-full max-w-lg p-6 m-4">
            <h2 className="text-xl text-[#e5e7eb] mb-4">Upload Assets</h2>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => onPickFiles(event.target.files)}
              accept="image/*,video/*,.pdf,.html,.htm,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              title="Choisir des fichiers médias"
              aria-label="Choisir des fichiers médias"
            />
            <div
              className="border-2 border-dashed border-[rgba(255,255,255,0.12)] rounded-[16px] p-12 text-center cursor-pointer hover:border-[#3b82f6] transition-all duration-200"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} className="mx-auto text-[#9ca3af] mb-4" />
              <p className="text-[#e5e7eb] mb-2">Click to upload or drag and drop</p>
              <p className="text-[#9ca3af] text-sm">Images, videos, PDFs, or HTML files</p>
            </div>
            {error ? <p className="text-[#ef4444] text-sm mt-3">{error}</p> : null}
            <div className="flex gap-3 pt-6">
              <GlassButton variant="ghost" className="flex-1" onClick={() => setShowUpload(false)}>
                Annuler
              </GlassButton>
              <GlassButton className="flex-1" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                {busy ? 'Upload...' : 'Choisir des fichiers'}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
