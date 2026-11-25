import { tr, langue } from './i18n';
import { CONFIG } from './config';

export interface ParsedOmdbAwards {
  oscars: number;
  emmys: number;
  goldenGlobes: number;
  baftas: number;
  wins: number;
  nominations: number;
  raw: string;
}

export interface OmdbDetails {
  configured: boolean;
  imdbRating: string | null;
  imdbVotes: string | null;
  imdbId?: string;
  awards: string | null;
  parsedAwards: ParsedOmdbAwards | null;
  rottenTomatoes: string | null;
  metacritic: string | null;
  rated: string | null;
  runtime: string | null;
  released: string | null;
  country: string | null;
  language: string | null;
  boxOffice: string | null;
  director: string | null;
  actors: string | null;
  totalSeasons: string | null;
}

export interface JikanRelationGroup {
  relation: string;
  entries: {
    malId: number;
    name: string;
    type: string;
  }[];
}

export interface JikanDetails {
  score: number | null;
  scoredBy: number | null;
  rank: number | null;
  popularity: number | null;
  rating: string | null;
  openings: string[];
  endings: string[];
  relations: JikanRelationGroup[];
}

export interface WikidataEnrichment {
  imdbId?: string;
  awards: string[];
}

export interface JikanEpisodeItem {
  mal_id: number;
  title: string;
  title_japanese?: string | null;
  aired?: string | null;
  score?: number | null;
  filler?: boolean;
  recap?: boolean;
}

export interface JikanEpisodesResult {
  episodes: JikanEpisodeItem[];
  hasNextPage: boolean;
  lastVisiblePage: number;
}

const malCache = new Map<number, { data: JikanDetails; expiry: number }>();
const malEpisodesCache = new Map<string, { data: JikanEpisodesResult; expiry: number }>();
const imdbCache = new Map<string, { data: OmdbDetails; expiry: number }>();
const wikidataCache = new Map<string, { data: WikidataEnrichment; expiry: number }>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanOmdbField = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'N/A') return null;
  return trimmed;
};

export function parseOmdbAwards(awardsStr?: string | null): ParsedOmdbAwards | null {
  const raw = cleanOmdbField(awardsStr);
  if (!raw) return null;

  const matchNumber = (regex: RegExp): number => {
    const m = raw.match(regex);
    return m ? parseInt(m[1], 10) || 0 : 0;
  };

  const oscars = matchNumber(/Won\s+(\d+)\s+Oscar/i);
  const emmys = matchNumber(/Won\s+(\d+)\s+(?:Primetime\s+)?Emmy/i);
  const goldenGlobes = matchNumber(/Won\s+(\d+)\s+Golden\s+Globe/i);
  const baftas = matchNumber(/Won\s+(\d+)\s+BAFTA/i);
  const wins = matchNumber(/(\d+)\s+win/i);
  const nominations = matchNumber(/(\d+)\s+nomination/i);

  return {
    oscars,
    emmys,
    goldenGlobes,
    baftas,
    wins,
    nominations,
    raw
  };
}

function normalizeOmdbJson(json: any, configured: boolean): OmdbDetails {
  const ratings: Array<{ Source?: string; Value?: string }> = Array.isArray(json?.Ratings) ? json.Ratings : [];
  const rt = ratings.find((r) => r.Source === 'Rotten Tomatoes')?.Value || null;
  const mcRating = ratings.find((r) => r.Source === 'Metacritic')?.Value || null;
  const metascore = cleanOmdbField(json?.Metascore);
  const metacritic = mcRating || (metascore ? `${metascore}/100` : null);

  const awards = cleanOmdbField(json?.Awards);
  return {
    configured,
    imdbRating: cleanOmdbField(json?.imdbRating),
    imdbVotes: cleanOmdbField(json?.imdbVotes),
    imdbId: cleanOmdbField(json?.imdbID) || undefined,
    awards,
    parsedAwards: parseOmdbAwards(awards),
    rottenTomatoes: cleanOmdbField(rt),
    metacritic,
    rated: cleanOmdbField(json?.Rated),
    runtime: cleanOmdbField(json?.Runtime),
    released: cleanOmdbField(json?.Released),
    country: cleanOmdbField(json?.Country),
    language: cleanOmdbField(json?.Language),
    boxOffice: cleanOmdbField(json?.BoxOffice),
    director: cleanOmdbField(json?.Director),
    actors: cleanOmdbField(json?.Actors),
    totalSeasons: cleanOmdbField(json?.totalSeasons)
  };
}

