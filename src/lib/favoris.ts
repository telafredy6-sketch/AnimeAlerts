import { FavoriItem } from './types';

const CLE_FAVORIS = "animealert:favoris";
const CLE_PROGRESSION = "animealert:progression";

export function lireFavoris(): FavoriItem[] {
  try {
    const raw = localStorage.getItem(CLE_FAVORIS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Erreur lecture favoris:", err);
    return [];
  }
}

export function estFavori(id: number): boolean {
  return lireFavoris().some(a => a.id === id);
}

export function basculerFavori(anime: {
  id: number;
  idMal?: number | null;
  titre: string;
  titreOriginal?: string;
  affiche?: string;
  noteAniList?: number | null;
  format?: string;
  episodesTotal?: number | null;
}): boolean {
  const list = lireFavoris();
  const index = list.findIndex(a => a.id === anime.id);
  let estAjoute = false;

  if (index >= 0) {
    list.splice(index, 1);
    estAjoute = false;
  } else {
    // Récupérer la progression existante si présente
    const prog = lireProgression(anime.id);
    list.unshift({
      id: anime.id,
      idMal: anime.idMal,
      titre: anime.titre,
      titreOriginal: anime.titreOriginal,
      affiche: anime.affiche,
      noteAniList: anime.noteAniList,
      format: anime.format,
      episodesTotal: anime.episodesTotal ?? null,
      episodesVus: prog.episodesVus || 0,
      ajouteLe: Date.now()
    });
    estAjoute = true;
  }

  try {
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("favoris:change", { detail: { count: list.length } }));
  } catch (err) {
    console.error("Erreur enregistrement favoris:", err);
  }

  return estAjoute;
}

export function supprimerFavori(id: number): void {
  const list = lireFavoris().filter(a => a.id !== id);
  try {
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("favoris:change", { detail: { count: list.length } }));
  } catch (err) {
    console.error("Erreur suppression favori:", err);
  }
}

export function lireProgression(animeId: number): { episodesVus: number; total: number | null } {
  try {
    const raw = localStorage.getItem(CLE_PROGRESSION);
    const map = raw ? JSON.parse(raw) : {};
    return map[String(animeId)] || { episodesVus: 0, total: null };
  } catch {
    return { episodesVus: 0, total: null };
  }
}

export function sauvegarderProgression(animeId: number, episodesVus: number, total?: number | null): void {
  try {
    const raw = localStorage.getItem(CLE_PROGRESSION);
    const map = raw ? JSON.parse(raw) : {};
    const safeVus = Math.max(0, episodesVus);
    map[String(animeId)] = { episodesVus: safeVus, total: total ?? null };
    localStorage.setItem(CLE_PROGRESSION, JSON.stringify(map));

    // Mettre aussi à jour la liste des favoris si l'anime y est présent
    const favoris = lireFavoris();
    const fav = favoris.find(f => f.id === animeId);
    if (fav) {
      fav.episodesVus = safeVus;
      if (total !== undefined) fav.episodesTotal = total;
      localStorage.setItem(CLE_FAVORIS, JSON.stringify(favoris));
    }

    window.dispatchEvent(new CustomEvent("favoris:change", { detail: { count: favoris.length } }));
  } catch (err) {
    console.error("Erreur enregistrement progression:", err);
  }
}

export function exporterFavorisJSON(): string {
  const favoris = lireFavoris();
  const rawProg = localStorage.getItem(CLE_PROGRESSION) || "{}";
  const bundle = {
    app: "AnimeAlert Buea",
    dateExport: new Date().toISOString(),
    version: 1,
    favoris,
    progression: JSON.parse(rawProg)
  };
  return JSON.stringify(bundle, null, 2);
}

export function importerFavorisJSON(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || !Array.isArray(data.favoris)) {
      throw new Error("Format JSON non valide");
    }

    // Fusion intelligente
    const existants = lireFavoris();
    const map = new Map<number, FavoriItem>();
    existants.forEach(item => map.set(item.id, item));
    data.favoris.forEach((item: FavoriItem) => {
      if (item && item.id) {
        map.set(item.id, { ...map.get(item.id), ...item });
      }
    });

    const fusion = Array.from(map.values());
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(fusion));

    if (data.progression && typeof data.progression === 'object') {
      const rawProg = localStorage.getItem(CLE_PROGRESSION);
      const curProg = rawProg ? JSON.parse(rawProg) : {};
      Object.assign(curProg, data.progression);
      localStorage.setItem(CLE_PROGRESSION, JSON.stringify(curProg));
    }

    window.dispatchEvent(new CustomEvent("favoris:change", { detail: { count: fusion.length } }));
    return true;
  } catch (err) {
    console.error("Erreur importation favoris:", err);
    return false;
  }
}
