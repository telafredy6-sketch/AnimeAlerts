import React from 'react';
import { Send, Heart, ExternalLink } from 'lucide-react';
import { CONFIG } from '../lib/config';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] py-10 transition-colors mt-16 pb-24 md:pb-12 text-[#55607A] dark:text-[#A3AEC8] text-sm">
      <div className="w-[min(1180px,100%-2rem)] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Col 1: Brand & Presentation */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FFC83D] ring-2 ring-[#2B50FF]"></span>
            <span className="font-['Bricolage_Grotesque'] text-lg font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
              AnimeAlert Buea
            </span>
          </div>
          <p className="max-w-md text-xs leading-relaxed">
            Plateforme communautaire pour les passionnés d'animation japonaise à Buea et au Cameroun. Suivi des sorties en heure locale (Africa/Douala), comparaison des notes officielles et alertes en direct sur Telegram.
          </p>
          <p className="text-[11px] text-[#55607A]/80 dark:text-[#A3AEC8]/80">
            AnimeAlert Buea ne diffuse et n'héberge aucune vidéo protégée par le droit d'auteur. Données fournies par AniList GraphQL, Jikan API (MyAnimeList) et OMDb.
          </p>
        </div>

        {/* Col 2: Navigation rapide */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#14213D] dark:text-[#EEF1F8]">
            Navigation
          </h4>
          <ul className="space-y-1.5 text-xs">
            <li>
              <button onClick={() => onNavigate('/')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                Accueil & Sorties du jour
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/recherche')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                Recherche avancée & Filtres
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/calendrier')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                Calendrier hebdo 7 jours
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/favoris')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                Mes favoris & progression
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/a-propos')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                À propos & sources
              </button>
            </li>
          </ul>
        </div>

        {/* Col 3: Canaux & Telegram */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#14213D] dark:text-[#EEF1F8]">
            Communauté
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <a
                href="https://t.me/AnimeAlert"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline"
              >
                <span className="w-2 h-2 rounded-full bg-[#FFC83D]"></span>
                <span>Bot Telegram @AnimeAlert</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            </li>
            <li>
              <a
                href="https://t.me/AnimeAlertBuea"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors"
              >
                <Send className="w-3 h-3 text-[#2B50FF]" />
                <span>Canal AnimeAlert Buea</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            </li>
            <li>
              <button onClick={() => onNavigate('/canaux')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors">
                Voir tous nos 6 canaux
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('/canaux?proposer=1')} className="hover:text-[#2B50FF] dark:hover:text-[#7F95FF] transition-colors text-[#2B50FF] dark:text-[#7F95FF] font-medium">
                + Proposer un canal
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="w-[min(1180px,100%-2rem)] mx-auto mt-8 pt-6 border-t border-[#D5DBE8]/60 dark:border-[#27324D]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <p>© {new Date().getFullYear()} AnimeAlert Buea — Fait avec passion pour la communauté camerounaise.</p>
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('/a-propos')} className="hover:underline">Mentions légales</button>
          <span>·</span>
          <button onClick={() => onNavigate('/canaux')} className="hover:underline">Canaux Telegram</button>
        </div>
      </div>
    </footer>
  );
};
