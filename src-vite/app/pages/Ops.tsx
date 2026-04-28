import React from 'react';
import { GlassCard } from '../components/GlassCard';
import { useTranslation } from '../i18n';

export function Ops() {
  const { t } = useTranslation();
  const [sla, setSla] = React.useState({ availabilityPercent: 100, incidentsLast24h: 0, mttrMinutes: 0 });
  const [fleet, setFleet] = React.useState({ total: 0, online: 0, stale: 0, offline: 0, pending: 0 });
  const [audit, setAudit] = React.useState<any[]>([]);

  const load = React.useCallback(async () => {
    try {
      const [slaRes, auditRes] = await Promise.all([
        fetch('/api/ops/sla', { cache: 'no-store' }),
        fetch('/api/audit?limit=80', { cache: 'no-store' })
      ]);

      if (slaRes.ok) {
        const payload = await slaRes.json();
        setSla(payload?.sla || { availabilityPercent: 100, incidentsLast24h: 0, mttrMinutes: 0 });
        setFleet(payload?.fleet || { total: 0, online: 0, stale: 0, offline: 0, pending: 0 });
      }
      if (auditRes.ok) {
        const payload = await auditRes.json();
        setAudit(Array.isArray(payload?.records) ? payload.records : []);
      }
    } catch {
      // keep previous
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 12000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('ops.title')}</h1>
        <p className="text-[#9ca3af]">{t('ops.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('ops.availability')}</div><div className="text-2xl text-[#22c55e] font-bold">{sla.availabilityPercent.toFixed(2)}%</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('ops.incidents')}</div><div className="text-2xl text-[#f59e0b] font-bold">{sla.incidentsLast24h}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">{t('ops.mttr')}</div><div className="text-2xl text-[#3b82f6] font-bold">{sla.mttrMinutes} min</div></GlassCard>
      </div>

      <GlassCard className="p-4">
        <h2 className="text-lg text-[#e5e7eb] mb-2">{t('ops.fleetSummary')}</h2>
        <div className="text-[#cbd5e1] text-sm">{t('fleet.total')} {fleet.total} • {t('fleet.online')} {fleet.online} • {t('fleet.stale')} {fleet.stale} • {t('fleet.offline')} {fleet.offline} • {t('fleet.pending')} {fleet.pending}</div>
      </GlassCard>

      <GlassCard className="p-4 overflow-auto">
        <h2 className="text-lg text-[#e5e7eb] mb-3">{t('ops.auditHistory')}</h2>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[#9ca3af] border-b border-[rgba(255,255,255,0.12)]">
              <th className="py-2">{t('ops.date')}</th>
              <th className="py-2">{t('ops.type')}</th>
              <th className="py-2">{t('ops.level')}</th>
              <th className="py-2">{t('ops.source')}</th>
              <th className="py-2">{t('ops.message')}</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.id} className="border-b border-[rgba(255,255,255,0.06)] text-[#e5e7eb]">
                <td className="py-2">{new Date(row.timestamp || row.at || Date.now()).toLocaleString('fr-FR')}</td>
                <td className="py-2">{row.type}</td>
                <td className="py-2">{row.level}</td>
                <td className="py-2">{row.source}</td>
                <td className="py-2">{row.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
