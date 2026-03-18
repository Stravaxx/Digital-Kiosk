import React, { useEffect, useRef, useState } from 'react';
import { Settings as SettingsIcon, Save, BellRing, RefreshCw, Download } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { getCurrentAdminSession } from '../../services/adminAuthService';
import {
  DEFAULT_SYSTEM_SETTINGS,
  saveSystemSettings,
  syncSystemSettingsFromDb,
  type SystemSettings
} from '../../services/systemSettingsService';
import {
  checkForUpdates,
  executeBackgroundUpdate,
  getBackgroundUpdateState,
  getUpdateStatus,
  type BackgroundUpdateState,
  type UpdateStatus
} from '../../services/updateService';

const UPDATE_LAST_NOTIFIED_TAG_KEY = 'ds.updates.last-notified-tag';

interface AdminUserView {
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export function Settings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const session = getCurrentAdminSession();
  const isAdmin = session?.role === 'admin';
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator' | 'viewer'>('viewer');
  const [userActionBusy, setUserActionBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [backgroundUpdateState, setBackgroundUpdateState] = useState<BackgroundUpdateState | null>(null);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updatesBusy, setUpdatesBusy] = useState<'check' | 'apply' | ''>('');
  const [updatesError, setUpdatesError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const lastNotifiedTagRef = useRef<string>(
    String(localStorage.getItem(UPDATE_LAST_NOTIFIED_TAG_KEY) || '').trim()
  );

  const formatVersionLabel = (value: string | null | undefined) => {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    return raw.toLowerCase().startsWith('v') ? `V${raw.slice(1)}` : `V${raw}`;
  };

  useEffect(() => {
    void syncSystemSettingsFromDb().then(setSettings).catch(() => setSettings(DEFAULT_SYSTEM_SETTINGS));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError('');
      try {
        const response = await fetch('/api/auth/users', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setUsersError(String(payload?.error || 'Chargement impossible.'));
          return;
        }
        const nextUsers = Array.isArray(payload?.users)
          ? payload.users
              .map((item: any) => ({
                username: String(item?.username || '').trim(),
                role: item?.role === 'admin' || item?.role === 'operator' || item?.role === 'viewer' ? item.role : 'viewer',
                createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
                updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : undefined,
                lastLoginAt: typeof item?.lastLoginAt === 'string' ? item.lastLoginAt : undefined
              }))
              .filter((item: AdminUserView) => item.username)
          : [];
        setUsers(nextUsers);
      } catch {
        setUsersError('Chargement impossible.');
      } finally {
        setUsersLoading(false);
      }
    };

    void loadUsers();
  }, [isAdmin]);