export async function fetchJikanDetails(idMal: number): Promise<JikanDetails | null> {
  const cached = malCache.get(idMal);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  for (let essai = 0; essai < 2; essai++) {
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${idMal}/full`);
      if (response.status === 429) {
        await sleep(1000);
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      const d = json?.data;
      if (!d) return null;

      const allowedRelations = new Set([
        'Sequel',
        'Prequel',
        'Side story',
        'Spin-off',
        'Alternative version',
        'Full story',
        'Summary'
      ]);

      const relations: JikanRelationGroup[] = Array.isArray(d.relations)
        ? d.relations
            .filter((r: any) => allowedRelations.has(r.relation))
            .map((r: any) => ({
              relation: r.relation,
              entries: (r.entry || [])
                .filter((e: any) => e.type === 'anime' && e.mal_id && e.name)
                .map((e: any) => ({
                  malId: Number(e.mal_id),
                  name: String(e.name),
                  type: String(e.type)
                }))
            }))
            .filter((r: JikanRelationGroup) => r.entries.length > 0)
        : [];

      const details: JikanDetails = {
        score: d.score ? Number(d.score) : null,
        scoredBy: d.scored_by ? Number(d.scored_by) : null,
        rank: d.rank ? Number(d.rank) : null,
        popularity: d.popularity ? Number(d.popularity) : null,
        rating: cleanOmdbField(d.rating),
        openings: Array.isArray(d.theme?.openings) ? d.theme.openings.filter(Boolean) : [],
        endings: Array.isArray(d.theme?.endings) ? d.theme.endings.filter(Boolean) : [],
        relations
      };

      malCache.set(idMal, { data: details, expiry: Date.now() + 15 * 60 * 1000 });
      return details;
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchJikanScore(idMal: number): Promise<number | null> {
  const details = await fetchJikanDetails(idMal);
  return details?.score ?? null;
}

export async function fetchJikanEpisodes(idMal: number, page = 1): Promise<JikanEpisodesResult> {
  const key = `${idMal}-${page}`;
  const cached = malEpisodesCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  for (let essai = 0; essai < 2; essai++) {
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${idMal}/episodes?page=${page}`);
      if (response.status === 429) {
        await sleep(1000);
        continue;
      }
      if (!response.ok) return { episodes: [], hasNextPage: false, lastVisiblePage: 1 };
      const json = await response.json();
      const episodes: JikanEpisodeItem[] = Array.isArray(json?.data)
        ? json.data.map((ep: any) => ({
            mal_id: Number(ep.mal_id),
            title: String(ep.title || ep.title_romanji || `Episode ${ep.mal_id}`),
            title_japanese: ep.title_japanese || null,
            aired: ep.aired || null,
            score: ep.score ? Number(ep.score) : null,
            filler: Boolean(ep.filler),
            recap: Boolean(ep.recap)
          }))
        : [];
      const result: JikanEpisodesResult = {
        episodes,
        hasNextPage: Boolean(json?.pagination?.has_next_page),
        lastVisiblePage: Number(json?.pagination?.last_visible_page || 1)
      };
      malEpisodesCache.set(key, { data: result, expiry: Date.now() + 15 * 60 * 1000 });
      return result;
    } catch {
      return { episodes: [], hasNextPage: false, lastVisiblePage: 1 };
    }
  }
  return { episodes: [], hasNextPage: false, lastVisiblePage: 1 };
}

