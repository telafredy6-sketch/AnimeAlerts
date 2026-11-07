import React, { useState } from 'react';
import { HelpCircle, Search, Home, ChevronRight } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate: (path: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onNavigate(`/recherche?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2B50FF] dark:text-[#7F95FF] flex items-center justify-center mx-auto ring-8 ring-blue-500/10">
        <HelpCircle className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="font-['Bricolage_Grotesque'] text-5xl font-extrabold text-[#2B50FF] dark:text-[#7F95FF]">
          404
        </span>
        <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold text-[#14213D] dark:text-[#EEF1F8]">
          Page ou anime introuvable
        </h1>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] max-w-sm mx-auto">
          L'adresse demandée n'existe pas ou la fiche a été déplacée. Lance une recherche ci-dessous pour trouver ton anime.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#55607A]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex. Bleach, Naruto, Dandadan..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] text-xs sm:text-sm outline-none focus:border-[#2B50FF]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#2B50FF] text-white text-xs font-semibold hover:brightness-105 transition-all"
        >
          Chercher
        </button>
      </form>

      <div className="pt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Retour à l'accueil</span>
        </button>
        <button
          onClick={() => onNavigate('/recherche')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF] hover:underline"
        >
          <span>Voir le catalogue</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
