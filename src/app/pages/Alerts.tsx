import React from 'react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';

type AlertsConfig = {
  offlineAfterSeconds: number;
  staleAfterSeconds: number;
  maxTemperatureC: number;
  maxStorageUsagePercent: number;
  maxHeartbeatLatencyMs: number;
};

type AlertItem = {
  id: string;
  severity: 'critical' | 'warning';
  type: string;
  message: string;
  at: string;
  status?: 'new' | 'ack' | 'silenced' | 'resolved';
  silencedUntil?: string;
  ackedAt?: string;
};

export function Alerts() {
  const [config, setConfig] = React.useState<AlertsConfig>({
    offlineAfterSeconds: 180,
    staleAfterSeconds: 90,
    maxTemperatureC: 80,
    maxStorageUsagePercent: 85,
    maxHeartbeatLatencyMs: 30000
  });
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [actionBusyId, setActionBusyId] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [configRes, alertsRes] = await Promise.all([
        fetch('/api/alerts/config', { cache: 'no-store' }),
        fetch('/api/alerts', { cache: 'no-store' })
      ]);

      if (configRes.ok) {
        const configPayload = await configRes.json();
        setConfig((prev) => ({ ...prev, ...(configPayload?.config || {}) }));
      }
      if (alertsRes.ok) {
        const alertsPayload = await alertsRes.json();
        setAlerts(Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts : []);
      }
    } catch {
      // keep previous state
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const ackAlert = async (alertId: string) => {
    setActionBusyId(alertId);
    try {
      await fetch(`/api/alerts/${encodeURIComponent(alertId)}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      await load();
    } finally {
      setActionBusyId('');
    }
  };

  const silenceAlert = async (alertId: string) => {
    setActionBusyId(alertId);
    try {
      await fetch(`/api/alerts/${encodeURIComponent(alertId)}/silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 30 })
      });
      await load();
    } finally {
      setActionBusyId('');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl text-[#e5e7eb] mb-2">Centre d’alertes</h1>
        <p className="text-[#9ca3af]">Seuils configurables et alertes en temps réel.</p>
      </div>

      <GlassCard className="p-6 space-y-4">
        <h2 className="text-lg text-[#e5e7eb]">Seuils d’alerte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-[#9ca3af] text-sm">Offline (s)
            <input type="number" value={config.offlineAfterSeconds} onChange={(e) => setConfig({ ...config, offlineAfterSeconds: Math.max(30, Number(e.target.value) || 30) })} className="mt-1 w-full bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]" />
          </label>
          <label className="text-[#9ca3af] text-sm">Stale (s)
            <input type="number" value={config.staleAfterSeconds} onChange={(e) => setConfig({ ...config, staleAfterSeconds: Math.max(15, Number(e.target.value) || 15) })} className="mt-1 w-full bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]" />
          </label>
          <label className="text-[#9ca3af] text-sm">Température max (°C)
            <input type="number" value={config.maxTemperatureC} onChange={(e) => setConfig({ ...config, maxTemperatureC: Math.max(35, Number(e.target.value) || 35) })} className="mt-1 w-full bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]" />
          </label>
          <label className="text-[#9ca3af] text-sm">Stockage max (%)
            <input type="number" value={config.maxStorageUsagePercent} onChange={(e) => setConfig({ ...config, maxStorageUsagePercent: Math.min(99, Math.max(50, Number(e.target.value) || 50)) })} className="mt-1 w-full bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]" />
          </label>
        </div>
        <GlassButton onClick={saveConfig} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</GlassButton>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">Alertes actives ({alerts.length})</h2>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-[#9ca3af]">Aucune alerte active.</p>
          ) : alerts.map((item) => (
            <div key={item.id} className={`p-3 rounded-[12px] border ${item.severity === 'critical' ? 'border-[#ef4444]/60 bg-[#ef4444]/10' : 'border-[#f59e0b]/60 bg-[#f59e0b]/10'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[#e5e7eb] font-medium">{item.message}</div>
                  <div className="text-xs text-[#9ca3af] mt-1">{item.type} • {item.at}</div>
                  <div className="text-xs text-[#9ca3af] mt-1">statut: {item.status || 'new'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ackAlert(item.id)}
                    disabled={actionBusyId === item.id || item.status === 'ack'}
                    className="px-2 py-1 text-xs rounded-[8px] border border-[rgba(255,255,255,0.18)] text-[#e5e7eb] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                  >
                    ACK
                  </button>
                  <button
                    type="button"
                    onClick={() => silenceAlert(item.id)}
                    disabled={actionBusyId === item.id}
                    className="px-2 py-1 text-xs rounded-[8px] border border-[rgba(255,255,255,0.18)] text-[#e5e7eb] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                  >
                    Silence 30m
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