export async function fetchWikidataImdbAndAwards(
  anilistId: number,
  malId?: number | null
): Promise<WikidataEnrichment> {
  const lang = langue;
  const cacheKey = `${anilistId}-${malId || 0}-${lang}`;
  const cached = wikidataCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const filterClauses: string[] = [`{ ?item wdt:P8731 "${anilistId}" . }`];
  if (malId) {
    filterClauses.push(`{ ?item wdt:P4086 "${malId}" . }`);
  }

  const sparql = `
SELECT DISTINCT ?imdb ?awardLabel WHERE {
  ${filterClauses.join(' UNION ')}
  OPTIONAL { ?item wdt:P345 ?imdb . }
  OPTIONAL { ?item wdt:P166 ?award . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en,fr". }
}
LIMIT 30`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5500);

  try {
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
      signal: controller.signal
    });

    if (!response.ok) {
      return { awards: [] };
    }

    const json = await response.json();
    const bindings: any[] = json?.results?.bindings || [];

    let imdbId: string | undefined;
    const awardsSet = new Set<string>();

    for (const b of bindings) {
      const imdbVal = b?.imdb?.value;
      if (!imdbId && typeof imdbVal === 'string' && /^tt\d{5,}$/.test(imdbVal)) {
        imdbId = imdbVal;
      }
      const awardLabel = b?.awardLabel?.value;
      if (typeof awardLabel === 'string' && awardLabel && !/^Q\d+$/.test(awardLabel)) {
        awardsSet.add(awardLabel);
      }
    }

    const result: WikidataEnrichment = {
      imdbId,
      awards: Array.from(awardsSet)
    };
    wikidataCache.set(cacheKey, { data: result, expiry: Date.now() + 30 * 60 * 1000 });
    return result;
  } catch {
    return { awards: [] };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOmdbDetails(options: {
  titles: string[];
  year?: number | null;
  format?: string | null;
  imdbId?: string;
}): Promise<OmdbDetails> {
  const cleanTitles = options.titles.map((t) => t.trim()).filter(Boolean);
  const emptyResult: OmdbDetails = {
    configured: false,
    imdbRating: null,
    imdbVotes: null,
    imdbId: options.imdbId,
    awards: null,
    parsedAwards: null,
    rottenTomatoes: null,
    metacritic: null,
    rated: null,
    runtime: null,
    released: null,
    country: null,
    language: null,
    boxOffice: null,
    director: null,
    actors: null,
    totalSeasons: null
  };

  if (!cleanTitles.length && !options.imdbId) {
    return emptyResult;
  }

  const omdbType = options.format === 'MOVIE' ? 'movie' : options.format ? 'series' : undefined;
  const cacheKey = JSON.stringify({
    i: options.imdbId || '',
    titles: cleanTitles,
    y: options.year || '',
    type: omdbType || ''
  });

  const cached = imdbCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 1. Server-side OMDb proxy (/api/omdb)
  try {
    const sp = new URLSearchParams();
    if (options.imdbId) sp.set('i', options.imdbId);
    if (cleanTitles.length) sp.set('titles', JSON.stringify(cleanTitles));
    if (options.year) sp.set('y', String(options.year));
    if (omdbType) sp.set('type', omdbType);

    const response = await fetch(`/api/omdb?${sp.toString()}`);
    if (response.ok) {
      const payload = await response.json();
      if (payload?.configured) {
        const normalized = payload.data
          ? normalizeOmdbJson(payload.data, true)
          : { ...emptyResult, configured: true };
        imdbCache.set(cacheKey, { data: normalized, expiry: Date.now() + 20 * 60 * 1000 });
        return normalized;
      }
    }
  } catch {
    // Fallback below if client key is explicitly configured
  }

  // 2. Optional client env key fallback (e.g. static Vite preview with VITE_OMDB_API_KEY)
  const clientKey = (
    (import.meta as any).env?.VITE_OMDB_API_KEY ||
    CONFIG.omdbKey ||
    ''
  ).trim();

  if (!clientKey) {
    return emptyResult;
  }

  if (options.imdbId) {
    try {
      const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(clientKey)}&i=${encodeURIComponent(options.imdbId)}&plot=short`;
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        if (json.Response === 'True') {
          const normalized = normalizeOmdbJson(json, true);
          imdbCache.set(cacheKey, { data: normalized, expiry: Date.now() + 20 * 60 * 1000 });
          return normalized;
        }
      }
    } catch {
      // continue to title cascade
    }
  }

  for (const t of cleanTitles) {
    try {
      const sp = new URLSearchParams({ apikey: clientKey, t });
      if (options.year) sp.set('y', String(options.year));
      if (omdbType) sp.set('type', omdbType);

      const response = await fetch(`https://www.omdbapi.com/?${sp.toString()}`);
      if (!response.ok) continue;
      const json = await response.json();
      if (json.Response === 'True') {
        const normalized = normalizeOmdbJson(json, true);
        imdbCache.set(cacheKey, { data: normalized, expiry: Date.now() + 20 * 60 * 1000 });
        return normalized;
      }
    } catch {
      // ignore transient network errors
    }
  }

  return { ...emptyResult, configured: true };
}

