import React from 'react';
import { Monitor, FolderOpen, List, Calendar, Activity, AlertCircle, CheckCircle, DoorOpen, Clock } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { GlassCard } from '../components/GlassCard';
import { getSystemApiBase } from '../../services/systemApiBase';
import { useTranslation } from '../i18n';

export function Dashboard() {
  const { t } = useTranslation();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [aboutClosing, setAboutClosing] = React.useState(false);
  const [aboutTab, setAboutTab] = React.useState<'project' | 'tech' | 'build'>('project');

  const version = String(import.meta.env.VITE_APP_VERSION || '0.0.0');
  const buildDateRaw = String(import.meta.env.VITE_BUILD_DATE || '');
  const libraries = String(import.meta.env.VITE_APP_LIBRARIES || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const languages = ['TypeScript', 'TSX (React)', 'JavaScript (Node.js)', 'CSS', 'JSON', 'Markdown', 'Shell'];

  const formatBuildDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value || 'N/A';
    return parsed.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const buildDate = formatBuildDate(buildDateRaw);

  const openAbout = React.useCallback(() => {
    setAboutTab('project');
    setAboutOpen(true);
    setAboutClosing(false);
  }, []);

  const closeAbout = React.useCallback(() => {
    setAboutClosing(true);
    window.setTimeout(() => {
      setAboutOpen(false);
      setAboutClosing(false);
    }, 220);
  }, []);

  React.useEffect(() => {
    if (!aboutOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAbout();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aboutOpen, closeAbout]);

  React.useEffect(() => {
    if (!aboutOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [aboutOpen]);

  React.useEffect(() => {
    const handler = () => openAbout();
    window.addEventListener('app:open-about', handler);
    return () => window.removeEventListener('app:open-about', handler);
  }, [openAbout]);

  const tabOrder: Array<'project' | 'tech' | 'build'> = ['project', 'tech', 'build'];
  const activeTabIndex = tabOrder.indexOf(aboutTab);
  const goPrevTab = () => setAboutTab(tabOrder[Math.max(0, activeTabIndex - 1)]);
  const goNextTab = () => setAboutTab(tabOrder[Math.min(tabOrder.length - 1, activeTabIndex + 1)]);

  // Charger dynamiquement les réunions et activités depuis API système
  const [upcomingMeetings, setUpcomingMeetings] = React.useState<any[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<any[]>([]);
  const [screens, setScreens] = React.useState<any[]>([]);
  const [dashboardLoadError, setDashboardLoadError] = React.useState('');
  React.useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      try {
        setDashboardLoadError('');
        const base = getSystemApiBase();
        const [meetingsRes, activityRes, screensRes] = await Promise.all([
          fetch(`${base}/api/meetings`, { cache: 'no-store', credentials: 'include' }),
          fetch(`${base}/api/activity`, { cache: 'no-store', credentials: 'include' }),
          fetch(`${base}/api/screens`, { cache: 'no-store', credentials: 'include' })
        ]);

        if (!meetingsRes.ok || !activityRes.ok || !screensRes.ok) {
          throw new Error(t('dashboard.error'));
        }

        const [meetings, activity, screensRows] = await Promise.all([
          meetingsRes.json(),
          activityRes.json(),
          screensRes.json()
        ]);

        if (!active) return;
        setUpcomingMeetings(Array.isArray(meetings) ? meetings : []);
        setRecentActivity(Array.isArray(activity) ? activity : []);
        setScreens(Array.isArray(screensRows) ? screensRows : []);
      } catch {
        if (!active) return;
        setUpcomingMeetings([]);
        setRecentActivity([]);
        setScreens([]);
        setDashboardLoadError(t('dashboard.error'));
      }
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const resolveActivityIcon = (icon: string) => {
    switch (String(icon || '').toLowerCase()) {
      case 'monitor':
        return <Monitor size={18} className="text-[#3b82f6]" />;
      case 'folder-open':
        return <FolderOpen size={18} className="text-[#f59e0b]" />;
      default:
        return <Activity size={18} className="text-[#22c55e]" />;
    }
  };

  const screensOnline = screens.filter((item) => String(item?.status || '').toLowerCase() === 'online').length;
  const screensOffline = screens.filter((item) => String(item?.status || '').toLowerCase() !== 'online' && String(item?.status || '').toLowerCase() !== 'pending').length;
  const screensPending = screens.filter((item) => String(item?.status || '').toLowerCase() === 'pending').length;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl text-[#e5e7eb] mb-2">Dashboard</h1>
        <p className="text-[#9ca3af]">Digital Signage System Overview</p>
        {dashboardLoadError ? (
          <p className="mt-3 text-sm text-[#fca5a5]">{dashboardLoadError}</p>
        ) : null}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Screens Online"
          value={String(screensOnline)}
          icon={<Monitor size={40} />}
          color="primary"
        />
        <StatCard
          title="Screens Offline"
          value={String(screensOffline)}
          icon={<AlertCircle size={40} />}
          color="danger"
        />
        <StatCard
          title="Active Rooms"
          value="0"
          icon={<DoorOpen size={40} />}
          color="secondary"
        />
        <StatCard
          title="Total Assets"
          value="0"
          icon={<FolderOpen size={40} />}
          color="warning"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-2">Pending Approval</div>
              <div className="text-3xl text-[#f59e0b] font-bold">0</div>
              <div className="text-[#9ca3af] text-xs mt-1">New devices</div>
            </div>
            <Clock className="text-[#f59e0b]" size={40} />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-2">Active Playlists</div>
              <div className="text-3xl text-[#3b82f6] font-bold">0</div>
              <div className="text-[#9ca3af] text-xs mt-1">Currently playing</div>
            </div>
            <List className="text-[#3b82f6]" size={40} />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[#9ca3af] text-sm mb-2">Meetings Today</div>
              <div className="text-3xl text-[#22c55e] font-bold">0</div>
              <div className="text-[#9ca3af] text-xs mt-1">Across all rooms</div>
            </div>
            <Calendar className="text-[#22c55e]" size={40} />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-[#3b82f6]" size={24} />
            <h2 className="text-lg text-[#e5e7eb]">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-[rgba(255,255,255,0.04)] rounded-[12px]"
                >
                  <div className="mt-1">{resolveActivityIcon(activity.icon)}</div>
                  <div className="flex-1">
                    <div className="text-[#e5e7eb] text-sm">{activity.message}</div>
                    <div className="text-[#9ca3af] text-xs mt-1">{activity.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[#9ca3af]">
                No recent activity
              </div>
            )}
          </div>
        </GlassCard>

        {/* Upcoming Meetings */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-[#22c55e]" size={24} />
            <h2 className="text-lg text-[#e5e7eb]">Upcoming Meetings</h2>
          </div>
          <div className="space-y-3">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`p-4 bg-[rgba(255,255,255,0.04)] rounded-[12px] border-l-4 ${
                    meeting.status === 'starting-soon' ? 'border-l-[#f59e0b]' : 'border-l-[#3b82f6]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[#e5e7eb] font-medium">{meeting.title}</div>
                    <div className="text-[#9ca3af] text-sm">{meeting.time}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DoorOpen size={14} className="text-[#9ca3af]" />
                    <div className="text-[#9ca3af] text-sm">{meeting.room}</div>
                  </div>
                  {meeting.status === 'starting-soon' && (
                    <div className="mt-2 text-[#f59e0b] text-xs">Starting soon</div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-[#9ca3af]">
                No meetings scheduled for today
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Screen Status */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Monitor className="text-[#3b82f6]" size={24} />
          <h2 className="text-lg text-[#e5e7eb]">Screen Status</h2>
        </div>
        {screens.length === 0 ? (
          <div className="text-center py-12 text-[#9ca3af]">
            <Monitor size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-2">No screens registered</p>
            <p className="text-sm">Les players apparaissent ici après liaison PIN/QR.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-2 py-1 rounded-[10px] bg-[rgba(34,197,94,0.15)] text-[#86efac]">Online: {screensOnline}</span>
              <span className="px-2 py-1 rounded-[10px] bg-[rgba(239,68,68,0.15)] text-[#fca5a5]">Offline: {screensOffline}</span>
              <span className="px-2 py-1 rounded-[10px] bg-[rgba(245,158,11,0.15)] text-[#fcd34d]">Pending: {screensPending}</span>
            </div>
            {screens.slice(0, 8).map((screen) => {
              const rawStatus = String(screen?.status || '').toLowerCase();
              const status = rawStatus === 'online' ? 'online' : (rawStatus === 'pending' ? 'pending' : 'offline');
              const statusClass = status === 'online'
                ? 'text-[#86efac]'
                : status === 'pending'
                  ? 'text-[#fcd34d]'
                  : 'text-[#fca5a5]';

              return (
                <div key={String(screen?.id || screen?.deviceId || Math.random())} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.04)] rounded-[12px]">
                  <div className="min-w-0">
                    <p className="text-[#e5e7eb] text-sm truncate">{String(screen?.name || screen?.deviceId || 'Screen')}</p>
                    <p className="text-[#9ca3af] text-xs truncate">{String(screen?.ip || 'N/A')} • {String(screen?.os || 'N/A')}</p>
                  </div>
                  <span className={`text-xs uppercase ${statusClass}`}>{status}</span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {aboutOpen && (
        <div
          className={`fixed inset-0 z-[120] bg-[#020617]/85 backdrop-blur-[3px] transition-opacity duration-200 ${aboutClosing ? 'opacity-0' : 'opacity-100'}`}
          onMouseDown={() => closeAbout()}
        >
          <div className="w-full h-full flex items-center justify-center p-4 sm:p-6">
            <div
              onMouseDown={(event) => event.stopPropagation()}
              className={`w-full max-w-4xl max-h-[88vh] bg-[#0f172a] border border-[rgba(255,255,255,0.16)] rounded-[20px] overflow-hidden shadow-2xl transition-all duration-200 ${aboutClosing ? 'opacity-0 scale-[0.97] translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}
            >
              <div className="px-5 sm:px-6 py-4 border-b border-[rgba(255,255,255,0.12)] flex items-center justify-between">
                <h2 className="text-xl text-[#e5e7eb]">About</h2>
                <button
                  type="button"
                  onClick={closeAbout}
                  className="px-3 py-1 rounded-[10px] text-sm text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                >
                  Fermer
                </button>
              </div>

              <div className="px-4 sm:px-6 pt-4 flex items-center gap-2 border-b border-[rgba(255,255,255,0.08)]">
                {[
                  { id: 'project', label: 'Projet' },
                  { id: 'tech', label: 'Technos' },
                  { id: 'build', label: 'Build' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAboutTab(tab.id as 'project' | 'tech' | 'build')}
                    className={`px-3 py-2 text-sm rounded-t-[10px] border border-b-0 transition-all duration-200 ${aboutTab === tab.id
                      ? 'text-[#e5e7eb] bg-[rgba(59,130,246,0.2)] border-[rgba(59,130,246,0.5)]'
                      : 'text-[#9ca3af] bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] hover:text-[#e5e7eb]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto max-h-[58vh] space-y-4">
                {aboutTab === 'project' && (
                  <GlassCard className="p-5">
                    <h3 className="text-lg text-[#e5e7eb] mb-3">à propos du projet</h3>
                    <p className="text-[#cbd5e1] leading-relaxed">
                      Digital Kiosk est un projet open-source permettant de transformer n'importe quel écran en un panneau d'affichage dynamique. Conçu pour être simple à utiliser et facile à déployer, il offre une solution clé en main pour la gestion de contenu sur des écrans d'information ou de signalisation.
                    </p>
                  </GlassCard>
                )}

                {aboutTab === 'tech' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GlassCard className="p-5">
                      <h3 className="text-lg text-[#e5e7eb] mb-3">Langages</h3>
                      <ul className="space-y-2 text-[#cbd5e1]">
                        {languages.map((language) => (
                          <li key={language} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                            <span>{language}</span>
                          </li>
                        ))}
                      </ul>
                    </GlassCard>

                    <GlassCard className="p-5">
                      <h3 className="text-lg text-[#e5e7eb] mb-3">Librairies</h3>
                      <div className="max-h-64 overflow-auto pr-1 flex flex-wrap gap-2">
                        {libraries.map((libraryName) => (
                          <span
                            key={libraryName}
                            className="px-2 py-1 rounded-full text-xs border border-[rgba(255,255,255,0.18)] text-[#cbd5e1] bg-[rgba(255,255,255,0.05)]"
                          >
                            {libraryName}
                          </span>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                )}

                {aboutTab === 'build' && (
                  <GlassCard className="p-5">
                    <h3 className="text-lg text-[#e5e7eb] mb-3">Dernier build</h3>
                    <div className="space-y-2 text-[#cbd5e1]">
                      <p>Version : <span className="text-[#e5e7eb] font-semibold">{version}</span></p>
                      <p>Date : <span className="text-[#e5e7eb] font-semibold">{buildDate}</span></p>
                    </div>
                  </GlassCard>
                )}
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-[rgba(255,255,255,0.12)] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goPrevTab}
                  disabled={activeTabIndex <= 0}
                  className="px-3 py-2 rounded-[10px] text-sm border border-[rgba(255,255,255,0.15)] text-[#e5e7eb] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={goNextTab}
                  disabled={activeTabIndex >= tabOrder.length - 1}
                  className="px-3 py-2 rounded-[10px] text-sm border border-[rgba(255,255,255,0.15)] text-[#e5e7eb] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
