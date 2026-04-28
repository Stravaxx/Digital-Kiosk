import { useState, useEffect } from 'react';
import { ServerStatus } from './components/ServerStatus';
import { LogViewer } from './components/LogViewer';
import { ConnectedClients, type ConnectedClientItem } from './components/ConnectedClients';
import { ControlPanel } from './components/ControlPanel';
import { LanguageSelector } from './components/LanguageSelector';
import { LogOverlay } from './components/LogOverlay';
import { Maximize2, Minimize2, Square, Terminal, X } from 'lucide-react';

type UiLogType = 'info' | 'error' | 'warning' | 'success';

type MonitorStatus = 'running' | 'stopped' | 'crashed' | 'starting';

interface MonitorLogRecord {
  timestamp?: string;
  level?: string;
  message?: string;
}

interface DesktopMonitorState {
  status?: string;
  startedAt?: string | null;
  platform?: string;
  config?: {
    adminUrl?: string;
    titleBarMode?: 'custom' | 'system';
  };
}

interface FleetTelemetry {
  cpuPercent?: number;
  memoryPercent?: number;
  version?: string;
  os?: string;
  browser?: string;
}

interface FleetItem {
  id: string;
  name?: string;
  deviceId?: string;
  status?: string;
  heartbeatAgeMs?: number | null;
  connectedAt?: string;
  lastSeenAt?: string;
  ip?: string;
  telemetry?: FleetTelemetry;
}

interface FleetResponse {
  summary?: {
    online?: number;
  };
  items?: FleetItem[];
}

interface SystemUsageResponse {
  ok?: boolean;
  usage?: {
    cpuPercent?: number;
    memoryPercent?: number;
    networkMbps?: number;
  };
}

