import { anilist, QUERY_SORTIES_24H } from './anilist';
import { lireFavoris } from './favoris';
import { heureCameroun, titreDe } from './format';
import { tr, langue } from './i18n';
import { AiringScheduleItem } from './types';

export type NotificationScope = 'favorites_and_subs' | 'all_cameroon';
export type NotificationLeadMinutes = 0 | 15 | 30;

export interface NotificationPrefs {
  enabled: boolean;
  scope: NotificationScope;
  leadMinutes: NotificationLeadMinutes;
  subscribedIds: number[];
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  animeId?: number;
  icon?: string;
  image?: string;
  tag?: string;
  openLabel?: string;
  dismissLabel?: string;
}

const CLE_PREFS = 'animealert:push_prefs';
const CLE_NOTIFIED = 'animealert:notified_episodes';
const NOTIF_EVENT = 'animealert:notifications-change';

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  scope: 'favorites_and_subs',
  leadMinutes: 15,
  subscribedIds: []
};

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function lireNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(CLE_PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      scope: parsed.scope === 'all_cameroon' ? 'all_cameroon' : 'favorites_and_subs',
      leadMinutes: [0, 15, 30].includes(parsed.leadMinutes) ? parsed.leadMinutes : 15,
      subscribedIds: Array.isArray(parsed.subscribedIds) ? parsed.subscribedIds : []
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function lireNotifiedKeys(): string[] {
  try {
    const raw = localStorage.getItem(CLE_NOTIFIED);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sauvegarderNotifiedKeys(keys: string[]): void {
  try {
    localStorage.setItem(CLE_NOTIFIED, JSON.stringify(keys.slice(-120)));
  } catch {
    // ignore storage errors
  }
}

export function sauvegarderNotificationPrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(CLE_PREFS, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: prefs }));
  void syncStateToServiceWorker(prefs);
}

export function isAnimeSubscribed(animeId: number): boolean {
  const prefs = lireNotificationPrefs();
  return prefs.subscribedIds.includes(animeId);
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function syncStateToServiceWorker(prefs?: NotificationPrefs): Promise<void> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return;
  const activePrefs = prefs || lireNotificationPrefs();
  const favoriteIds = lireFavoris().map((f) => f.id);
  const notifiedKeys = lireNotifiedKeys();

  const swTarget = reg.active || reg.waiting || reg.installing;
  if (swTarget) {
    swTarget.postMessage({
      type: 'SYNC_NOTIF_STATE',
      state: {
        ...activePrefs,
        lang: langue,
        favoriteIds,
        notifiedKeys
      }
    });
  }
}

export async function registerPeriodicCameroonSync(): Promise<boolean> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return false;
  try {
    const periodicSync = (reg as unknown as {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    }).periodicSync;
    if (periodicSync) {
      await periodicSync.register('animealert-cameroon-check', {
        minInterval: 15 * 60 * 1000
      });
      return true;
    }
  } catch {
    // Periodic Background Sync may not be granted or supported on all browsers
  }
  return false;
}

export async function showServiceWorkerNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;

  const reg = await getServiceWorkerRegistration();
  const fullPayload: NotificationPayload = {
    openLabel: tr('Voir la fiche', 'View details'),
    dismissLabel: tr('Fermer', 'Dismiss'),
    icon: '/pwa-192x192.png',
    ...payload
  };

  if (reg) {
    try {
      if (reg.active) {
        reg.active.postMessage({ type: 'SHOW_ANIME_NOTIFICATION', payload: fullPayload });
        return true;
      }
      await reg.showNotification(fullPayload.title, {
        body: fullPayload.body,
        icon: fullPayload.icon,
        badge: '/pwa-192x192.png',
        tag: fullPayload.tag || `animealert-${Date.now()}`,
        data: { url: fullPayload.url || '/', animeId: fullPayload.animeId }
      });
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    new Notification(fullPayload.title, {
      body: fullPayload.body,
      icon: '/pwa-192x192.png'
    });
    return true;
  } catch {
    return false;
  }
}

export async function enableCameroonPushNotifications(): Promise<{
  ok: boolean;
  permission: NotificationPermission | 'unsupported';
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, permission: 'unsupported' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    const prefs = lireNotificationPrefs();
    if (prefs.enabled) {
      sauvegarderNotificationPrefs({ ...prefs, enabled: false });
    }
    return { ok: false, permission };
  }

  const prefs = lireNotificationPrefs();
  const nextPrefs: NotificationPrefs = { ...prefs, enabled: true };
  sauvegarderNotificationPrefs(nextPrefs);
  await registerPeriodicCameroonSync();

  return { ok: true, permission };
}

export function disableCameroonPushNotifications(): void {
  const prefs = lireNotificationPrefs();
  sauvegarderNotificationPrefs({ ...prefs, enabled: false });
}

export async function toggleAnimeSubscription(
  animeId: number,
  animeTitle?: string
): Promise<{ subscribed: boolean; permission: NotificationPermission | 'unsupported' }> {
  const prefs = lireNotificationPrefs();
  const already = prefs.subscribedIds.includes(animeId);

  if (already) {
    const nextIds = prefs.subscribedIds.filter((id) => id !== animeId);
    sauvegarderNotificationPrefs({ ...prefs, subscribedIds: nextIds });
    return { subscribed: false, permission: getNotificationPermission() };
  }

  // Subscribing: ensure permission is granted
  const res = await enableCameroonPushNotifications();
  if (!res.ok) {
    return { subscribed: false, permission: res.permission };
  }

  const updatedPrefs = lireNotificationPrefs();
  const nextIds = Array.from(new Set([...updatedPrefs.subscribedIds, animeId]));
  sauvegarderNotificationPrefs({ ...updatedPrefs, enabled: true, subscribedIds: nextIds });

  if (animeTitle) {
    await showServiceWorkerNotification({
      title: tr(`Alerte activée : ${animeTitle}`, `Alert enabled: ${animeTitle}`),
      body: tr(
        `Tu recevras une notification push avant la sortie au Cameroun (UTC+1).`,
        `You will receive a push notification before its Cameroon release (UTC+1).`
      ),
      url: `/anime/${animeId}`,
      animeId,
      tag: `animealert-sub-${animeId}`
    });
  }

  return { subscribed: true, permission: res.permission };
}

