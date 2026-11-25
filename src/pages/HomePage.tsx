import { tr } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Clock,
  Flame,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Bot,
  Star,
  History,
  Trash2,
  Play
} from 'lucide-react';
import { anilist, QUERY_SORTIES_24H, QUERY_ACCUEIL_SECTIONS, fetchSurpriseAnime } from '../lib/anilist';
import { AiringScheduleItem, AnimeMedia } from '../lib/types';
import { AnimeCard } from '../components/AnimeCard';
import { formatCompteARebours, heureCameroun, titreDe, nettoyerDescription } from '../lib/format';
import { getSaisonCourante, FORMATS } from '../lib/config';
import { lireAnimesRecents, effacerAnimesRecents, RecentAnimeItem } from '../lib/history';
import { lireFavoris } from '../lib/favoris';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sorties24h, setSorties24h] = useState<AiringScheduleItem[]>([]);
  const [tendances, setTendances] = useState<AnimeMedia[]>([]);
  const [saisonPopulaires, setSaisonPopulaires] = useState<AnimeMedia[]>([]);
  const [chargement, setChargement] = useState(true);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Math.floor(Date.now() / 1000));
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightPaused, setSpotlightPaused] = useState(false);
  const [recents, setRecents] = useState<RecentAnimeItem[]>(() => lireAnimesRecents());
  const [favorisList, setFavorisList] = useState(() => lireFavoris());

  const saisonCourante = getSaisonCourante();

  // Horloge compte à rebours chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenant(Math.floor(Date.now() / 1000));
    }, 1000);

    const syncLocalDiscovery = () => {
      setRecents(lireAnimesRecents());
      setFavorisList(lireFavoris());
    };
    window.addEventListener('animealert:recent-change', syncLocalDiscovery);
    window.addEventListener('favoris:change', syncLocalDiscovery);

    return () => {
      clearInterval(timer);
      window.removeEventListener('animealert:recent-change', syncLocalDiscovery);
      window.removeEventListener('favoris:change', syncLocalDiscovery);
    };
  }, []);

  // Chargement des données d'accueil
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setChargement(true);
      const debut = Math.floor(Date.now() / 1000);
      const fin = debut + 86400;

      try {
        const [sortiesRes, sectionsRes] = await Promise.all([
          anilist(QUERY_SORTIES_24H, { debut, fin }).catch(() => ({ Page: { airingSchedules: [] } })),
          anilist(QUERY_ACCUEIL_SECTIONS, {
            season: saisonCourante.id,
            seasonYear: saisonCourante.annee
          }).catch(() => ({ tendances: { media: [] }, saison: { media: [] } }))
        ]);

        if (ignore) return;

        const items: AiringScheduleItem[] = (sortiesRes?.Page?.airingSchedules || [])
          .filter((i: any) => !i.media.isAdult)
          .sort((a: any, b: any) => (b.media.popularity || 0) - (a.media.popularity || 0))
          .slice(0, 6)
          .sort((a: any, b: any) => a.airingAt - b.airingAt);

        setSorties24h(items);
        setTendances(sectionsRes?.tendances?.media || []);
        setSaisonPopulaires(sectionsRes?.saison?.media || []);
      } catch (err) {
        console.warn('Chargement accueil interrompu:', err);
      } finally {
        if (!ignore) setChargement(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [saisonCourante.id, saisonCourante.annee]);

  const spotlightList = tendances.slice(0, 5);

  // Auto-rotation du carrousel Spotlight
  useEffect(() => {
    if (spotlightPaused || spotlightList.length <= 1) return;
    const id = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightList.length);
    }, 6500);
    return () => clearInterval(id);
  }, [spotlightPaused, spotlightList.length]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchTerm.trim();
    if (clean) {
      onNavigate(`/recherche?q=${encodeURIComponent(clean)}`);
    }
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

  const suggestions = ['One Piece', 'Frieren', 'Demon Slayer', 'Solo Leveling', 'Jujutsu Kaisen'];

  // Fusionner "Reprendre ma découverte" (derniers consultés + favoris avec progression)
  const favProgressMap = new Map(favorisList.map((f) => [f.id, f]));
  const continueItems: Array<{
    id: number;
    titre: string;
    affiche?: string;
    episodesVus: number;
    episodesTotal?: number | null;
    noteAniList?: number | null;
  }> = [];
  const seenIds = new Set<number>();

  for (const r of recents) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const fav = favProgressMap.get(r.id);
    continueItems.push({
      id: r.id,
      titre: r.titre,
      affiche: r.affiche || fav?.affiche,
      episodesVus: fav?.episodesVus || 0,
      episodesTotal: r.episodesTotal ?? fav?.episodesTotal,
      noteAniList: r.noteAniList ?? fav?.noteAniList
    });
  }
  for (const f of favorisList) {
    if (seenIds.has(f.id) || !(f.episodesVus && f.episodesVus > 0)) continue;
    seenIds.add(f.id);
    continueItems.push({
      id: f.id,
      titre: f.titre,
      affiche: f.affiche,
      episodesVus: f.episodesVus || 0,
      episodesTotal: f.episodesTotal,
      noteAniList: f.noteAniList
    });
  }

  const activeSpotlight = spotlightList[spotlightIndex % Math.max(1, spotlightList.length)];

  return (
    <div className="space-y-10">
      {/* Hero Section & Search */}
      <section className="relative pt-4 sm:pt-8 pb-2">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF]">
              <span className="w-2 h-2 rounded-full bg-[#FFC83D]"></span>
              <span>{tr("Édition Buea & Cameroun · Heure locale UTC+1", "Buea & Cameroon Edition · Local time UTC+1")}</span>
            </div>
            <a
              href="https://t.me/animealert_buea_bot"
              target="_blank"
              rel="noopener noreferrer"
              title="@animealert_buea_bot"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF] border border-[#2B50FF]/30 transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-[#FFC83D]" />
              <span>Bot Telegram</span>
            </a>
          </div>

          <h1 className="font-['Bricolage_Grotesque'] text-3xl sm:text-5xl font-extrabold tracking-tight text-[#14213D] dark:text-[#EEF1F8] leading-[1.08] text-balance">
            {tr("Cherche un anime, compare ses notes, ne rate aucune sortie.", "Search for an anime, compare its ratings, never miss a release.")}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[#55607A] dark:text-[#A3AEC8] leading-relaxed max-w-2xl">
            {tr("Toutes les notes croisées (AniList, MyAnimeList, IMDb/OMDb), le compte à rebours des sorties heure du Cameroun, et tes rappels sur Telegram.", "All ratings side by side (AniList, MyAnimeList, IMDb/OMDb), countdowns to releases in Cameroon time, and your reminders on Telegram.")}
          </p>

          {/* Formulaire de recherche */}
          <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#55607A] dark:text-[#A3AEC8]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={tr("Ex. One Piece, Frieren, Jujutsu Kaisen...", "E.g. One Piece, Frieren, Jujutsu Kaisen...")}
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] placeholder-[#55607A]/60 focus:border-[#2B50FF] dark:focus:border-[#7F95FF] outline-none text-base transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#2B50FF] text-white font-semibold hover:brightness-105 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-[#2B50FF]/25"
            >
              <Search className="w-4 h-4" />
              <span>{tr("Chercher", "Search")}</span>
            </button>
            <button
              type="button"
              onClick={handleSurprise}
              disabled={surpriseLoading}
              className="px-4 py-3 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] font-semibold hover:border-[#2B50FF] transition-all text-sm flex items-center justify-center gap-1.5"
              title={tr("Ouvrir un anime au hasard", "Open a random anime")}
            >
              <Sparkles className={`w-4 h-4 text-[#FFC83D] ${surpriseLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Surprise</span>
            </button>
          </form>

          {/* Suggestions instantanées */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#55607A] dark:text-[#A3AEC8]">
            <span className="font-medium">{tr("Populaires :", "Popular:")}</span>
            {suggestions.map((titre) => (
              <button
                key={titre}
                type="button"
                onClick={() => onNavigate(`/recherche?q=${encodeURIComponent(titre)}`)}
                className="px-2.5 py-1 rounded-full bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] dark:hover:border-[#7F95FF] text-[#14213D] dark:text-[#EEF1F8] transition-colors"
              >
                {titre}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Spotlight Carousel + Top 5 Tendances */}
      {!chargement && activeSpotlight && (
        <section
          className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-stretch"
          onMouseEnter={() => setSpotlightPaused(true)}
          onMouseLeave={() => setSpotlightPaused(false)}
        >
          {/* Spotlight Card */}
          <div className="relative rounded-3xl overflow-hidden bg-[#14213D] border border-[#D5DBE8] dark:border-[#27324D] min-h-[290px] sm:min-h-[330px] flex flex-col justify-end p-5 sm:p-7 shadow-lg">
            {(activeSpotlight.bannerImage || activeSpotlight.coverImage?.extraLarge || activeSpotlight.coverImage?.large) && (
              <img
                src={activeSpotlight.bannerImage || activeSpotlight.coverImage?.extraLarge || activeSpotlight.coverImage?.large || ''}
                alt={titreDe(activeSpotlight.title)}
                className="absolute inset-0 w-full h-full object-cover opacity-55 transition-opacity duration-500"
                referrerPolicy="no-referrer"
                decoding="async"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1322] via-[#0D1322]/75 to-[#0D1322]/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0D1322]/90 via-[#0D1322]/40 to-transparent" />

            {/* Top controls */}
            <div className="relative z-10 flex items-center justify-between mb-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFC83D] text-[#14213D] text-xs font-extrabold">
                <Flame className="w-3.5 h-3.5" />
                <span>#{spotlightIndex + 1} {tr('À la une', 'Spotlight')}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSpotlightIndex((prev) => (prev - 1 + spotlightList.length) % spotlightList.length)}
                  className="p-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white border border-white/15 transition-colors"
                  aria-label={tr('Précédent', 'Previous')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSpotlightIndex((prev) => (prev + 1) % spotlightList.length)}
                  className="p-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-white border border-white/15 transition-colors"
                  aria-label={tr('Suivant', 'Next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Spotlight Content */}
            <div className="relative z-10 max-w-xl space-y-2.5 text-white mt-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                {activeSpotlight.format && (
                  <span className="px-2 py-0.5 rounded-md bg-white/15 font-semibold">
                    {FORMATS[activeSpotlight.format] || activeSpotlight.format}
                  </span>
                )}
                {activeSpotlight.seasonYear && <span>{activeSpotlight.seasonYear}</span>}
                {activeSpotlight.episodes && (
                  <span>· {activeSpotlight.episodes} {tr('ép.', 'ep.')}</span>
                )}
                {activeSpotlight.duration && <span>· {activeSpotlight.duration} min</span>}
                {activeSpotlight.averageScore && (
                  <span className="inline-flex items-center gap-1 text-[#FFC83D] font-bold">
                    · <Star className="w-3.5 h-3.5 fill-[#FFC83D]" /> {(activeSpotlight.averageScore / 10).toFixed(1)}
                  </span>
                )}
              </div>

              <h2 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold leading-tight line-clamp-2">
                {titreDe(activeSpotlight.title)}
              </h2>

              {activeSpotlight.description && (
                <p className="text-xs sm:text-sm text-white/75 line-clamp-2 leading-relaxed">
                  {nettoyerDescription(activeSpotlight.description)}
                </p>
              )}

              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => onNavigate(`/anime/${activeSpotlight.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2B50FF] text-white text-xs sm:text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#2B50FF]/30"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{tr('Voir la fiche & notes', 'View details & ratings')}</span>
                </button>

                {/* Dots */}
                <div className="flex items-center gap-1.5">
                  {spotlightList.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSpotlightIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === spotlightIndex ? 'w-6 bg-[#FFC83D]' : 'w-2 bg-white/35 hover:bg-white/60'
                      }`}
                      aria-label={`${tr('Diapositive', 'Slide')} ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Tendances Sidebar */}
          <aside className="rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-['Bricolage_Grotesque'] text-sm font-extrabold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>{tr('Top 5 cette semaine', 'Top 5 this week')}</span>
              </h3>
              <button
                onClick={() => onNavigate('/recherche?tri=TRENDING_DESC')}
                className="text-[11px] font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline"
              >
                {tr('Tout voir', 'See all')}
              </button>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-between">
              {spotlightList.map((item, idx) => {
                const isActive = idx === spotlightIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(`/anime/${item.id}`)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 border border-[#2B50FF]/30'
                        : 'hover:bg-[#F2F4F8] dark:hover:bg-[#0D1322]/70 border border-transparent'
                    }`}
                  >
                    <span
                      className={`font-['Bricolage_Grotesque'] text-sm font-extrabold w-5 text-center tabular-nums ${
                        idx === 0 ? 'text-[#FFC83D]' : 'text-[#55607A] dark:text-[#A3AEC8]'
                      }`}
                    >
                      0{idx + 1}
                    </span>
                    {item.coverImage?.large && (
                      <img
                        src={item.coverImage.large}
                        alt={titreDe(item.title)}
                        className="w-9 h-12 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] line-clamp-1">
                        {titreDe(item.title)}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
                        {item.averageScore && (
                          <span className="inline-flex items-center gap-0.5 text-[#14213D] dark:text-[#EEF1F8] font-semibold">
                            <Star className="w-3 h-3 fill-[#FFC83D] text-[#FFC83D]" />
                            {(item.averageScore / 10).toFixed(1)}
                          </span>
                        )}
                        {item.episodes && (
                          <span>· {item.episodes} {tr('ép.', 'ep.')}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </section>
      )}

      {/* Section : Reprendre ma découverte (100% localStorage, sans administration) */}
      {continueItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
              <h2 className="font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
                {tr("Reprendre ma découverte", "Continue watching & browsing")}
              </h2>
            </div>
            {recents.length > 0 && (
              <button
                type="button"
                onClick={effacerAnimesRecents}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#55607A] dark:text-[#A3AEC8] hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{tr("Effacer l'historique", "Clear history")}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {continueItems.slice(0, 6).map((item) => {
              const pct =
                item.episodesTotal && item.episodesTotal > 0
                  ? Math.min(100, Math.round((item.episodesVus / item.episodesTotal) * 100))
                  : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(`/anime/${item.id}`)}
                  className="group text-left flex flex-col rounded-2xl overflow-hidden bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] transition-all"
                >
                  <div className="relative aspect-[3/4] w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    {item.affiche && (
                      <img
                        src={item.affiche}
                        alt={item.titre}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6">
                      <span className="text-[10px] font-bold text-[#FFC83D]">
                        {item.episodesVus > 0
                          ? `${tr('Ép.', 'Ep.')} ${item.episodesVus}${item.episodesTotal ? ` / ${item.episodesTotal}` : ''}`
                          : tr('Consulté récemment', 'Recently viewed')}
                      </span>
                      {pct > 0 && (
                        <div className="mt-1 h-1 w-full rounded-full bg-white/25 overflow-hidden">
                          <div className="h-full bg-[#2B50FF]" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] line-clamp-1 group-hover:text-[#2B50FF] dark:group-hover:text-[#7F95FF]">
                      {item.titre}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Section : Sorties des prochaines 24h avec compte à rebours */}
      {sorties24h.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
                <h2 className="font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
                  {tr("Ça sort dans les prochaines 24h", "Coming out in the next 24h")}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
                {tr("Comptes à rebours en temps réel · Heure locale du Cameroun (Africa/Douala).", "Real-time countdowns · Cameroon local time (Africa/Douala).")}
              </p>
            </div>
            <button
              onClick={() => onNavigate('/calendrier')}
              className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
            >
              <span>{tr("Planning 7 jours", "7-day schedule")}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {sorties24h.map((item) => {
              const diff = item.airingAt - maintenant;
              const title = titreDe(item.media.title);
              const timeStr = heureCameroun(item.airingAt);

              return (
                <div
                  key={`${item.id}-${item.episode}`}
                  onClick={() => onNavigate(`/anime/${item.media.id}`)}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl bg-[#1F3FD6] text-white hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-[#1F3FD6]/20 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#FFC83D] tabular-nums tracking-tight">
                      {formatCompteARebours(diff)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-semibold whitespace-nowrap">
                      {tr('Épisode', 'Episode')} {item.episode}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-1 group-hover:underline">
                      {title}
                    </h3>
                    <p className="text-xs text-white/80 mt-1">
                      {tr("Diffusion prévue à", "Airing at")} <span className="font-bold text-white">{timeStr}</span> {tr("(Cameroun)", "(Cameroon)")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section : Tendances cette semaine */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
              {tr("Tendances de la semaine", "Trending this week")}
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/recherche?tri=TRENDING_DESC')}
            className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
          >
            <span>{tr("Explorer plus", "Explore more")}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {chargement ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tendances.slice(0, 8).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </section>

      {/* Section : Saison en cours */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
            <h2 className="font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
              {tr('Saison', 'Season')} {saisonCourante.label} {saisonCourante.annee}
            </h2>
          </div>
          <button
            onClick={() => onNavigate(`/saison/${saisonCourante.annee}/${saisonCourante.slug}`)}
            className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
          >
            <span>{tr("Voir toute la saison", "See the whole season")}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {chargement ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {saisonPopulaires.slice(0, 8).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </section>

      {/* Section : Canaux Telegram & Bot Preview */}
      <section className="p-6 rounded-2xl bg-gradient-to-br from-[#14213D] to-[#1F3FD6] text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-[#FFC83D]">
              <Bot className="w-3.5 h-3.5" />
              <span>{tr("Bot & Communauté Otaku Buea", "Bot & Buea Otaku Community")}</span>
            </div>
            <h2 className="font-['Bricolage_Grotesque'] text-2xl font-bold">
              {tr("Active le Bot AnimeAlert", "Activate the AnimeAlert Bot")}
            </h2>
            <p className="text-sm text-white/80 max-w-xl">
              {tr("Reçois des alertes 15 minutes avant la sortie des épisodes en heure du Cameroun et rejoins nos canaux d'échange.", "Get alerts 15 minutes before episodes air, in Cameroon time, and join our discussion channels.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://t.me/animealert_buea_bot"
              target="_blank"
              rel="noopener noreferrer"
              title="@animealert_buea_bot"
              className="px-5 py-2.5 rounded-xl bg-[#FFC83D] text-[#14213D] font-bold text-sm hover:brightness-105 active:scale-95 transition-all whitespace-nowrap shadow-md inline-flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-[#14213D]" />
              <span>{tr("Démarrer le Bot", "Start the Bot")}</span>
            </a>
            <button
              onClick={() => onNavigate('/canaux')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all whitespace-nowrap"
            >
              {tr("Voir les canaux", "See the channels")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
