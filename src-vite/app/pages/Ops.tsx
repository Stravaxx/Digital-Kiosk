import React from 'react';
import { GlassCard } from '../components/GlassCard';
import { useTranslation } from '../i18n';

type FleetSummary = {
  total: number;
  online: number;
  stale: number;
  offline: number;
  pending: number;
};

type FleetItem = {
  id: string;
  name: string;
  deviceId: string;
  status: string;
  heartbeatAgeMs: number | null;
  telemetry?: {
    cpuPercent?: number;
    memoryPercent?: number;
    networkMbps?: number;
    networkInterface?: string;
    temperatureC?: number;
    diskUsedPercent?: number;
    version?: string;
  };
};

type AuditRow = {
  id?: string;
  timestamp?: string;
  at?: string;
  type?: string;
  level?: string;
  source?: string;
  message?: string;
};

const EMPTY_SLA = { availabilityPercent: 100, incidentsLast24h: 0, mttrMinutes: 0 };
const EMPTY_FLEET: FleetSummary = { total: 0, online: 0, stale: 0, offline: 0, pending: 0 };

function formatNumber(value: number | undefined, digits = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return digits > 0 ? '0.0' : '0';
  }
  return value.toFixed(digits);
}

function formatHeartbeat(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value / 1000)} s`;
}

function formatAuditDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString('fr-FR');
}

function statusTone(status: string) {
  switch (status.toLowerCase()) {
    case 'online':
      return 'bg-[#22c55e]/20 text-[#22c55e]';
    case 'stale':
      return 'bg-[#f59e0b]/20 text-[#f59e0b]';
    case 'pending':
      return 'bg-[#3b82f6]/20 text-[#60a5fa]';
    default:
      return 'bg-[#ef4444]/20 text-[#f87171]';
  }
}

export function Ops() {
  const { t } = useTranslation();
  const [sla, setSla] = React.useState(EMPTY_SLA);
  const [fleet, setFleet] = React.useState<FleetSummary>(EMPTY_FLEET);
  const [items, setItems] = React.useState<FleetItem[]>([]);
  const [audit, setAudit] = React.useState<AuditRow[]>([]);

  const load = React.useCallback(async () => {
    try {
      const [fleetRes, slaRes, auditRes] = await Promise.all([
        fetch('/api/monitoring/fleet', { cache: 'no-store' }),
        fetch('/api/ops/sla', { cache: 'no-store' }),
        fetch('/api/audit?limit=80', { cache: 'no-store' })
      ]);

      if (fleetRes.ok) {
        const payload = await fleetRes.json();
        setFleet(payload?.summary || EMPTY_FLEET);
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      }

      if (slaRes.ok) {
        const payload = await slaRes.json();
        setSla(payload?.sla || EMPTY_SLA);
        if (!fleetRes.ok) {
          setFleet(payload?.fleet || EMPTY_FLEET);
        }
      }

      if (auditRes.ok) {
        const payload = await auditRes.json();
        setAudit(Array.isArray(payload?.records) ? payload.records : []);
      }
    } catch {
      // keep previous data on transient failures
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 12000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="mb-2 text-2xl text-[#e5e7eb] sm:text-3xl">{t('ops.title')}</h1>
        <p className="max-w-3xl text-sm text-[#9ca3af] sm:text-base">{t('ops.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('ops.availability')}</div>
          <div className="mt-3 text-2xl font-bold text-[#22c55e] sm:text-3xl">{sla.availabilityPercent.toFixed(2)}%</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('ops.incidents')}</div>
          <div className="mt-3 text-2xl font-bold text-[#f59e0b] sm:text-3xl">{sla.incidentsLast24h}</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('ops.mttr')}</div>
          <div className="mt-3 text-2xl font-bold text-[#3b82f6] sm:text-3xl">{sla.mttrMinutes} min</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('fleet.total')}</div>
          <div className="mt-3 text-2xl font-bold text-[#e5e7eb] sm:text-3xl">{fleet.total}</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('fleet.online')}</div>
          <div className="mt-3 text-2xl font-bold text-[#22c55e] sm:text-3xl">{fleet.online}</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('fleet.stale')}</div>
          <div className="mt-3 text-2xl font-bold text-[#f59e0b] sm:text-3xl">{fleet.stale}</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('fleet.offline')}</div>
          <div className="mt-3 text-2xl font-bold text-[#ef4444] sm:text-3xl">{fleet.offline}</div>
        </GlassCard>
        <GlassCard className="min-h-[112px] p-4">
          <div className="text-sm text-[#9ca3af]">{t('fleet.pending')}</div>
          <div className="mt-3 text-2xl font-bold text-[#60a5fa] sm:text-3xl">{fleet.pending}</div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg text-[#e5e7eb] sm:text-xl">{t('ops.devices')}</h2>
            <p className="text-sm text-[#94a3b8]">{t('ops.fleetSummary')}</p>
          </div>
          <div className="text-sm text-[#cbd5e1]">
            {t('fleet.total')} {fleet.total} • {t('fleet.online')} {fleet.online} • {t('fleet.stale')} {fleet.stale} • {t('fleet.offline')} {fleet.offline} • {t('fleet.pending')} {fleet.pending}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-[#94a3b8]">
            {t('ops.devicesEmpty')}
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#e5e7eb]">{item.name}</div>
                      <div className="break-all text-xs text-[#94a3b8]">{item.deviceId}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#cbd5e1]">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('fleet.heartbeat')}</div>
                      <div>{formatHeartbeat(item.heartbeatAgeMs)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('ops.network')}</div>
                      <div>{formatNumber(item.telemetry?.networkMbps, 2)} Mbps</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('fleet.cpu')}</div>
                      <div>{formatNumber(item.telemetry?.cpuPercent)}%</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('fleet.ram')}</div>
                      <div>{formatNumber(item.telemetry?.memoryPercent)}%</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('fleet.temperature')}</div>
                      <div>{formatNumber(item.telemetry?.temperatureC, 1)}°C</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[#64748b]">{t('fleet.disk')}</div>
                      <div>{formatNumber(item.telemetry?.diskUsedPercent)}%</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[#94a3b8]">
                    {item.telemetry?.networkInterface || 'auto'} • {item.telemetry?.version || '—'}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.12)] text-left text-[#9ca3af]">
                    <th className="py-2 pr-4">{t('fleet.player')}</th>
                    <th className="py-2 pr-4">{t('fleet.status')}</th>
                    <th className="py-2 pr-4">{t('fleet.heartbeat')}</th>
                    <th className="py-2 pr-4">{t('fleet.cpu')}</th>
                    <th className="py-2 pr-4">{t('fleet.ram')}</th>
                    <th className="py-2 pr-4">{t('ops.network')}</th>
                    <th className="py-2 pr-4">{t('fleet.temperature')}</th>
                    <th className="py-2 pr-4">{t('fleet.disk')}</th>
                    <th className="py-2">{t('fleet.version')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[rgba(255,255,255,0.06)] align-top text-[#e5e7eb]">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{item.name}</div>
                        <div className="break-all text-xs text-[#9ca3af]">{item.deviceId}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{formatHeartbeat(item.heartbeatAgeMs)}</td>
                      <td className="py-3 pr-4">{formatNumber(item.telemetry?.cpuPercent)}%</td>
                      <td className="py-3 pr-4">{formatNumber(item.telemetry?.memoryPercent)}%</td>
                      <td className="py-3 pr-4">
                        <div>{formatNumber(item.telemetry?.networkMbps, 2)} Mbps</div>
                        <div className="text-xs text-[#9ca3af]">{item.telemetry?.networkInterface || 'auto'}</div>
                      </td>
                      <td className="py-3 pr-4">{formatNumber(item.telemetry?.temperatureC, 1)}°C</td>
                      <td className="py-3 pr-4">{formatNumber(item.telemetry?.diskUsedPercent)}%</td>
                      <td className="py-3">{item.telemetry?.version || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </GlassCard>

      <GlassCard className="p-4 sm:p-5">
        <h2 className="mb-4 text-lg text-[#e5e7eb] sm:text-xl">{t('ops.auditHistory')}</h2>
        {audit.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-[#94a3b8]">
            {t('ops.auditEmpty')}
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:hidden">
              {audit.map((row, index) => (
                <div key={row.id || `${row.timestamp || row.at || 'audit'}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-[#64748b]">{formatAuditDate(row.timestamp || row.at)}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[#e2e8f0]">{row.type || '—'}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[#e2e8f0]">{row.level || '—'}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[#e2e8f0]">{row.source || '—'}</span>
                  </div>
                  <div className="mt-3 break-words text-sm text-[#cbd5e1]">{row.message || '—'}</div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.12)] text-left text-[#9ca3af]">
                    <th className="py-2 pr-4">{t('ops.date')}</th>
                    <th className="py-2 pr-4">{t('ops.type')}</th>
                    <th className="py-2 pr-4">{t('ops.level')}</th>
                    <th className="py-2 pr-4">{t('ops.source')}</th>
                    <th className="py-2">{t('ops.message')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row, index) => (
                    <tr key={row.id || `${row.timestamp || row.at || 'audit'}-${index}`} className="border-b border-[rgba(255,255,255,0.06)] align-top text-[#e5e7eb]">
                      <td className="py-3 pr-4 text-[#cbd5e1]">{formatAuditDate(row.timestamp || row.at)}</td>
                      <td className="py-3 pr-4">{row.type || '—'}</td>
                      <td className="py-3 pr-4">{row.level || '—'}</td>
                      <td className="py-3 pr-4">{row.source || '—'}</td>
                      <td className="py-3 break-words text-[#cbd5e1]">{row.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
