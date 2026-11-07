import { CanalTelegram } from './types';

export const CONFIG = {
  // Nom du bot Telegram (AnimeAlert)
  botUsername: "AnimeAlert",
  botUrl: "https://t.me/AnimeAlert",

  // Clé API OMDb pour notes IMDb si renseignée
  omdbKey: "",

  canaux: [
    {
      nom: "Bot AnimeAlert (@AnimeAlert)",
      description: "Le bot Telegram officiel : reçois des rappels personnalisés 15 min avant chaque épisode et recherche tes animes directement.",
      lien: "https://t.me/AnimeAlert",
      categorie: "officiel",
      badge: "Bot Officiel 🤖",
      membres: "Actif 24/7"
    },
    {
      nom: "AnimeAlert Buea",
      description: "Le canal officiel : sorties du jour, résumés détaillés, actualités anime et sondages à Buea.",
      lien: "https://t.me/AnimeAlertBuea",
      categorie: "officiel",
      badge: "Principal",
      membres: "5.4k"
    },
    {
      nom: "My Anime",
      description: "Partages d'épisodes, sorties quotidiennes et streaming direct sur Telegram.",
      lien: "https://t.me/myanime67",
      categorie: "streaming",
      badge: "Streaming",
      membres: "3.2k"
    },
    {
      nom: "Anime Galaxy",
      description: "Discussion entre otakus, recommandations pépites et sorties en VOSTFR / VF.",
      lien: "https://t.me/Anime_GalaxyOfficial",
      categorie: "communaute",
      badge: "Communauté",
      membres: "4.1k"
    },
    {
      nom: "Mangas Japanimation",
      description: "Chapitres de mangas récents, scans traduits, animes et fiches culturelles japonaises.",
      lien: "https://t.me/Mangas_Japanimations",
      categorie: "mangas",
      badge: "Mangas & Scans",
      membres: "2.8k"
    },
    {
      nom: "Anime Home Japan",
      description: "Téléchargements légers adaptés aux connexions mobiles, récapitulatifs de saisons.",
      lien: "https://t.me/OTAKU_HOME17",
      categorie: "streaming",
      badge: "Qualité optimisée",
      membres: "1.9k"
    },
    {
      nom: "Hebdo Zone",
      description: "Le récapitulatif hebdomadaire du week-end pour ne rater aucun gros épisode.",
      lien: "https://t.me/HebdoZone5",
      categorie: "sorties",
      badge: "Hebdo",
      membres: "2.3k"
    }
  ] as CanalTelegram[]
};

export const FORMATS: Record<string, string> = {
  TV: "Série TV",
  TV_SHORT: "Série courte",
  MOVIE: "Film",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Spécial",
  MUSIC: "Clip musical"
};

export const STATUTS: Record<string, { label: string; color: string }> = {
  FINISHED: { label: "Terminé", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  RELEASING: { label: "En cours", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  NOT_YET_RELEASED: { label: "À venir", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  CANCELLED: { label: "Annulé", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  HIATUS: { label: "En pause", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" }
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
  Adventure: "Aventure",
  Comedy: "Comédie",
  Drama: "Drame",
  Ecchi: "Ecchi",
  Fantasy: "Fantastique",
  Horror: "Horreur",
  "Mahou Shoujo": "Magical Girl",
  Mecha: "Mecha",
  Music: "Musique",
  Mystery: "Mystère",
  Psychological: "Psychologique",
  Romance: "Romance",
  "Sci-Fi": "Science-Fiction",
  "Slice of Life": "Tranche de vie",
  Sports: "Sport",
  Supernatural: "Surnaturel",
  Thriller: "Suspense"
};

export const SAISONS = [
  { id: "WINTER", label: "Hiver", slug: "hiver", mois: [12, 1, 2] },
  { id: "SPRING", label: "Printemps", slug: "printemps", mois: [3, 4, 5] },
  { id: "SUMMER", label: "Été", slug: "ete", mois: [6, 7, 8] },
  { id: "FALL", label: "Automne", slug: "automne", mois: [9, 10, 11] }
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
