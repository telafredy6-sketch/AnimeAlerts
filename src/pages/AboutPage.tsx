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
          <span>À propos du projet</span>
        </div>
        <h1 className="font-['Bricolage_Grotesque'] text-3xl sm:text-4xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
          AnimeAlert Buea
        </h1>
        <p className="text-sm sm:text-base text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          Un guide communautaire conçu pour simplifier la vie des amateurs d'animes et mangas à Buea, Douala, Yaoundé et dans toute la région.
        </p>
      </div>

      {/* Mission */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-3">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
          <span>Pourquoi AnimeAlert Buea ?</span>
        </h2>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          Suivre les sorties d'animes peut être un vrai casse-tête : fuseaux horaires japonais ou américains décalés, notes dispersées sur différents sites, difficultés à savoir quand un épisode est réellement disponible au Cameroun.
        </p>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          AnimeAlert Buea centralise les horaires en heure locale (<strong className="text-[#14213D] dark:text-[#EEF1F8]">Africa/Douala, UTC+1</strong>), réunit les notes côte-à-côte, et avertit la communauté en direct sur Telegram.
        </p>
      </section>

      {/* Comment fonctionnent les notes */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-4">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#2B50FF]" />
          <span>Comment fonctionnent les notes comparées ?</span>
        </h2>
        <div className="space-y-3 text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          <p>
            Plutôt que de te fier à une seule source, AnimeAlert interroge 3 bases complémentaires :
          </p>
          <ul className="space-y-2 pl-4">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">AniList</strong> : Moyenne sur 10 calculée à partir des scores de la communauté active et internationale.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">MyAnimeList (Jikan API)</strong> : La base de référence historique des otakus avec plusieurs centaines de milliers d'avis.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#2B50FF]">•</span>
              <span>
                <strong className="text-[#14213D] dark:text-[#EEF1F8]">IMDb (OMDb API)</strong> : La note attribuée par le grand public mondial et les cinéphiles.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Sources & Mentions légales */}
      <section className="p-6 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm space-y-3">
        <h2 className="font-['Bricolage_Grotesque'] text-xl font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          <span>Sources et respect des droits</span>
        </h2>
        <div className="space-y-2 text-xs text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          <p>
            AnimeAlert Buea est une application d'information, de métadonnées et d'agenda.
          </p>
          <p className="font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            AnimeAlert Buea n'héberge, ne stocke et ne transmet aucun fichier vidéo ni flux sous copyright sur ses serveurs.
          </p>
          <p>
            Les résumés, titres, affiches et données de diffusion proviennent des API publiques officielles d'AniList, MyAnimeList (Jikan) et OMDb. Les liens de visionnage légal redirigent vers les diffuseurs officiels (Crunchyroll, Netflix, etc.).
          </p>
        </div>
      </section>

      {/* Contact & Telegram */}
      <section className="p-6 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-3">
        <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8] flex items-center gap-2">
          <Send className="w-5 h-5 text-[#2B50FF]" />
          <span>Contact & Communauté</span>
        </h3>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
          Pour toute suggestion, partenariat ou signalement, écris-nous directement sur Telegram via notre canal ou contacte l'administrateur.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="https://t.me/AnimeAlertBuea"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#2B50FF] text-white text-xs font-semibold hover:brightness-105 transition-all"
          >
            Rejoindre AnimeAlert sur Telegram
          </a>
          <button
            onClick={() => onNavigate('/canaux')}
            className="px-4 py-2 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]"
          >
            Explorer tous les canaux
          </button>
        </div>
      </section>
    </div>
  );
};
