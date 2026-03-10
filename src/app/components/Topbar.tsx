import React from 'react';
import { Search, User, Moon, Sun, Menu, Info } from 'lucide-react';
import { logoutAdmin } from '../../services/adminAuthService';
import { appendSystemLog } from '../../services/logService';
import { useLocation, useNavigate } from 'react-router-dom';

interface TopbarProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenMenu?: () => void;
}

export function Topbar({ darkMode = true, onToggleDarkMode, onOpenMenu }: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard');
      window.setTimeout(() => {
        window.dispatchEvent(new Event('app:open-about'));
      }, 0);
      return;
    }
    window.dispatchEvent(new Event('app:open-about'));
  };

  return (
    <div className="h-16 border-b border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] flex items-center justify-between px-6">
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
            placeholder="Search..."
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

        <button
          className="flex items-center gap-2 p-2 hover:bg-[rgba(255,255,255,0.08)] rounded-[16px] transition-all duration-200"
          onClick={onLogout}
        >
          <div className="w-8 h-8 bg-[#3b82f6] rounded-full flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <span className="text-[#e5e7eb] text-sm">Admin (déconnexion)</span>
        </button>
      </div>
    </div>
  );
}
