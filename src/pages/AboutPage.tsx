import { tr } from '../lib/i18n';
import React from 'react';
import { Info, Shield, Database, Send, Mail, Heart, HelpCircle, CheckCircle } from 'lucide-react';
import { CONFIG } from '../lib/config';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF]">
          <Info className="w-3.5 h-3.5" />
          <span>{tr("À propos du projet", "About the project")}</span>
        </div>
        <h1 className="font-['Bricolage_Grotesque'] text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
          AnimeAlert Buea
        </h1>
        <p className="text-sm sm:text-base text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          {tr("Un guide communautaire conçu pour simplifier la vie des amateurs d'animes et mangas à Buea, Douala, Yaoundé et dans toute la région.", "A community guide designed to make life easier for anime and manga fans in Buea, Douala, Yaoundé and across the region.")}
        </p>
      </div>

      {/* Mission */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-3">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          <span>{tr("Pourquoi AnimeAlert Buea ?", "Why AnimeAlert Buea?")}</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          {tr("Suivre les sorties d'animes peut être un vrai casse-tête : fuseaux horaires japonais ou américains décalés, notes dispersées sur différents sites, difficultés à savoir quand un épisode est réellement disponible au Cameroun.", "Following anime releases can be a real headache: mismatched Japanese or American time zones, ratings scattered across different sites, and difficulty knowing when an episode is actually available in Cameroon.")}
        </p>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          {tr("AnimeAlert Buea centralise les horaires en heure locale (", "AnimeAlert Buea centralizes schedules in local time (")}<strong className="text-[#14213D] dark:text-[#EEF1F8]">Africa/Douala, UTC+1</strong>{tr("), réunit les notes côte-à-côte, et avertit la communauté en direct sur Telegram.", "), puts ratings side by side, and alerts the community live on Telegram.")}
        </p>
      </section>

      {/* Comment fonctionnent les notes */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#2B50FF]" />
          <span>{tr("Comment fonctionnent les notes comparées ?", "How do the compared ratings work?")}</span>
        </h2>
        <div className="space-y-3 text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          <p>
            {tr("Plutôt que de te fier à une seule source, AnimeAlert interroge 3 bases complémentaires :", "Instead of relying on a single source, AnimeAlert queries 3 complementary databases:")}
          </p>
          <ul className="space-y-2 pl-4">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">AniList</strong> {tr(": Moyenne sur 10 calculée à partir des scores de la communauté active et internationale.", ": Average out of 10 calculated from the scores of the active, international community.")}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">MyAnimeList (Jikan API)</strong> {tr(": La base de référence historique des otakus avec plusieurs centaines de milliers d'avis.", ": The historical reference database for otaku, with several hundred thousand reviews.")}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">IMDb (OMDb API)</strong> {tr(": La note attribuée par le grand public mondial et les cinéphiles.", ": The rating given by the worldwide general public and movie buffs.")}
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Sources & Mentions légales */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-3">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          <span>{tr("Sources et respect des droits", "Sources and respect for rights")}</span>
        </h2>
        <div className="space-y-2 text-xs text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          <p>
            {tr("AnimeAlert Buea est une application d'information, de métadonnées et d'agenda.", "AnimeAlert Buea is an information, metadata and schedule application.")}
          </p>
          <p className="font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            {tr("AnimeAlert Buea n'héberge, ne stocke et ne transmet aucun fichier vidéo ni flux sous copyright sur ses serveurs.", "AnimeAlert Buea does not host, store or transmit any video file or copyrighted stream on its servers.")}
          </p>
          <p>
            {tr("Les résumés, titres, affiches et données de diffusion proviennent des API publiques officielles d'AniList, MyAnimeList (Jikan) et OMDb. Les liens de visionnage légal redirigent vers les diffuseurs officiels (Crunchyroll, Netflix, etc.).", "Summaries, titles, posters and airing data come from the official public APIs of AniList, MyAnimeList (Jikan) and OMDb. Legal viewing links redirect to official broadcasters (Crunchyroll, Netflix, etc.).")}
          </p>
        </div>
      </section>

      {/* Contact & Telegram */}
      <section className="p-6 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-3">
        <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Send className="w-5 h-5 text-[#2B50FF]" />
          <span>{tr("Contact & Communauté", "Contact & Community")}</span>
        </h3>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          {tr("Pour toute suggestion, partenariat ou signalement, écris-nous directement sur Telegram via notre canal ou contacte l'administrateur.", "For any suggestion, partnership or report, write to us directly on Telegram via our channel or contact the administrator.")}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="https://t.me/AnimeAlertBuea"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#2B50FF] text-white text-xs font-semibold hover:brightness-105 transition-all"
          >
            {tr("Rejoindre AnimeAlert sur Telegram", "Join AnimeAlert on Telegram")}
          </a>
          <button
            onClick={() => onNavigate('/canaux')}
            className="px-4 py-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]"
          >
            {tr("Explorer tous les canaux", "Explore all channels")}
          </button>
        </div>
      </section>
    </div>
  );
};
      
