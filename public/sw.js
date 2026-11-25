const CACHE_NAME = 'animealert-v6';
const IMAGE_CACHE_NAME = 'animealert-images-v1';
const NOTIF_STATE_CACHE = 'animealert-notif-state';
const NOTIF_STATE_KEY = '/__animealert_notif_state__';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/aistudio/file_0000000012488210983af17121cf1c31_aeba312b.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              key !== IMAGE_CACHE_NAME &&
              key !== 'animealert-api-cache' &&
              key !== NOTIF_STATE_CACHE
          )
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore internal virtual cache key
  if (url.pathname === NOTIF_STATE_KEY) return;

  // Local /api/* and External JSON APIs (AniList, Jikan, OMDb, Wikidata): Network First with cache fallback
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname === 'graphql.anilist.co' ||
    url.hostname.includes('jikan.moe') ||
    url.hostname.includes('omdbapi.com') ||
    url.hostname.includes('wikidata.org')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            event.waitUntil(caches.open('animealert-api-cache').then((cache) => cache.put(event.request, clone)));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Anime CDN images (s4.anilist.co, img.anili.st): Fast Cache First
  if (
    event.request.destination === 'image' &&
    (url.hostname.includes('anilist.co') || url.hostname.includes('anili.st') || url.hostname.includes('myanimelist.net'))
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
              const clone = networkResponse.clone();
              event.waitUntil(cache.put(event.request, clone));
            }
            return networkResponse;
          });
        })
      )
    );
    return;
  }

  // HTML navigation requests: Network First so UI updates are seen immediately
  if (
    event.request.mode === 'navigate' ||
    (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html')))
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone)));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Immutable static assets (/assets/*, icons, manifest): Cache First then Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)));
        }
        return networkResponse;
      });
    })
  );
});

/* ---------------- Push Notifications & Cameroon Episode Alerts ---------------- */

function buildNotificationOptions(payload) {
  const title = payload.title || 'AnimeAlert Buea';
  const options = {
    body: payload.body || 'Un nouvel épisode sort bientôt au Cameroun.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || `animealert-${Date.now()}`,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: [150, 80, 150],
    data: {
      url: payload.url || '/calendrier',
      animeId: payload.animeId || null
    },
    actions: [
      { action: 'open', title: payload.openLabel || 'Voir la fiche' },
      { action: 'dismiss', title: payload.dismissLabel || 'Fermer' }
    ]
  };

  if (payload.image) {
    options.image = payload.image;
  }

  return { title, options };
}

// Standard Web Push event (VAPID / server-pushed payloads)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const { title, options } = buildNotificationOptions(payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus existing tab & navigate or open a new window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE_FROM_NOTIFICATION', url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

async function saveNotifState(state) {
  try {
    const cache = await caches.open(NOTIF_STATE_CACHE);
    await cache.put(
      NOTIF_STATE_KEY,
      new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } })
    );
  } catch {
    // ignore storage errors
  }
}

async function readNotifState() {
  try {
    const cache = await caches.open(NOTIF_STATE_CACHE);
    const res = await cache.match(NOTIF_STATE_KEY);
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatCameroonTime(tsSeconds, lang) {
  try {
    return new Date(tsSeconds * 1000).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Douala'
    });
  } catch {
    return '';
  }
}

async function checkUpcomingEpisodesInSW() {
  const state = await readNotifState();
  if (!state || !state.enabled) return;

  const isEn = state.lang === 'en';
  const now = Math.floor(Date.now() / 1000);
  const leadSeconds = (state.leadMinutes || 15) * 60;
  const windowEnd = now + leadSeconds + 300; // slight buffer for periodic sync

  const query = `
    query ($debut: Int, $fin: Int) {
      Page(page: 1, perPage: 30) {
        airingSchedules(airingAt_greater: $debut, airingAt_lesser: $fin, sort: TIME) {
          episode
          airingAt
          media {
            id
            title { romaji english }
            popularity
            isAdult
            coverImage { large }
          }
        }
      }
    }
  `;

  try {
    const resp = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { debut: now - 300, fin: windowEnd } })
    });
    if (!resp.ok) return;
    const json = await resp.json();
    const schedules = (json.data && json.data.Page && json.data.Page.airingSchedules) || [];

    const watchedSet = new Set([...(state.favoriteIds || []), ...(state.subscribedIds || [])]);
    const notifiedSet = new Set(state.notifiedKeys || []);
    let changed = false;

    for (const item of schedules) {
      if (!item.media || item.media.isAdult) continue;
      const animeId = item.media.id;

      if (state.scope === 'favorites_and_subs' && !watchedSet.has(animeId)) continue;
      if (state.scope === 'all_cameroon' && (item.media.popularity || 0) < 15000 && !watchedSet.has(animeId)) continue;

      const key = `${animeId}-${item.episode}-${state.leadMinutes || 0}`;
      if (notifiedSet.has(key)) continue;

      const titleText = item.media.title.english || item.media.title.romaji || 'Anime';
      const heure = formatCameroonTime(item.airingAt, state.lang);
      const isReleased = item.airingAt <= now;

      const notifTitle = isReleased
        ? (isEn ? `Episode ${item.episode} out: ${titleText}` : `Épisode ${item.episode} disponible : ${titleText}`)
        : (isEn ? `Airing soon: ${titleText} (Ep. ${item.episode})` : `Sortie imminente : ${titleText} (Ép. ${item.episode})`);

      const notifBody = isReleased
        ? (isEn ? `Aired at ${heure} (Cameroon time). Tap to view details.` : `Diffusé à ${heure} (heure du Cameroun). Touche pour voir la fiche.`)
        : (isEn ? `Airing at ${heure} (Cameroon time · Africa/Douala).` : `Diffusion prévue à ${heure} (heure du Cameroun · Africa/Douala).`);

      await self.registration.showNotification(notifTitle, {
        body: notifBody,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        image: (item.media.coverImage && item.media.coverImage.large) || undefined,
        tag: `animealert-ep-${animeId}-${item.episode}`,
        vibrate: [150, 80, 150],
        data: { url: `/anime/${animeId}`, animeId },
        actions: [
          { action: 'open', title: isEn ? 'View details' : 'Voir la fiche' },
          { action: 'dismiss', title: isEn ? 'Dismiss' : 'Fermer' }
        ]
      });

      notifiedSet.add(key);
      changed = true;
    }

    if (changed) {
      state.notifiedKeys = Array.from(notifiedSet).slice(-120);
      await saveNotifState(state);
    }
  } catch {
    // Ignore transient network errors in SW background sync
  }
}

// Listen for client postMessage triggers
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SHOW_ANIME_NOTIFICATION' && data.payload) {
    const { title, options } = buildNotificationOptions(data.payload);
    event.waitUntil(self.registration.showNotification(title, options));
  }

  if (data.type === 'SYNC_NOTIF_STATE' && data.state) {
    event.waitUntil(saveNotifState(data.state));
  }

  if (data.type === 'CHECK_UPCOMING_NOW') {
    event.waitUntil(checkUpcomingEpisodesInSW());
  }
});

// Background Periodic Sync (Chrome / Edge PWAs)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'animealert-cameroon-check') {
    event.waitUntil(checkUpcomingEpisodesInSW());
  }
});
