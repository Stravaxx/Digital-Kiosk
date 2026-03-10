import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Monitor, List, FolderOpen, Calendar, Layout, Database, FileText, Settings, Home, DoorOpen, LayoutTemplate, BookOpen, Braces, Bell, ActivitySquare, ShieldAlert, LogOut } from 'lucide-react';
import { getCurrentAdminSession, listStoredAdminAccounts, logoutAdmin, switchAdminAccount } from '../../services/adminAuthService';

type MenuItem = {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  external?: boolean;
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const currentSession = getCurrentAdminSession();
  const accounts = useMemo(() => listStoredAdminAccounts(), []);

  const handleSwitchAccount = (username: string) => {
    if (!switchAdminAccount(username)) return;
    onClose?.();
    window.location.reload();
  };

  const handleLogout = async () => {
    await logoutAdmin();
    window.location.href = '/login';
  };

  const menuItems: MenuItem[] = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: Home },
    { id: 'screens', path: '/screens', label: 'Screens', icon: Monitor },
    { id: 'rooms', path: '/rooms', label: 'Rooms', icon: DoorOpen },
    { id: 'playlists', path: '/playlists', label: 'Playlists', icon: List },
    { id: 'assets', path: '/assets', label: 'Assets', icon: FolderOpen },
    { id: 'calendar', path: '/calendar', label: 'Calendar', icon: Calendar },
    { id: 'layouts', path: '/layouts', label: 'Layouts', icon: Layout },
    { id: 'templates', path: '/templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'storage', path: '/storage', label: 'Storage', icon: Database },
    { id: 'logs', path: '/logs', label: 'Logs', icon: FileText },
    { id: 'fleet', path: '/fleet', label: 'Fleet', icon: ActivitySquare },
    { id: 'alerts', path: '/alerts', label: 'Alerts', icon: Bell },
    { id: 'ops', path: '/ops', label: 'Ops', icon: ShieldAlert },
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
    { id: 'docs', path: '/docs/', label: 'Documentation', icon: BookOpen, external: true },
    { id: 'api-docs', path: '/docs/api/index.html', label: 'API', icon: Braces, external: true },
  ];
  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] border-r border-[rgba(255,255,255,0.12)] flex flex-col transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="p-6 border-b border-[rgba(255,255,255,0.12)]">
        <h1 className="text-xl text-[#e5e7eb]">Digital Signage</h1>
        <p className="text-sm text-[#9ca3af]">Management System</p>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;

          if (item.external) {
            return (
              <a
                key={item.id}
                href={item.path}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="w-full flex items-center gap-3 px-6 py-3 text-left transition-all duration-200 text-[#9ca3af] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#e5e7eb]"
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </a>
            );
          }
          
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `w-full flex items-center gap-3 px-6 py-3 text-left transition-all duration-200 ${
                isActive
                  ? 'bg-[rgba(59,130,246,0.2)] text-[#3b82f6] border-r-2 border-[#3b82f6]'
                  : 'text-[#9ca3af] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#e5e7eb]'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.12)] p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-[#9ca3af]">Comptes</p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {accounts.length === 0 ? (
            <p className="text-sm text-[#9ca3af]">Aucun compte en session.</p>
          ) : (
            accounts.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => handleSwitchAccount(account.username)}
                className={`w-full text-left rounded-[10px] px-3 py-2 text-sm border transition-all duration-200 ${account.isActive
                  ? 'bg-[rgba(59,130,246,0.2)] border-[#3b82f6] text-[#bfdbfe]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)] text-[#e5e7eb] hover:bg-[rgba(255,255,255,0.08)]'
                }`}
                disabled={account.isActive}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{account.username}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#9ca3af]">{account.role}</span>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-[12px] border border-[rgba(255,255,255,0.12)] px-3 py-2 text-[#e5e7eb] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
        >
          <LogOut size={16} />
          <span>{currentSession ? `Déconnexion (${currentSession.username})` : 'Déconnexion'}</span>
        </button>
      </div>
    </div>
  );
}
