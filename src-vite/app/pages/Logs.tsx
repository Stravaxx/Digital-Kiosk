import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Filter, Download, Trash2, RefreshCw, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import {
  buildLogsExportContent,
  clearSystemLogs,
  listSystemLogs,
  type SystemLogLevel,
  type SystemLogRecord,
  type SystemLogType
} from '../../services/logService';
import { useTranslation } from '../i18n';

const TYPE_FILTERS: Array<SystemLogType | 'all'> = ['all', 'screen', 'error', 'upload', 'sync', 'auth', 'player', 'system'];
const LEVEL_FILTERS: Array<SystemLogLevel | 'all'> = ['all', 'info', 'warning', 'error'];

function getLevelStyle(level: SystemLogLevel): string {
  if (level === 'error') return 'bg-[rgba(239,68,68,0.2)] text-[#fca5a5] border-[rgba(239,68,68,0.35)]';
  if (level === 'warning') return 'bg-[rgba(245,158,11,0.2)] text-[#fcd34d] border-[rgba(245,158,11,0.35)]';
  return 'bg-[rgba(34,197,94,0.2)] text-[#86efac] border-[rgba(34,197,94,0.35)]';
}

function getLevelIcon(level: SystemLogLevel) {
  if (level === 'error') return <ShieldAlert size={14} />;
  if (level === 'warning') return <AlertTriangle size={14} />;
  return <Info size={14} />;
}

export function Logs() {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<SystemLogType | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<SystemLogLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SystemLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshMs, setRefreshMs] = useState<number>(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const records = await listSystemLogs({
        type: filterType,
        level: filterLevel,
        search,
        limit: 500
      });
      setRows(records);
    } catch {
      setError('Impossible de charger les logs.');
    } finally {
      setLoading(false);
    }
  }, [filterLevel, filterType, search]);

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLogs]);

  useEffect(() => {
    if (refreshMs <= 0) return undefined;
    const timer = window.setInterval(() => {
      void loadLogs();
    }, refreshMs);
    return () => window.clearInterval(timer);
  }, [loadLogs, refreshMs]);

  const counts = useMemo(() => {
    const info = rows.filter((row) => row.level === 'info').length;
    const warning = rows.filter((row) => row.level === 'warning').length;
    const fatal = rows.filter((row) => row.level === 'error').length;
    return { info, warning, error: fatal };
  }, [rows]);

  const onExport = () => {
    const content = buildLogsExportContent(rows);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `logs-${stamp}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const onClear = async () => {
    const confirmed = window.confirm(t('logs.confirmClear'));
    if (!confirmed) return;
    setLoading(true);
    try {
      await clearSystemLogs(filterType);
      await loadLogs();
    } catch {
      setError('Suppression des logs impossible.');
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('logs.title')}</h1>
          <p className="text-[#9ca3af]">{t('logs.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <GlassButton variant="ghost" onClick={loadLogs}>
            <RefreshCw size={20} className="inline mr-2" />
            {t('common.refresh')}
          </GlassButton>
          <GlassButton variant="ghost" onClick={onExport} disabled={rows.length === 0}>
            <Download size={20} className="inline mr-2" />
            {t('logs.export')}
          </GlassButton>
          <GlassButton variant="danger" onClick={onClear} disabled={rows.length === 0 || loading}>
            <Trash2 size={20} className="inline mr-2" />
            {t('logs.clear')}
          </GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <p className="text-[#9ca3af] text-sm">{t('logs.info')}</p>
          <p className="text-2xl text-[#86efac] mt-1">{counts.info}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[#9ca3af] text-sm">{t('logs.warnings')}</p>
          <p className="text-2xl text-[#fcd34d] mt-1">{counts.warning}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[#9ca3af] text-sm">{t('logs.errors')}</p>
          <p className="text-2xl text-[#fca5a5] mt-1">{counts.error}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Filter size={20} className="text-[#9ca3af]" />
          <div className="flex gap-2">
            {TYPE_FILTERS.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-[16px] transition-all duration-200 capitalize ${
                  filterType === type
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[rgba(255,255,255,0.08)] text-[#9ca3af] hover:bg-[rgba(255,255,255,0.12)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {LEVEL_FILTERS.map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-4 py-2 rounded-[16px] transition-all duration-200 capitalize ${
                  filterLevel === level
                    ? 'bg-[#22c55e] text-white'
                    : 'bg-[rgba(255,255,255,0.08)] text-[#9ca3af] hover:bg-[rgba(255,255,255,0.12)]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void loadLogs();
              }
            }}
            placeholder={t('logs.searchPlaceholder')}
            className="min-w-[260px] flex-1 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
          />
          <GlassButton size="sm" onClick={loadLogs}>{t('common.apply')}</GlassButton>
          <select
            value={String(refreshMs)}
            onChange={(event) => setRefreshMs(Number.parseInt(event.target.value, 10) || 0)}
            className="bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
            aria-label={t('logs.autoRefresh')}
            title={t('logs.autoRefresh')}
          >
            <option value="0">{t('logs.pause')}</option>
            <option value="5000">{t('logs.auto5s')}</option>
            <option value="10000">{t('logs.auto10s')}</option>
            <option value="30000">{t('logs.auto30s')}</option>
          </select>
        </div>

        {error ? <p className="text-[#ef4444] text-sm mb-4">{error}</p> : null}

        {rows.length === 0 && !loading ? (
          <div className="text-center py-20">
            <FileText size={64} className="mx-auto text-[#9ca3af] opacity-50 mb-4" />
            <h3 className="text-lg text-[#e5e7eb] mb-2">{t('logs.empty')}</h3>
            <p className="text-[#9ca3af]">{t('logs.emptyHint')}</p>
          </div>
        ) : null}

        {loading ? <p className="text-[#9ca3af] py-4">{t('logs.loading')}</p> : null}

        {rows.length > 0 ? (
          <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
            {rows.map((row) => (
              <div key={row.id} className="rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${getLevelStyle(row.level)}`}>
                      {getLevelIcon(row.level)}
                      {row.level.toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-[#9ca3af]">{row.type}</span>
                    <span className="text-xs text-[#9ca3af]">{row.source}</span>
                  </div>
                  <span className="text-xs text-[#9ca3af]">{new Date(row.timestamp).toLocaleString('fr-FR')}</span>
                </div>
                <p className="text-[#e5e7eb] mt-2 text-sm break-words">{row.message}</p>
                {row.details && Object.keys(row.details).length > 0 ? (
                  <pre className="mt-2 text-xs text-[#9ca3af] bg-[rgba(15,23,42,0.55)] rounded-[10px] p-2 overflow-x-auto">{JSON.stringify(row.details, null, 2)}</pre>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