export async function sendTestCameroonNotification(): Promise<{
  ok: boolean;
  permission: NotificationPermission | 'unsupported';
}> {
  const res = await enableCameroonPushNotifications();
  if (!res.ok) return res;

  const now = Math.floor(Date.now() / 1000);
  try {
    const data = await anilist(QUERY_SORTIES_24H, { debut: now, fin: now + 86400 });
    const schedules: AiringScheduleItem[] = (data?.Page?.airingSchedules || [])
      .filter((i: AiringScheduleItem) => !i.media?.isAdult)
      .sort((a: AiringScheduleItem, b: AiringScheduleItem) => a.airingAt - b.airingAt);

    if (schedules.length > 0) {
      const next = schedules[0];
      const titleText = titreDe(next.media.title);
      const heure = heureCameroun(next.airingAt);
      const sent = await showServiceWorkerNotification({
        title: tr(
          `Prochaine sortie au Cameroun : ${titleText}`,
          `Next Cameroon release: ${titleText}`
        ),
        body: tr(
          `Épisode ${next.episode} prévu à ${heure} (heure du Cameroun). Touche pour ouvrir la fiche.`,
          `Episode ${next.episode} airing at ${heure} (Cameroon time). Tap to open details.`
        ),
        url: `/anime/${next.media.id}`,
        animeId: next.media.id,
        image: next.media.coverImage?.large || undefined,
        tag: `animealert-test-${next.media.id}-${next.episode}`
      });
      return { ok: sent, permission: res.permission };
    }
  } catch {
    // Fallback below if offline or AniList unreachable
  }

  const sent = await showServiceWorkerNotification({
    title: tr('Notifications AnimeAlert Buea activées', 'AnimeAlert Buea notifications active'),
    body: tr(
      'Les alertes de nouveaux épisodes en heure du Cameroun (UTC+1) passent bien par le Service Worker.',
      'New episode alerts in Cameroon time (UTC+1) are working through the Service Worker.'
    ),
    url: '/calendrier',
    tag: 'animealert-test-fallback'
  });

  return { ok: sent, permission: res.permission };
}

let isChecking = false;

export async function checkUpcomingCameroonEpisodes(): Promise<number> {
  if (isChecking) return 0;
  if (!isPushSupported() || Notification.permission !== 'granted') return 0;

  const prefs = lireNotificationPrefs();
  if (!prefs.enabled) return 0;

  isChecking = true;
  let notifiedCount = 0;

  try {
    const now = Math.floor(Date.now() / 1000);
    const leadSeconds = prefs.leadMinutes * 60;
    const debut = now - 300; // up to 5 min past release
    const fin = now + leadSeconds + 120; // inside lead time window

    const data = await anilist(QUERY_SORTIES_24H, { debut, fin });
    const schedules: AiringScheduleItem[] = (data?.Page?.airingSchedules || []).filter(
      (i: AiringScheduleItem) => !i.media?.isAdult
    );

    const favoriteIds = lireFavoris().map((f) => f.id);
    const watchedSet = new Set<number>([...favoriteIds, ...prefs.subscribedIds]);
    const notifiedKeys = new Set<string>(lireNotifiedKeys());

    for (const item of schedules) {
      const animeId = item.media.id;
      const isWatched = watchedSet.has(animeId);

      if (prefs.scope === 'favorites_and_subs' && !isWatched) continue;
      if (prefs.scope === 'all_cameroon' && (item.media.popularity || 0) < 12000 && !isWatched) continue;

      const key = `${animeId}-${item.episode}-${prefs.leadMinutes}`;
      if (notifiedKeys.has(key)) continue;

      const titleText = titreDe(item.media.title);
      const heure = heureCameroun(item.airingAt);
      const isReleased = item.airingAt <= now;

      const title = isReleased
        ? tr(`Épisode ${item.episode} sorti : ${titleText}`, `Episode ${item.episode} out: ${titleText}`)
        : tr(
            `Sortie dans ~${prefs.leadMinutes} min : ${titleText}`,
            `Airing in ~${prefs.leadMinutes} min: ${titleText}`
          );

      const body = isReleased
        ? tr(
            `Disponible depuis ${heure} (heure du Cameroun). Touche pour voir la fiche.`,
            `Aired at ${heure} (Cameroon time). Tap to open details.`
          )
        : tr(
            `Épisode ${item.episode} à ${heure} (heure du Cameroun · Africa/Douala).`,
            `Episode ${item.episode} at ${heure} (Cameroon time · Africa/Douala).`
          );

      const ok = await showServiceWorkerNotification({
        title,
        body,
        url: `/anime/${animeId}`,
        animeId,
        image: item.media.coverImage?.large || undefined,
        tag: `animealert-ep-${animeId}-${item.episode}`
      });

      if (ok) {
        notifiedKeys.add(key);
        notifiedCount++;
      }
    }

    if (notifiedCount > 0) {
      sauvegarderNotifiedKeys(Array.from(notifiedKeys));
      void syncStateToServiceWorker(prefs);
    }
  } catch {
    // Silent failure when offline
  } finally {
    isChecking = false;
  }

  return notifiedCount;
}
