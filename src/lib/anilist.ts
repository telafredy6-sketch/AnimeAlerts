const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// Simple in-memory cache and in-flight deduplication to prevent redundant fetches
const cache = new Map<string, { data: any; expiry: number }>();
const inFlight = new Map<string, Promise<any>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeAniListRequest<T>(
  query: string,
  variables: Record<string, any>,
  timeoutMs = 15000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new Error("Délai de réponse AniList dépassé")),
      timeoutMs
    );

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

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`Erreur AniList (${response.status})`);
        if (attempt === 0) {
          await sleep(800);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        throw new Error(`Erreur AniList (${response.status})`);
      }

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || "Erreur GraphQL AniList");
      }

      return json.data as T;
    } catch (err: any) {
      const isAbortOrNetwork =
        err?.name === "AbortError" ||
        err?.name === "TypeError" ||
        String(err?.message || "").includes("Délai");
      lastError =
        err?.name === "AbortError"
          ? new Error("Connexion à AniList expirée. Vérifie ta connexion puis réessaye.")
          : err;

      if (isAbortOrNetwork && attempt === 0) {
        await sleep(600);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Erreur AniList");
}

export async function anilist<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const cacheKey = JSON.stringify({ query, variables });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }

  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = executeAniListRequest<T>(query, variables)
    .then((data) => {
      const ttl = variables.search ? 30 * 1000 : 3 * 60 * 1000;
      cache.set(cacheKey, { data, expiry: Date.now() + ttl });
      return data;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
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
      description(asHtml: false)
      genres
      averageScore
      episodes
      duration
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
    synonyms
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
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
    relations {
      edges {
        relationType
        node {
          id
          idMal
          type
          title { romaji english }
          format
          status
          seasonYear
          episodes
          averageScore
          coverImage { large medium color }
        }
      }
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