  useEffect(() => {
    let mounted = true;

    const maybeNotifyRelease = (status: UpdateStatus) => {
      if (!status.updateAvailable || !status.latestTag) return;
      if (lastNotifiedTagRef.current === status.latestTag) return;

      lastNotifiedTagRef.current = status.latestTag;
      localStorage.setItem(UPDATE_LAST_NOTIFIED_TAG_KEY, status.latestTag);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        void new Notification('Mise à jour disponible', {
          body: `${status.latestTag} est disponible sur ${status.repo}.`
        });
      }
    };

    const loadUpdateStatus = async (forceCheck = false) => {
      try {
        const nextStatus = forceCheck ? await checkForUpdates() : await getUpdateStatus();
        const nextBackgroundState = await getBackgroundUpdateState().catch(() => null);
        if (!mounted) return;
        setUpdateStatus(nextStatus);
        setBackgroundUpdateState(nextBackgroundState);
        setUpdatesError('');
        maybeNotifyRelease(nextStatus);
      } catch (error) {
        if (!mounted) return;
        setUpdatesError(String((error as Error)?.message || 'Impossible de vérifier les mises à jour.'));
      } finally {
        if (mounted) setUpdatesLoading(false);
      }
    };

    void loadUpdateStatus();
    const timer = window.setInterval(() => {
      void loadUpdateStatus();
    }, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const runManualUpdateCheck = async () => {
    setUpdatesBusy('check');
    setUpdatesError('');
    try {
      const next = await checkForUpdates();
      setUpdateStatus(next);
    } catch (error) {
      setUpdatesError(String((error as Error)?.message || 'Vérification impossible.'));
    } finally {
      setUpdatesBusy('');
    }
  };

  const runApplyUpdate = async () => {
    if (!window.confirm('Appliquer la mise à jour en arrière-plan ? Une sauvegarde DB + storage sera faite automatiquement.')) {
      return;
    }

    setUpdatesBusy('apply');
    setUpdatesError('');
    try {
      const state = await executeBackgroundUpdate();
      setBackgroundUpdateState(state);
      const next = await getUpdateStatus().catch(() => null);
      if (next) {
        setUpdateStatus(next);
      }
    } catch (error) {
      setUpdatesError(String((error as Error)?.message || 'Application de la mise à jour impossible.'));
    } finally {
      setUpdatesBusy('');
    }
  };

  const saveChanges = () => {
    saveSystemSettings(settings);
  };

  const reloadUsers = async () => {
    if (!isAdmin) return;
    const response = await fetch('/api/auth/users', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(String(payload?.error || 'Erreur utilisateurs'));
    }
    const nextUsers = Array.isArray(payload?.users)
      ? payload.users
          .map((item: any) => ({
            username: String(item?.username || '').trim(),
            role: item?.role === 'admin' || item?.role === 'operator' || item?.role === 'viewer' ? item.role : 'viewer',
            createdAt: typeof item?.createdAt === 'string' ? item.createdAt : undefined,
            updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : undefined,
            lastLoginAt: typeof item?.lastLoginAt === 'string' ? item.lastLoginAt : undefined
          }))
          .filter((item: AdminUserView) => item.username)
      : [];
    setUsers(nextUsers);
  };

  const createUser = async () => {
    if (!isAdmin || !newUsername.trim() || !newPassword) return;
    setUserActionBusy(true);
    setUsersError('');
    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setUsersError(String(payload?.error || 'Création impossible'));
        return;
      }
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      await reloadUsers();
    } catch {
      setUsersError('Création impossible');
    } finally {
      setUserActionBusy(false);
    }
  };

  const patchUserRole = async (username: string, role: 'admin' | 'operator' | 'viewer') => {
    if (!isAdmin) return;
    setUserActionBusy(true);
    setUsersError('');
    try {
      const response = await fetch(`/api/auth/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setUsersError(String(payload?.error || 'Mise à jour impossible'));
        return;
      }
      await reloadUsers();
    } catch {
      setUsersError('Mise à jour impossible');
    } finally {
      setUserActionBusy(false);
    }
  };

  const resetUserPassword = async (username: string) => {
    if (!isAdmin) return;
    const nextPassword = window.prompt(`Nouveau mot de passe pour ${username} (8+ avec minuscule + majuscule)`);
    if (!nextPassword) return;
    setUserActionBusy(true);
    setUsersError('');
    try {
      const response = await fetch(`/api/auth/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setUsersError(String(payload?.error || 'Reset impossible'));
        return;
      }
      await reloadUsers();
    } catch {
      setUsersError('Reset impossible');
    } finally {
      setUserActionBusy(false);
    }
  };

