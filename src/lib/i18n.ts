export type Langue = "fr" | "en";

function detecter(): Langue {
  try {
    const s = localStorage.getItem("langue");
    if (s === "fr" || s === "en") return s;
  } catch {}
  const nav = typeof navigator !== "undefined" ? (navigator.language || "") : "";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export let langue: Langue = detecter();

if (typeof document !== "undefined") {
  document.documentElement.lang = langue;
}

/** tr("texte français", "english text") : renvoie le texte dans la langue choisie */
export function tr(fr: string, en: string): string {
  return langue === "en" ? en : fr;
}

/** Locale pour les dates et les nombres */
export let LOCALE = langue === "en" ? "en-GB" : "fr-FR";

/** Change la langue instantanément sans recharger la page (évite les 404 SPA sur Vercel) */
export function changerLangue(l: Langue): void {
  langue = l;
  LOCALE = l === "en" ? "en-GB" : "fr-FR";
  try {
    localStorage.setItem("langue", l);
  } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("animealert:lang-change", { detail: l }));
  }
}
