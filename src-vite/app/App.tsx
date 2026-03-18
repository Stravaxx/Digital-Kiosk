import React, { useEffect, useState } from 'react';
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
import { isAdminAuthenticated } from '../services/adminAuthService';
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

function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarSearch, setCalendarSearch] = useState('');
  const location = useLocation();
  const isCalendarRoute = location.pathname.startsWith('/calendar');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCalendarRoute && calendarSearch) {
      setCalendarSearch('');
    }
  }, [isCalendarRoute, calendarSearch]);

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
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
  if (!isAdminAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <AdminShell />;
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
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/screens" element={<Screens />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/layouts" element={<Layouts />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/ops" element={<Ops />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
