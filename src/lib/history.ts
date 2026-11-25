const CLE_HISTORIQUE = "animealert:recherche_historique";
const MAX_HISTORIQUE = 10;

export function lireHistoriqueRecherche(): string[] {
  try {
    const raw = localStorage.getItem(CLE_HISTORIQUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ajouterHistoriqueRecherche(terme: string): void {
  const clean = terme.trim();
  if (!clean || clean.length < 2) return;

  try {
    let list = lireHistoriqueRecherche();
    // Enlever les doublons (insensible à la casse)
    list = list.filter(item => item.toLowerCase() !== clean.toLowerCase());
    list.unshift(clean);
    if (list.length > MAX_HISTORIQUE) {
      list = list.slice(0, MAX_HISTORIQUE);
    }
    localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(list));
  } catch (err) {
    console.error("Erreur enregistrement historique recherche:", err);
  }
}

export function supprimerElementHistorique(terme: string): string[] {
  try {
    const list = lireHistoriqueRecherche().filter(item => item !== terme);
    localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

export function effacerHistoriqueRecherche(): void {
  try {
    localStorage.removeItem(CLE_HISTORIQUE);
  } catch {
    // ignore
  }
}

export interface RecentAnimeItem {
  id: number;
  titre: string;
  affiche?: string;
  banniere?: string | null;
  format?: string;
  episodesTotal?: number | null;
  noteAniList?: number | null;
  consulteLe: number;
}

const CLE_RECENTS = "animealert:animes_recents";
const MAX_RECENTS = 10;

export function lireAnimesRecents(): RecentAnimeItem[] {
  try {
    const raw = localStorage.getItem(CLE_RECENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ajouterAnimeRecent(item: Omit<RecentAnimeItem, 'consulteLe'>): void {
  try {
    let list = lireAnimesRecents().filter((x) => x.id !== item.id);
    list.unshift({ ...item, consulteLe: Date.now() });
    if (list.length > MAX_RECENTS) {
      list = list.slice(0, MAX_RECENTS);
    }
    localStorage.setItem(CLE_RECENTS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('animealert:recent-change'));
  } catch {
    // ignore storage errors
  }
}

export function effacerAnimesRecents(): void {
  try {
    localStorage.removeItem(CLE_RECENTS);
    window.dispatchEvent(new CustomEvent('animealert:recent-change'));
  } catch {
    // ignore
  }
}
