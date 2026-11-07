import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Search, Filter, RotateCcw, ChevronLeft, ChevronRight, X, Clock, History } from 'lucide-react';
import { anilist, QUERY_RECHERCHE_CATALOGUE } from '../lib/anilist';
import { AnimeMedia } from '../lib/types';
import { AnimeCard } from '../components/AnimeCard';
import { GENRES, GENRES_FR, FORMATS, STATUTS } from '../lib/config';
import {
  lireHistoriqueRecherche,
  ajouterHistoriqueRecherche,
  supprimerElementHistorique,
  effacerHistoriqueRecherche
} from '../lib/history';

interface SearchPageProps {
  searchParams: URLSearchParams;
  onNavigate: (path: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ searchParams, onNavigate }) => {
  const [isPending, startTransition] = useTransition();

  // Read URL params
  const qParam = searchParams.get('q') || '';
  const genreParam = searchParams.get('genre') || '';
  const anneeParam = searchParams.get('annee') || '';
  const formatParam = searchParams.get('format') || '';
  const statutParam = searchParams.get('statut') || '';
  const scoreMinParam = searchParams.get('scoreMin') || '';
  const triParam = searchParams.get('tri') || (qParam ? 'SEARCH_MATCH' : 'POPULARITY_DESC');
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local state for input
  const [searchInput, setSearchInput] = useState(qParam);
  const [medias, setMedias] = useState<AnimeMedia[]>([]);
  const [chargement, setChargement] = useState(true);
  const [pageInfo, setPageInfo] = useState<{ total: number; currentPage: number; lastPage: number; hasNextPage: boolean }>({
    total: 0,
    currentPage: 1,
    lastPage: 1,
    hasNextPage: false
  });
  const [historique, setHistorique] = useState<string[]>(() => lireHistoriqueRecherche());
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Keep input in sync with URL
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  // Push new URL params helper
  const updateUrl = useCallback(
    (newParams: Record<string, string | number | null | undefined>) => {
      const sp = new URLSearchParams(searchParams);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') {
          sp.delete(k);
        } else {
          sp.set(k, String(v));
        }
      });
      onNavigate(`/recherche?${sp.toString()}`);
    },
    [searchParams, onNavigate]
  );

  // Perform AniList search whenever filters in URL change
  useEffect(() => {
    let active = true;
    setChargement(true);

    const variables: Record<string, any> = {
      page: pageParam,
      perPage: 20,
      sort: [triParam]
    };

    if (qParam.trim()) {
      variables.search = qParam.trim();
      ajouterHistoriqueRecherche(qParam.trim());
      setHistorique(lireHistoriqueRecherche());
    }
    if (genreParam) variables.genre = genreParam;
    if (anneeParam) variables.seasonYear = parseInt(anneeParam, 10);
    if (formatParam) variables.format = formatParam;
    if (statutParam) variables.status = statutParam;
    if (scoreMinParam) variables.averageScore_greater = parseInt(scoreMinParam, 10);

    anilist(QUERY_RECHERCHE_CATALOGUE, variables)
      .then((data) => {
        if (!active) return;
        const page = data?.Page;
        setMedias(page?.media || []);
        if (page?.pageInfo) {
          setPageInfo({
            total: page.pageInfo.total || 0,
            currentPage: page.pageInfo.currentPage || 1,
            lastPage: page.pageInfo.lastPage || 1,
            hasNextPage: Boolean(page.pageInfo.hasNextPage)
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Erreur recherche:', err);
        setMedias([]);
      })
      .finally(() => {
        if (active) setChargement(false);
      });

    return () => {
      active = false;
    };
  }, [qParam, genreParam, anneeParam, formatParam, statutParam, scoreMinParam, triParam, pageParam]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ q: searchInput.trim(), page: 1 });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    onNavigate('/recherche?tri=POPULARITY_DESC');
  };

  const handleHistoryClick = (item: string) => {
    setSearchInput(item);
    updateUrl({ q: item, page: 1 });
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updated = supprimerElementHistorique(item);
    setHistorique(updated);
  };

  // Liste des années récentes
  const annees = Array.from({ length: 35 }, (_, i) => 2026 - i);

  const hasActiveFilters = Boolean(
    qParam || genreParam || anneeParam || formatParam || statutParam || scoreMinParam || triParam !== 'POPULARITY_DESC'
  );

  return (
    <div className="space-y-6">
      {/* Top Search Bar & Header */}
      <div>
        <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
          Recherche & Catalogue
        </h1>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
          Explore parmi des milliers d'animes avec filtres combinés et pagination.
        </p>

        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#55607A]" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Titre en français, romaji ou anglais..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] text-sm focus:border-[#2B50FF] dark:focus:border-[#7F95FF] outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateUrl({ q: '', page: 1 });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#55607A] hover:text-[#14213D] dark:hover:text-[#EEF1F8]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#2B50FF] text-white font-semibold text-xs sm:text-sm hover:brightness-105 transition-all shrink-0"
          >
            Filtrer
          </button>
          <button
            type="button"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            className="md:hidden px-3 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-1.5 text-xs font-semibold"
          >
            <Filter className="w-4 h-4" />
            <span>Filtres</span>
          </button>
        </form>

        {/* Historique de recherche (10 max) */}
        {historique.length > 0 && !qParam && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[#55607A] dark:text-[#A3AEC8]">
            <span className="flex items-center gap-1 mr-1">
              <History className="w-3.5 h-3.5" />
              <span>Historique :</span>
            </span>
            {historique.map((terme) => (
              <span
                key={terme}
                onClick={() => handleHistoryClick(terme)}
                className="group inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] text-[#14213D] dark:text-[#EEF1F8] cursor-pointer text-xs"
              >
                <span>{terme}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveHistoryItem(e, terme)}
                  className="opacity-40 group-hover:opacity-100 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => {
                effacerHistoriqueRecherche();
                setHistorique([]);
              }}
              className="text-[11px] hover:underline text-[#55607A] ml-2"
            >
              Effacer tout
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Filters bar (desktop/mobile) + Results */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Filters Sidebar */}
        <aside
          className={`space-y-4 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] ${
            showFiltersMobile ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#D5DBE8] dark:border-[#27324D]">
            <h2 className="text-sm font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-[#2B50FF]" />
              <span>Filtres de recherche</span>
            </h2>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
                title="Réinitialiser"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            )}
          </div>

          {/* Tri */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Trier par
            </label>
            <select
              value={triParam}
              onChange={(e) => updateUrl({ tri: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="POPULARITY_DESC">Popularité décroissante</option>
              <option value="SCORE_DESC">Meilleures notes</option>
              <option value="TRENDING_DESC">Tendances actuelles</option>
              <option value="START_DATE_DESC">Plus récents</option>
              {qParam && <option value="SEARCH_MATCH">Pertinence du texte</option>}
            </select>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Genre
            </label>
            <select
              value={genreParam}
              onChange={(e) => updateUrl({ genre: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="">Tous les genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {GENRES_FR[g] || g}
                </option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Format
            </label>
            <select
              value={formatParam}
              onChange={(e) => updateUrl({ format: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="">Tous formats</option>
              {Object.entries(FORMATS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Statut
            </label>
            <select
              value={statutParam}
              onChange={(e) => updateUrl({ statut: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUTS).map(([k, item]) => (
                <option key={k} value={k}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Année */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Année de sortie
            </label>
            <select
              value={anneeParam}
              onChange={(e) => updateUrl({ annee: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="">Toutes les années</option>
              {annees.map((an) => (
                <option key={an} value={an}>
                  {an}
                </option>
              ))}
            </select>
          </div>

          {/* Note minimale */}
          <div>
            <label className="block text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] mb-1">
              Note minimale (AniList)
            </label>
            <select
              value={scoreMinParam}
              onChange={(e) => updateUrl({ scoreMin: e.target.value, page: 1 })}
              className="w-full p-2 text-xs rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
            >
              <option value="">Toutes notes</option>
              <option value="60">60% et plus (6.0/10)</option>
              <option value="70">70% et plus (7.0/10)</option>
              <option value="75">75% et plus (7.5/10)</option>
              <option value="80">80% et plus (8.0/10)</option>
              <option value="85">85% et plus (8.5/10)</option>
            </select>
          </div>
        </aside>

        {/* Results Column */}
        <main className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8]">
            <span>
              {chargement ? (
                'Recherche en cours...'
              ) : (
                <>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">{pageInfo.total}</strong> animes trouvés
                  {pageInfo.lastPage > 1 && ` · Page ${pageInfo.currentPage} sur ${pageInfo.lastPage}`}
                </>
              )}
            </span>
          </div>

          {chargement ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : medias.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D] text-center space-y-3">
              <p className="text-base font-semibold text-[#14213D] dark:text-[#EEF1F8]">
                Aucun anime ne correspond à ces critères.
              </p>
              <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] max-w-sm mx-auto">
                Essaie d'élargir tes filtres ou vérifie l'orthographe du titre (titre japonais ou anglais).
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#2B50FF] text-white hover:brightness-105 transition-all"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {medias.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} onNavigate={onNavigate} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!chargement && pageInfo.lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                onClick={() => updateUrl({ page: Math.max(1, pageInfo.currentPage - 1) })}
                disabled={pageInfo.currentPage <= 1}
                className="p-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#2B50FF] transition-colors"
                title="Page précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-4 py-2 rounded-xl text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] tabular-nums">
                Page {pageInfo.currentPage} / {pageInfo.lastPage}
              </span>

              <button
                onClick={() => updateUrl({ page: Math.min(pageInfo.lastPage, pageInfo.currentPage + 1) })}
                disabled={!pageInfo.hasNextPage || pageInfo.currentPage >= pageInfo.lastPage}
                className="p-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#2B50FF] transition-colors"
                title="Page suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