export async function fetchOmdbRating(titles: string[]): Promise<{ rating: string | null; imdbId?: string }> {
  const details = await fetchOmdbDetails({ titles });
  return { rating: details.imdbRating, imdbId: details.imdbId };
}

export function analyseNotes(
  aniScore10?: number | null,
  malScore?: number | null,
  imdbScoreStr?: string | null,
  extra?: {
    rankMal?: number | null;
    winsCount?: number;
    oscarsCount?: number;
    rottenTomatoes?: string | null;
  }
): string {
  const scores: { name: string; val: number }[] = [];
  if (typeof aniScore10 === 'number' && !isNaN(aniScore10) && aniScore10 > 0) {
    scores.push({ name: 'AniList', val: aniScore10 });
  }
  if (typeof malScore === 'number' && !isNaN(malScore) && malScore > 0) {
    scores.push({ name: 'MyAnimeList', val: malScore });
  }
  const imdbNum = imdbScoreStr ? parseFloat(imdbScoreStr) : NaN;
  if (!isNaN(imdbNum) && imdbNum > 0) {
    scores.push({ name: 'IMDb', val: imdbNum });
  }

  let baseVerdict = '';

  const ani = scores.find((s) => s.name === 'AniList')?.val;
  const mal = scores.find((s) => s.name === 'MyAnimeList')?.val;
  const imdb = scores.find((s) => s.name === 'IMDb')?.val;

  if (scores.length < 2) {
    if (scores.length === 1) {
      if (scores[0].val >= 8.5) {
        baseVerdict = tr("Anime d'exception plébiscité par la communauté.", 'Outstanding anime acclaimed by the community.');
      } else if (scores[0].val >= 7.5) {
        baseVerdict = tr('Très bonne appréciation générale.', 'Very good overall reception.');
      } else {
        baseVerdict = tr('Note communautaire convenable.', 'Decent community rating.');
      }
    } else {
      baseVerdict = tr('Notes en cours de collecte auprès de la communauté.', 'Ratings are still being collected from the community.');
    }
  } else if (ani && mal && imdb) {
    const avg = (ani + mal + imdb) / 3;
    const spread = Math.max(ani, mal, imdb) - Math.min(ani, mal, imdb);
    if (spread <= 0.4) {
      baseVerdict = tr(
        `Consensus exceptionnel entre AniList (${ani.toFixed(1)}), MyAnimeList (${mal.toFixed(2)}) et IMDb (${imdb.toFixed(1)}) — moyenne ${avg.toFixed(1)}/10.`,
        `Exceptional consensus across AniList (${ani.toFixed(1)}), MyAnimeList (${mal.toFixed(2)}), and IMDb (${imdb.toFixed(1)}) — average ${avg.toFixed(1)}/10.`
      );
    } else if (imdb > ani + 0.4 && imdb > mal + 0.4) {
      baseVerdict = tr(
        `Très apprécié du grand public sur IMDb (${imdb.toFixed(1)}) au-dessus des fans anime (AniList ${ani.toFixed(1)} / MAL ${mal.toFixed(2)}).`,
        `Highly praised by the general IMDb audience (${imdb.toFixed(1)}), above anime communities (AniList ${ani.toFixed(1)} / MAL ${mal.toFixed(2)}).`
      );
    } else {
      baseVerdict = tr(
        `Moyenne croisée solide de ${avg.toFixed(1)}/10 sur les 3 plateformes (AniList, MAL et IMDb).`,
        `Solid cross-platform average of ${avg.toFixed(1)}/10 across AniList, MAL, and IMDb.`
      );
    }
  } else if (ani && mal) {
    const diff = Math.abs(ani - mal);
    if (diff <= 0.3) {
      baseVerdict = tr(
        `Harmonie forte entre AniList (${ani.toFixed(1)}) et MyAnimeList (${mal.toFixed(2)}) — avis très unanime !`,
        `Strong agreement between AniList (${ani.toFixed(1)}) and MyAnimeList (${mal.toFixed(2)}) — a very unanimous opinion!`
      );
    } else if (ani > mal) {
      baseVerdict = tr(
        `AniList surévalue de ${(ani - mal).toFixed(1)} point par rapport à MyAnimeList.`,
        `AniList rates it ${(ani - mal).toFixed(1)} points higher than MyAnimeList.`
      );
    } else {
      baseVerdict = tr(
        `MyAnimeList est plus enthousiaste de ${(mal - ani).toFixed(1)} point qu'AniList.`,
        `MyAnimeList is ${(mal - ani).toFixed(1)} points more enthusiastic than AniList.`
      );
    }
  } else if (ani && imdb) {
    const diff = (imdb - ani).toFixed(1);
    if (Math.abs(Number(diff)) <= 0.4) {
      baseVerdict = tr(
        `Évaluation équivalente entre public anime (${ani.toFixed(1)}) et grand public IMDb (${imdb.toFixed(1)}).`,
        `Equivalent rating between the anime audience (${ani.toFixed(1)}) and the general IMDb audience (${imdb.toFixed(1)}).`
      );
    } else {
      baseVerdict =
        Number(diff) < 0
          ? tr(`IMDb est de ${Math.abs(Number(diff))} point en dessous d'AniList.`, `IMDb is ${Math.abs(Number(diff))} points below AniList.`)
          : tr(`IMDb note plus généreusement (+${diff}) que la communauté d'AniList.`, `IMDb rates more generously (+${diff}) than the AniList community.`);
    }
  } else {
    baseVerdict = tr("Notes moyennes solides sur l'ensemble des plateformes.", 'Solid average ratings across all platforms.');
  }

  const extras: string[] = [];
  if (extra?.rankMal && extra.rankMal <= 100) {
    extras.push(tr(`Top #${extra.rankMal} mondial MAL`, `MAL Global Top #${extra.rankMal}`));
  }
  if (extra?.oscarsCount && extra.oscarsCount > 0) {
    extras.push(
      tr(
        `${extra.oscarsCount} Oscar${extra.oscarsCount > 1 ? 's' : ''} remporté${extra.oscarsCount > 1 ? 's' : ''}`,
        `${extra.oscarsCount} Oscar${extra.oscarsCount > 1 ? 's' : ''} won`
      )
    );
  } else if (extra?.winsCount && extra.winsCount > 0) {
    extras.push(
      tr(
        `${extra.winsCount} prix remporté${extra.winsCount > 1 ? 's' : ''}`,
        `${extra.winsCount} award win${extra.winsCount > 1 ? 's' : ''}`
      )
    );
  }
  if (extra?.rottenTomatoes) {
    extras.push(`Rotten Tomatoes ${extra.rottenTomatoes}`);
  }

  return extras.length > 0 ? `${baseVerdict} · ${extras.join(' · ')}` : baseVerdict;
}
