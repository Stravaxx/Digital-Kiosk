import { Play, Square, RotateCw, Settings, Download, Power } from 'lucide-react';

interface ControlPanelProps {
  serverStatus: 'running' | 'stopped' | 'crashed' | 'starting';
  isUpdating: boolean;
  compact?: boolean;
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onRestart: () => void | Promise<void>;
  onOpenAdmin: () => void | Promise<void>;
  onUpdate: () => void | Promise<void>;
  onShutdown: () => void | Promise<void>;
  language: 'fr' | 'en';
}

export function ControlPanel({
  serverStatus,
  isUpdating,
  compact = false,
  onStart,
  onStop,
  onRestart,
  onOpenAdmin,
  onUpdate,
  onShutdown,
  language
}: ControlPanelProps) {

  const translations = {
    fr: {
      start: 'Démarrer',
      stop: 'Arrêter',
      restart: 'Redémarrer',
      admin: 'Administration',
      update: 'Mettre à jour',
      shutdown: 'Éteindre',
      updating: 'Mise à jour...',
    },
    en: {
      start: 'Start',
      stop: 'Stop',
      restart: 'Restart',
      admin: 'Administration',
      update: 'Update',
      shutdown: 'Shutdown',
      updating: 'Updating...'
    }
  };

  const t = translations[language];

  return (
    <div className="space-y-2 md:space-y-3">
      {/* Main Controls */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <button
          onClick={() => void onStart()}
          disabled={serverStatus === 'running' || serverStatus === 'starting'}
          className="rounded-xl border border-green-400/30 bg-green-500/20 p-2.5 md:p-4 transition-all duration-300 hover:scale-105 hover:bg-green-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 group"
        >
          <div className="flex flex-col items-center gap-2">
            <Play className="size-5 text-green-400 transition-transform group-hover:scale-110 md:size-6" />
            {!compact && <span className="text-xs font-semibold text-green-400 md:text-sm">{t.start}</span>}
          </div>
        </button>

        <button
          onClick={() => void onStop()}
          disabled={serverStatus === 'stopped'}
          className="rounded-xl border border-red-400/30 bg-red-500/20 p-2.5 md:p-4 transition-all duration-300 hover:scale-105 hover:bg-red-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 group"
        >
          <div className="flex flex-col items-center gap-2">
            <Square className="size-5 text-red-400 transition-transform group-hover:scale-110 md:size-6" />
            {!compact && <span className="text-xs font-semibold text-red-400 md:text-sm">{t.stop}</span>}
          </div>
        </button>

        <button
          onClick={() => void onRestart()}
          disabled={serverStatus === 'stopped' || serverStatus === 'starting'}
          className="rounded-xl border border-yellow-400/30 bg-yellow-500/20 p-2.5 md:p-4 transition-all duration-300 hover:scale-105 hover:bg-yellow-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 group"
        >
          <div className="flex flex-col items-center gap-2">
            <RotateCw className="size-5 text-yellow-400 transition-transform duration-500 group-hover:rotate-180 md:size-6" />
            {!compact && <span className="text-xs font-semibold text-yellow-400 md:text-sm">{t.restart}</span>}
          </div>
        </button>

        <button
          onClick={() => void onOpenAdmin()}
          className="rounded-xl border border-blue-400/30 bg-blue-500/20 p-2.5 md:p-4 transition-all duration-300 hover:scale-105 hover:bg-blue-500/30 active:scale-95 group"
        >
          <div className="flex flex-col items-center gap-2">
            <Settings className="size-5 text-blue-400 transition-transform duration-300 group-hover:rotate-90 md:size-6" />
            {!compact && <span className="text-xs font-semibold text-blue-400 md:text-sm">{t.admin}</span>}
          </div>
        </button>
      </div>

      {/* Secondary Controls */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <button
          onClick={() => void onUpdate()}
          disabled={isUpdating}
          className="rounded-xl border border-purple-400/30 bg-purple-500/20 p-2.5 md:p-3 transition-all duration-300 hover:scale-105 hover:bg-purple-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 group"
        >
          <div className="flex items-center justify-center gap-2">
            <Download className={`size-5 text-purple-400 ${isUpdating ? 'animate-bounce' : 'group-hover:-translate-y-1'} transition-transform`} />
            {!compact && <span className="text-xs font-semibold text-purple-400 md:text-sm">
              {isUpdating ? t.updating : t.update}
            </span>}
          </div>
        </button>

        <button
          onClick={() => void onShutdown()}
          className="rounded-xl border border-orange-400/30 bg-orange-500/20 p-2.5 md:p-3 transition-all duration-300 hover:scale-105 hover:bg-orange-500/30 active:scale-95 group"
        >
          <div className="flex items-center justify-center gap-2">
            <Power className="size-5 text-orange-400 group-hover:scale-110 transition-transform" />
            {!compact && <span className="text-xs font-semibold text-orange-400 md:text-sm">{t.shutdown}</span>}
          </div>
        </button>
      </div>

      {/* Crash Recovery */}
      {serverStatus === 'crashed' && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/30 animate-pulse">
          <p className="text-sm text-red-400 mb-3 font-semibold">
            {language === 'fr' ? '⚠️ Crash détecté! Redémarrage disponible.' : '⚠️ Crash detected! Restart available.'}
          </p>
          <button
            onClick={() => void onRestart()}
            className="w-full p-3 rounded-lg bg-red-500/30 border border-red-400/50 hover:bg-red-500/40 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="flex items-center justify-center gap-2">
              <RotateCw className="size-5 text-red-300" />
              <span className="text-sm font-semibold text-red-300">
                {language === 'fr' ? 'Récupérer le serveur' : 'Recover Server'}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
