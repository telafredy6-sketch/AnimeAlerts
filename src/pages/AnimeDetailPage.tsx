import { tr, LOCALE } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import {
  Star,
  Heart,
  Share2,
  CheckCircle2,
  Plus,
  Minus,
  Bell,
  Play,
  ExternalLink,
  ChevronLeft,
  Building2,
  Users,
  Bot,
  Trophy,
  Award,
  Music,
  GitBranch,
  Film,
  Tv
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
import {
  fetchJikanDetails,
  fetchJikanEpisodes,
  fetchOmdbDetails,
  fetchWikidataImdbAndAwards,
  analyseNotes,
  JikanDetails,
  JikanEpisodeItem,
  OmdbDetails,
  WikidataEnrichment
} from '../lib/notes';
import { isAnimeSubscribed, toggleAnimeSubscription } from '../lib/notifications';
import { ajouterAnimeRecent } from '../lib/history';
import { Search, Check } from 'lucide-react';

interface AnimeDetailPageProps {
  id: string;
  onNavigate: (path: string) => void;
}

export const AnimeDetailPage: React.FC<AnimeDetailPageProps> = ({ id, onNavigate }) => {
  const animeId = parseInt(id, 10);
  const [anime, setAnime] = useState<AnimeMedia | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Scores, OMDb, Wikidata & Jikan Full
  const [jikanDetails, setJikanDetails] = useState<JikanDetails | null>(null);
  const [omdbDetails, setOmdbDetails] = useState<OmdbDetails | null>(null);
  const [wikidata, setWikidata] = useState<WikidataEnrichment | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activeThemeTab, setActiveThemeTab] = useState<'op' | 'ed'>('op');

  // Épisodes (Jikan + streamingEpisodes)
  const [episodesList, setEpisodesList] = useState<JikanEpisodeItem[]>([]);
  const [episodesPage, setEpisodesPage] = useState(1);
  const [episodesHasNext, setEpisodesHasNext] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodeSort, setEpisodeSort] = useState<'asc' | 'desc'>('asc');

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
    setJikanDetails(null);
    setOmdbDetails(null);
    setWikidata(null);
    setEpisodesList([]);
    setEpisodesPage(1);
    setEpisodesHasNext(false);
    setEpisodeSearch('');

    anilist(QUERY_FICHE_COMPLETE, { id: animeId })
      .then((data) => {
        if (ignore) return;
        const media: AnimeMedia = data?.Media;
        if (!media) {
          setErreur(tr("Anime introuvable.", "Anime not found."));
          return;
        }
        setAnime(media);

        // Enregistrer dans "Reprendre ma découverte" (localStorage, sans admin)
        ajouterAnimeRecent({
          id: media.id,
          titre: titreDe(media.title),
          affiche: media.coverImage?.large || media.coverImage?.extraLarge || '',
          banniere: media.bannerImage,
          format: media.format,
          episodesTotal: media.episodes,
          noteAniList: media.averageScore
        });

        // Init favori, progression & alerte push
        setIsFav(estFavori(animeId));
        setNotificationActivee(isAnimeSubscribed(animeId));
        const prog = lireProgression(animeId);
        setEpisodesVus(prog.episodesVus || 0);

        // Fetch companion notes (MyAnimeList, Wikidata IMDb/Awards, Épisodes & OMDb)
        setNotesLoading(true);
        const titles = [media.title?.english, media.title?.romaji].filter(Boolean) as string[];

        const jikanPromise = media.idMal
          ? Promise.all([
              fetchJikanDetails(media.idMal).then((details) => {
                if (!ignore) setJikanDetails(details);
              }),
              fetchJikanEpisodes(media.idMal, 1).then((epRes) => {
                if (!ignore) {
                  setEpisodesList(epRes.episodes);
                  setEpisodesHasNext(epRes.hasNextPage);
                  setEpisodesPage(1);
                }
              })
            ])
          : Promise.resolve();

        const wikidataAndOmdbPromise = fetchWikidataImdbAndAwards(media.id, media.idMal).then(async (wd) => {
          if (ignore) return;
          setWikidata(wd);

          const omdb = await fetchOmdbDetails({
            titles,
            year: media.seasonYear,
            format: media.format,
            imdbId: wd.imdbId
          });
          if (!ignore) setOmdbDetails(omdb);
        });

        Promise.allSettled([jikanPromise, wikidataAndOmdbPromise]).finally(() => {
          if (!ignore) setNotesLoading(false);
        });
      })
      .catch((err) => {
        if (!ignore) {
          console.warn('Chargement anime interrompu:', err?.message || err);
          setErreur(tr("Impossible de récupérer les détails de cet anime pour le moment.", "Unable to load the details of this anime right now."));
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, [animeId, retryCount]);

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
        <p className="text-base font-bold text-[#14213D] dark:text-[#EEF1F8]">{erreur || tr("Anime introuvable.", "Anime not found.")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2B50FF] text-white hover:brightness-105 transition-all"
          >
            {tr("Réessayer", "Retry")}
          </button>
          <button
            onClick={() => onNavigate('/recherche')}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-all"
          >
            {tr("Retour au catalogue", "Back to catalog")}
          </button>
        </div>
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

  // Comparatif des notes & données OMDb / Jikan / Wikidata
  const malScore = jikanDetails?.score ?? null;
  const imdbRating = omdbDetails?.imdbRating ?? null;
  const resolvedImdbId = omdbDetails?.imdbId || wikidata?.imdbId;

  const analyse = analyseNotes(
    anime.averageScore ? anime.averageScore / 10 : null,
    malScore,
    imdbRating,
    {
      rankMal: jikanDetails?.rank,
      winsCount: omdbDetails?.parsedAwards?.wins,
      oscarsCount: omdbDetails?.parsedAwards?.oscars,
      rottenTomatoes: omdbDetails?.rottenTomatoes
    }
  );

  const coverUrl = anime.coverImage?.large || anime.coverImage?.extraLarge;
  const bannerUrl = coverUrl || anime.bannerImage;

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
                decoding="async"
                fetchPriority="high"
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

              {anime.synonyms && anime.synonyms.length > 0 && (
                <p className="text-[11px] text-white/50 mt-1">
                  {tr('Autres titres :', 'Also known as:')} {anime.synonyms.slice(0, 3).join(' · ')}
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
                title={tr("Suivre cet anime sur le Bot Telegram (@animealert_buea_bot)", "Follow this anime on the Telegram Bot (@animealert_buea_bot)")}
              >
                <Bot className="w-4 h-4 text-[#FFC83D]" />
                <span>{tr("Alertes sur le Bot Telegram", "Alerts on Telegram Bot")}</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Phare : Comparaison Triple Notes (AniList / MyAnimeList / IMDb & OMDb) */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
            <Star className="w-5 h-5 text-[#FFC83D] fill-[#FFC83D]" />
            <span>{tr("Comparatif officiel des notes communautaires", "Official comparison of community ratings")}</span>
          </h2>
          {notesLoading && (
            <span className="text-xs text-[#55607A] dark:text-[#A3AEC8] animate-pulse">
              {tr("Chargement MyAnimeList & OMDb...", "Loading MyAnimeList & OMDb...")}
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
              {anime.favourites
                ? `${anime.favourites.toLocaleString(LOCALE)} ${tr('favoris AniList', 'AniList favorites')}`
                : tr("Communauté mondiale AniList", "AniList global community")}
            </p>
          </div>

          {/* MyAnimeList */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] font-medium">
              <span className="flex items-center gap-1.5">
                <span>MyAnimeList</span>
                {jikanDetails?.rank && (
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold tabular-nums">
                    #{jikanDetails.rank}
                  </span>
                )}
              </span>
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
              {jikanDetails?.scoredBy
                ? `${jikanDetails.scoredBy.toLocaleString(LOCALE)} ${tr('votes MAL', 'MAL votes')}`
                : tr("Jikan API v4 vérifiée", "Jikan API v4 verified")}
            </p>
          </div>

          {/* IMDb via OMDb */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] font-medium">
              <span>IMDb · OMDb</span>
              <a
                href={
                  resolvedImdbId
                    ? `https://www.imdb.com/title/${resolvedImdbId}/`
                    : `https://www.imdb.com/find/?q=${encodeURIComponent(titre)}&s=tt`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                {tr("Fiche IMDb", "IMDb Page")} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-['Bricolage_Grotesque'] text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {imdbRating || '—'}
              </span>
              <span className="text-xs text-[#55607A] dark:text-[#A3AEC8]">/ 10</span>
            </div>
            <p className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] mt-1">
              {omdbDetails?.imdbVotes
                ? `${omdbDetails.imdbVotes} ${tr('votes IMDb', 'IMDb votes')}`
                : tr("Avis critiques & grand public", "Critic & general audience reviews")}
            </p>
          </div>
        </div>

        {/* Critiques complémentaires OMDb (Rotten Tomatoes, Metascore, Classification, Box Office) */}
        {(omdbDetails?.rottenTomatoes ||
          omdbDetails?.metacritic ||
          omdbDetails?.rated ||
          jikanDetails?.rating ||
          omdbDetails?.boxOffice) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {omdbDetails?.rottenTomatoes && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span>Rotten Tomatoes</span>
                <strong className="tabular-nums">{omdbDetails.rottenTomatoes}</strong>
              </span>
            )}
            {omdbDetails?.metacritic && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Metascore</span>
                <strong className="tabular-nums">{omdbDetails.metacritic}</strong>
              </span>
            )}
            {(omdbDetails?.rated || jikanDetails?.rating) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[#D5DBE8] dark:border-[#27324D] text-xs font-medium text-[#14213D] dark:text-[#EEF1F8]">
                <span>{tr('Public :', 'Rated:')}</span>
                <strong>{omdbDetails?.rated || jikanDetails?.rating?.split(' - ')[0]}</strong>
              </span>
            )}
            {omdbDetails?.boxOffice && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Film className="w-3.5 h-3.5" />
                <span>Box-office : {omdbDetails.boxOffice}</span>
              </span>
            )}
          </div>
        )}

        {/* Analyse comparative */}
        <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 text-xs sm:text-sm text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2B50FF] shrink-0"></span>
          <span className="font-medium">{analyse}</span>
        </div>
      </section>

      {/* Distinctions, Prix & Titres gagnés (OMDb & Wikidata) */}
      {(omdbDetails?.parsedAwards ||
        (wikidata && wikidata.awards.length > 0) ||
        omdbDetails?.director ||
        omdbDetails?.actors ||
        omdbDetails?.country) && (
        <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFC83D]" />
              <span>{tr("Distinctions, Prix & Fiche IMDb / OMDb", "Awards, Titles Won & IMDb / OMDb Info")}</span>
            </h2>
            {resolvedImdbId && (
              <a
                href={`https://www.imdb.com/title/${resolvedImdbId}/awards/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline inline-flex items-center gap-1"
              >
                <span>{tr("Palmarès complet sur IMDb", "Full awards on IMDb")}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Compteurs visuels OMDb (Oscars, Victoires, Nominations) */}
          {omdbDetails?.parsedAwards && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2.5">
                {omdbDetails.parsedAwards.oscars > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    <Trophy className="w-4 h-4 text-[#FFC83D]" />
                    <span>
                      {omdbDetails.parsedAwards.oscars}{' '}
                      {omdbDetails.parsedAwards.oscars > 1 ? 'Oscars' : 'Oscar'}{' '}
                      {tr('remporté', 'won')}
                      {omdbDetails.parsedAwards.oscars > 1 ? tr('s', '') : ''}
                    </span>
                  </div>
                )}
                {omdbDetails.parsedAwards.emmys > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    <Award className="w-4 h-4" />
                    <span>{omdbDetails.parsedAwards.emmys} Emmy{omdbDetails.parsedAwards.emmys > 1 ? 's' : ''}</span>
                  </div>
                )}
                {omdbDetails.parsedAwards.goldenGlobes > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    <Award className="w-4 h-4" />
                    <span>{omdbDetails.parsedAwards.goldenGlobes} Golden Globe{omdbDetails.parsedAwards.goldenGlobes > 1 ? 's' : ''}</span>
                  </div>
                )}
                {omdbDetails.parsedAwards.wins > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[#2B50FF] dark:text-[#7F95FF] text-xs font-bold tabular-nums">
                    <Award className="w-4 h-4" />
                    <span>
                      {omdbDetails.parsedAwards.wins}{' '}
                      {tr(
                        omdbDetails.parsedAwards.wins > 1 ? 'victoires / prix' : 'victoire / prix',
                        omdbDetails.parsedAwards.wins > 1 ? 'award wins' : 'award win'
                      )}
                    </span>
                  </div>
                )}
                {omdbDetails.parsedAwards.nominations > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[#D5DBE8] dark:border-[#27324D] text-[#55607A] dark:text-[#A3AEC8] text-xs font-semibold tabular-nums">
                    <span>
                      {omdbDetails.parsedAwards.nominations}{' '}
                      {omdbDetails.parsedAwards.nominations > 1 ? 'nominations' : 'nomination'}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">{tr('Résumé IMDb / OMDb :', 'IMDb / OMDb summary:')}</strong>{' '}
                {omdbDetails.parsedAwards.raw}
              </p>
            </div>
          )}

          {/* Liste des titres et récompenses officielles nommées (Wikidata) */}
          {wikidata && wikidata.awards.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8]">
                {tr("Titres et récompenses officielles recensés :", "Recorded official titles & awards:")}
              </p>
              <div className="flex flex-wrap gap-2">
                {wikidata.awards.map((awardName) => (
                  <span
                    key={awardName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-medium text-[#14213D] dark:text-[#EEF1F8]"
                  >
                    <Trophy className="w-3.5 h-3.5 text-[#FFC83D] shrink-0" />
                    <span>{awardName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Métadonnées complémentaires OMDb */}
          {(omdbDetails?.director || omdbDetails?.actors || omdbDetails?.country || omdbDetails?.released || omdbDetails?.totalSeasons) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-[#D5DBE8]/70 dark:border-[#27324D]/70 text-xs">
              {omdbDetails.director && (
                <div>
                  <span className="text-[#55607A] dark:text-[#A3AEC8] block">{tr('Réalisation', 'Director')}</span>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8]">{omdbDetails.director}</strong>
                </div>
              )}
              {omdbDetails.actors && (
                <div>
                  <span className="text-[#55607A] dark:text-[#A3AEC8] block">{tr('Voix & Casting', 'Voice Cast')}</span>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8]">{omdbDetails.actors}</strong>
                </div>
              )}
              {omdbDetails.country && (
                <div>
                  <span className="text-[#55607A] dark:text-[#A3AEC8] block">{tr('Pays & Langue', 'Country & Language')}</span>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8]">
                    {omdbDetails.country}{omdbDetails.language ? ` · ${omdbDetails.language}` : ''}
                  </strong>
                </div>
              )}
              {omdbDetails.released && (
                <div>
                  <span className="text-[#55607A] dark:text-[#A3AEC8] block">{tr('Première sortie', 'Initial release')}</span>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8]">{omdbDetails.released}</strong>
                </div>
              )}
              {omdbDetails.totalSeasons && (
                <div>
                  <span className="text-[#55607A] dark:text-[#A3AEC8] block">{tr('Saisons recensées (IMDb)', 'Listed seasons (IMDb)')}</span>
                  <strong className="text-[#14213D] dark:text-[#EEF1F8]">{omdbDetails.totalSeasons}</strong>
                </div>
              )}
            </div>
          )}
        </section>
      )}

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

      {/* Saisons & Univers lié (Navigation directe AniList + fallback Jikan) */}
      {(() => {
        const allowedAniRelations = new Set([
          'PREQUEL',
          'SEQUEL',
          'SIDE_STORY',
          'SPIN_OFF',
          'ALTERNATIVE',
          'PARENT',
          'SUMMARY'
        ]);
        const relationLabels: Record<string, string> = {
          PREQUEL: tr('Saison précédente / Préquelle', 'Prequel / Previous'),
          SEQUEL: tr('Saison suivante / Suite', 'Sequel / Next season'),
          SIDE_STORY: tr('Histoire parallèle', 'Side story'),
          SPIN_OFF: 'Spin-off',
          ALTERNATIVE: tr('Version alternative', 'Alternative version'),
          PARENT: tr('Série principale', 'Parent story'),
          SUMMARY: tr('Film récapitulatif', 'Summary')
        };
        const directSeasons = (anime.relations?.edges || []).filter(
          (e) => e.node?.type === 'ANIME' && allowedAniRelations.has(e.relationType)
        );

        if (directSeasons.length > 0) {
          return (
            <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
                  <span>{tr("Saisons, films & suites liées", "Seasons, movies & related entries")}</span>
                </h2>
                <span className="text-xs text-[#55607A] dark:text-[#A3AEC8] tabular-nums">
                  {directSeasons.length} {tr('liés', 'related')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {directSeasons.map((edge) => {
                  const rel = edge.node;
                  const relTitle = titreDe(rel.title);
                  const relFmt = rel.format ? FORMATS[rel.format] || rel.format : null;
                  return (
                    <button
                      key={`${edge.relationType}-${rel.id}`}
                      onClick={() => onNavigate(`/anime/${rel.id}`)}
                      className="flex items-center gap-3 text-left p-3 rounded-2xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8]/60 dark:bg-[#0D1322]/60 hover:border-[#2B50FF] transition-all group"
                    >
                      {rel.coverImage?.large && (
                        <img
                          src={rel.coverImage.large}
                          alt={relTitle}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-12 h-16 rounded-xl object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2B50FF] dark:text-[#7F95FF]">
                          {relationLabels[edge.relationType] || edge.relationType}
                        </span>
                        <p className="text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] mt-0.5 line-clamp-2 group-hover:text-[#2B50FF] dark:group-hover:text-[#7F95FF]">
                          {relTitle}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#55607A] dark:text-[#A3AEC8] mt-1">
                          {relFmt && <span>{relFmt}</span>}
                          {rel.seasonYear && <span>· {rel.seasonYear}</span>}
                          {rel.episodes && <span>· {rel.episodes} {tr('ép.', 'ep.')}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        }

        if (jikanDetails && jikanDetails.relations.length > 0) {
          return (
            <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
              <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
                <span>{tr("Chronologie & suites liées", "Timeline & related anime")}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {jikanDetails.relations.flatMap((group) =>
                  group.entries.slice(0, 3).map((entry) => (
                    <button
                      key={`${group.relation}-${entry.malId}`}
                      onClick={() => onNavigate(`/recherche?q=${encodeURIComponent(entry.name)}`)}
                      className="text-left p-3.5 rounded-2xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8]/60 dark:bg-[#0D1322]/60 hover:border-[#2B50FF] transition-colors group"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2B50FF] dark:text-[#7F95FF]">
                        {group.relation}
                      </span>
                      <p className="text-xs font-bold text-[#14213D] dark:text-[#EEF1F8] mt-1 line-clamp-1 group-hover:text-[#2B50FF] dark:group-hover:text-[#7F95FF]">
                        {entry.name}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        }

        return null;
      })()}

      {/* Liste des Épisodes (automatique Jikan + AniList streamingEpisodes, avec recherche & tri) */}
      {(episodesList.length > 0 || (anime.streamingEpisodes && anime.streamingEpisodes.length > 0)) && (() => {
        const streamingMap = new Map<number, { thumbnail?: string | null; title?: string | null }>();
        (anime.streamingEpisodes || []).forEach((se, idx) => {
          const epMatch = se.title?.match(/(?:Episode|Épisode|Ep\.?)\s*(\d+)/i);
          const epNum = epMatch ? parseInt(epMatch[1], 10) : idx + 1;
          if (!streamingMap.has(epNum)) {
            streamingMap.set(epNum, { thumbnail: se.thumbnail, title: se.title });
          }
        });

        const baseEpisodes: JikanEpisodeItem[] =
          episodesList.length > 0
            ? episodesList
            : (anime.streamingEpisodes || []).map((se, idx) => ({
                mal_id: idx + 1,
                title: se.title || `${tr('Épisode', 'Episode')} ${idx + 1}`,
                filler: false,
                recap: false
              }));

        const qLower = episodeSearch.trim().toLowerCase();
        const filteredEps = baseEpisodes
          .filter((ep) => {
            if (!qLower) return true;
            return (
              String(ep.mal_id).includes(qLower) ||
              ep.title.toLowerCase().includes(qLower)
            );
          })
          .sort((a, b) => (episodeSort === 'asc' ? a.mal_id - b.mal_id : b.mal_id - a.mal_id));

        const handleLoadMoreEpisodes = async () => {
          if (!anime.idMal || episodesLoading || !episodesHasNext) return;
          setEpisodesLoading(true);
          try {
            const nextPage = episodesPage + 1;
            const res = await fetchJikanEpisodes(anime.idMal, nextPage);
            if (res.episodes.length > 0) {
              setEpisodesList((prev) => [...prev, ...res.episodes]);
              setEpisodesPage(nextPage);
              setEpisodesHasNext(res.hasNextPage);
            } else {
              setEpisodesHasNext(false);
            }
          } finally {
            setEpisodesLoading(false);
          }
        };

        return (
          <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
                  <Tv className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
                  <span>{tr('Liste des épisodes', 'Episodes list')}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2B50FF] dark:text-[#7F95FF] tabular-nums">
                    {filteredEps.length}
                  </span>
                </h2>
                <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
                  {tr('Clique sur un épisode pour mettre à jour ta progression locale.', 'Click an episode to update your local watch progress.')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#55607A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={episodeSearch}
                    onChange={(e) => setEpisodeSearch(e.target.value)}
                    placeholder={tr('Chercher un épisode...', 'Search episodes...')}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEpisodeSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors"
                >
                  {episodeSort === 'asc' ? tr('Plus anciens ↑', 'Oldest ↑') : tr('Plus récents ↓', 'Newest ↓')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredEps.map((ep) => {
                const isWatched = ep.mal_id <= episodesVus;
                const thumb = streamingMap.get(ep.mal_id)?.thumbnail;
                return (
                  <button
                    key={ep.mal_id}
                    type="button"
                    onClick={() => handleChangerEpisodesVus(isWatched && ep.mal_id === episodesVus ? ep.mal_id - 1 : ep.mal_id)}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all ${
                      isWatched
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-500/40'
                        : 'bg-[#F2F4F8]/60 dark:bg-[#0D1322]/60 border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF]'
                    }`}
                  >
                    {thumb ? (
                      <div className="relative w-20 aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-800">
                        <img
                          src={thumb}
                          alt={ep.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 text-white text-[10px] font-bold tabular-nums">
                          {ep.mal_id}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-extrabold tabular-nums ${
                          isWatched
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8]'
                        }`}
                      >
                        {isWatched ? <Check className="w-4 h-4" /> : ep.mal_id}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-[#2B50FF] dark:text-[#7F95FF] tabular-nums">
                          {tr('Ép.', 'Ep.')} {ep.mal_id}
                        </span>
                        {ep.filler && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                            FILLER
                          </span>
                        )}
                        {ep.recap && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-500/15 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                            RECAP
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] line-clamp-1 mt-0.5">
                        {ep.title}
                      </p>
                      {ep.aired && (
                        <span className="text-[10px] text-[#55607A] dark:text-[#A3AEC8]">
                          {new Date(ep.aired).toLocaleDateString(LOCALE)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {episodesHasNext && (
              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreEpisodes}
                  disabled={episodesLoading}
                  className="px-4 py-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors disabled:opacity-50"
                >
                  {episodesLoading
                    ? tr('Chargement...', 'Loading...')
                    : tr("Charger plus d'épisodes", 'Load more episodes')}
                </button>
              </div>
            )}
          </section>
        );
      })()}

      {/* Thèmes musicaux : Openings & Endings */}
      {jikanDetails && (jikanDetails.openings.length > 0 || jikanDetails.endings.length > 0) && (
        <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
              <Music className="w-5 h-5 text-[#2B50FF] dark:text-[#7F95FF]" />
              <span>{tr("Génériques (Openings & Endings)", "Soundtrack Themes (Openings & Endings)")}</span>
            </h2>
            <div className="flex items-center gap-1.5 bg-[#F2F4F8] dark:bg-[#0D1322] p-1 rounded-xl border border-[#D5DBE8] dark:border-[#27324D]">
              <button
                type="button"
                onClick={() => setActiveThemeTab('op')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  activeThemeTab === 'op'
                    ? 'bg-[#2B50FF] text-white'
                    : 'text-[#55607A] dark:text-[#A3AEC8] hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
                }`}
              >
                Openings ({jikanDetails.openings.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveThemeTab('ed')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  activeThemeTab === 'ed'
                    ? 'bg-[#2B50FF] text-white'
                    : 'text-[#55607A] dark:text-[#A3AEC8] hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
                }`}
              >
                Endings ({jikanDetails.endings.length})
              </button>
            </div>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#55607A] dark:text-[#A3AEC8]">
            {(activeThemeTab === 'op' ? jikanDetails.openings : jikanDetails.endings).length > 0 ? (
              (activeThemeTab === 'op' ? jikanDetails.openings : jikanDetails.endings)
                .slice(0, 10)
                .map((themeStr, idx) => (
                  <li
                    key={`${activeThemeTab}-${idx}`}
                    className="px-3 py-2 rounded-xl bg-[#F2F4F8]/70 dark:bg-[#0D1322]/60 border border-[#D5DBE8]/60 dark:border-[#27324D]/60 text-[#14213D] dark:text-[#EEF1F8]"
                  >
                    {themeStr}
                  </li>
                ))
            ) : (
              <li className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
                {tr("Aucun générique répertorié.", "No themes listed.")}
              </li>
            )}
          </ul>
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
