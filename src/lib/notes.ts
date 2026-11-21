import { tr } from './i18n';
import { CONFIG } from './config';

const malCache = new Map<number, { score: number | null; expiry: number }>();
const imdbCache = new Map<string, { rating: string | null; imdbId?: string; expiry: number }>();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchJikanScore(idMal: number): Promise<number | null> {
  const cached = malCache.get(idMal);
  if (cached && cached.expiry > Date.now()) {
    return cached.score;
  }

  for (let essai = 0; essai < 2; essai++) {
    try {
      const response = await fetch(`https://api.jikan.moe/v4/anime/${idMal}`);
      if (response.status === 429) {
        await sleep(1000);
        continue;
      }
      if (!response.ok) return null;
      const json = await response.json();
      const score = json.data && json.data.score ? Number(json.data.score) : null;
      malCache.set(idMal, { score, expiry: Date.now() + 10 * 60 * 1000 });
      return score;
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchOmdbRating(titles: string[]): Promise<{ rating: string | null; imdbId?: string }> {
  const cleanTitles = titles.filter(Boolean);
  if (!cleanTitles.length) return { rating: null };

  const key = cleanTitles[0];
  const cached = imdbCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return { rating: cached.rating, imdbId: cached.imdbId };
  }

  if (!CONFIG.omdbKey) {
    return { rating: null };
  }

  for (const t of cleanTitles) {
    try {
      const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(CONFIG.omdbKey)}&t=${encodeURIComponent(t)}`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const json = await response.json();
      if (json.Response === "True" && json.imdbRating && json.imdbRating !== "N/A") {
        const result = { rating: json.imdbRating, imdbId: json.imdbID };
        imdbCache.set(key, { ...result, expiry: Date.now() + 20 * 60 * 1000 });
        return result;
      }
    } catch {
      // ignore network errors
    }
  }

  return { rating: null };
}

export function analyseNotes(aniScore10?: number | null, malScore?: number | null, imdbScoreStr?: string | null): string {
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

  if (scores.length < 2) {
    if (scores.length === 1) {
      if (scores[0].val >= 8.5) return tr("Anime d'exception plébiscité par la communauté.", "Outstanding anime acclaimed by the community.");
      if (scores[0].val >= 7.5) return tr("Très bonne appréciation générale.", "Very good overall reception.");
      return tr("Note communautaire convenable.", "Decent community rating.");
    }
    return tr("Notes en cours de collecte auprès de la communauté.", "Ratings are still being collected from the community.");
  }

  const ani = scores.find(s => s.name === 'AniList')?.val;
  const mal = scores.find(s => s.name === 'MyAnimeList')?.val;
  const imdb = scores.find(s => s.name === 'IMDb')?.val;

  if (ani && mal) {
    const diff = Math.abs(ani - mal);
    if (diff <= 0.3) {
      return tr(`Harmonie forte entre AniList (${ani.toFixed(1)}) et MyAnimeList (${mal.toFixed(2)}) — avis très unanime !`, `Strong agreement between AniList (${ani.toFixed(1)}) and MyAnimeList (${mal.toFixed(2)}) — a very unanimous opinion!`);
    }
    if (ani > mal) {
      return tr(`AniList surévalue de ${(ani - mal).toFixed(1)} point par rapport à MyAnimeList.`, `AniList rates it ${(ani - mal).toFixed(1)} points higher than MyAnimeList.`);
    }
    return tr(`MyAnimeList est plus enthousiaste de ${(mal - ani).toFixed(1)} point qu'AniList.`, `MyAnimeList is ${(mal - ani).toFixed(1)} points more enthusiastic than AniList.`);
  }

  if (ani && imdb) {
    const diff = (imdb - ani).toFixed(1);
    if (Math.abs(Number(diff)) <= 0.4) {
      return tr(`Évaluation équivalente entre public anime (${ani.toFixed(1)}) et grand public IMDb (${imdb.toFixed(1)}).`, `Equivalent rating between the anime audience (${ani.toFixed(1)}) and the general IMDb audience (${imdb.toFixed(1)}).`);
    }
    return Number(diff) < 0
      ? tr(`IMDb est de ${Math.abs(Number(diff))} point en dessous d'AniList.`, `IMDb is ${Math.abs(Number(diff))} points below AniList.`)
      : tr(`IMDb note plus généreusement (+${diff}) que la communauté d'AniList.`, `IMDb rates more generously (+${diff}) than the AniList community.`);
  }

  return tr("Notes moyennes solides sur l'ensemble des plateformes.", "Solid average ratings across all platforms.");
}
