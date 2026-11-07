export interface AnimeTitle {
  romaji: string;
  english?: string | null;
  native?: string | null;
}

export interface AnimeCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}

export interface AiringEpisode {
  episode: number;
  airingAt: number;
}

export interface ExternalLink {
  site: string;
  type: string;
  url: string;
}

export interface CharacterNode {
  id: number;
  name: {
    full: string;
    native?: string | null;
  };
  image?: {
    medium?: string | null;
    large?: string | null;
  } | null;
}

export interface CharacterEdge {
  role: string;
  node: CharacterNode;
}

export interface StudioNode {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  siteUrl?: string | null;
}

export interface RecommendationNode {
  mediaRecommendation?: {
    id: number;
    title: AnimeTitle;
    coverImage?: AnimeCoverImage;
    format?: string;
    averageScore?: number;
    seasonYear?: number;
  } | null;
}

export interface AnimeMedia {
  id: number;
  idMal?: number | null;
  title: AnimeTitle;
  coverImage?: AnimeCoverImage;
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number;
  favourites?: number;
  episodes?: number | null;
  duration?: number | null;
  status?: string;
  format?: string;
  season?: string;
  seasonYear?: number | null;
  siteUrl?: string;
  trailer?: {
    id?: string;
    site?: string;
  } | null;
  nextAiringEpisode?: AiringEpisode | null;
  externalLinks?: ExternalLink[];
  studios?: {
    nodes?: StudioNode[];
  };
  characters?: {
    edges?: CharacterEdge[];
  };
  recommendations?: {
    nodes?: RecommendationNode[];
  };
}

export interface AiringScheduleItem {
  id?: number;
  episode: number;
  airingAt: number;
  media: {
    id: number;
    title: AnimeTitle;
    popularity?: number;
    isAdult?: boolean;
    format?: string;
    genres?: string[];
    coverImage?: AnimeCoverImage;
    averageScore?: number | null;
  };
}

export interface CanalTelegram {
  nom: string;
  description: string;
  lien: string;
  categorie: 'officiel' | 'sorties' | 'streaming' | 'mangas' | 'communaute';
  badge?: string;
  membres?: string;
}

export interface FavoriItem {
  id: number;
  idMal?: number | null;
  titre: string;
  titreOriginal?: string;
  affiche?: string;
  noteAniList?: number | null;
  format?: string;
  episodesTotal?: number | null;
  episodesVus?: number;
  ajouteLe: number;
}

export interface SearchFilters {
  q?: string;
  genre?: string;
  annee?: string;
  saison?: string;
  format?: string;
  statut?: string;
  scoreMin?: string;
  tri?: string;
  page?: number;
}
