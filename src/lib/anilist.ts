const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// Simple in-memory cache to prevent redundant fetches
const cache = new Map<string, { data: any; expiry: number }>();

export async function anilist<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur AniList (${response.status})`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message || "Erreur GraphQL AniList");
    }

    // Cache valid responses for 3 minutes (or 30s for search)
    const ttl = variables.search ? 30 * 1000 : 3 * 60 * 1000;
    cache.set(cacheKey, { data: json.data, expiry: Date.now() + ttl });

    return json.data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Recherche avancée avec filtres multiples et pagination
export const QUERY_RECHERCHE_CATALOGUE = `
query (
  $page: Int,
  $perPage: Int,
  $search: String,
  $genre: String,
  $season: MediaSeason,
  $seasonYear: Int,
  $format: MediaFormat,
  $status: MediaStatus,
  $averageScore_greater: Int,
  $sort: [MediaSort]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      perPage
      currentPage
      lastPage
      hasNextPage
    }
    media(
      search: $search,
      genre: $genre,
      season: $season,
      seasonYear: $seasonYear,
      format: $format,
      status: $status,
      averageScore_greater: $averageScore_greater,
      sort: $sort,
      type: ANIME,
      isAdult: false
    ) {
      id
      idMal
      title { romaji english native }
      coverImage { large extraLarge color }
      bannerImage
      description(asHtml: false)
      genres
      averageScore
      meanScore
      episodes
      status
      format
      season
      seasonYear
      siteUrl
      nextAiringEpisode { episode airingAt }
    }
  }
}`;

// Sorties des prochaines 24h
export const QUERY_SORTIES_24H = `
query ($debut: Int, $fin: Int) {
  Page(page: 1, perPage: 50) {
    airingSchedules(airingAt_greater: $debut, airingAt_lesser: $fin, sort: TIME) {
      id
      episode
      airingAt
      media {
        id
        idMal
        title { romaji english }
        popularity
        isAdult
        format
        genres
        averageScore
        coverImage { large extraLarge color }
      }
    }
  }
}`;

// Calendrier sur 7 jours
export const QUERY_CALENDRIER_7J = `
query ($debut: Int, $fin: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
      currentPage
    }
    airingSchedules(airingAt_greater: $debut, airingAt_lesser: $fin, sort: TIME) {
      id
      episode
      airingAt
      media {
        id
        idMal
        title { romaji english }
        format
        genres
        averageScore
        popularity
        isAdult
        coverImage { large medium color }
      }
    }
  }
}`;

// Tendances de la semaine & saison actuelle
export const QUERY_ACCUEIL_SECTIONS = `
query ($season: MediaSeason, $seasonYear: Int) {
  tendances: Page(page: 1, perPage: 8) {
    media(type: ANIME, isAdult: false, sort: TRENDING_DESC) {
      id
      idMal
      title { romaji english }
      coverImage { large extraLarge color }
      bannerImage
      genres
      averageScore
      episodes
      status
      format
      seasonYear
      nextAiringEpisode { episode airingAt }
    }
  }
  saison: Page(page: 1, perPage: 8) {
    media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
      id
      idMal
      title { romaji english }
      coverImage { large extraLarge color }
      bannerImage
      genres
      averageScore
      episodes
      status
      format
      seasonYear
      nextAiringEpisode { episode airingAt }
    }
  }
}`;

// Fiche détaillée complète avec personnages, studios, trailer et recommandations
export const QUERY_FICHE_COMPLETE = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native }
    coverImage { extraLarge large medium color }
    bannerImage
    description(asHtml: false)
    genres
    averageScore
    meanScore
    popularity
    favourites
    episodes
    duration
    status
    format
    season
    seasonYear
    siteUrl
    trailer {
      id
      site
    }
    nextAiringEpisode {
      episode
      airingAt
    }
    externalLinks {
      site
      type
      url
    }
    studios(isMain: true) {
      nodes {
        id
        name
        isAnimationStudio
        siteUrl
      }
    }
    characters(role: MAIN, sort: ROLE, perPage: 8) {
      edges {
        role
        node {
          id
          name { full native }
          image { medium large }
        }
      }
    }
    recommendations(perPage: 6, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          title { romaji english }
          coverImage { large extraLarge color }
          format
          averageScore
          seasonYear
        }
      }
    }
  }
}`;

// Pour le bouton « Surprise-moi » : récupère un anime populaire au hasard
export async function fetchSurpriseAnime(): Promise<number | null> {
  const randomPage = Math.floor(Math.random() * 15) + 1;
  const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 20) {
        media(type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
          id
        }
      }
    }
  `;
  try {
    const data = await anilist(query, { page: randomPage });
    const items = data.Page.media;
    if (items && items.length > 0) {
      const pick = items[Math.floor(Math.random() * items.length)];
      return pick.id;
    }
  } catch (err) {
    console.error("Erreur surprise anime:", err);
  }
  return 1535; // Fallback: Death Note
}
