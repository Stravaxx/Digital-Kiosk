import React, { useEffect, useMemo, useState } from 'react';
import { getBackgroundUpdateState, type BackgroundUpdateState } from '../../services/updateService';
import { useTranslation } from '../i18n';

export function Updater() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<BackgroundUpdateState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await getBackgroundUpdateState();
        if (!mounted) return;
        setState(next);
        setError('');
      } catch (cause) {
        if (!mounted) return;
        setError(String((cause as Error)?.message || t('updater.fetchError')));
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 1500);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const stepLabel = useMemo(() => {
    if (!state?.currentStep || state.currentStep === 'idle') return t('updater.waiting');
    return state.steps?.[state.currentStep]?.label || state.currentStep;
  }, [state, t]);

  const progress = Math.max(0, Math.min(100, Math.round(state?.progress || 0)));
  const progressBucket = Math.max(0, Math.min(20, Math.round(progress / 5)));
  const progressWidthClass = [
    'w-0',
    'w-[5%]',
    'w-[10%]',
    'w-[15%]',
    'w-[20%]',
    'w-[25%]',
    'w-[30%]',
    'w-[35%]',
    'w-[40%]',
    'w-[45%]',
    'w-[50%]',
    'w-[55%]',
    'w-[60%]',
    'w-[65%]',
    'w-[70%]',
    'w-[75%]',
    'w-[80%]',
    'w-[85%]',
    'w-[90%]',
    'w-[95%]',
    'w-full'
  ][progressBucket];
  const isRunning = Boolean(state?.isRunning);
  const isComplete = !isRunning && progress >= 100 && !state?.error;

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e5e7eb] p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(15,23,42,0.92)] p-6 space-y-5">
        <h1 className="text-2xl font-semibold">{t('updater.title')}</h1>
        <p className="text-sm text-[#9ca3af]">{t('updater.subtitle')}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9ca3af]">{t('updater.step')}</span>
            <span>{stepLabel}</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#1f2937] overflow-hidden border border-[rgba(255,255,255,0.12)]">
            <div className={`h-full ${progressWidthClass} bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300`} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9ca3af]">{t('updater.progress')}</span>
            <span>{progress}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-[rgba(255,255,255,0.04)] p-3 border border-[rgba(255,255,255,0.08)]">
            <p className="text-[#9ca3af]">{t('updater.startedAt')}</p>
            <p>{state?.timestamp ? new Date(state.timestamp).toLocaleString(locale) : '—'}</p>
          </div>
          <div className="rounded-xl bg-[rgba(255,255,255,0.04)] p-3 border border-[rgba(255,255,255,0.08)]">
            <p className="text-[#9ca3af]">{t('updater.backup')}</p>
            <p>{state?.backupDateTime ? new Date(state.backupDateTime).toLocaleString(locale) : t('updater.waiting')}</p>
          </div>
        </div>

        {state?.error ? <p className="text-sm text-[#fca5a5]">{t('updater.error')}: {state.error}</p> : null}
        {error ? <p className="text-sm text-[#fca5a5]">{error}</p> : null}

        {isRunning ? (
          <p className="text-sm text-[#fcd34d]">{t('updater.running')}</p>
        ) : isComplete ? (
          <div className="space-y-2">
            <p className="text-sm text-[#34d399]">{t('updater.completed')}</p>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
              onClick={() => window.location.assign('/settings')}
            >
              {t('updater.backToSettings')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[#9ca3af]">{t('updater.noActiveUpdate')}</p>
        )}
      </div>
    </div>
  );
}
