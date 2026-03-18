import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, User, Moon, Sun, Menu, Info } from 'lucide-react';
import { getCurrentAdminSession, logoutAdmin } from '../../services/adminAuthService';
import { appendSystemLog } from '../../services/logService';
import { useNavigate } from 'react-router-dom';
import { getSystemApiBase } from '../../services/systemApiBase';

interface TopbarProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenMenu?: () => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchEnabled?: boolean;
}

export function Topbar({
  darkMode = true,
  onToggleDarkMode,
  onOpenMenu,
  searchValue = '',
  onSearchValueChange,
  searchEnabled = false
}: TopbarProps) {
  const navigate = useNavigate();
  const currentSession = getCurrentAdminSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [updateRunning, setUpdateRunning] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const statusLabel = useMemo(() => {
    if (updateRunning) {
      return 'En mise à jour';
    }
    return serverOnline ? 'Connecté' : 'Déconnecté';
  }, [serverOnline, updateRunning]);
  const statusClassName = useMemo(() => {
    if (updateRunning) {
      return 'text-[#f59e0b]';
    }
    return serverOnline ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }, [serverOnline, updateRunning]);

  const onLogout = async () => {
    void appendSystemLog({
      type: 'auth',
      level: 'info',
      source: 'ui.topbar',
      message: 'Déconnexion admin',
      details: {}
    });
    await logoutAdmin();
    window.location.href = '/login';
  };

  const onOpenAbout = () => {
    navigate('/about');
  };

  useEffect(() => {
    let active = true;

    const probe = async () => {
      try {
        const response = await fetch(`${getSystemApiBase()}/api/health`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (!active) return;
        setServerOnline(response.ok);
      } catch {
        if (!active) return;
        setServerOnline(false);
      }
    };

    const probeUpdate = async () => {
      try {
        const response = await fetch(`${getSystemApiBase()}/api/system/update/state`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (!active) return;
        if (!response.ok) {
          setUpdateRunning(false);
          return;
        }
        const payload = await response.json();
        setUpdateRunning(Boolean(payload?.isRunning));
      } catch {
        if (!active) return;
        setUpdateRunning(false);
      }
    };

    void probe();
    void probeUpdate();
    const timer = window.setInterval(() => {
      void probe();
    }, 8000);
    const updateTimer = window.setInterval(() => {
      void probeUpdate();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(updateTimer);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [menuOpen]);

  return (
    <div className="relative z-[70] h-16 border-b border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Ouvrir le menu"
            className="md:hidden p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-[12px] transition-all duration-200"
          >
            <Menu size={20} className="text-[#e5e7eb]" />
          </button>
        ) : null}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={20} />
          <input
            type="text"
            placeholder={searchEnabled ? 'Rechercher dans le calendrier...' : 'Recherche (active sur Calendrier uniquement)'}
            value={searchEnabled ? searchValue : ''}
            onChange={(event) => {
              if (!searchEnabled) return;
              onSearchValueChange?.(event.target.value);
            }}
            disabled={!searchEnabled}
            className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] pl-10 pr-4 py-2 text-[#e5e7eb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] transition-all duration-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        
        
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-[16px] transition-all duration-200"
          >
            {darkMode ? (
              <Moon size={20} className="text-[#9ca3af]" />
            ) : (
              <Sun size={20} className="text-[#9ca3af]" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenAbout}
          className="flex items-center gap-2 p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-[16px] transition-all duration-200"
          title="About"
          aria-label="Ouvrir About"
        >
          <Info size={18} className="text-[#e5e7eb]" />
          <span className="text-[#e5e7eb] text-sm">About</span>
        </button>

        <div ref={menuRef} className="relative">
          <button
            className="flex items-center gap-2 p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-[16px] transition-all duration-200"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            <div className="w-8 h-8 bg-[#3b82f6] rounded-full flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <span className="text-[#e5e7eb] text-sm">{currentSession?.username || 'Admin'}</span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-[12px] border border-[rgba(255,255,255,0.14)] bg-[rgba(15,23,42,0.95)] backdrop-blur-[20px] p-3 shadow-xl z-[120] space-y-3">
              <div>
                <p className="text-xs text-[#9ca3af]">Utilisateur</p>
                <p className="text-sm text-[#e5e7eb]">{currentSession?.username || 'admin'}</p>
              </div>
              <div>
                <p className="text-xs text-[#9ca3af]">Rôle</p>
                <p className="text-sm text-[#e5e7eb] uppercase">{currentSession?.role || 'admin'}</p>
              </div>
              <div>
                <p className="text-xs text-[#9ca3af]">Statut serveur</p>
                <p className={`text-sm ${statusClassName}`}>{statusLabel}</p>
              </div>
              <button
                className="w-full mt-1 rounded-[10px] border border-[rgba(255,255,255,0.14)] px-3 py-2 text-sm text-[#e5e7eb] hover:bg-[rgba(255,255,255,0.08)] transition-all duration-200"
                onClick={onLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
