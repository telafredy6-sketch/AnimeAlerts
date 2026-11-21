import { tr, LOCALE } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import {
  Star,
  Heart,
  Share2,
  Calendar,
  Clock,
  Tv,
  CheckCircle2,
  Plus,
  Minus,
  Bell,
  Play,
  ExternalLink,
  ChevronLeft,
  Send,
  Building2,
  Users,
  Bot
} from 'lucide-react';
import { anilist, QUERY_FICHE_COMPLETE } from '../lib/anilist';
import { AnimeMedia } from '../lib/types';
import {
  titreDe,
  titreSecondaire,
  nettoyerDescription,
  heureCameroun,
  dateCamerounComplete,
  formatCompteARebours,
  lienTelegram
} from '../lib/format';
import { FORMATS, STATUTS, GENRES_FR } from '../lib/config';
import {
  estFavori,
  basculerFavori,
  lireProgression,
  sauvegarderProgression
} from '../lib/favoris';
import { fetchJikanScore, fetchOmdbRating, analyseNotes } from '../lib/notes';
import { isAnimeSubscribed, toggleAnimeSubscription } from '../lib/notifications';

interface AnimeDetailPageProps {
  id: string;
  onNavigate: (path: string) => void;
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({ id, onNavigate }) => {
  const animeId = parseInt(id, 10);
  const [anime, setAnime] = useState<AnimeMedia | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Scores
  const [malScore, setMalScore] = useState<number | null>(null);
  const [imdbRating, setImdbRating] = useState<string | null>(null);
  const [imdbId, setImdbId] = useState<string | undefined>(undefined);
  const [notesLoading, setNotesLoading] = useState(false);

  // Progression & Favoris
  const [isFav, setIsFav] = useState(false);
  const [episodesVus, setEpisodesVus] = useState(0);
  const [synopsisOuvert, setSynopsisOuvert] = useState(false);
  const [notificationActivee, setNotificationActivee] = useState(false);
  const [copieEffectuee, setCopieEffectuee] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Math.floor(Date.now() / 1000));

