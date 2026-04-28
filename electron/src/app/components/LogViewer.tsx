import { useEffect, useRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface Log {
  time: string;
  type: 'info' | 'error' | 'warning' | 'success';
  message: string;
}

interface LogViewerProps {
  logs: Log[];
  compact?: boolean;
}

export function LogViewer({ logs, compact = false }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const logConfig = {
    info: {
      icon: Info,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-400/20'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-400/20'
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-400/20'
    },
    success: {
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-400/20'
    }
  };

  return (
    <div
      ref={scrollRef}
      className={`${compact ? 'h-full' : 'h-96'} overflow-y-auto space-y-2 p-4 rounded-xl bg-black/20 border border-white/5 scrollbar-thin scrollbar-thumb-blue-500/50 scrollbar-track-transparent`}
    >
      {logs.map((log, index) => {
        const config = logConfig[log.type];
        const Icon = config.icon;

        return (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-all duration-300 hover:scale-[1.01]`}
          >
            <Icon className={`size-4 ${config.color} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400 font-mono">{log.time}</span>
                <span className={`text-xs font-semibold uppercase ${config.color}`}>
                  {log.type}
                </span>
              </div>
              <p className="text-sm text-gray-200 break-words">{log.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
