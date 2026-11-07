import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Plus,
  Minus,
  ArrowUpDown,
  Search,
  ExternalLink
} from 'lucide-react';
import { FavoriItem } from '../lib/types';
import {
  lireFavoris,
  supprimerFavori,
  sauvegarderProgression,
  exporterFavorisJSON,
  importerFavorisJSON
} from '../lib/favoris';
import { FORMATS } from '../lib/config';

interface FavoritesPageProps {
  onNavigate: (path: string) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({ onNavigate }) => {
  const [favoris, setFavoris] = useState<FavoriItem[]>(() => lireFavoris());
  const [tri, setTri] = useState<'date' | 'titre' | 'note'>('date');
  const [rechercheLocale, setRechercheLocale] = useState('');
  const [messageFeedback, setMessageFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFavChange = () => {
      setFavoris(lireFavoris());
    };
    window.addEventListener('favoris:change', handleFavChange);
    return () => window.removeEventListener('favoris:change', handleFavChange);
  }, []);

  const handleSupprimer = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    supprimerFavori(id);
    setFavoris(lireFavoris());
  };

  const handleUpdateEpisode = (e: React.MouseEvent, item: FavoriItem, delta: number) => {
    e.stopPropagation();
    const current = item.episodesVus || 0;
    const total = item.episodesTotal || null;
    const next = Math.max(0, current + delta);
    const capped = total ? Math.min(total, next) : next;
    sauvegarderProgression(item.id, capped, total);
    setFavoris(lireFavoris());
  };

  const handleExporter = () => {
    const json = exporterFavorisJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animealert-favoris-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessageFeedback('Fichier JSON de sauvegarde exporté avec succès !');
    setTimeout(() => setMessageFeedback(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const ok = importerFavorisJSON(content);
        if (ok) {
          setFavoris(lireFavoris());
          setMessageFeedback('Favoris et progression importés avec succès !');
        } else {
          setMessageFeedback("Erreur lors de l'import : format de fichier non reconnu.");
        }
        setTimeout(() => setMessageFeedback(null), 3500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Statistiques globales
  const totalAnimes = favoris.length;
  const totalVus = favoris.reduce((acc, f) => acc + (f.episodesVus || 0), 0);
  const totalEpisodesAttendus = favoris.reduce((acc, f) => acc + (f.episodesTotal || 0), 0);
  const animesCompletes = favoris.filter(
    (f) => f.episodesTotal && (f.episodesVus || 0) >= f.episodesTotal
  ).length;

  // Filtrage et tri
  const favorisFiltres = favoris
    .filter((f) => {
      if (!rechercheLocale.trim()) return true;
      return f.titre.toLowerCase().includes(rechercheLocale.toLowerCase());
    })
    .sort((a, b) => {
      if (tri === 'titre') return a.titre.localeCompare(b.titre);
      if (tri === 'note') return (b.noteAniList || 0) - (a.noteAniList || 0);
      return b.ajouteLe - a.ajouteLe;
    });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
              Mes Animes Favoris
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
            Persisté dans ton navigateur · Aucun compte ni inscription requis.
          </p>
        </div>

        {/* Import / Export JSON buttons */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors"
            title="Importer un fichier JSON de favoris"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer</span>
          </button>
          <button
            onClick={handleExporter}
            disabled={totalAnimes === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] disabled:opacity-40 hover:border-[#2B50FF] transition-colors"
            title="Exporter tes favoris pour changer de téléphone ou navigateur"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {messageFeedback && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF] animate-in fade-in">
          {messageFeedback}
        </div>
      )}

      {/* Global Progress Metrics Strip */}
      {totalAnimes > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm">
          <div>
            <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] block">Animes suivis</span>
            <span className="font-['Bricolage_Grotesque'] text-2xl font-extrabold text-[#14213D] dark:text-[#EEF1F8] tabular-nums">
              {totalAnimes}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] block">Épisodes vus</span>
            <span className="font-['Bricolage_Grotesque'] text-2xl font-extrabold text-[#2B50FF] dark:text-[#7F95FF] tabular-nums">
              {totalVus}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] block">Épisodes restants</span>
            <span className="font-['Bricolage_Grotesque'] text-2xl font-extrabold text-amber-500 tabular-nums">
              {totalEpisodesAttendus > totalVus ? totalEpisodesAttendus - totalVus : 0}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] block">Séries complétées</span>
            <span className="font-['Bricolage_Grotesque'] text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {animesCompletes}
            </span>
          </div>
        </div>
      )}

      {/* Local search & Sort bar */}
      {totalAnimes > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#55607A]" />
            <input
              type="text"
              value={rechercheLocale}
              onChange={(e) => setRechercheLocale(e.target.value)}
              placeholder="Filtrer dans mes favoris..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#55607A] dark:text-[#A3AEC8]">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Trier :</span>
            <div className="flex items-center p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D]">
              <button
                onClick={() => setTri('date')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  tri === 'date' ? 'bg-[#2B50FF] text-white' : 'hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
                }`}
              >
                Récents
              </button>
              <button
                onClick={() => setTri('note')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  tri === 'note' ? 'bg-[#2B50FF] text-white' : 'hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
                }`}
              >
                Notes
              </button>
              <button
                onClick={() => setTri('titre')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  tri === 'titre' ? 'bg-[#2B50FF] text-white' : 'hover:text-[#14213D] dark:hover:text-[#EEF1F8]'
                }`}
              >
                Titre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Favorites List */}
      {totalAnimes === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-[#D5DBE8] dark:border-[#27324D] space-y-4 my-8">
          <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 mx-auto flex items-center justify-center">
            <Heart className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
              Ta liste de favoris est vide pour le moment
            </h3>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] max-w-sm mx-auto">
              Clique sur le cœur ♡ sur n'importe quelle carte d'anime pour l'ajouter ici et suivre ta progression d'épisodes.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/recherche')}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#2B50FF] text-white hover:brightness-105 transition-all shadow-md"
          >
            Découvrir des animes
          </button>
        </div>
      ) : favorisFiltres.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D]">
          <p className="text-sm font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            Aucun favori ne correspond à « {rechercheLocale} »
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorisFiltres.map((item) => {
            const score = item.noteAniList ? (item.noteAniList / 10).toFixed(1) : null;
            const formatStr = item.format ? FORMATS[item.format] || item.format : null;
            const vus = item.episodesVus || 0;
            const total = item.episodesTotal;
            const isCompleted = total && vus >= total;

            return (
              <div
                key={item.id}
                onClick={() => onNavigate(`/anime/${item.id}`)}
                className="group relative flex flex-col justify-between p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex gap-3">
                  <div className="w-16 h-24 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                    {item.affiche ? (
                      <img
                        src={item.affiche}
                        alt={item.titre}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Affiche
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8]">
                        {formatStr || 'Anime'}
                      </span>
                      <button
                        onClick={(e) => handleSupprimer(e, item.id)}
                        className="p-1 text-[#55607A] hover:text-rose-500 transition-colors"
                        title="Supprimer des favoris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-bold text-sm text-[#14213D] dark:text-[#EEF1F8] line-clamp-1 group-hover:text-[#2B50FF] transition-colors">
                      {item.titre}
                    </h3>

                    {score && (
                      <span className="text-xs font-bold text-amber-500 tabular-nums">
                        ★ {score}/10
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar and episode tracker */}
                <div className="mt-3 pt-3 border-t border-[#D5DBE8]/60 dark:border-[#27324D]/60 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-[#55607A] dark:text-[#A3AEC8]">
                      {isCompleted ? (
                        <span className="text-emerald-600 font-bold">Complété !</span>
                      ) : (
                        <>Épisode <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">{vus}</strong> {total ? `/ ${total}` : ''}</>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleUpdateEpisode(e, item, -1)}
                      disabled={vus <= 0}
                      className="p-1 rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] disabled:opacity-30 hover:border-[#2B50FF]"
                      title="-1 épisode"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleUpdateEpisode(e, item, 1)}
                      disabled={total ? vus >= total : false}
                      className="p-1 rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] disabled:opacity-30 hover:border-[#2B50FF]"
                      title="+1 épisode"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
