import React from 'react';
import { GlassCard } from '../components/GlassCard';

export function Ops() {
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
        <h1 className="text-2xl text-[#e5e7eb] mb-2">Ops</h1>
        <p className="text-[#9ca3af]">SLA, incidents et historique d’audit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Disponibilité</div><div className="text-2xl text-[#22c55e] font-bold">{sla.availabilityPercent.toFixed(2)}%</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">Incidents (24h)</div><div className="text-2xl text-[#f59e0b] font-bold">{sla.incidentsLast24h}</div></GlassCard>
        <GlassCard className="p-4"><div className="text-[#9ca3af] text-sm">MTTR</div><div className="text-2xl text-[#3b82f6] font-bold">{sla.mttrMinutes} min</div></GlassCard>
      </div>

      <GlassCard className="p-4">
        <h2 className="text-lg text-[#e5e7eb] mb-2">Fleet summary</h2>
        <div className="text-[#cbd5e1] text-sm">Total {fleet.total} • Online {fleet.online} • Stale {fleet.stale} • Offline {fleet.offline} • Pending {fleet.pending}</div>
      </GlassCard>

      <GlassCard className="p-4 overflow-auto">
        <h2 className="text-lg text-[#e5e7eb] mb-3">Historique d’audit</h2>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-[#9ca3af] border-b border-[rgba(255,255,255,0.12)]">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Niveau</th>
              <th className="py-2">Source</th>
              <th className="py-2">Message</th>
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
