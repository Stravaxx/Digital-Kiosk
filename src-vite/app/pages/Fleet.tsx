import React from 'react';
import { Activity, Monitor, AlertTriangle, Clock3 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { useTranslation } from '../i18n';

type FleetItem = {
  id: string;
  name: string;
  deviceId: string;
  status: string;
  heartbeatAgeMs: number | null;
  telemetry: {
    cpuPercent: number;
    memoryPercent: number;
    networkMbps: number;
    networkInterface?: string;
    temperatureC: number;
    diskUsedPercent: number;
    version: string;
  };
};

export function Fleet() {
  const { t } = useTranslation();
  const [summary, setSummary] = React.useState({ total: 0, online: 0, stale: 0, offline: 0, pending: 0 });
  const [items, setItems] = React.useState<FleetItem[]>([]);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/fleet', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setSummary(payload?.summary || { total: 0, online: 0, stale: 0, offline: 0, pending: 0 });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch {
      // keep previous state
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('fleet.title')}</h1>
        <p className="text-[#9ca3af]">{t('fleet.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('fleet.total')}</div><div className="text-2xl text-[#e5e7eb] font-bold">{summary.total}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('fleet.online')}</div><div className="text-2xl text-[#22c55e] font-bold">{summary.online}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('fleet.stale')}</div><div className="text-2xl text-[#f59e0b] font-bold">{summary.stale}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('fleet.offline')}</div><div className="text-2xl text-[#ef4444] font-bold">{summary.offline}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('fleet.pending')}</div><div className="text-2xl text-[#3b82f6] font-bold">{summary.pending}</div></GlassCard>
      </div>

      <GlassCard className="p-4 overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[#9ca3af] border-b border-[rgba(255,255,255,0.12)]">
              <th className="py-2">{t('fleet.player')}</th>
              <th className="py-2">{t('fleet.status')}</th>
              <th className="py-2">{t('fleet.heartbeat')}</th>
              <th className="py-2">{t('fleet.cpu')}</th>
              <th className="py-2">{t('fleet.ram')}</th>
              <th className="py-2">Réseau</th>
              <th className="py-2">{t('fleet.temperature')}</th>
              <th className="py-2">{t('fleet.disk')}</th>
              <th className="py-2">{t('fleet.version')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[rgba(255,255,255,0.06)] text-[#e5e7eb]">
                <td className="py-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-[#9ca3af]">{item.deviceId}</div>
                </td>
                <td className="py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${item.status === 'online' ? 'bg-[#22c55e]/20 text-[#22c55e]' : item.status === 'stale' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="py-2">{item.heartbeatAgeMs == null ? '—' : `${Math.round(item.heartbeatAgeMs / 1000)} s`}</td>
                <td className="py-2">{item.telemetry.cpuPercent?.toFixed(0) || '0'}%</td>
                <td className="py-2">{item.telemetry.memoryPercent?.toFixed(0) || '0'}%</td>
                <td className="py-2">
                  <div>{item.telemetry.networkMbps?.toFixed(2) || '0'} Mbps</div>
                  <div className="text-xs text-[#9ca3af]">{item.telemetry.networkInterface || 'auto'}</div>
                </td>
                <td className="py-2">{item.telemetry.temperatureC?.toFixed(1) || '0'}°C</td>
                <td className="py-2">{item.telemetry.diskUsedPercent?.toFixed(0) || '0'}%</td>
                <td className="py-2">{item.telemetry.version || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
