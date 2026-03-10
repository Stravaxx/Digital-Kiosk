import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, CheckCircle, Clock, WifiOff, Eye, Trash2, RefreshCw, Power, Folder, FolderOpen } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import {
  loadScreens,
  refreshOnlineOfflineStatus,
  registerPendingScreen,
  saveScreens,
  DEFAULT_GROUP_THEME,
  SCREENS_KEY,
  type GroupThemeSettings,
  type ScreenModel,
  type ScreenThemeSettings
} from '../../shared/screenRegistry';
import { LAYOUTS_KEY, loadLayouts, type LayoutModel } from '../../shared/layoutRegistry';
import { loadRooms, type RoomModel } from '../../shared/localCalendar';
import {
  deleteScreenGroup,
  loadScreenGroups,
  saveScreenGroups,
  upsertScreenGroup,
  type ScreenGroupModel
} from '../../shared/screenGroupRegistry';
import { mirrorLocalStorageKeyToDb, syncLocalStorageKeyFromSystem } from '../../services/clientDbStorage';
import { appendSystemLog } from '../../services/logService';

function sanitizeHexColor(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return DEFAULT_GROUP_THEME.primaryColor;
}

export function Screens() {
  const [screens, setScreens] = useState<ScreenModel[]>([]);
  const [layouts, setLayouts] = useState<LayoutModel[]>([]);
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [groups, setGroups] = useState<ScreenGroupModel[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [nameDraftByScreen, setNameDraftByScreen] = useState<Record<string, string>>({});
  const [launchCountByScreen, setLaunchCountByScreen] = useState<Record<string, number>>({});
  const [selectedScreen, setSelectedScreen] = useState<ScreenModel | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'online' | 'offline'>('all');
  const [pairingPin, setPairingPin] = useState('');
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingMessage, setPairingMessage] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const systemApiBase = useMemo(() => {
    const envBase = (import.meta.env.VITE_ADMIN_API_BASE as string | undefined)?.trim() || '';
    return envBase || window.location.origin;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const devname = params.get('devname');
    const deviceId = params.get('deviceId');
    const os = params.get('os');
    const pin = String(params.get('pin') || '').trim();

    if (/^\d{6}$/.test(pin)) {
      setPairingPin(pin);
      setPairingMessage('PIN détecté depuis QR, validez la liaison.');
    }

    if (token && devname && deviceId) {
      const next = registerPendingScreen({ token, devname, deviceId, os: os ?? undefined });
      setScreens(next);
    } else {
      setScreens(refreshOnlineOfflineStatus());
    }

    setLayouts(loadLayouts());
    setRooms(loadRooms());
    setGroups(loadScreenGroups());
  }, []);

  useEffect(() => {
    const syncAndRefresh = async () => {
      await syncLocalStorageKeyFromSystem(SCREENS_KEY).catch(() => false);
      setScreens(refreshOnlineOfflineStatus());
    };

    const timer = setInterval(() => {
      void syncAndRefresh();
    }, 4000);

    void syncAndRefresh();
    return () => clearInterval(timer);
  }, []);

  const persist = (next: ScreenModel[]) => {
    setScreens(next);
    saveScreens(next);
  };

  const persistGroups = (next: ScreenGroupModel[]) => {
    setGroups(next);
    saveScreenGroups(next);
  };

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const next = upsertScreenGroup({
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      theme: { ...DEFAULT_GROUP_THEME }
    });
    setGroups(next);
    setNewGroupName('');
  };

  const removeGroup = (groupId: string) => {
    const nextGroups = deleteScreenGroup(groupId);
    setGroups(nextGroups);
    persist(screens.map((screen) => (screen.groupId === groupId ? { ...screen, groupId: undefined } : screen)));
  };

  const patchGroupTheme = (groupId: string, patch: Partial<GroupThemeSettings>) => {
    const target = groups.find((group) => group.id === groupId);
    if (!target) return;
    persistGroups(groups.map((group) => (
      group.id === groupId
        ? {
            ...group,
            theme: {
              ...group.theme,
              ...patch,
              primaryColor: sanitizeHexColor((patch.primaryColor ?? group.theme.primaryColor))
            }
          }
        : group
    )));
  };

  const assignGroup = (screenId: string, groupId: string) => {
    persist(screens.map((screen) => (screen.id === screenId ? { ...screen, groupId: groupId || undefined } : screen)));
  };

  const patchScreenTheme = (screenId: string, patch: Partial<ScreenThemeSettings>) => {
    persist(screens.map((screen) => (
      screen.id === screenId
        ? (() => {
            const currentTheme: ScreenThemeSettings = {
              mode: screen.theme?.mode ?? 'inherit-group',
              primaryColor: screen.theme?.primaryColor ?? DEFAULT_GROUP_THEME.primaryColor,
              lightStart: screen.theme?.lightStart ?? DEFAULT_GROUP_THEME.lightStart,
              darkStart: screen.theme?.darkStart ?? DEFAULT_GROUP_THEME.darkStart
            };

            const nextTheme: ScreenThemeSettings = {
              ...currentTheme,
              ...patch,
              primaryColor: patch.primaryColor
                ? sanitizeHexColor(patch.primaryColor)
                : currentTheme.primaryColor
            };

            return {
              ...screen,
              theme: nextTheme
            };
          })()
        : screen
    )));
  };

  const launchPlayerWindows = (screen: ScreenModel) => {
    const count = Math.max(1, launchCountByScreen[screen.id] ?? 1);
    for (let index = 0; index < count; index += 1) {
      const url = `${window.location.origin}/player?deviceId=${encodeURIComponent(screen.deviceId)}&instance=${index + 1}`;
      window.open(url, `_blank`);
    }
  };

  const approveScreen = (screenId: string) => {
    persist(screens.map((screen) => (
      screen.id === screenId ? { ...screen, status: 'online', lastHeartbeat: new Date().toISOString() } : screen
    )));
  };

  const rejectScreen = (screenId: string) => {
    persist(screens.filter((screen) => screen.id !== screenId));
  };

  const assignLayout = async (screenId: string, layoutId: string) => {
    persist(screens.map((screen) => (screen.id === screenId ? { ...screen, layoutId } : screen)));
    await mirrorLocalStorageKeyToDb(LAYOUTS_KEY).catch(() => undefined);
    await mirrorLocalStorageKeyToDb(SCREENS_KEY).catch(() => undefined);
  };

  const assignRooms = (screenId: string, roomIds: string[]) => {
    persist(screens.map((screen) => (screen.id === screenId ? { ...screen, roomIds } : screen)));
  };

  const toggleRoomAssignment = (screenId: string, roomId: string, checked: boolean) => {
    const target = screens.find((screen) => screen.id === screenId);
    if (!target) return;

    const current = new Set(target.roomIds ?? []);
    if (checked) current.add(roomId);
    else current.delete(roomId);

    assignRooms(screenId, Array.from(current));
  };

  const renameScreen = (screenId: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;

    persist(screens.map((screen) => (screen.id === screenId ? { ...screen, name: trimmed } : screen)));
    setNameDraftByScreen((prev) => ({ ...prev, [screenId]: trimmed }));
  };

  const sendCommand = async (screenId: string, command: string) => {
    try {
      const response = await fetch(`${systemApiBase}/api/screens/${encodeURIComponent(screenId)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        void appendSystemLog({
          type: 'screen',
          level: 'error',
          source: 'ui.screens',
          message: `Échec commande: ${command}`,
          details: { screenId, command, error: payload?.error || 'command failed' }
        });
        return;
      }

      void appendSystemLog({
        type: 'screen',
        level: 'info',
        source: 'ui.screens',
        message: `Commande envoyée: ${command}`,
        details: { screenId, command }
      });
    } catch {
      void appendSystemLog({
        type: 'screen',
        level: 'error',
        source: 'ui.screens',
        message: `Échec commande: ${command}`,
        details: { screenId, command, error: 'network error' }
      });
    }
  };

  const toggleSelected = (screenId: string, checked: boolean) => {
    setSelectedScreenIds((prev) => {
      if (checked) return Array.from(new Set([...prev, screenId]));
      return prev.filter((id) => id !== screenId);
    });
  };

  const runBulkCommand = async (command: 'refresh' | 'reload' | 'reboot') => {
    if (selectedScreenIds.length === 0) return;
    setBulkBusy(true);
    try {
      await fetch(`${systemApiBase}/api/screens/commands/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, screenIds: selectedScreenIds })
      });
      setSelectedScreenIds([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkRotateToken = async () => {
    if (selectedScreenIds.length === 0) return;
    setBulkBusy(true);
    try {
      await fetch(`${systemApiBase}/api/screens/rotate-token/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenIds: selectedScreenIds })
      });
      await syncLocalStorageKeyFromSystem(SCREENS_KEY).catch(() => false);
      setScreens(refreshOnlineOfflineStatus());
      setSelectedScreenIds([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const filteredScreens = useMemo(
    () => screens.filter((screen) => filter === 'all' || screen.status === filter),
    [filter, screens]
  );

  const screensByGroup = useMemo(() => {
    const map = new Map<string, ScreenModel[]>();
    groups.forEach((group) => map.set(group.id, []));
    map.set('ungrouped', []);

    screens.forEach((screen) => {
      const key = screen.groupId && map.has(screen.groupId) ? screen.groupId : 'ungrouped';
      map.set(key, [...(map.get(key) ?? []), screen]);
    });

    return map;
  }, [groups, screens]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  useEffect(() => {
    if (!selectedScreen) return;
    const refreshed = screens.find((screen) => screen.id === selectedScreen.id);
    if (!refreshed) {
      setShowDetailsModal(false);
      setSelectedScreen(null);
      return;
    }
    setSelectedScreen(refreshed);
  }, [screens, selectedScreen]);

  const counts = {
    pending: screens.filter((screen) => screen.status === 'pending').length,
    online: screens.filter((screen) => screen.status === 'online').length,
    offline: screens.filter((screen) => screen.status === 'offline').length
  };

  const claimPairing = async () => {
    const pin = pairingPin.trim();

    setPairingMessage('');
    setPairingError('');

    if (!/^\d{6}$/.test(pin)) {
      setPairingError('PIN invalide: 6 chiffres requis.');
      return;
    }

    setPairingBusy(true);
    try {
      const response = await fetch(`${systemApiBase}/api/screens/pair/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setPairingError(typeof payload?.error === 'string' ? payload.error : 'Liaison impossible.');
        return;
      }

      await syncLocalStorageKeyFromSystem(SCREENS_KEY).catch(() => false);
      setScreens(refreshOnlineOfflineStatus());
      setPairingMessage('Appareil lié avec succès.');
      setPairingPin('');
      const params = new URLSearchParams(window.location.search);
      if (params.has('pin')) {
        params.delete('pin');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      setPairingError('Liaison impossible (serveur indisponible).');
    } finally {
      setPairingBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-3 text-center md:text-left">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Screens Management</h1>
          <p className="text-[#9ca3af]">Gestion individuelle de plusieurs machines (enrôlement, approbation, layout)</p>
        </div>
      </div>

      {enrollError ? (
        <GlassCard className="p-4 text-[#ef4444] text-sm text-center">
          {enrollError}
        </GlassCard>
      ) : null}

      <GlassCard className="p-4 space-y-3">
        <h2 className="text-[#e5e7eb] text-base">Lier un appareil via PIN (QR ou saisie manuelle)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={pairingPin}
            onChange={(event) => setPairingPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb] tracking-widest"
            placeholder="PIN 6 chiffres"
            aria-label="PIN 6 chiffres"
          />
          <GlassButton onClick={claimPairing} disabled={pairingBusy}>{pairingBusy ? 'Liaison...' : 'Lier appareil'}</GlassButton>
        </div>
        {pairingMessage ? <p className="text-[#22c55e] text-sm">{pairingMessage}</p> : null}
        {pairingError ? <p className="text-[#ef4444] text-sm">{pairingError}</p> : null}
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-1">Total</div>
              <div className="text-2xl text-[#e5e7eb] font-bold">{screens.length}</div>
            </div>
            <Monitor className="text-[#3b82f6]" size={32} />
          </div>
        </GlassCard>

        <GlassCard className="p-4 cursor-pointer" onClick={() => setFilter('pending')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-1">Pending</div>
              <div className="text-2xl text-[#f59e0b] font-bold">{counts.pending}</div>
            </div>
            <Clock className="text-[#f59e0b]" size={32} />
          </div>
        </GlassCard>

        <GlassCard className="p-4 cursor-pointer" onClick={() => setFilter('online')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-1">Online</div>
              <div className="text-2xl text-[#22c55e] font-bold">{counts.online}</div>
            </div>
            <CheckCircle className="text-[#22c55e]" size={32} />
          </div>
        </GlassCard>

        <GlassCard className="p-4 cursor-pointer" onClick={() => setFilter('offline')}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-1">Offline</div>
              <div className="text-2xl text-[#ef4444] font-bold">{counts.offline}</div>
            </div>
            <WifiOff className="text-[#ef4444]" size={32} />
          </div>
        </GlassCard>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'online', 'offline'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-[12px] ${filter === tab ? 'bg-[#3b82f6] text-white' : 'bg-[rgba(255,255,255,0.08)] text-[#9ca3af]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {selectedScreenIds.length > 0 ? (
        <GlassCard className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#e5e7eb] text-sm">{selectedScreenIds.length} écran(s) sélectionné(s)</span>
            <GlassButton size="sm" onClick={() => runBulkCommand('refresh')} disabled={bulkBusy}>Refresh</GlassButton>
            <GlassButton size="sm" onClick={() => runBulkCommand('reload')} disabled={bulkBusy}>Reload</GlassButton>
            <GlassButton size="sm" onClick={() => runBulkCommand('reboot')} disabled={bulkBusy}>Reboot</GlassButton>
            <GlassButton variant="danger" size="sm" onClick={runBulkRotateToken} disabled={bulkBusy}>Rotate Token</GlassButton>
            <GlassButton variant="ghost" size="sm" onClick={() => setSelectedScreenIds([])} disabled={bulkBusy}>Clear</GlassButton>
          </div>
        </GlassCard>
      ) : null}

      {filteredScreens.length === 0 ? (
        <GlassCard className="p-6 text-center text-[#9ca3af]">Aucun écran pour ce filtre.</GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredScreens.map((screen) => (
            <GlassCard key={screen.id} className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[#e5e7eb] font-medium">{screen.name}</h3>
                  <p className="text-[#9ca3af] text-sm">{screen.deviceId}</p>
                  <p className="text-[#9ca3af] text-xs">{screen.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs text-[#9ca3af]">
                    <input
                      type="checkbox"
                      checked={selectedScreenIds.includes(screen.id)}
                      onChange={(event) => toggleSelected(screen.id, event.target.checked)}
                      className="accent-[#3b82f6]"
                    />
                    Select
                  </label>
                  <button
                    type="button"
                    aria-label="Voir détails"
                    title="Voir détails"
                    onClick={() => {
                      setSelectedScreen(screen);
                      setShowDetailsModal(true);
                    }}
                    className="p-2 rounded-[8px] hover:bg-[rgba(255,255,255,0.08)]"
                  >
                    <Eye size={16} className="text-[#9ca3af]" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[#9ca3af] text-sm">Token: {screen.deviceToken}</div>
                <div>
                  <label className="block text-[#9ca3af] text-xs mb-1" htmlFor={`layout-${screen.id}`}>Layout assigné</label>
                  <select
                    id={`layout-${screen.id}`}
                    value={screen.layoutId ?? ''}
                    onChange={(event) => assignLayout(screen.id, event.target.value)}
                    className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                  >
                    <option className="bg-[#111827] text-[#e5e7eb]" value="">Aucun</option>
                    {layouts.map((layout) => (
                      <option className="bg-[#111827] text-[#e5e7eb]" key={layout.id} value={layout.id}>{layout.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#9ca3af] text-xs mb-1">Salles affichées (checkbox)</label>
                  <div className="w-full min-h-[120px] bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-3 py-2 space-y-2">
                    {rooms.length === 0 ? (
                      <p className="text-[#9ca3af] text-xs">Aucune salle disponible.</p>
                    ) : (
                      rooms.map((room) => {
                        const checked = (screen.roomIds ?? []).includes(room.id);
                        return (
                          <label key={room.id} className="flex items-center gap-2 text-[#e5e7eb] text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleRoomAssignment(screen.id, room.id, event.target.checked)}
                              className="accent-[#3b82f6]"
                            />
                            <span>{room.name} ({room.number})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[#9ca3af] text-xs mt-1">{(screen.roomIds ?? []).length} salle(s) sélectionnée(s). Laisser vide = toutes les salles.</p>
                </div>
              </div>

              {screen.status === 'pending' ? (
                <div className="flex gap-2 mt-4">
                  <GlassButton size="sm" className="flex-1" onClick={() => approveScreen(screen.id)}>Approuver</GlassButton>
                  <GlassButton variant="ghost" size="sm" className="flex-1" onClick={() => rejectScreen(screen.id)}>Rejeter</GlassButton>
                </div>
              ) : (
                <div className="flex gap-2 mt-4">
                  <GlassButton variant="ghost" size="sm" onClick={() => sendCommand(screen.id, 'refresh')}>
                    <RefreshCw size={16} />
                  </GlassButton>
                  <GlassButton variant="ghost" size="sm" onClick={() => rejectScreen(screen.id)}>
                    <Trash2 size={16} />
                  </GlassButton>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {showDetailsModal && selectedScreen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-2xl p-6">
            <h2 className="text-xl text-[#e5e7eb] mb-4">{selectedScreen.name}</h2>
            <div className="mb-4 space-y-2">
              <label className="block text-[#9ca3af] text-xs" htmlFor={`rename-screen-${selectedScreen.id}`}>Renommer l'appareil / écran</label>
              <div className="flex gap-2">
                <input
                  id={`rename-screen-${selectedScreen.id}`}
                  value={nameDraftByScreen[selectedScreen.id] ?? selectedScreen.name}
                  onChange={(event) => setNameDraftByScreen((prev) => ({ ...prev, [selectedScreen.id]: event.target.value }))}
                  className="flex-1 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] px-3 py-2 text-[#e5e7eb]"
                  placeholder="Nom de l'écran"
                />
                <GlassButton
                  onClick={() => renameScreen(selectedScreen.id, nameDraftByScreen[selectedScreen.id] ?? selectedScreen.name)}
                >
                  Enregistrer
                </GlassButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-[#9ca3af]">Device ID</div><div className="text-[#e5e7eb]">{selectedScreen.deviceId}</div>
              <div className="text-[#9ca3af]">Hostname</div><div className="text-[#e5e7eb]">{selectedScreen.hostname}</div>
              <div className="text-[#9ca3af]">OS</div><div className="text-[#e5e7eb]">{selectedScreen.os}</div>
              <div className="text-[#9ca3af]">Résolution</div><div className="text-[#e5e7eb]">{selectedScreen.resolution}</div>
              <div className="text-[#9ca3af]">Salles assignées</div>
              <div className="text-[#e5e7eb]">
                {(selectedScreen.roomIds ?? []).length === 0
                  ? 'Toutes les salles'
                  : rooms
                    .filter((room) => (selectedScreen.roomIds ?? []).includes(room.id))
                    .map((room) => `${room.name} (${room.number})`)
                    .join(', ')}
              </div>
              <div className="text-[#9ca3af]">Dernier heartbeat</div><div className="text-[#e5e7eb]">{new Date(selectedScreen.lastHeartbeat).toLocaleString('fr-FR')}</div>
            </div>
            <div className="mt-6">
              <GlassButton variant="ghost" className="w-full" onClick={() => setShowDetailsModal(false)}>Fermer</GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
