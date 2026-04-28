import { Languages } from 'lucide-react';
import { useState } from 'react';

interface LanguageSelectorProps {
  language: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
}

export function LanguageSelector({ language, onLanguageChange }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 active:scale-95"
      >
        <Languages className="size-5 text-blue-400" />
        <span className="text-white font-medium">{currentLanguage?.flag}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors ${
                  language === lang.code ? 'bg-blue-500/20 border-l-2 border-blue-400' : ''
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className={`text-sm font-medium ${language === lang.code ? 'text-blue-400' : 'text-white'}`}>
                  {lang.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
