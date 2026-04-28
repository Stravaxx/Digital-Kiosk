import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { adoptAdminToken, bootstrapAdminAccount, consumeLastAuthError, getAdminAuthStatus, getAdminToken, isAdminAuthenticated, loginAdmin, verifyCurrentAdminConnection } from '../../services/adminAuthService';
import { appendSystemLog } from '../../services/logService';
import { useTranslation } from '../i18n';

export function Login() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checkingToken, setCheckingToken] = useState(true);
  const [requiresBootstrap, setRequiresBootstrap] = useState(false);

  const resolvePostLoginTarget = () => {
    const url = new URL(window.location.href);
    const raw = String(url.searchParams.get('redirect') || '').trim();
    if (!raw) return '/dashboard';

    // Prevent open redirects: only allow same-origin relative paths.
    if (!raw.startsWith('/') || raw.startsWith('//')) {
      return '/dashboard';
    }
    return raw;
  };

  useEffect(() => {
    let active = true;
    const lastError = consumeLastAuthError();
    if (lastError) {
      setError(lastError);
    }

    const bootstrapLogin = async () => {
      const authStatus = await getAdminAuthStatus();
      if (!active) return;
      setRequiresBootstrap(!authStatus.configured);

      const url = new URL(window.location.href);
      const tokenFromUrl = String(url.searchParams.get('token') || url.searchParams.get('adminToken') || '').trim();

      if (tokenFromUrl) {
        const adopted = await adoptAdminToken(tokenFromUrl);
        if (!active) return;

        if (adopted.ok) {
          url.searchParams.delete('token');
          url.searchParams.delete('adminToken');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          window.location.href = resolvePostLoginTarget();
          return;
        }

        setError(adopted.message || 'Token invalide ou expiré.');
      } else if (isAdminAuthenticated() && getAdminToken()) {
        const connected = await verifyCurrentAdminConnection();
        if (!active) return;
        if (connected) {
          window.location.href = resolvePostLoginTarget();
          return;
        }
      }

      setCheckingToken(false);
    };

    void bootstrapLogin();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError(t('login.required'));
      return;
    }

    if (requiresBootstrap) {
      const boot = await bootstrapAdminAccount(username, password);
      if (!boot.ok) {
        setError(boot.message ?? 'Initialisation refusée.');
        return;
      }
      setRequiresBootstrap(false);
    }

    const result = await loginAdmin(username, password);
    if (!result.ok) {
      void appendSystemLog({
        type: 'auth',
        level: 'warning',
        source: 'ui.login',
        message: requiresBootstrap ? 'Échec après initialisation admin' : 'Échec de connexion admin',
        details: { username: username.trim() }
      });
      setError(result.message ?? 'Connexion refusée.');
      return;
    }

    void appendSystemLog({
      type: 'auth',
      level: 'info',
      source: 'ui.login',
      message: requiresBootstrap ? 'Initialisation et connexion admin réussies' : 'Connexion admin réussie',
      details: { username: username.trim() }
    });

    window.location.href = resolvePostLoginTarget();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e5e7eb] flex items-center justify-center p-6">
      <GlassCard className="w-full max-w-md p-6 space-y-5">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center mb-3">
            <LockKeyhole size={20} className="text-[#3b82f6]" />
          </div>
          <h1 className="text-2xl text-[#e5e7eb]">{t('login.title')}</h1>
          {requiresBootstrap ? (
            <p className="text-sm text-[#9ca3af] mt-2">{t('login.bootstrap')}</p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4 max-w-sm mx-auto w-full">
          <div>
            <label className="block text-[#e5e7eb] mb-1" htmlFor="login-username">{t('login.username')}</label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
            />
          </div>
          <div>
            <label className="block text-[#e5e7eb] mb-1" htmlFor="login-password">{t('login.password')}</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[12px] px-3 py-2 text-[#e5e7eb]"
            />
          </div>

          {error && <p className="text-[#ef4444] text-sm">{error}</p>}

          <GlassButton type="submit" className="w-full" disabled={checkingToken}>
            <LogIn size={16} className="mr-2" />
            {checkingToken ? t('login.verifying') : (requiresBootstrap ? t('login.createAndLogin') : t('login.submit'))}
          </GlassButton>
        </form>
      </GlassCard>
    </div>
  );
}
