import React, { useEffect, useState } from 'react';
import { useRouter } from './hooks/useRouter';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MobileNav } from './components/MobileNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { langue, Langue } from './lib/i18n';
import {
  checkUpcomingCameroonEpisodes,
  syncStateToServiceWorker
} from './lib/notifications';

// Pages
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { AnimeDetailPage } from './pages/AnimeDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SeasonPage } from './pages/SeasonPage';
import { GenrePage } from './pages/GenrePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  const { pathname, searchParams, route, navigate } = useRouter();
  const [, setActiveLang] = useState<Langue>(() => langue);

  // Sync Service Worker notification state, language & schedule Cameroon airing checks
  useEffect(() => {
    void syncStateToServiceWorker();
    void checkUpcomingCameroonEpisodes();

    const interval = setInterval(() => {
      void checkUpcomingCameroonEpisodes();
    }, 60 * 1000);

    const handleFavSync = () => {
      void syncStateToServiceWorker();
    };
    window.addEventListener('favoris:change', handleFavSync);

    const handleLangChange = (e: Event) => {
      const custom = e as CustomEvent<Langue>;
      setActiveLang(custom.detail || langue);
      void syncStateToServiceWorker();
    };
    window.addEventListener('animealert:lang-change', handleLangChange);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION' && typeof event.data.url === 'string') {
        navigate(event.data.url);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('favoris:change', handleFavSync);
      window.removeEventListener('animealert:lang-change', handleLangChange);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [navigate]);

  // Handle intercepting internal links (<a href="/...">) so they use SPA router
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      // If internal link starting with / and not an asset / tel / mailto
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !anchor.hasAttribute('download') &&
        anchor.target !== '_blank'
      ) {
        e.preventDefault();
        navigate(href);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] transition-colors duration-200">
      {/* Top Bar matching contract */}
      <Header currentPath={pathname} onNavigate={navigate} />

      {/* Main Content Area */}
      <main className="flex-1 w-[min(1180px,100%-2rem)] mx-auto py-6 sm:py-8">
        {route.type === 'home' && <HomePage onNavigate={navigate} />}
        {route.type === 'search' && (
          <SearchPage searchParams={searchParams} onNavigate={navigate} />
        )}
        {route.type === 'anime-detail' && (
          <AnimeDetailPage id={route.params.id} onNavigate={navigate} />
        )}
        {route.type === 'calendar' && <CalendarPage onNavigate={navigate} />}
        {route.type === 'season' && (
          <SeasonPage
            annee={route.params.annee}
            saisonSlug={route.params.saison}
            onNavigate={navigate}
          />
        )}
        {route.type === 'genre' && (
          <GenrePage slug={route.params.slug} onNavigate={navigate} />
        )}
        {route.type === 'favorites' && <FavoritesPage onNavigate={navigate} />}
        {route.type === 'channels' && <ChannelsPage onNavigate={navigate} />}
        {route.type === 'about' && <AboutPage onNavigate={navigate} />}
        {route.type === 'not-found' && <NotFoundPage onNavigate={navigate} />}
      </main>

      {/* Global Footer */}
      <Footer onNavigate={navigate} />

      {/* Touch-Friendly Ergonomic Bottom Navigation */}
      <MobileNav currentPath={pathname} onNavigate={navigate} />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