  // Horloge compte à rebours
  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenant(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch full anime details
  useEffect(() => {
    let ignore = false;
    setChargement(true);
    setErreur(null);

    anilist(QUERY_FICHE_COMPLETE, { id: animeId })
      .then((data) => {
        if (ignore) return;
        const media: AnimeMedia = data?.Media;
        if (!media) {
          setErreur("Anime introuvable.");
          return;
        }
        setAnime(media);

        // Init favori, progression & alerte push
        setIsFav(estFavori(animeId));
        setNotificationActivee(isAnimeSubscribed(animeId));
        const prog = lireProgression(animeId);
        setEpisodesVus(prog.episodesVus || 0);

        // Fetch companion notes (MyAnimeList & IMDb)
        setNotesLoading(true);
        const promises: Promise<any>[] = [];

        if (media.idMal) {
          promises.push(
            fetchJikanScore(media.idMal).then((score) => {
              if (!ignore) setMalScore(score);
            })
          );
        }

        const titles = [media.title?.english, media.title?.romaji].filter(Boolean) as string[];
        promises.push(
          fetchOmdbRating(titles).then((r) => {
            if (!ignore) {
              setImdbRating(r.rating);
              setImdbId(r.imdbId);
            }
          })
        );

        Promise.allSettled(promises).finally(() => {
          if (!ignore) setNotesLoading(false);
        });
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Erreur chargement anime:', err);
          setErreur(tr("Impossible de récupérer les détails de cet anime.", "Unable to load the details of this anime."));
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, [animeId]);

  const handleToggleFav = () => {
    if (!anime) return;
    const added = basculerFavori({
      id: anime.id,
      idMal: anime.idMal,
      titre: titreDe(anime.title),
      titreOriginal: anime.title?.native || anime.title?.romaji,
      affiche: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
      noteAniList: anime.averageScore,
      format: anime.format,
      episodesTotal: anime.episodes
    });
    setIsFav(added);
  };

  const handleChangerEpisodesVus = (nouveau: number) => {
    if (!anime) return;
    const total = anime.episodes || null;
    const capped = total ? Math.min(total, Math.max(0, nouveau)) : Math.max(0, nouveau);
    setEpisodesVus(capped);
    sauvegarderProgression(anime.id, capped, total);
  };

  const handlePartager = async () => {
    const titre = anime ? titreDe(anime.title) : 'AnimeAlert Buea';
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${titre} — AnimeAlert Buea`,
          text: tr(`Découvre les notes et les prochaines sorties de ${titre} sur AnimeAlert Buea :`, `Check out the ratings and upcoming releases of ${titre} on AnimeAlert Buea:`),
          url
        });
        return;
      } catch {
        // Fallback si annulation
      }
    }
    // Fallback presse-papier
    try {
      await navigator.clipboard.writeText(url);
      setCopieEffectuee(true);
      setTimeout(() => setCopieEffectuee(false), 2500);
    } catch {}
  };

  const handleActiverNotification = async () => {
    if (!anime) return;
    if (!('Notification' in window)) {
      alert(tr("Les notifications ne sont pas prises en charge par ce navigateur.", "Notifications are not supported by this browser."));
      return;
    }
    const res = await toggleAnimeSubscription(anime.id, titreDe(anime.title));
    setNotificationActivee(res.subscribed);
    if (res.permission === 'denied') {
      alert(tr("Les notifications sont bloquées par ton navigateur. Autorise-les dans les paramètres du site.", "Notifications are blocked by your browser. Allow them in site settings."));
    }
  };

  if (chargement) {
    return (
      <div className="space-y-6 animate-pulse py-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="h-80 w-full bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="md:col-span-2 h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (erreur || !anime) {
    return (
      <div className="p-8 text-center space-y-4 rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D] my-10">
        <p className="text-base font-bold text-[#14213D] dark:text-[#EEF1F8]">{erreur || "Anime introuvable."}</p>
        <button
          onClick={() => onNavigate('/recherche')}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#2B50FF] text-white hover:brightness-105"
        >
          {tr("Retour au catalogue", "Back to catalog")}
        </button>
      </div>
    );
  }

  const titre = titreDe(anime.title);
  const titreSec = titreSecondaire(anime.title);
  const aniScore = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const synopsisClean = nettoyerDescription(anime.description);
  const formatStr = anime.format ? FORMATS[anime.format] || anime.format : 'Format inconnu';
  const statusInfo = anime.status ? STATUTS[anime.status] : null;
  const studioPrincipal = anime.studios?.nodes?.[0]?.name;

  // Calcul prochain épisode
  const nextAir = anime.nextAiringEpisode;
  const secondesRestantes = nextAir ? nextAir.airingAt - maintenant : 0;

  // Comparatif des notes
  const analyse = analyseNotes(
    anime.averageScore ? anime.averageScore / 10 : null,
    malScore,
    imdbRating
  );

  const coverUrl = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const bannerUrl = anime.bannerImage || coverUrl;

  return (
    <div className="space-y-8 pb-12">
      {/* Bouton Retour rapide */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#55607A] dark:text-[#A3AEC8] hover:text-[#14213D] dark:hover:text-[#EEF1F8] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{tr("Retour", "Back")}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePartager}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-[#2B50FF]" />
            <span>{copieEffectuee ? tr('Lien copié !', 'Link copied!') : tr('Partager', 'Share')}</span>
          </button>
          <button
            onClick={handleToggleFav}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              isFav
                ? 'bg-rose-500 text-white shadow-md'
                : 'border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] hover:border-rose-400'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
            <span>{isFav ? tr('Dans tes favoris', 'In your favorites') : tr('Ajouter aux favoris', 'Add to favorites')}</span>
          </button>
        </div>
      </div>

      {/* Hero Banner Immersif */}
      <div className="relative rounded-3xl overflow-hidden bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D]">
        {/* Fond flouté */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-xl scale-105 pointer-events-none"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1322] via-[#0D1322]/80 to-transparent pointer-events-none" />

        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
          {/* Affiche HD */}
          <div className="relative w-36 sm:w-48 lg:w-56 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 bg-slate-900 mx-auto md:mx-0">
            {coverUrl && (
              <img
                src={coverUrl}
                alt={titre}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Informations principales */}
          <div className="flex-1 space-y-4 text-white">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70 mb-1.5">
                <span>{formatStr}</span>
                {anime.seasonYear && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{anime.season} {anime.seasonYear}</span>
                  </>
                )}
                {anime.episodes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{anime.episodes} {tr('épisodes', 'episodes')} ({anime.duration || 24} min)</span>
                  </>
                )}
                {statusInfo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#FFC83D]">{statusInfo.label}</span>
                  </>
                )}
              </div>

              <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-4xl font-extrabold leading-tight text-white tracking-tight">
                {titre}
              </h1>

              {titreSec && (
                <p className="text-xs sm:text-sm text-white/60 mt-1 font-medium">
                  {titreSec} {anime.title?.native ? `(${anime.title.native})` : ''}
                </p>
              )}
            </div>

            {/* Genres cliquables vers /genre/:slug */}
            {anime.genres && (
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => onNavigate(`/genre/${g.toLowerCase()}`)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {GENRES_FR[g] || g}
                  </button>
                ))}
              </div>
            )}

            {/* Studio & métadonnées supplémentaires */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/80 pt-2 border-t border-white/10">
              {studioPrincipal && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#FFC83D]" />
                  <span>{tr("Studio :", "Studio:")} <strong className="text-white">{studioPrincipal}</strong></span>
                </div>
              )}
              {anime.popularity && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#2B50FF]" />
                  <span>{tr("Popularité :", "Popularity:")} <strong className="text-white tabular-nums">{anime.popularity.toLocaleString(LOCALE)}</strong></span>
                </div>
              )}
            </div>

            {/* Prochain épisode si en cours */}
            {nextAir && (
              <div className="p-3.5 rounded-2xl bg-[#1F3FD6]/80 backdrop-blur-md border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-[#FFC83D] uppercase tracking-wider">
                    {tr("Prochaine diffusion au Cameroun", "Next airing in Cameroon")}
                  </span>
                  <p className="text-sm font-semibold text-white">
                    {tr('Épisode', 'Episode')} {nextAir.episode} {tr('le', 'on')} {dateCamerounComplete(nextAir.airingAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-['Bricolage_Grotesque'] text-xl font-extrabold text-[#FFC83D] tabular-nums">
                    {formatCompteARebours(secondesRestantes)}
                  </span>
                  <button
                    onClick={handleActiverNotification}
                    className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                    title={tr("M'avertir avant la sortie", "Notify me before release")}
                  >
                    <Bell className={`w-4 h-4 ${notificationActivee ? 'fill-[#FFC83D] text-[#FFC83D]' : ''}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Bouton d'alerte Bot Telegram */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <a
                href={`https://t.me/animealert_buea_bot?start=anime_${anime.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2B50FF] hover:bg-blue-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-[#2B50FF]/25 transition-all"
                title={tr("Suivre cet anime et recevoir un rappel de sortie", "Follow this anime and get a release reminder")}
              >
                <Bot className="w-4 h-4 text-[#FFC83D]" />
                <span>{tr("Recevoir les alertes de cet anime sur le Bot @animealert_buea_bot", "Get alerts for this anime on the Bot @animealert_buea_bot")}</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Phare : Comparaison Triple Notes (AniList / MyAnimeList / IMDb) */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
            <Star className="w-5 h-5 text-[#FFC83D] fill-[#FFC83D]" />
            <span>{tr("Comparatif officiel des notes communautaires", "Official comparison of community ratings")}</span>
          </h2>
          {notesLoading && (
            <span className="text-xs text-[#55607A] dark:text-[#A3AEC8] animate-pulse">
              {tr("Chargement MyAnimeList & IMDb...", "Loading MyAnimeList & IMDb...")}
            </span>
          )}
        </div>

        {/* Triple Jauge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* AniList */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
            <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] font-medium">
              <span>AniList</span>
              <span className="text-[11px]">{tr("Score sur 10", "Score out of 10")}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-['Bricolage_Grotesque'] text-3xl font-extrabold text-[#2B50FF] dark:text-[#7F95FF] tabular-nums">
                {aniScore || '—'}
              </span>
              <span className="text-xs text-[#55607A] dark:text-[#A3AEC8]">/ 10</span>
            </div>
            <p className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] mt-1">
              {tr("Communauté mondiale AniList", "AniList global community")}
            </p>
          </div>

          {/* MyAnimeList */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] font-medium">
              <span>MyAnimeList</span>
              {anime.idMal && (
                <a
                  href={`https://myanimelist.net/anime/${anime.idMal}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#2B50FF] dark:text-[#7F95FF] hover:underline inline-flex items-center gap-0.5"
                >
                  MAL <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-['Bricolage_Grotesque'] text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {malScore !== null ? malScore.toFixed(2) : '—'}
              </span>
              <span className="text-xs text-[#55607A] dark:text-[#A3AEC8]">/ 10</span>
            </div>
            <p className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] mt-1">
              {tr("Jikan API v4 vérifiée", "Jikan API v4 verified")}
            </p>
          </div>

          {/* IMDb */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] font-medium">
              <span>IMDb</span>
              <a
                href={
                  imdbId
                    ? `https://www.imdb.com/title/${imdbId}/`
                    : `https://www.imdb.com/find/?q=${encodeURIComponent(titre)}&s=tt`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                {tr("Fiche", "Page")} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-['Bricolage_Grotesque'] text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {imdbRating || '—'}
              </span>
              <span className="text-xs text-[#55607A] dark:text-[#A3AEC8]">/ 10</span>
            </div>
            <p className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] mt-1">
              {tr("Avis critiques & grand public", "Critic & general audience reviews")}
            </p>
          </div>
        </div>

        {/* Analyse comparative */}
        <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 text-xs sm:text-sm text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2B50FF] shrink-0"></span>
          <span className="font-medium">{analyse}</span>
        </div>
      </section>

      {/* Progression personnelle : Épisodes vus */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>{tr("Suivi de visionnage (Sauvegardé localement)", "Watch tracking (Saved locally)")}</span>
            </h2>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
              {anime.episodes ? (
                <>
                  {tr("Tu as vu", "You've watched")} <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">{episodesVus}</strong> {tr('sur', 'out of')}{' '}
                  <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">{anime.episodes}</strong> {tr('épisodes.', 'episodes.')}
                  {anime.episodes - episodesVus > 0 ? (
                    <span className="ml-1 text-[#2B50FF] font-semibold">
                      {tr(`(Il te reste ${anime.episodes - episodesVus} épisodes)`, `(${anime.episodes - episodesVus} episodes left)`)}
                    </span>
                  ) : (
                    <span className="ml-1 text-emerald-600 font-semibold">{tr("(Anime complété !)", "(Anime completed!)")}</span>
                  )}
                </>
              ) : (
                <>{tr("Tu en es à l'épisode", "You're at episode")} <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">{episodesVus}</strong>.</>
              )}
            </p>
          </div>

          {/* Stepper controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleChangerEpisodesVus(episodesVus - 1)}
              disabled={episodesVus <= 0}
              className="p-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] disabled:opacity-30 hover:border-[#2B50FF] transition-colors"
              title={tr("-1 épisode", "-1 episode")}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 font-['Bricolage_Grotesque'] font-bold text-base rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] tabular-nums">
              {episodesVus} {anime.episodes ? `/ ${anime.episodes}` : ''}
            </span>
            <button
              onClick={() => handleChangerEpisodesVus(episodesVus + 1)}
              disabled={anime.episodes ? episodesVus >= anime.episodes : false}
              className="p-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] disabled:opacity-30 hover:border-[#2B50FF] transition-colors"
              title={tr("+1 épisode", "+1 episode")}
            >
              <Plus className="w-4 h-4" />
            </button>
            {anime.episodes && (
              <button
                onClick={() => handleChangerEpisodesVus(anime.episodes!)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                {tr("Tout vu", "Mark all watched")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Synopsis complet */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-3">
        <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
          Synopsis
        </h2>
        <div className={`text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed whitespace-pre-line ${
          !synopsisOuvert && synopsisClean.length > 350 ? 'line-clamp-4' : ''
        }`}>
          {synopsisClean}
        </div>
        {synopsisClean.length > 350 && (
          <button
            onClick={() => setSynopsisOuvert(!synopsisOuvert)}
            className="text-xs font-bold text-[#2B50FF] dark:text-[#7F95FF] hover:underline"
          >
            {synopsisOuvert ? tr('Réduire', 'Show less') : tr('Lire la suite', 'Read more')}
          </button>
        )}
      </section>

      {/* Personnages Principaux */}
      {anime.characters?.edges && anime.characters.edges.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
            {tr("Personnages principaux", "Main characters")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {anime.characters.edges.map((edge) => {
              const char = edge.node;
              return (
                <div
                  key={char.id}
                  className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D]"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 mb-2 border border-[#D5DBE8] dark:border-[#27324D]">
                    {char.image?.medium && (
                      <img
                        src={char.image.medium}
                        alt={char.name.full}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-[#14213D] dark:text-[#EEF1F8] line-clamp-1">
                    {char.name.full}
                  </h4>
                  <span className="text-[10px] text-[#55607A] dark:text-[#A3AEC8] capitalize">
                    {edge.role.toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Bande-Annonce (Trailer) */}
      {anime.trailer?.id && anime.trailer.site === 'youtube' && (
        <section className="space-y-4">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
            <Play className="w-5 h-5 text-rose-500" />
            <span>{tr("Bande-annonce officielle", "Official trailer")}</span>
          </h2>
          <div className="aspect-video w-full max-w-3xl rounded-3xl overflow-hidden border border-[#D5DBE8] dark:border-[#27324D] bg-black shadow-lg">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${anime.trailer.id}`}
              title={tr(`Bande-annonce de ${titre}`, `Trailer of ${titre}`)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </section>
      )}

      {/* Où regarder (Plateformes de streaming officielles) */}
      {anime.externalLinks && anime.externalLinks.filter((l) => l.type === 'STREAMING').length > 0 && (
        <section className="space-y-4">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
            <Tv className="w-5 h-5 text-[#2B50FF]" />
            <span>{tr("Où regarder légalement", "Where to watch legally")}</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {anime.externalLinks
              .filter((l) => l.type === 'STREAMING')
              .map((link) => (
                <a
                  key={link.site}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] hover:text-[#2B50FF] transition-colors"
                >
                  <span>{link.site}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>
              ))}
          </div>
        </section>
      )}

      {/* Recommandations similaires */}
      {anime.recommendations?.nodes && anime.recommendations.nodes.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
            {tr('Animes recommandés si tu aimes', 'Anime recommended if you like')} {titre}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {anime.recommendations.nodes.slice(0, 6).map((node) => {
              const rec = node.mediaRecommendation;
              if (!rec) return null;
              const recTitle = titreDe(rec.title);
              const recScore = rec.averageScore ? (rec.averageScore / 10).toFixed(1) : null;
              return (
                <div
                  key={rec.id}
                  onClick={() => onNavigate(`/anime/${rec.id}`)}
                  className="group flex flex-col rounded-2xl overflow-hidden bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] cursor-pointer transition-all"
                >
                  <div className="aspect-[2/3] w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    {rec.coverImage?.large && (
                      <img
                        src={rec.coverImage.large}
                        alt={recTitle}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h4 className="text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] line-clamp-1 group-hover:text-[#2B50FF]">
                      {recTitle}
                    </h4>
                    {recScore && (
                      <span className="text-[10px] text-[#55607A] dark:text-[#A3AEC8] flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-[#FFC83D] text-[#FFC83D]" />
                        {recScore}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
