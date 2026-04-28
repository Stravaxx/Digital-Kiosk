import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Square, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './pages/Dashboard';
import { Screens } from './pages/Screens';
import { Rooms } from './pages/Rooms';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Assets } from './pages/Assets';
import { Playlists } from './pages/Playlists';
import { Calendar } from './pages/Calendar';
import { Layouts } from './pages/Layouts';
import { Templates } from './pages/Templates';
import { Widgets } from './pages/Widgets';
import { Storage } from './pages/Storage';
import { Logs } from './pages/Logs';
import { Settings } from './pages/Settings';
import { Fleet } from './pages/Fleet';
import { Alerts } from './pages/Alerts';
import { Ops } from './pages/Ops';
import { Player } from './pages/Player';
import { Login } from './pages/Login';
import { About } from './pages/About';
import { Updater } from './pages/Updater';
import { hasAdminPermission, isAdminAuthenticated } from '../services/adminAuthService';
import { hydrateManyKeysFromDb, requestPersistentSystemStorage, syncLocalStorageKeyFromSystem } from '../services/clientDbStorage';
import { LAYOUTS_KEY } from '../shared/layoutRegistry';
import { PLAYLISTS_KEY } from '../shared/playlistRegistry';
import { SCREENS_KEY } from '../shared/screenRegistry';
import { SCREEN_GROUPS_KEY } from '../shared/screenGroupRegistry';
import { EVENTS_KEY, ROOMS_KEY } from '../shared/localCalendar';
import { SYSTEM_SETTINGS_KEY } from '../services/systemSettingsService';
import { PLAYER_CONNECTION_KEY_STORAGE } from '../services/playerSecurityService';
import { LOGS_STORAGE_KEY } from '../services/logService';
import { getSystemWsUrl } from '../services/systemApiBase';
import { useTranslation } from './i18n';

interface DesktopWindowApi {
  minimizeWindow: () => Promise<boolean>;
  toggleMaximizeWindow: () => Promise<{ ok: boolean; isMaximized: boolean }>;
  closeWindow: () => Promise<boolean>;
}

declare global {
  interface Window {
    desktopApi?: DesktopWindowApi;
  }
}

function AdminShell() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const location = useLocation();
  const isCalendarRoute = location.pathname.startsWith('/calendar');
  const showDesktopTitleBar = typeof window !== 'undefined' && Boolean(window.desktopApi);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCalendarRoute && calendarSearch) {
      setCalendarSearch('');
    }
  }, [isCalendarRoute, calendarSearch]);

  const handleMinimizeWindow = async () => {
    await window.desktopApi?.minimizeWindow();
  };

  const handleToggleMaximizeWindow = async () => {
    const result = await window.desktopApi?.toggleMaximizeWindow();
    if (result?.ok) {
      setIsWindowMaximized(Boolean(result.isMaximized));
    }
  };

  const handleCloseWindow = async () => {
    await window.desktopApi?.closeWindow();
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {showDesktopTitleBar ? (
        <div className="window-titlebar flex h-12 w-full items-center justify-between border-b border-white/10 bg-[#020617] shadow-lg shadow-black/20">
          <div className="flex min-w-0 items-center gap-3 pl-4 text-sm font-medium tracking-wide text-slate-100">
            <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white">
              DK
            </div>
            <span className="truncate">Digital Kiosk Admin Panel</span>
          </div>
          <div className="window-no-drag flex h-full items-center">
            <button
              type="button"
              aria-label="Minimize window"
              title="Minimize"
              onClick={handleMinimizeWindow}
              className="flex h-full w-12 items-center justify-center text-slate-200 transition hover:bg-white/10"
            >
              <Minimize2 size={16} />
            </button>
            <button
              type="button"
              aria-label="Toggle maximize window"
              title="Maximize"
              onClick={handleToggleMaximizeWindow}
              className="flex h-full w-12 items-center justify-center text-slate-200 transition hover:bg-white/10"
            >
              {isWindowMaximized ? <Square size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              aria-label="Close window"
              title="Close"
              onClick={handleCloseWindow}
              className="flex h-full w-12 items-center justify-center text-rose-200 transition hover:bg-rose-500/20"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label={t('app.closeMenu')}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-64 min-h-screen flex flex-col overflow-hidden">
        <Topbar
          darkMode={true}
          onOpenMenu={() => setSidebarOpen((value) => !value)}
          searchEnabled={isCalendarRoute}
          searchValue={calendarSearch}
          onSearchValueChange={setCalendarSearch}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ calendarSearch, setCalendarSearch }} />
        </main>
      </div>
    </div>
  );
}

