import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Monitor, List, FolderOpen, Calendar, Layout, Database, FileText, Settings, Home, DoorOpen, LayoutTemplate, BookOpen, Braces, Bell, ActivitySquare, ShieldAlert, LogOut } from 'lucide-react';
import { getCurrentAdminSession, hasAdminPermission, listStoredAdminAccounts, logoutAdmin, switchAdminAccount } from '../../services/adminAuthService';
import { useTranslation } from '../i18n';

type MenuItem = {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  external?: boolean;
  permissionKey?: string;
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { t } = useTranslation();
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
    { id: 'dashboard', path: '/dashboard', label: t('nav.dashboard'), icon: Home, permissionKey: 'dashboard' },
    { id: 'screens', path: '/screens', label: t('nav.screens'), icon: Monitor, permissionKey: 'screens' },
    { id: 'rooms', path: '/rooms', label: t('nav.rooms'), icon: DoorOpen, permissionKey: 'calendar' },
    { id: 'playlists', path: '/playlists', label: t('nav.playlists'), icon: List, permissionKey: 'playlists' },
    { id: 'assets', path: '/assets', label: t('nav.assets'), icon: FolderOpen, permissionKey: 'assets' },
    { id: 'calendar', path: '/calendar', label: t('nav.calendar'), icon: Calendar, permissionKey: 'calendar' },
    { id: 'layouts', path: '/layouts', label: t('nav.layouts'), icon: Layout, permissionKey: 'layouts' },
    { id: 'templates', path: '/templates', label: t('nav.templates'), icon: LayoutTemplate, permissionKey: 'layouts' },
    { id: 'storage', path: '/storage', label: t('nav.storage'), icon: Database, permissionKey: 'settings' },
    { id: 'logs', path: '/logs', label: t('nav.logs'), icon: FileText, permissionKey: 'logs' },
    { id: 'alerts', path: '/alerts', label: t('nav.alerts'), icon: Bell, permissionKey: 'alerts' },
    { id: 'ops', path: '/ops', label: t('nav.ops'), icon: ShieldAlert, permissionKey: 'monitoring' },
    { id: 'settings', path: '/settings', label: t('nav.settings'), icon: Settings, permissionKey: 'settings' },
    { id: 'docs', path: '/docs/', label: t('nav.docs'), icon: BookOpen, external: true },
    { id: 'api-docs', path: '/docs/api/index.html', label: t('nav.api'), icon: Braces, external: true },
  ];
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.external) return true;
    if (!item.permissionKey) return true;
    return hasAdminPermission(item.permissionKey, 'read');
  });
  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] border-r border-[rgba(255,255,255,0.12)] flex flex-col transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="p-6 border-b border-[rgba(255,255,255,0.12)]">
        <h1 className="text-xl text-[#e5e7eb]">{t('nav.title')}</h1>
        <p className="text-sm text-[#9ca3af]">{t('nav.subtitle')}</p>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        {visibleMenuItems.map((item) => {
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
    </div>
  );
}
