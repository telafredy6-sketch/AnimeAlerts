import type { IncomingMessage, ServerResponse } from 'node:http';

const omdbServerCache = new Map<string, { data: any; expiry: number }>();

function isPlausibleAnimeMatch(item: any, expectedYear?: number): boolean {
  if (!item || item.Response !== 'True') return false;
  const genre = String(item.Genre || '').toLowerCase();
  if (genre.includes('animation')) return true;
  if (expectedYear && item.Year) {
    const startYear = parseInt(String(item.Year).slice(0, 4), 10);
    if (!isNaN(startYear) && Math.abs(startYear - expectedYear) <= 1) {
      return true;
    }
  }
  return false;
}

async function queryOmdb(params: URLSearchParams, apiKey: string): Promise<any | null> {
  params.set('apikey', apiKey);
  const url = `https://www.omdbapi.com/?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (json && json.Response === 'True') return json;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupOmdb(options: {
  imdbId?: string;
  titles: string[];
  year?: number;
  type?: string;
}): Promise<{ configured: boolean; data: any | null }> {
  const apiKey = (process.env.OMDB_API_KEY || '').trim();
  if (!apiKey) {
    return { configured: false, data: null };
  }

  const cleanImdbId = options.imdbId && /^tt\d{5,}$/.test(options.imdbId.trim()) ? options.imdbId.trim() : '';
  const cleanTitles = options.titles.map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const cacheKey = JSON.stringify({ i: cleanImdbId, titles: cleanTitles, y: options.year, type: options.type });

  const cached = omdbServerCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return { configured: true, data: cached.data };
  }

  let bestMatch: any | null = null;

  // 1. Exact IMDb ID lookup (most accurate)
  if (cleanImdbId) {
    const byId = await queryOmdb(new URLSearchParams({ i: cleanImdbId, plot: 'short' }), apiKey);
    if (byId) {
      bestMatch = byId;
    }
  }

  // 2. Title + Year + Type fallback cascade
  if (!bestMatch) {
    let fallbackMatch: any | null = null;
    for (const title of cleanTitles) {
      const attempts: URLSearchParams[] = [];
      if (options.year && options.type) {
        attempts.push(new URLSearchParams({ t: title, y: String(options.year), type: options.type }));
      }
      if (options.type) {
        attempts.push(new URLSearchParams({ t: title, type: options.type }));
      }
      if (options.year) {
        attempts.push(new URLSearchParams({ t: title, y: String(options.year) }));
      }
      attempts.push(new URLSearchParams({ t: title }));

      for (const p of attempts) {
        const hit = await queryOmdb(p, apiKey);
        if (!hit) continue;
        if (isPlausibleAnimeMatch(hit, options.year)) {
          bestMatch = hit;
          break;
        }
        if (!fallbackMatch) fallbackMatch = hit;
      }
      if (bestMatch) break;
    }
    if (!bestMatch && fallbackMatch) {
      bestMatch = fallbackMatch;
    }
  }

  omdbServerCache.set(cacheKey, {
    data: bestMatch,
    expiry: Date.now() + (bestMatch ? 60 * 60 * 1000 : 5 * 60 * 1000)
  });

  return { configured: true, data: bestMatch };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const i = reqUrl.searchParams.get('i') || undefined;
  const rawTitles = reqUrl.searchParams.get('titles');
  const singleTitle = reqUrl.searchParams.get('t');
  const yStr = reqUrl.searchParams.get('y');
  const type = reqUrl.searchParams.get('type') || undefined;

  let titles: string[] = [];
  if (rawTitles) {
    try {
      const parsed = JSON.parse(rawTitles);
      if (Array.isArray(parsed)) titles = parsed.map(String);
    } catch {
      titles = rawTitles.split('|');
    }
  } else if (singleTitle) {
    titles = [singleTitle];
  }

  const year = yStr && /^\d{4}$/.test(yStr) ? parseInt(yStr, 10) : undefined;
  const result = await lookupOmdb({ imdbId: i, titles, year, type });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.end(JSON.stringify(result));
}
