import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface LogOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  logs: Array<{ time: string; type: 'info' | 'error' | 'warning' | 'success'; message: string }>;
  language: 'fr' | 'en';
}

export function LogOverlay({ isOpen, onClose, logs, language }: LogOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const translations = {
    fr: {
      title: 'Journaux Complets',
      close: 'Fermer'
    },
    en: {
      title: 'Full Logs',
      close: 'Close'
    }
  };

  const t = translations[language];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      default:
        return 'text-cyan-400';
    }
  };

  const getLogPrefix = (type: string) => {
    switch (type) {
      case 'error':
        return '[ERROR]';
      case 'warning':
        return '[WARN] ';
      case 'success':
        return '[OK]   ';
      default:
        return '[INFO] ';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Overlay Content */}
      <div className="relative w-full max-w-6xl h-[85vh] backdrop-blur-xl bg-slate-950/98 rounded-2xl border border-emerald-500/30 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-emerald-500/20 flex-shrink-0 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-red-500" />
              <div className="size-3 rounded-full bg-yellow-500" />
              <div className="size-3 rounded-full bg-green-500" />
            </div>
            <h2 className="text-lg font-mono text-emerald-400">{t.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-lg bg-red-500/20 border border-red-400/30 hover:bg-red-500/30 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center group"
          >
            <X className="size-4 text-red-400 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Terminal Stats */}
        <div className="px-6 py-2 border-b border-emerald-500/20 flex items-center gap-6 bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-mono">
              {language === 'fr' ? 'Connecté' : 'Connected'}
            </span>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {language === 'fr' ? 'Entrées' : 'Entries'}: <span className="text-emerald-400">{logs.length}</span>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {language === 'fr' ? 'Dernière mise à jour' : 'Last update'}: <span className="text-emerald-400">{logs[logs.length - 1]?.time || '--:--:--'}</span>
          </div>
        </div>

        {/* Terminal Logs */}
        <div
          ref={scrollRef}
          className="flex-1 p-6 min-h-0 overflow-y-auto bg-black/60 font-mono text-sm scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-transparent"
        >
          {logs.map((log, index) => (
            <div key={index} className="mb-1 leading-relaxed hover:bg-emerald-500/5 px-2 py-0.5">
              <span className="text-gray-500">[{log.time}]</span>
              {' '}
              <span className={getLogColor(log.type)}>{getLogPrefix(log.type)}</span>
              {' '}
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          {/* Blinking cursor */}
          <div className="mt-2 flex items-center">
            <span className="text-emerald-400">$</span>
            <span className="ml-2 inline-block w-2 h-4 bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-emerald-500/20 bg-black/40 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500 font-mono">
           digital kiosk manager v1.2.0
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {language === 'fr' ? 'Appuyez sur ESC pour fermer' : 'Press ESC to close'}
          </div>
        </div>
      </div>
    </div>
  );
}
