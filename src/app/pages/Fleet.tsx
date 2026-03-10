import React from 'react';
import { Activity, Monitor, AlertTriangle, Clock3 } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

type FleetItem = {
  id: string;
  name: string;
  deviceId: string;
  status: string;
  heartbeatAgeMs: number | null;
  telemetry: {
    cpuPercent: number;
    memoryPercent: number;
    temperatureC: number;
    diskUsedPercent: number;
    version: string;
  };
};

export function Fleet() {
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
        <h1 className="text-2xl text-[#e5e7eb] mb-2">Fleet Monitoring</h1>
        <p className="text-[#9ca3af]">État global des players, latence heartbeat et télémétrie.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Total</div><div className="text-2xl text-[#e5e7eb] font-bold">{summary.total}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Online</div><div className="text-2xl text-[#22c55e] font-bold">{summary.online}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Stale</div><div className="text-2xl text-[#f59e0b] font-bold">{summary.stale}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Offline</div><div className="text-2xl text-[#ef4444] font-bold">{summary.offline}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Pending</div><div className="text-2xl text-[#3b82f6] font-bold">{summary.pending}</div></GlassCard>
      </div>

      <GlassCard className="p-4 overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[#9ca3af] border-b border-[rgba(255,255,255,0.12)]">
              <th className="py-2">Player</th>
              <th className="py-2">Statut</th>
              <th className="py-2">Heartbeat</th>
              <th className="py-2">CPU</th>
              <th className="py-2">RAM</th>
              <th className="py-2">Température</th>
              <th className="py-2">Disque</th>
              <th className="py-2">Version</th>
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
