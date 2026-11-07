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
