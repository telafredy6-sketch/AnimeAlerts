import { tr } from './i18n';
import { CanalTelegram } from './types';

export const CONFIG = {
  // Nom du bot Telegram (AnimeAlert)
  botUsername: "animealert_buea_bot",
  botUrl: "https://t.me/animealert_buea_bot",

  // Clé API OMDb pour notes IMDb si renseignée
  omdbKey: "",

  canaux: [
    {
      nom: "Bot AnimeAlert (@animealert_buea_bot)",
      description: tr("Le bot Telegram officiel : reçois des rappels personnalisés 15 min avant chaque épisode et recherche tes animes directement.", "The official Telegram bot: get personalized reminders 15 min before each episode and search your anime directly."),
      lien: "https://t.me/animealert_buea_bot",
      categorie: "officiel",
      badge: tr("Bot Officiel 🤖", "Official Bot 🤖"),
      membres: tr("Actif 24/7", "Active 24/7")
    },
    {
      nom: "AnimeAlert Buea",
      description: tr("Le canal officiel : sorties du jour, résumés détaillés, actualités anime et sondages à Buea.", "The official channel: today's releases, detailed summaries, anime news and polls in Buea."),
      lien: "https://t.me/AnimeAlertBuea",
      categorie: "officiel",
      badge: tr("Principal", "Main"),
      membres: "5.4k"
    },
    {
      nom: "My Anime",
      description: tr("Partages d'épisodes, sorties quotidiennes et streaming direct sur Telegram.", "Episode sharing, daily releases and direct streaming on Telegram."),
      lien: "https://t.me/myanime67",
      categorie: "streaming",
      badge: "Streaming",
      membres: "3.2k"
    },
    {
      nom: "Anime Galaxy",
      description: tr("Discussion entre otakus, recommandations pépites et sorties en VOSTFR / VF.", "Discussion among otaku, hidden-gem recommendations and releases in VOSTFR / VF (French subs / dubs)."),
      lien: "https://t.me/Anime_GalaxyOfficial",
      categorie: "communaute",
      badge: tr("Communauté", "Community"),
      membres: "4.1k"
    },
    {
      nom: "Mangas Japanimation",
      description: tr("Chapitres de mangas récents, scans traduits, animes et fiches culturelles japonaises.", "Recent manga chapters, translated scans, anime and Japanese culture pages."),
      lien: "https://t.me/Mangas_Japanimations",
      categorie: "mangas",
      badge: tr("Mangas & Scans", "Manga & Scans"),
      membres: "2.8k"
    },
    {
      nom: "Anime Home Japan",
      description: tr("Téléchargements légers adaptés aux connexions mobiles, récapitulatifs de saisons.", "Lightweight downloads suited to mobile connections, season recaps."),
      lien: "https://t.me/OTAKU_HOME17",
      categorie: "streaming",
      badge: tr("Qualité optimisée", "Optimized quality"),
      membres: "1.9k"
    },
    {
      nom: "Hebdo Zone",
      description: tr("Le récapitulatif hebdomadaire du week-end pour ne rater aucun gros épisode.", "The weekend weekly recap so you never miss a big episode."),
      lien: "https://t.me/HebdoZone5",
      categorie: "sorties",
      badge: tr("Hebdo", "Weekly"),
      membres: "2.3k"
    }
  ] as CanalTelegram[]
};

export const FORMATS: Record<string, string> = {
  TV: tr("Série TV", "TV series"),
  TV_SHORT: tr("Série courte", "Short series"),
  MOVIE: tr("Film", "Movie"),
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: tr("Spécial", "Special"),
  MUSIC: tr("Clip musical", "Music video")
};

export const STATUTS: Record<string, { label: string; color: string }> = {
  FINISHED: { label: tr("Terminé", "Finished"), color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  RELEASING: { label: tr("En cours", "Ongoing"), color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  NOT_YET_RELEASED: { label: tr("À venir", "Upcoming"), color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  CANCELLED: { label: tr("Annulé", "Cancelled"), color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  HIATUS: { label: tr("En pause", "On hiatus"), color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" }
};

export const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller"
];

export const GENRES_FR: Record<string, string> = {
  Action: "Action",
  Adventure: tr("Aventure", "Adventure"),
  Comedy: tr("Comédie", "Comedy"),
  Drama: tr("Drame", "Drama"),
  Ecchi: "Ecchi",
  Fantasy: tr("Fantastique", "Fantasy"),
  Horror: tr("Horreur", "Horror"),
  "Mahou Shoujo": "Magical Girl",
  Mecha: "Mecha",
  Music: tr("Musique", "Music"),
  Mystery: tr("Mystère", "Mystery"),
  Psychological: tr("Psychologique", "Psychological"),
  Romance: "Romance",
  "Sci-Fi": tr("Science-Fiction", "Sci-Fi"),
  "Slice of Life": tr("Tranche de vie", "Slice of Life"),
  Sports: tr("Sport", "Sports"),
  Supernatural: tr("Surnaturel", "Supernatural"),
  Thriller: tr("Suspense", "Thriller")
};

export const SAISONS = [
  { id: "WINTER", label: tr("Hiver", "Winter"), slug: "hiver", mois: [12, 1, 2] },
  { id: "SPRING", label: tr("Printemps", "Spring"), slug: "printemps", mois: [3, 4, 5] },
  { id: "SUMMER", label: tr("Été", "Summer"), slug: "ete", mois: [6, 7, 8] },
  { id: "FALL", label: tr("Automne", "Fall"), slug: "automne", mois: [9, 10, 11] }
];

export function getSaisonCourante(): { id: string; label: string; slug: string; annee: number } {
  const now = new Date();
  const mois = now.getMonth() + 1;
  const annee = now.getFullYear();

  let saison = SAISONS[0];
  if (mois >= 3 && mois <= 5) saison = SAISONS[1];
  else if (mois >= 6 && mois <= 8) saison = SAISONS[2];
  else if (mois >= 9 && mois <= 11) saison = SAISONS[3];
  else saison = SAISONS[0];

  return { ...saison, annee };
        }
    