  const deleteUser = async (username: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Supprimer l'utilisateur ${username} ?`)) return;
    setUserActionBusy(true);
    setUsersError('');
    try {
      const response = await fetch(`/api/auth/users/${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setUsersError(String(payload?.error || 'Suppression impossible'));
        return;
      }
      await reloadUsers();
    } catch {
      setUsersError('Suppression impossible');
    } finally {
      setUserActionBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">System Settings</h1>
          <p className="text-[#9ca3af]">Configure global system parameters</p>
        </div>
        <GlassButton onClick={saveChanges}>
          <Save size={20} className="inline mr-2" />
          Save Changes
        </GlassButton>
      </div>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">General Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-timezone">System Timezone</label>
            <select id="settings-timezone" title="System Timezone" aria-label="System Timezone" value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option className="bg-[#111827] text-[#e5e7eb]">UTC</option>
              <option className="bg-[#111827] text-[#e5e7eb]">America/New_York</option>
              <option className="bg-[#111827] text-[#e5e7eb]">Europe/Paris</option>
              <option className="bg-[#111827] text-[#e5e7eb]">Asia/Tokyo</option>
            </select>
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-date-format">Date Format</label>
            <select id="settings-date-format" title="Date Format" aria-label="Date Format" value={settings.dateFormat} onChange={(event) => setSettings({ ...settings, dateFormat: event.target.value })} className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option className="bg-[#111827] text-[#e5e7eb]">DD/MM/YYYY</option>
              <option className="bg-[#111827] text-[#e5e7eb]">MM/DD/YYYY</option>
              <option className="bg-[#111827] text-[#e5e7eb]">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">Player Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-default-duration">Default Content Duration (seconds)</label>
            <input
              id="settings-default-duration"
              title="Default Content Duration (seconds)"
              aria-label="Default Content Duration (seconds)"
              type="number"
              value={settings.defaultContentDurationSec}
              onChange={(event) => setSettings({ ...settings, defaultContentDurationSec: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-player-refresh">Player Refresh Interval (minutes)</label>
            <input
              id="settings-player-refresh"
              title="Player Refresh Interval (minutes)"
              aria-label="Player Refresh Interval (minutes)"
              type="number"
              value={settings.playerRefreshIntervalMin}
              onChange={(event) => setSettings({ ...settings, playerRefreshIntervalMin: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-heartbeat">Heartbeat Interval (seconds)</label>
            <input
              id="settings-heartbeat"
              title="Heartbeat Interval (seconds)"
              aria-label="Heartbeat Interval (seconds)"
              type="number"
              value={settings.heartbeatIntervalSec}
              onChange={(event) => setSettings({ ...settings, heartbeatIntervalSec: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-transition-effect">Transition Effect</label>
            <select id="settings-transition-effect" title="Transition Effect" aria-label="Transition Effect" value={settings.transitionEffect} onChange={(event) => setSettings({ ...settings, transitionEffect: event.target.value })} className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
              <option className="bg-[#111827] text-[#e5e7eb]">Fade</option>
              <option className="bg-[#111827] text-[#e5e7eb]">Slide</option>
              <option className="bg-[#111827] text-[#e5e7eb]">Zoom</option>
              <option className="bg-[#111827] text-[#e5e7eb]">Crossfade</option>
              <option className="bg-[#111827] text-[#e5e7eb]">None</option>
            </select>
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-transition-duration">Transition Duration (milliseconds)</label>
            <input
              id="settings-transition-duration"
              title="Transition Duration (milliseconds)"
              aria-label="Transition Duration (milliseconds)"
              type="number"
              value={settings.transitionDurationMs}
              onChange={(event) => setSettings({ ...settings, transitionDurationMs: Math.max(0, Number(event.target.value) || 0) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-lg text-[#e5e7eb] mb-4">Storage Limits</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-max-storage">Maximum Storage (GB)</label>
            <input
              id="settings-max-storage"
              title="Maximum Storage (GB)"
              aria-label="Maximum Storage (GB)"
              type="number"
              value={settings.maximumStorageGb}
              onChange={(event) => setSettings({ ...settings, maximumStorageGb: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-2" htmlFor="settings-cache-limit">Cache Limit (GB)</label>
            <input
              id="settings-cache-limit"
              title="Cache Limit (GB)"
              aria-label="Cache Limit (GB)"
              type="number"
              value={settings.cacheLimitGb}
              onChange={(event) => setSettings({ ...settings, cacheLimitGb: Math.max(1, Number(event.target.value) || 1) })}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg text-[#e5e7eb] mb-1">Mises à jour</h2>
            <p className="text-sm text-[#9ca3af]">Source release: {updateStatus?.repo || 'Stravaxx/Digital-Kiosk'}.</p>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton type="button" onClick={runManualUpdateCheck} disabled={updatesBusy !== ''}>
              <RefreshCw size={16} className="inline mr-2" />
              {updatesBusy === 'check' ? 'Vérification...' : 'Vérifier'}
            </GlassButton>
            <GlassButton
              type="button"
              onClick={runApplyUpdate}
              disabled={updatesBusy !== '' || !updateStatus?.updateAvailable}
            >
              <Download size={16} className="inline mr-2" />
              {updatesBusy === 'apply' ? 'Mise à jour...' : 'Mettre à jour'}
            </GlassButton>
          </div>
        </div>

        {updatesLoading ? (
          <p className="text-sm text-[#9ca3af]">Chargement de l’état des releases...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
              <p className="text-[#9ca3af]">Version actuelle</p>
              <p className="text-[#e5e7eb]">{formatVersionLabel(updateStatus?.currentVersion)}</p>
            </div>
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
              <p className="text-[#9ca3af]">Dernière release</p>
              <p className="text-[#e5e7eb]">{formatVersionLabel(updateStatus?.latestTag)}</p>
            </div>
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
              <p className="text-[#9ca3af]">Dernier check</p>
              <p className="text-[#e5e7eb]">{updateStatus?.checkedAt ? new Date(updateStatus.checkedAt).toLocaleString('fr-FR') : '—'}</p>
            </div>
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
              <p className="text-[#9ca3af]">État</p>
              <p className={updateStatus?.updateAvailable ? 'text-[#f59e0b]' : 'text-[#34d399]'}>
                {updateStatus?.updateAvailable ? 'Nouvelle release disponible' : 'Application à jour'}
              </p>
            </div>
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
              <p className="text-[#9ca3af]">Service de mise à jour</p>
              <p className={backgroundUpdateState?.isRunning ? 'text-[#fcd34d]' : 'text-[#e5e7eb]'}>
                {backgroundUpdateState?.isRunning ? 'En cours (arrière-plan)' : 'Inactif'}
              </p>
              <p className="text-[#9ca3af] mt-1">Progression: {Math.max(0, Math.min(100, Math.round(backgroundUpdateState?.progress || 0)))}%</p>
            </div>
            <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] md:col-span-2">
              <p className="text-[#9ca3af]">Étape en cours</p>
              <p className="text-[#e5e7eb]">{backgroundUpdateState?.currentStep && backgroundUpdateState.currentStep !== 'idle' ? backgroundUpdateState.currentStep : 'Aucune'}</p>
              <p className="text-[#9ca3af] mt-1">
                Source: {backgroundUpdateState?.sourceType === 'release'
                  ? `Release GitHub (${formatVersionLabel(backgroundUpdateState?.targetVersion || backgroundUpdateState?.sourceRef)})`
                  : backgroundUpdateState?.sourceType === 'branch'
                    ? `Branche GitHub (${String(backgroundUpdateState?.sourceRef || 'release')})`
                    : '—'}
              </p>
              {backgroundUpdateState?.error ? (
                <p className="text-[#fca5a5] mt-1">Erreur: {backgroundUpdateState.error}</p>
              ) : null}
            </div>
          </div>
        )}

        {updateStatus?.latestPublishedAt ? (
          <p className="text-xs text-[#9ca3af]">Release publiée le {new Date(updateStatus.latestPublishedAt).toLocaleString('fr-FR')}.</p>
        ) : null}

        {updateStatus?.releaseUrl ? (
          <a
            href={updateStatus.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#93c5fd] underline"
          >
            Voir la release GitHub
          </a>
        ) : null}

        {updateStatus?.releaseBody ? (
          <div className="p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
            <p className="text-sm text-[#e5e7eb] mb-2">Notes de release</p>
            <pre className="whitespace-pre-wrap text-xs text-[#cbd5e1] font-sans">{updateStatus.releaseBody}</pre>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 p-3 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]">
          <div className="text-sm">
            <p className="text-[#e5e7eb]">Notifications de mise à jour</p>
            <p className="text-[#9ca3af]">Notification locale quand une nouvelle release est publiée.</p>
          </div>
          <GlassButton type="button" onClick={requestNotificationPermission}>
            <BellRing size={16} className="inline mr-2" />
            {notificationsEnabled ? 'Notifications actives' : 'Activer les notifications'}
          </GlassButton>
        </div>

        {updateStatus?.updateAvailable ? (
          <div className="p-3 rounded-[12px] border border-[#f59e0b]/60 bg-[#f59e0b]/10 text-sm text-[#fcd34d]">
            Nouvelle release détectée ({updateStatus.latestTag}). Cliquez sur “Mettre à jour” pour appliquer la version publiée.
          </div>
        ) : null}

        {updateStatus?.requiresRestart ? (
          <div className="p-3 rounded-[12px] border border-[#3b82f6]/60 bg-[#3b82f6]/10 text-sm text-[#bfdbfe]">
            Mise à jour appliquée. Redémarrez le service Node pour charger la nouvelle version.
          </div>
        ) : null}

        {updatesError ? <p className="text-sm text-[#ef4444]">{updatesError}</p> : null}
        {updateStatus?.checkError ? <p className="text-sm text-[#ef4444]">{updateStatus.checkError}</p> : null}
        {updateStatus?.updateError ? <p className="text-sm text-[#ef4444]">{updateStatus.updateError}</p> : null}
      </GlassCard>

      {isAdmin ? (
        <GlassCard className="p-6">
          <h2 className="text-lg text-[#e5e7eb] mb-4">Multiuser</h2>
          <p className="text-sm text-[#9ca3af] mb-4">Gestion des comptes et des rôles admin/operator/viewer.</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <input
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="username"
              className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="mot de passe"
              className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
            />
            <select
              title="Rôle du nouvel utilisateur"
              aria-label="Rôle du nouvel utilisateur"
              value={newRole}
              onChange={(event) => setNewRole(event.target.value as 'admin' | 'operator' | 'viewer')}
              className="appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
            >
              <option value="admin" className="bg-[#111827]">admin</option>
              <option value="operator" className="bg-[#111827]">operator</option>
              <option value="viewer" className="bg-[#111827]">viewer</option>
            </select>
            <GlassButton onClick={createUser} disabled={userActionBusy}>Créer</GlassButton>
          </div>

          {usersError ? <p className="text-sm text-[#ef4444] mb-3">{usersError}</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9ca3af] border-b border-[rgba(255,255,255,0.12)]">
                  <th className="text-left py-2 pr-3">Username</th>
                  <th className="text-left py-2 pr-3">Role</th>
                  <th className="text-left py-2 pr-3">Dernier login</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-[#9ca3af]">Chargement…</td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.username} className="border-b border-[rgba(255,255,255,0.08)]">
                    <td className="py-2 pr-3 text-[#e5e7eb]">{user.username}</td>
                    <td className="py-2 pr-3">
                      <select
                        title={`Rôle utilisateur ${user.username}`}
                        aria-label={`Rôle utilisateur ${user.username}`}
                        value={user.role}
                        disabled={userActionBusy}
                        onChange={(event) => patchUserRole(user.username, event.target.value as 'admin' | 'operator' | 'viewer')}
                        className="appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[10px] px-2 py-1 text-[#e5e7eb]"
                      >
                        <option value="admin" className="bg-[#111827]">admin</option>
                        <option value="operator" className="bg-[#111827]">operator</option>
                        <option value="viewer" className="bg-[#111827]">viewer</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-[#9ca3af]">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : '—'}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <GlassButton type="button" disabled={userActionBusy} onClick={() => resetUserPassword(user.username)}>Reset MDP</GlassButton>
                        <GlassButton type="button" disabled={userActionBusy || user.username === session?.username} onClick={() => deleteUser(user.username)}>Supprimer</GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
