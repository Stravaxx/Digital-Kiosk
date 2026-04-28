import React, { useState } from 'react';
import { Box, Plus, Clock, Cloud, Rss, FileCode } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { useTranslation } from '../i18n';

export function Widgets() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);

  const widgetTypes = [
    { id: 'clock', name: 'Clock', icon: Clock, color: '#3b82f6' },
    { id: 'weather', name: 'Weather', icon: Cloud, color: '#22c55e' },
    { id: 'rss', name: 'RSS Feed', icon: Rss, color: '#f59e0b' },
    { id: 'html', name: 'Custom HTML', icon: FileCode, color: '#8b5cf6' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#e5e7eb] mb-2">Widgets</h1>
          <p className="text-[#9ca3af]">{t('widgets.subtitle')}</p>
        </div>
        <GlassButton onClick={() => setShowCreate(true)}>
          <Plus size={20} className="inline mr-2" />
          {t('widgets.create')}
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {widgetTypes.map((widget) => {
          const Icon = widget.icon;
          return (
            <GlassCard key={widget.id} className="p-6 hover:scale-[1.02] transition-all duration-200 cursor-pointer">
              <Icon size={40} className="mb-3" style={{ color: widget.color }} />
              <h3 className="text-[#e5e7eb] mb-1">{widget.name}</h3>
              <p className="text-[#9ca3af] text-sm">0 {t('widgets.configured')}</p>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="p-6">
        <div className="text-center py-20">
          <Box size={64} className="mx-auto text-[#9ca3af] opacity-50 mb-4" />
          <h3 className="text-lg text-[#e5e7eb] mb-2">{t('widgets.none')}</h3>
          <p className="text-[#9ca3af] mb-6">{t('widgets.noneHint')}</p>
          <GlassButton onClick={() => setShowCreate(true)}>
            <Plus size={20} className="inline mr-2" />
            {t('widgets.createFirst')}
          </GlassButton>
        </div>
      </GlassCard>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <GlassCard className="w-full max-w-lg p-6 m-4">
            <h2 className="text-xl text-[#e5e7eb] mb-4">{t('widgets.create')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[#e5e7eb] mb-2" htmlFor="widget-type">{t('widgets.type')}</label>
                <select id="widget-type" title="Widget Type" aria-label="Widget Type" className="w-full appearance-none bg-[#111827] border border-[rgba(255,255,255,0.18)] rounded-[16px] px-4 py-2 text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]">
                  <option className="bg-[#111827] text-[#e5e7eb]">Clock</option>
                  <option className="bg-[#111827] text-[#e5e7eb]">Weather</option>
                  <option className="bg-[#111827] text-[#e5e7eb]">RSS Feed</option>
                  <option className="bg-[#111827] text-[#e5e7eb]">News Ticker</option>
                  <option className="bg-[#111827] text-[#e5e7eb]">Custom HTML</option>
                  <option className="bg-[#111827] text-[#e5e7eb]">Markdown</option>
                </select>
              </div>
              <div>
                <label className="block text-[#e5e7eb] mb-2">{t('widgets.name')}</label>
                <input
                  type="text"
                  placeholder={t('widgets.namePlaceholder')}
                  className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[16px] px-4 py-2 text-[#e5e7eb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <GlassButton variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>
                  {t('common.close')}
                </GlassButton>
                <GlassButton className="flex-1" onClick={() => setShowCreate(false)}>
                  {t('widgets.create')}
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