interface ConnectedClientRecord {
  id?: string;
  username?: string;
  role?: string;
  ip?: string;
  os?: string;
  browser?: string;
  ua?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

interface ConnectedClientsResponse {
  clients?: ConnectedClientRecord[];
}

interface DesktopApi {
  getState: () => Promise<DesktopMonitorState>;
  getLogs: () => Promise<{ lines?: MonitorLogRecord[] }>;
  startServer: () => Promise<unknown>;
  stopServer: () => Promise<unknown>;
  restartServer: () => Promise<unknown>;
  openAdmin: () => Promise<unknown>;
  minimizeWindow: () => Promise<boolean>;
  toggleMaximizeWindow: () => Promise<{ ok: boolean; isMaximized: boolean }>;
  closeWindow: () => Promise<boolean>;
  quitApp: () => Promise<boolean>;
  onStateChanged: (callback: (payload: DesktopMonitorState) => void) => () => void;
}

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

function toUiLogType(level: string | undefined): UiLogType {
  if (level === 'error') return 'error';
  if (level === 'warning' || level === 'warn') return 'warning';
  if (level === 'success') return 'success';
  return 'info';
}

function normalizeStatus(value: string | undefined): MonitorStatus {
  if (value === 'running' || value === 'stopped' || value === 'crashed' || value === 'starting') {
    return value;
  }
  return 'stopped';
}

function formatUptime(startedAt: string | null | undefined): string {
  if (!startedAt) return '—';
  const startMs = Date.parse(startedAt);
  if (Number.isNaN(startMs)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function inferDeviceKind(item: FleetItem): 'desktop' | 'mobile' | 'tablet' {
  const source = `${item.deviceId || ''} ${item.name || ''}`.toLowerCase();
  if (source.includes('ipad') || source.includes('tablet')) return 'tablet';
  if (source.includes('android') || source.includes('ios') || source.includes('mobile') || source.includes('phone')) {
    return 'mobile';
  }
  return 'desktop';
}

function formatConnectedTime(item: FleetItem): string {
  if (item.connectedAt) {
    const ms = Date.parse(item.connectedAt);
    if (!Number.isNaN(ms)) {
      return new Date(ms).toLocaleTimeString();
    }
  }
  if (typeof item.heartbeatAgeMs === 'number') {
    return `-${Math.round(item.heartbeatAgeMs / 1000)}s`;
  }
  return '—';
}

function mapFleetToClients(items: FleetItem[]): ConnectedClientItem[] {
  return items.map((item) => ({
    id: item.id,
    ip: item.ip || item.deviceId || '—',
    os: item.telemetry?.os || item.name || '—',
    browser: item.telemetry?.browser || item.telemetry?.version || '—',
    device: inferDeviceKind(item),
    account: item.name || null,
    accountType: 'player',
    connectedAt: formatConnectedTime(item)
  }));
}

function inferConnectedClientDevice(item: ConnectedClientRecord): 'desktop' | 'mobile' | 'tablet' {
  const source = `${item.os || ''} ${item.ua || ''}`.toLowerCase();
  if (source.includes('ipad') || source.includes('tablet')) return 'tablet';
  if (source.includes('android') || source.includes('ios') || source.includes('iphone') || source.includes('mobile') || source.includes('phone')) {
    return 'mobile';
  }
  return 'desktop';
}

function mapConnectedEndpointClients(items: ConnectedClientRecord[]): ConnectedClientItem[] {
  return items.map((item, index) => ({
    id: String(item.id || `client-${index}`),
    ip: String(item.ip || '—'),
    os: String(item.os || 'unknown'),
    browser: String(item.browser || 'unknown'),
    device: inferConnectedClientDevice(item),
    account: item.username ? String(item.username) : null,
    accountType: item.role === 'admin' ? 'admin' : 'user',
    connectedAt: item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleTimeString() : '—'
  }));
}

export default function App() {
  const buildBrandIconCandidates = () => {
    if (window.location.protocol === 'file:') {
      return [
        new URL('../../public/branding/kiosk-icon.svg', window.location.href).toString(),
        new URL('../../public/branding/kiosk-icon.ico', window.location.href).toString(),
        new URL('../../public/brandiing/kiosk-icon.svg', window.location.href).toString(),
        new URL('../../public/brandiing/kiosk-icon.ico', window.location.href).toString()
      ];
    }

    return [
      '/branding/kiosk-icon.svg',
      '/branding/kiosk-icon.ico',
      '/brandiing/kiosk-icon.svg',
      '/brandiing/kiosk-icon.ico'
    ];
  };

  const brandIconCandidates = buildBrandIconCandidates();
  const [brandIconIndex, setBrandIconIndex] = useState(0);
  const brandIconSrc = brandIconCandidates[Math.min(brandIconIndex, brandIconCandidates.length - 1)];
  const handleBrandIconError = () => {
    setBrandIconIndex((previous) => Math.min(previous + 1, brandIconCandidates.length - 1));
  };
  const [serverStatus, setServerStatus] = useState<MonitorStatus>('starting');
  const [monitorState, setMonitorState] = useState<DesktopMonitorState | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; type: UiLogType; message: string }>>([]);
  const [fleetItems, setFleetItems] = useState<FleetItem[]>([]);
  const [fleetOnlineCount, setFleetOnlineCount] = useState(0);
  const [connectedClients, setConnectedClients] = useState<ConnectedClientItem[]>([]);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [isLogOverlayOpen, setIsLogOverlayOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [monitoringAuthError, setMonitoringAuthError] = useState(false);
  const [hasSystemUsage, setHasSystemUsage] = useState(false);
  const [systemUsage, setSystemUsage] = useState<{ cpuPercent: number; memoryPercent: number; networkMbps: number }>({
    cpuPercent: 0,
    memoryPercent: 0,
    networkMbps: 0
  });
  const [isCompactControls, setIsCompactControls] = useState(false);

  const translations = {
    fr: {
      title: 'Gestionnaire du serveur Digital Kiosk',
      serverStatus: 'Statut du Serveur',
      logs: 'Journaux',
      clients: 'Clients Connectés',
      controls: 'Contrôles',
      terminal: 'Ouvrir le Terminal',
      desktopWindow: 'Fenêtre',
      updateStarted: 'Mise à jour système démarrée',
      updateFailed: 'Échec du lancement de la mise à jour'
    },
    en: {
      title: 'Digital Kiosk Manager',
      serverStatus: 'Server Status',
      logs: 'Logs',
      clients: 'Connected Clients',
      controls: 'Controls',
      terminal: 'Open Terminal',
      desktopWindow: 'Window',
      updateStarted: 'System update started',
      updateFailed: 'Failed to start update'
    }
  };

  const t = translations[language];
  const titleBarMode = monitorState?.config?.titleBarMode === 'system' ? 'system' : 'custom';
  const showCustomTitleBar = titleBarMode === 'custom';

  useEffect(() => {
    const desktopApi = window.desktopApi;
    if (!desktopApi) {
      setServerStatus('stopped');
      setLogs([{ time: new Date().toLocaleTimeString(), type: 'error', message: 'Desktop API unavailable in renderer context.' }]);
      return;
    }

    let active = true;

    const refreshLogs = async () => {
      try {
        const payload = await desktopApi.getLogs();
        if (!active) return;
        const normalized = Array.isArray(payload?.lines)
          ? payload.lines.slice(-250).map((entry) => ({
              time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
              type: toUiLogType(entry.level),
              message: entry.message || ''
            }))
          : [];
        setLogs(normalized);
      } catch {
        if (!active) return;
        setLogs((prev) => prev.length > 0 ? prev : [{ time: new Date().toLocaleTimeString(), type: 'warning', message: 'Unable to read monitor logs.' }]);
      }
    };

    const refreshState = async () => {
      try {
        const snapshot = await desktopApi.getState();
        if (!active) return;
        setMonitorState(snapshot);
        setServerStatus(normalizeStatus(snapshot?.status));
      } catch {
        if (!active) return;
        setServerStatus('crashed');
      }
    };

    void refreshState();
    void refreshLogs();

    const dispose = desktopApi.onStateChanged((payload) => {
      if (!active) return;
      setMonitorState(payload);
      setServerStatus(normalizeStatus(payload?.status));
      void refreshLogs();
    });

    return () => {
      active = false;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    const baseUrl = monitorState?.config?.adminUrl;
    if (!baseUrl || monitoringAuthError) return;

    let active = true;

    const refreshFleet = async () => {
      try {
        const [fleetResponse, clientsResponse] = await Promise.all([
          fetch(`${baseUrl}/api/monitoring/fleet`, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
          }),
          fetch(`${baseUrl}/api/monitoring/connected-clients`, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include'
          })
        ]);

        if (fleetResponse.ok) {
          const payload = (await fleetResponse.json()) as FleetResponse;
          if (!active) return;
          const items = Array.isArray(payload?.items) ? payload.items : [];
          setFleetItems(items);
          setFleetOnlineCount(Number(payload?.summary?.online || 0));
          setConnectedClients((previous) => previous.length > 0 ? previous : mapFleetToClients(items));
        }

        if (fleetResponse.status === 401 || clientsResponse.status === 401) {
          if (!active) return;
          setMonitoringAuthError(true);
          setLogs((previous) => [
            ...previous.slice(-249),
            {
              time: new Date().toLocaleTimeString(),
              type: 'warning',
              message:
                language === 'fr'
                  ? 'Monitoring non autorisé (401). Vérifiez la session admin côté serveur.'
                  : 'Monitoring unauthorized (401). Verify admin session on server side.'
            }
          ]);
          return;
        }

        if (clientsResponse.ok) {
          const payload = (await clientsResponse.json()) as ConnectedClientsResponse;
          if (!active) return;
          const rows = Array.isArray(payload?.clients) ? payload.clients : [];
          setConnectedClients(mapConnectedEndpointClients(rows));
        }

        if (!fleetResponse.ok && !clientsResponse.ok) {
          if (!active) return;
          setConnectedClients([]);
        }
      } catch {
        // keep last state
      }
    };

    void refreshFleet();
    const timer = window.setInterval(() => {
      void refreshFleet();
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [monitorState?.config?.adminUrl, monitoringAuthError, language]);

  useEffect(() => {
    const updateCompactMode = () => {
      setIsCompactControls(window.innerWidth <= 560);
    };
    updateCompactMode();
    window.addEventListener('resize', updateCompactMode);
    return () => window.removeEventListener('resize', updateCompactMode);
  }, []);

  useEffect(() => {
    const baseUrl = monitorState?.config?.adminUrl;
    if (!baseUrl || monitoringAuthError) return;
    let active = true;

    const refreshSystemUsage = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/monitoring/system-usage`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include'
        });
        if (!response.ok) return;
        const payload = (await response.json()) as SystemUsageResponse;
        if (!active) return;

        const cpu = Number(payload?.usage?.cpuPercent);
        const memory = Number(payload?.usage?.memoryPercent);
        const network = Number(payload?.usage?.networkMbps);

        if (!Number.isFinite(cpu) || !Number.isFinite(memory) || !Number.isFinite(network)) {
          return;
        }

        setSystemUsage({
          cpuPercent: cpu,
          memoryPercent: memory,
          networkMbps: network
        });
        setHasSystemUsage(true);
      } catch {
        // keep last state
      }
    };

    void refreshSystemUsage();
    const timer = window.setInterval(() => {
      void refreshSystemUsage();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [monitorState?.config?.adminUrl, monitoringAuthError]);

  const averageCpu = fleetItems.length
    ? fleetItems.reduce((acc, item) => acc + Number(item.telemetry?.cpuPercent || 0), 0) / fleetItems.length
    : 0;
  const averageMemory = fleetItems.length
    ? fleetItems.reduce((acc, item) => acc + Number(item.telemetry?.memoryPercent || 0), 0) / fleetItems.length
    : 0;
  const cpuPercent = hasSystemUsage ? systemUsage.cpuPercent : averageCpu;
  const memoryPercent = hasSystemUsage ? systemUsage.memoryPercent : averageMemory;

  const handleStart = async () => {
    await window.desktopApi?.startServer();
  };

  const handleStop = async () => {
    await window.desktopApi?.stopServer();
  };

  const handleRestart = async () => {
    await window.desktopApi?.restartServer();
  };

  const handleOpenAdmin = async () => {
    await window.desktopApi?.openAdmin();
  };

  const handleUpdate = async () => {
    if (isUpdating) return;
    const baseUrl = monitorState?.config?.adminUrl;
    if (!baseUrl) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`${baseUrl}/api/system/update/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setLogs((prev) => [
        ...prev.slice(-249),
        { time: new Date().toLocaleTimeString(), type: 'info', message: t.updateStarted }
      ]);
    } catch {
      setLogs((prev) => [
        ...prev.slice(-249),
        { time: new Date().toLocaleTimeString(), type: 'error', message: t.updateFailed }
      ]);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShutdown = async () => {
    await window.desktopApi?.quitApp();
  };

  const handleMinimizeWindow = async () => {
    await window.desktopApi?.minimizeWindow();
  };

  const handleToggleMaximizeWindow = async () => {
    const result = await window.desktopApi?.toggleMaximizeWindow();
    if (result) {
      setIsWindowMaximized(Boolean(result.isMaximized));
    }
  };

  const handleCloseWindow = async () => {
    await window.desktopApi?.closeWindow();
  };

  return (
    <div className="size-full h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 overflow-hidden flex flex-col">
      {/* Background blur effect */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDU5LCAxMzAsIDI0NiwgMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

      <div className="relative flex-1 flex flex-col min-h-0">
        {showCustomTitleBar && (
          <div className="window-titlebar m-0 flex h-12 w-full items-center justify-between bg-slate-950 px-0 shadow-lg shadow-black/30">
            <div className="flex min-w-0 items-center gap-2 pl-3 text-sm font-medium tracking-wide text-slate-200">
              <img
                src={brandIconSrc}
                alt="Digital Kiosk"
                className="size-5 rounded-sm object-contain"
                draggable={false}
                onError={handleBrandIconError}
              />
              <span className="truncate">Digital Kiosk Desktop</span>
            </div>
            <div className="window-no-drag flex h-full items-center gap-0 bg-slate-950 p-0">
              <button
                type="button"
                title={`${t.desktopWindow}: Minimize`}
                onClick={handleMinimizeWindow}
                className="h-full px-4 text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:outline-none"
              >
                <Minimize2 className="size-4" />
              </button>
              <button
                type="button"
                title={`${t.desktopWindow}: Maximize`}
                onClick={handleToggleMaximizeWindow}
                className="h-full px-4 text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:outline-none"
              >
                {isWindowMaximized ? <Square className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button
                type="button"
                title={`${t.desktopWindow}: Close`}
                onClick={handleCloseWindow}
                className="h-full px-4 text-red-300 transition hover:bg-red-500/20 focus:outline-none focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden p-2 pt-2 md:p-4 md:pt-3 xl:p-6 xl:pt-4">

        {/* Header */}
        <div className="mb-3 flex flex-shrink-0 flex-col gap-2 md:mb-4 md:gap-3 xl:mb-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="window-no-drag flex flex-wrap items-center gap-2 md:gap-3">
            <button
              onClick={() => setIsLogOverlayOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 transition-all duration-300 hover:scale-105 hover:bg-emerald-500/30 active:scale-95 md:px-3 md:py-2 xl:px-4"
            >
              <Terminal className="size-4 text-emerald-400 md:size-5" />
              <span className="text-xs font-medium text-emerald-400 md:text-sm">{t.terminal}</span>
            </button>
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid min-h-0 grid-cols-1 gap-2 md:gap-3 xl:grid-cols-3 xl:gap-4 2xl:gap-6">
          {/* Left Column - Server Status + Logs */}
          <div className="col-span-1 flex min-h-0 flex-col gap-2 md:gap-3 xl:col-span-2 xl:gap-4 2xl:gap-6">
            {/* Server Status */}
            <div className="flex-shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl md:p-4 2xl:p-6">
              <h2 className="text-xl font-semibold text-white mb-4">{t.serverStatus}</h2>
              <ServerStatus
                status={serverStatus}
                language={language}
                uptimeLabel={formatUptime(monitorState?.startedAt)}
                memoryPercent={memoryPercent}
                cpuPercent={cpuPercent}
                networkMbps={systemUsage.networkMbps}
                activeConnections={fleetOnlineCount}
              />
            </div>

            {/* Logs - compact version */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl md:p-4 2xl:p-6">
              <h2 className="mb-3 flex-shrink-0 text-lg font-semibold text-white md:text-xl">{t.logs}</h2>
              <LogViewer logs={logs.slice(-5)} compact />
            </div>
          </div>

          {/* Right Column */}
          <div className="flex min-h-0 flex-col gap-2 md:gap-3 xl:gap-4 2xl:gap-6">
            {/* Control Panel */}
            <div className="flex-shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl md:p-4 2xl:p-6">
              <h2 className="text-xl font-semibold text-white mb-4">{t.controls}</h2>
              <ControlPanel
                serverStatus={serverStatus}
                isUpdating={isUpdating}
                compact={isCompactControls}
                onStart={handleStart}
                onStop={handleStop}
                onRestart={handleRestart}
                onOpenAdmin={handleOpenAdmin}
                onUpdate={handleUpdate}
                onShutdown={handleShutdown}
                language={language}
              />
            </div>

            {/* Connected Clients */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl md:p-4 2xl:p-6">
              <h2 className="mb-3 flex-shrink-0 text-lg font-semibold text-white md:text-xl">{t.clients}</h2>
              <ConnectedClients language={language} clients={connectedClients} />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Log Overlay */}
      <LogOverlay
        isOpen={isLogOverlayOpen}
        onClose={() => setIsLogOverlayOpen(false)}
        logs={logs}
        language={language}
      />
    </div>
  );
}
