import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Clock, Flame, Calendar, Send, ChevronRight, Play, Bot } from 'lucide-react';
import { anilist, QUERY_SORTIES_24H, QUERY_ACCUEIL_SECTIONS, fetchSurpriseAnime } from '../lib/anilist';
import { AiringScheduleItem, AnimeMedia } from '../lib/types';
import { AnimeCard } from '../components/AnimeCard';
import { formatCompteARebours, heureCameroun, titreDe, esc } from '../lib/format';
import { getSaisonCourante, CONFIG } from '../lib/config';

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

  const saisonCourante = getSaisonCourante();

  // Horloge compte à rebours chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenant(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
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

        // Filtrer et trier les sorties des prochaines 24h
        const items: AiringScheduleItem[] = (sortiesRes?.Page?.airingSchedules || [])
          .filter((i: any) => !i.media.isAdult)
          .sort((a: any, b: any) => (b.media.popularity || 0) - (a.media.popularity || 0))
          .slice(0, 6)
          .sort((a: any, b: any) => a.airingAt - b.airingAt);

        setSorties24h(items);
        setTendances(sectionsRes?.tendances?.media || []);
        setSaisonPopulaires(sectionsRes?.saison?.media || []);
      } catch (err) {
        console.error('Erreur chargement accueil:', err);
      } finally {
        if (!ignore) setChargement(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [saisonCourante.id, saisonCourante.annee]);

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

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-10 pb-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF]">
              <span className="w-2 h-2 rounded-full bg-[#FFC83D]"></span>
              <span>Édition Buea & Cameroun · Heure locale UTC+1</span>
            </div>
            <a
              href="https://t.me/AnimeAlert"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF] border border-[#2B50FF]/30 transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-[#FFC83D]" />
              <span>Bot Telegram : @AnimeAlert</span>
            </a>
          </div>

          <h1 className="font-['Bricolage_Grotesque'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#14213D] dark:text-[#EEF1F8] leading-[1.08] text-balance">
            Cherche un anime, compare ses notes, ne rate aucune sortie.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#55607A] dark:text-[#A3AEC8] leading-relaxed max-w-2xl">
            Toutes les notes croisées (AniList, MyAnimeList, IMDb), le compte à rebours précis des sorties heure du Cameroun, et tes rappels sur Telegram.
          </p>

          {/* Formulaire de recherche */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#55607A] dark:text-[#A3AEC8]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex. One Piece, Frieren, Jujutsu Kaisen..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] placeholder-[#55607A]/60 focus:border-[#2B50FF] dark:focus:border-[#7F95FF] outline-none text-base transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 rounded-xl bg-[#2B50FF] text-white font-semibold hover:brightness-105 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-[#2B50FF]/25"
            >
              <Search className="w-4 h-4" />
              <span>Chercher</span>
            </button>
            <button
              type="button"
              onClick={handleSurprise}
              disabled={surpriseLoading}
              className="px-4 py-3.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] font-semibold hover:border-[#2B50FF] transition-all text-sm flex items-center justify-center gap-1.5"
              title="Ouvrir un anime au hasard"
            >
              <Sparkles className={`w-4 h-4 text-[#FFC83D] ${surpriseLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Surprise</span>
            </button>
          </form>

          {/* Suggestions instantanées */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-[#55607A] dark:text-[#A3AEC8]">
            <span className="font-medium">Populaires :</span>
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

      {/* Section : Sorties des prochaines 24h avec compte à rebours */}
      {sorties24h.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
                <h2 className="font-['Bricolage_Grotesque'] text-xl sm:text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
                  Ça sort dans les prochaines 24h
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
                Comptes à rebours en temps réel · Heure locale du Cameroun (Africa/Douala).
              </p>
            </div>
            <button
              onClick={() => onNavigate('/calendrier')}
              className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
            >
              <span>Planning 7 jours</span>
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
                      Épisode {item.episode}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-base sm:text-lg leading-snug line-clamp-1 group-hover:underline">
                      {title}
                    </h3>
                    <p className="text-xs text-white/80 mt-1">
                      Diffusion prévue à <span className="font-bold text-white">{timeStr}</span> (Cameroun)
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
              Tendances de la semaine
            </h2>
          </div>
          <button
            onClick={() => onNavigate('/recherche?tri=TRENDING_DESC')}
            className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
          >
            <span>Explorer plus</span>
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
              Saison {saisonCourante.label} {saisonCourante.annee}
            </h2>
          </div>
          <button
            onClick={() => onNavigate(`/saison/${saisonCourante.annee}/${saisonCourante.slug}`)}
            className="text-xs sm:text-sm font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline flex items-center gap-1"
          >
            <span>Voir toute la saison</span>
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
      <section className="p-6 rounded-3xl bg-gradient-to-br from-[#14213D] to-[#1F3FD6] text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-[#FFC83D]">
              <Bot className="w-3.5 h-3.5" />
              <span>Bot & Communauté Otaku Buea</span>
            </div>
            <h2 className="font-['Bricolage_Grotesque'] text-2xl font-bold">
              Active le Bot Telegram @AnimeAlert
            </h2>
            <p className="text-sm text-white/80 max-w-xl">
              Reçois des alertes 15 minutes avant la sortie des épisodes en heure du Cameroun et rejoins nos canaux d'échange.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://t.me/AnimeAlert"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#FFC83D] text-[#14213D] font-bold text-sm hover:brightness-105 active:scale-95 transition-all whitespace-nowrap shadow-md inline-flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-[#14213D]" />
              <span>Démarrer le Bot (@AnimeAlert)</span>
            </a>
            <button
              onClick={() => onNavigate('/canaux')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all whitespace-nowrap"
            >
              Voir les canaux
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
