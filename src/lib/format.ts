import { AnimeMedia, AnimeTitle } from './types';
import { CONFIG } from './config';

export function esc(texte: string | number | null | undefined): string {
  const table: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return String(texte ?? "").replace(/[&<>"']/g, c => table[c] || c);
}

export function urlSure(u: string | null | undefined): string {
  if (!u) return "";
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
  } catch {
    return "";
  }
}

export function titreDe(titleObj?: AnimeTitle | null, fallback = "Sans titre"): string {
  if (!titleObj) return fallback;
  return titleObj.english?.trim() || titleObj.romaji?.trim() || titleObj.native?.trim() || fallback;
}

export function titreSecondaire(titleObj?: AnimeTitle | null): string | null {
  if (!titleObj) return null;
  if (titleObj.english && titleObj.romaji && titleObj.english !== titleObj.romaji) {
    return titleObj.romaji;
  }
  return titleObj.native || null;
}

export function nettoyerDescription(desc: string | null | undefined): string {
  if (!desc) return "Aucun résumé disponible pour le moment.";
  return desc
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<i\b[^>]*>(.*?)<\/i>/gi, "$1")
    .replace(/<b\b[^>]*>(.*?)<\/b>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * Heure au Cameroun (Africa/Douala, UTC+1)
 */
export function heureCameroun(timestampSeconds: number): string {
  try {
    return new Date(timestampSeconds * 1000).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Douala"
    });
  } catch {
    return "--:--";
  }
}

export function dateCamerounComplete(timestampSeconds: number): string {
  try {
    return new Date(timestampSeconds * 1000).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Douala"
    });
  } catch {
    return "Date inconnue";
  }
}

export function jourCamerounCourt(timestampSeconds: number): string {
  try {
    return new Date(timestampSeconds * 1000).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "Africa/Douala"
    });
  } catch {
    return "";
  }
}

export function formatCompteARebours(secondesRestantes: number): string {
  if (secondesRestantes <= 0) return "Disponible !";

  const jours = Math.floor(secondesRestantes / 86400);
  const heures = Math.floor((secondesRestantes % 86400) / 3600);
  const minutes = Math.floor((secondesRestantes % 3600) / 60);
  const secs = Math.floor(secondesRestantes % 60);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (jours > 0) {
    return `${jours}j ${pad(heures)}h ${pad(minutes)}m`;
  }
  return `${pad(heures)}:${pad(minutes)}:${pad(secs)}`;
}

export function lienBot(): string {
  const nom = (CONFIG.botUsername || "").replace("@", "").trim();
  return nom ? `https://t.me/${nom}` : "";
}

export function lienTelegram(): string {
  const premier = CONFIG.canaux[0];
  return premier ? urlSure(premier.lien) : lienBot();
}
