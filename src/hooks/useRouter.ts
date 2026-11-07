import { useState, useEffect, useCallback, useMemo } from 'react';

export type RouteType =
  | 'home'
  | 'search'
  | 'anime-detail'
  | 'calendar'
  | 'season'
  | 'genre'
  | 'favorites'
  | 'channels'
  | 'about'
  | 'not-found';

export interface RouteMatch {
  type: RouteType;
  params: Record<string, string>;
}

export function parsePath(pathname: string): RouteMatch {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (cleanPath === '/' || cleanPath === '/index.html') {
    return { type: 'home', params: {} };
  }
  if (cleanPath === '/recherche') {
    return { type: 'search', params: {} };
  }
  if (cleanPath === '/calendrier') {
    return { type: 'calendar', params: {} };
  }
  if (cleanPath === '/favoris') {
    return { type: 'favorites', params: {} };
  }
  if (cleanPath === '/canaux') {
    return { type: 'channels', params: {} };
  }
  if (cleanPath === '/a-propos') {
    return { type: 'about', params: {} };
  }

  // /anime/:id
  const animeMatch = cleanPath.match(/^\/anime\/(\d+)/);
  if (animeMatch) {
    return { type: 'anime-detail', params: { id: animeMatch[1] } };
  }

  // /saison/:annee/:saison
  const saisonMatch = cleanPath.match(/^\/saison\/(\d{4})\/([a-zA-Z0-9_-]+)/);
  if (saisonMatch) {
    return { type: 'season', params: { annee: saisonMatch[1], saison: saisonMatch[2] } };
  }

  // /genre/:slug
  const genreMatch = cleanPath.match(/^\/genre\/([a-zA-Z0-9_-]+)/);
  if (genreMatch) {
    return { type: 'genre', params: { slug: genreMatch[1] } };
  }

  return { type: 'not-found', params: {} };
}

export function useRouter() {
  const [currentUrl, setCurrentUrl] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search
  }));

  useEffect(() => {
    const handlePopState = () => {
      setCurrentUrl({
        pathname: window.location.pathname,
        search: window.location.search
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean; scrollToTop?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }

    setCurrentUrl({
      pathname: window.location.pathname,
      search: window.location.search
    });

    if (options?.scrollToTop !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(currentUrl.search), [currentUrl.search]);
  const route = useMemo(() => parsePath(currentUrl.pathname), [currentUrl.pathname]);

  return {
    pathname: currentUrl.pathname,
    search: currentUrl.search,
    searchParams,
    route,
    navigate
  };
}
