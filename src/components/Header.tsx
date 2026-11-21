import { tr, langue, changerLangue } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import { Heart, Sun, Moon, Monitor, Send, Sparkles, Bot } from 'lucide-react';
import { lireFavoris } from '../lib/favoris';
import { lireThemeActuel, appliquerTheme, ThemeMode } from '../lib/theme';
import { PWAInstallButton } from './PWAInstallButton';
import { AppLogo } from './AppLogo';
import { fetchSurpriseAnime } from '../lib/anilist';
import { lienBot } from '../lib/format';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const [favCount, setFavCount] = useState<number>(() => lireFavoris().length);
  const [theme, setTheme] = useState<ThemeMode>(() => lireThemeActuel());
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  useEffect(() => {
    const handleFavChange = (e: Event) => {
      const custom = e as CustomEvent<{ count: number }>;
      setFavCount(custom.detail?.count ?? lireFavoris().length);
    };

    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ mode: ThemeMode }>;
      if (custom.detail?.mode) setTheme(custom.detail.mode);
    };

    window.addEventListener('favoris:change', handleFavChange);
    window.addEventListener('animealert:theme-change', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('favoris:change', handleFavChange);
      window.removeEventListener('animealert:theme-change', handleThemeChange as EventListener);
    };
  }, []);

  const handleToggleTheme = () => {
    const sequence: ThemeMode[] = ['auto', 'dark', 'light'];
    const next = sequence[(sequence.indexOf(theme) + 1) % sequence.length];
    setTheme(next);
    appliquerTheme(next);
  };

  const handleSurprise = async () => {
    if (surpriseLoading) return;
    setSurpriseLoading(true);
    try {
      const id = await fetchSurpriseAnime();
      if (id) {
        onNavigate(`/anime/${id}`);
      }
    } finally {
      setSurpriseLoading(false);
    }
  };

  const botUrl = lienBot() || "https://t.me/animealert_buea_bot";

  const navLinks = [
    { label: tr('Accueil', 'Home'), path: '/' },
    { label: tr('Recherche', 'Search'), path: '/recherche' },
    { label: tr('Calendrier', 'Calendar'), path: '/calendrier' },
    {
      label: tr('Favoris', 'Favorites'),
      path: '/favoris',
      badge: favCount > 0 ? favCount : null
    },
    { label: tr('Canaux', 'Channels'), path: '/canaux' }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF]/90 dark:bg-[#161F35]/90 backdrop-blur-md transition-colors">
      <div className="w-[min(1180px,100%-2rem)] mx-auto flex items-center justify-between gap-4 md:gap-8 h-16">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2.5 text-left group whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#2B50FF]"
        >
          <AppLogo size={28} className="transition-transform group-hover:scale-105" />
          <span className="font-['Bricolage_Grotesque'] text-xl font-extrabold tracking-tight text-[#14213D] dark:text-[#EEF1F8]">
            AnimeAlert <span className="text-[#2B50FF] dark:text-[#7F95FF]">Buea</span>
          </span>
        </button>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium text-[#55607A] dark:text-[#A3AEC8]">
          {navLinks.map((link) => {
            const isActive =
              link.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(link.path);

            return (
              <button
                key={link.path}
                onClick={() => onNavigate(link.path)}
                className={`relative px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'text-[#2B50FF] dark:text-[#7F95FF] font-semibold bg-blue-50 dark:bg-blue-950/40'
                    : 'hover:text-[#14213D] dark:hover:text-[#EEF1F8] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {link.label}
                {link.badge !== null && link.badge !== undefined && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-[#FFC83D] text-[#14213D] tabular-nums">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions (Theme, Surprise, PWA, Bot CTA) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bouton Surprise-moi */}
          <button
            onClick={handleSurprise}
            disabled={surpriseLoading}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors whitespace-nowrap shrink-0"
            title={tr("Ouvrir un anime populaire au hasard", "Open a random popular anime")}
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#FFC83D] ${surpriseLoading ? 'animate-spin' : ''}`} />
            <span>Surprise</span>
          </button>

          {/* Sélecteur de langue FR / EN */}
          <button
            onClick={() => changerLangue(langue === 'fr' ? 'en' : 'fr')}
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors"
            title={tr('Changer de langue', 'Change language')}
            aria-label={tr('Changer de langue', 'Change language')}
          >
            {langue === 'fr' ? 'EN' : 'FR'}
          </button>

          {/* Theme switcher */}
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-lg border border-[#D5DBE8] dark:border-[#27324D] text-[#55607A] dark:text-[#A3AEC8] hover:text-[#14213D] dark:hover:text-[#EEF1F8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={`${tr('Thème', 'Theme')}: ${theme} ${tr('(Cliquer pour basculer)', '(Click to toggle)')}`}
            aria-label={tr("Basculer le thème", "Toggle theme")}
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#7F95FF]" />
            ) : theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Bot Telegram Direct CTA */}
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2B50FF] text-white text-xs font-semibold hover:brightness-105 active:scale-95 transition-all whitespace-nowrap shadow-sm shadow-[#2B50FF]/20"
            title={tr("Ouvrir le bot Telegram @animealert_buea_bot", "Open the Telegram bot @animealert_buea_bot")}
          >
            <Bot className="w-4 h-4 text-[#FFC83D]" />
            <span><span className="hidden sm:inline">Bot </span>@animealert_buea_bot</span>
          </a>
        </div>
      </div>
    </header>
  );
};

  
