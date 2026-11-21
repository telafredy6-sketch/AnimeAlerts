export type Langue = "fr" | "en";

function detecter(): Langue {
  try {
    const s = localStorage.getItem("langue");
    if (s === "fr" || s === "en") return s;
  } catch {}
  const nav = typeof navigator !== "undefined" ? (navigator.language || "") : "";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const langue: Langue = detecter();

if (typeof document !== "undefined") {
  document.documentElement.lang = langue;
}

/** tr("texte français", "english text") : renvoie le texte dans la langue choisie */
export function tr(fr: string, en: string): string {
  return langue === "en" ? en : fr;
}

/** Locale pour les dates et les nombres */
export const LOCALE = langue === "en" ? "en-GB" : "fr-FR";

/** Change la langue puis recharge la page */
export function changerLangue(l: Langue): void {
  try {
    localStorage.setItem("langue", l);
  } catch {}
  window.location.reload();
}
