import { Activity, AlertTriangle, CheckCircle, XCircle, Loader } from 'lucide-react';

interface ServerStatusProps {
  status: 'running' | 'stopped' | 'crashed' | 'starting';
  language: 'fr' | 'en';
  uptimeLabel: string;
  memoryPercent: number;
  cpuPercent: number;
  networkMbps: number;
  activeConnections: number;
}

export function ServerStatus({
  status,
  language,
  uptimeLabel,
  memoryPercent,
  cpuPercent,
  networkMbps,
  activeConnections
}: ServerStatusProps) {
  const translations = {
    fr: {
      running: 'En Ligne',
      stopped: 'Arrêté',
      crashed: 'Crash Détecté',
      starting: 'Démarrage...',
      uptime: 'Temps de fonctionnement',
      memory: 'Mémoire',
      cpu: 'CPU',
      network: 'Réseau',
      connections: 'Connexions actives'
    },
    en: {
      running: 'Running',
      stopped: 'Stopped',
      crashed: 'Crashed',
      starting: 'Starting...',
      uptime: 'Uptime',
      memory: 'Memory',
      cpu: 'CPU',
      network: 'Network',
      connections: 'Active connections'
    }
  };

  const t = translations[language];

  const statusConfig = {
    running: {
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-400/30',
      label: t.running
    },
    stopped: {
      icon: XCircle,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-400/30',
      label: t.stopped
    },
    crashed: {
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-400/30',
      label: t.crashed
    },
    starting: {
      icon: Loader,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-400/30',
      label: t.starting
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const usageToWidthClass = (value: number) => {
    const safe = Math.max(0, Math.min(100, value));
    if (safe <= 5) return 'w-[5%]';
    if (safe <= 10) return 'w-[10%]';
    if (safe <= 20) return 'w-[20%]';
    if (safe <= 30) return 'w-[30%]';
    if (safe <= 40) return 'w-[40%]';
    if (safe <= 50) return 'w-[50%]';
    if (safe <= 60) return 'w-[60%]';
    if (safe <= 70) return 'w-[70%]';
    if (safe <= 80) return 'w-[80%]';
    if (safe <= 90) return 'w-[90%]';
    return 'w-full';
  };

  const memoryWidthClass = usageToWidthClass(memoryPercent);
  const cpuWidthClass = usageToWidthClass(cpuPercent);

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className={`flex items-center gap-2 rounded-xl border p-3 md:gap-3 md:p-4 ${config.bgColor} ${config.borderColor}`}>
        <Icon className={`size-5 md:size-6 ${config.color} ${status === 'starting' ? 'animate-spin' : ''}`} />
        <span className={`text-base font-semibold md:text-lg ${config.color}`}>{config.label}</span>
      </div>

      {/* Metrics */}
      {status === 'running' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:gap-4">
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-blue-400" />
              <span className="text-sm text-blue-300">{t.uptime}</span>
            </div>
            <p className="text-lg font-bold text-white md:text-xl">{uptimeLabel}</p>
          </div>

          <div className="rounded-xl border border-purple-400/20 bg-purple-500/10 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-purple-400" />
              <span className="text-sm text-purple-300">{t.connections}</span>
            </div>
            <p className="text-lg font-bold text-white md:text-xl">{activeConnections}</p>
          </div>

          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-cyan-400" />
              <span className="text-sm text-cyan-300">{t.memory}</span>
            </div>
            <p className="text-lg font-bold text-white md:text-xl">{memoryPercent.toFixed(0)}%</p>
            <div className="mt-2 h-1.5 bg-cyan-900/30 rounded-full overflow-hidden">
              <div className={`h-full bg-cyan-400 rounded-full ${memoryWidthClass}`}></div>
            </div>
          </div>

          <div className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-green-400" />
              <span className="text-sm text-green-300">{t.cpu}</span>
            </div>
            <p className="text-lg font-bold text-white md:text-xl">{cpuPercent.toFixed(0)}%</p>
            <div className="mt-2 h-1.5 bg-green-900/30 rounded-full overflow-hidden">
              <div className={`h-full bg-green-400 rounded-full ${cpuWidthClass}`}></div>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3 md:p-4 sm:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="size-4 text-indigo-400" />
              <span className="text-sm text-indigo-300">{t.network}</span>
            </div>
            <p className="text-lg font-bold text-white md:text-xl">{networkMbps.toFixed(3)} Mbps</p>
          </div>
        </div>
      )}
    </div>
  );
}
