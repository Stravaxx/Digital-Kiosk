import React from 'react';
import { Database, HardDrive, Trash2 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { StatCard } from '../components/StatCard';

export function Storage() {
  const [stats, setStats] = React.useState({
    totalAssets: 0,
    totalSize: 0,
    cacheSize: 0,
    logsSize: 0,
    dbEngine: 'json',
    dbPath: ''
  });
  const [busy, setBusy] = React.useState(false);

  const toGb = (value: number) => `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  const totalUsed = stats.totalSize + stats.cacheSize + stats.logsSize;
  const safeTotal = Math.max(totalUsed, 1);
  const assetsPct = Math.round((stats.totalSize / safeTotal) * 100);
  const cachePct = Math.round((stats.cacheSize / safeTotal) * 100);
  const logsPct = Math.round((stats.logsSize / safeTotal) * 100);

  const loadStats = React.useCallback(async () => {
    try {
      const response = await fetch('/api/storage/stats', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setStats({
        totalAssets: Number(payload?.totalAssets) || 0,
        totalSize: Number(payload?.totalSize) || 0,
        cacheSize: Number(payload?.cacheSize) || 0,
        logsSize: Number(payload?.logsSize) || 0,
        dbEngine: String(payload?.dbEngine || 'json'),
        dbPath: String(payload?.dbPath || '')
      });
    } catch {
      // keep previous state
    }
  }, []);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const clearCache = async () => {
    setBusy(true);
    try {
      await fetch('/api/storage/clear-cache', { method: 'POST' });
      await loadStats();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Storage Management</h1>
          <p className="text-[#9ca3af]">Monitor storage usage and manage files</p>
        </div>
        <GlassButton variant="danger" onClick={clearCache} disabled={busy}>
          <Trash2 size={20} className="inline mr-2" />
          {busy ? 'Nettoyage...' : 'Clear Cache'}
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Storage"
          value={toGb(totalUsed)}
          icon={<HardDrive size={40} />}
          color="primary"
        />
        <StatCard
          title="Assets Storage"
          value={toGb(stats.totalSize)}
          icon={<Database size={40} />}
          color="secondary"
        />
        <StatCard
          title="Cache Storage"
          value={toGb(stats.cacheSize)}
          icon={<Database size={40} />}
          color="warning"
        />
      </div>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">Storage Distribution</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#9ca3af]">Assets</span>
              <span className="text-[#e5e7eb]">{toGb(stats.totalSize)} / {assetsPct}%</span>
            </div>
            <progress className="w-full h-2 rounded-full overflow-hidden storage-progress storage-progress-assets" max={100} value={assetsPct} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#9ca3af]">Cache</span>
              <span className="text-[#e5e7eb]">{toGb(stats.cacheSize)} / {cachePct}%</span>
            </div>
            <progress className="w-full h-2 rounded-full overflow-hidden storage-progress storage-progress-cache" max={100} value={cachePct} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#9ca3af]">Logs</span>
              <span className="text-[#e5e7eb]">{toGb(stats.logsSize)} / {logsPct}%</span>
            </div>
            <progress className="w-full h-2 rounded-full overflow-hidden storage-progress storage-progress-logs" max={100} value={logsPct} />
          </div>
        </div>
        <div className="mt-4 text-xs text-[#9ca3af]">
          <div>Moteur DB: {stats.dbEngine}</div>
          <div className="truncate">Chemin DB: {stats.dbPath || 'N/A'}</div>
          <div>Assets: {stats.totalAssets}</div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">Storage Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.12)]">
            <div>
              <p className="text-[#e5e7eb]">Auto-cleanup old files</p>
              <p className="text-[#9ca3af] text-sm">Automatically remove unused files after 30 days</p>
            </div>
            <label className="relative inline-block w-12 h-6">
              <input type="checkbox" className="sr-only peer" aria-label="Activer le nettoyage automatique" title="Activer le nettoyage automatique" />
              <div className="w-full h-full bg-[rgba(255,255,255,0.12)] rounded-full peer-checked:bg-[#3b82f6] transition-all duration-200"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all duration-200"></div>
            </label>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-[#e5e7eb]">Cache offline content</p>
              <p className="text-[#9ca3af] text-sm">Enable offline playback on screens</p>
            </div>
            <label className="relative inline-block w-12 h-6">
              <input type="checkbox" className="sr-only peer" defaultChecked aria-label="Activer le cache hors ligne" title="Activer le cache hors ligne" />
              <div className="w-full h-full bg-[rgba(255,255,255,0.12)] rounded-full peer-checked:bg-[#3b82f6] transition-all duration-200"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-6 transition-all duration-200"></div>
            </label>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