function RequireAuth() {
  const location = useLocation();
  if (!isAdminAuthenticated()) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <AdminShell />;
}

function RequirePermission({ permissionKey, mode = 'read', children }: {
  permissionKey: string;
  mode?: 'read' | 'write';
  children: React.ReactElement;
}) {
  if (!hasAdminPermission(permissionKey, mode)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/player')) {
      return;
    }

    const sharedKeys = [
      SCREENS_KEY,
      SCREEN_GROUPS_KEY,
      LAYOUTS_KEY,
      PLAYLISTS_KEY,
      ROOMS_KEY,
      EVENTS_KEY,
      SYSTEM_SETTINGS_KEY,
      PLAYER_CONNECTION_KEY_STORAGE,
      LOGS_STORAGE_KEY
    ];

    void (async () => {
      await Promise.all(sharedKeys.map((key) => syncLocalStorageKeyFromSystem(key).catch(() => false)));
      await hydrateManyKeysFromDb(sharedKeys);
    })();

    void requestPersistentSystemStorage();

    const wsUrl = getSystemWsUrl('/ws/system-sync');

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let syncInFlight = false;
    let syncQueued = false;

    const applySystemSync = (incomingKeys?: string[]) => {
      if (syncInFlight) {
        syncQueued = true;
        return;
      }

      syncInFlight = true;
      const keys = Array.isArray(incomingKeys) && incomingKeys.length > 0 && !incomingKeys.includes('*')
        ? sharedKeys.filter((key) => incomingKeys.includes(key))
        : sharedKeys;

      void (async () => {
        await Promise.all(keys.map((key) => syncLocalStorageKeyFromSystem(key).catch(() => false)));
      })().finally(() => {
        syncInFlight = false;
        if (syncQueued) {
          syncQueued = false;
          applySystemSync();
        }
      });
    };

    const connectWs = () => {
      if (stopped) return;
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data || '{}')) as { type?: string; keys?: string[]; payload?: { reason?: string } };
          if (payload?.type === 'sync') {
            applySystemSync(Array.isArray(payload.keys) ? payload.keys : undefined);
            return;
          }

          if (payload?.type === 'update-reload') {
            const reason = String(payload?.payload?.reason || 'system-update-complete').trim();
            if (reason === 'system-update-complete') {
              window.setTimeout(() => {
                window.location.reload();
              }, 1200);
            }
          }
        } catch {
          // ignore malformed message
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connectWs, 1200);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connectWs();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/player" element={<Player />} />
        <Route path="/updater" element={<Updater />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/screens" element={<RequirePermission permissionKey="screens"><Screens /></RequirePermission>} />
          <Route path="/rooms" element={<RequirePermission permissionKey="calendar"><Rooms /></RequirePermission>} />
          <Route path="/assets" element={<RequirePermission permissionKey="assets"><Assets /></RequirePermission>} />
          <Route path="/playlists" element={<RequirePermission permissionKey="playlists"><Playlists /></RequirePermission>} />
          <Route path="/calendar" element={<RequirePermission permissionKey="calendar"><Calendar /></RequirePermission>} />
          <Route path="/layouts" element={<RequirePermission permissionKey="layouts"><Layouts /></RequirePermission>} />
          <Route path="/templates" element={<RequirePermission permissionKey="layouts"><Templates /></RequirePermission>} />
          <Route path="/storage" element={<RequirePermission permissionKey="settings"><Storage /></RequirePermission>} />
          <Route path="/logs" element={<RequirePermission permissionKey="logs"><Logs /></RequirePermission>} />
          <Route path="/fleet" element={<RequirePermission permissionKey="monitoring"><Fleet /></RequirePermission>} />
          <Route path="/alerts" element={<RequirePermission permissionKey="alerts"><Alerts /></RequirePermission>} />
          <Route path="/ops" element={<RequirePermission permissionKey="monitoring"><Ops /></RequirePermission>} />
          <Route path="/settings" element={<RequirePermission permissionKey="settings"><Settings /></RequirePermission>} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
