import React from 'react';
import { Github, Star, Eye, GitFork, AlertCircle, Package } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { useTranslation } from '../i18n';

interface GithubRepoStats {
  stars: number;
  watchers: number;
  forks: number;
  openIssues: number;
}

export function About() {
  const { t } = useTranslation();
  const version = String(import.meta.env.VITE_APP_VERSION || '0.0.0');
  const buildDate = String(import.meta.env.VITE_BUILD_DATE || 'N/A');
  const githubRepo = 'Stravaxx/Digital-Kiosk'.trim();

  const [stats, setStats] = React.useState<GithubRepoStats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!githubRepo || !/^[\w.-]+\/[\w.-]+$/.test(githubRepo)) {
      setStats(null);
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`https://api.github.com/repos/${githubRepo}`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (!response.ok) throw new Error(`github:${response.status}`);
        const payload = await response.json();
        if (!active) return;

        setStats({
          stars: Number(payload?.stargazers_count) || 0,
          watchers: Number(payload?.subscribers_count) || 0,
          forks: Number(payload?.forks_count) || 0,
          openIssues: Number(payload?.open_issues_count) || 0
        });
      } catch {
        if (!active) return;
        setError(t('about.githubLoadError'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [githubRepo]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl text-[#e5e7eb] mb-2">{t('about.title')}</h1>
        <p className="text-[#9ca3af]">{t('about.subtitle')}</p>
      </div>

      <GlassCard className="p-6 space-y-4">
        <h2 className="text-lg text-[#e5e7eb]">{t('about.projectDescriptionTitle')}</h2>
        <p className="text-[#cbd5e1] leading-relaxed">
          {t('about.projectDescriptionBody')}
        </p>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#e5e7eb]">
            <Package size={18} />
            <h3 className="text-base">{t('about.buildTitle')}</h3>
          </div>
          <p className="text-sm text-[#9ca3af]">{t('about.version')}: <span className="text-[#e5e7eb]">{version}</span></p>
          <p className="text-sm text-[#9ca3af]">{t('about.buildDate')}: <span className="text-[#e5e7eb]">{buildDate}</span></p>
        </GlassCard>

        <GlassCard className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#e5e7eb]">
            <Github size={18} />
            <h3 className="text-base">GitHub</h3>
          </div>

          {!githubRepo ? (
            <p className="text-sm text-[#9ca3af]">{t('about.githubRepoHint')}</p>
          ) : (
            <>
              <p className="text-sm text-[#9ca3af]">{t('about.repo')}: <a className="text-[#93c5fd] underline" href={`https://github.com/${githubRepo}`} target="_blank" rel="noreferrer">{githubRepo}</a></p>
              {loading ? <p className="text-sm text-[#9ca3af]">{t('about.loadingStats')}</p> : null}
              {error ? (
                <p className="text-sm text-[#fca5a5] flex items-center gap-2"><AlertCircle size={14} />{error}</p>
              ) : null}
              {stats ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[10px] bg-[rgba(255,255,255,0.05)] p-3 text-[#e5e7eb] flex items-center gap-2"><Star size={14} className="text-[#fbbf24]" /> {stats.stars} {t('about.stars')}</div>
                  <div className="rounded-[10px] bg-[rgba(255,255,255,0.05)] p-3 text-[#e5e7eb] flex items-center gap-2"><Eye size={14} className="text-[#93c5fd]" /> {stats.watchers} {t('about.watchers')}</div>
                  <div className="rounded-[10px] bg-[rgba(255,255,255,0.05)] p-3 text-[#e5e7eb] flex items-center gap-2"><GitFork size={14} className="text-[#86efac]" /> {stats.forks} {t('about.forks')}</div>
                  <div className="rounded-[10px] bg-[rgba(255,255,255,0.05)] p-3 text-[#e5e7eb] flex items-center gap-2"><AlertCircle size={14} className="text-[#fca5a5]" /> {stats.openIssues} {t('about.issues')}</div>
                </div>
              ) : null}
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
