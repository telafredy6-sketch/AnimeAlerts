import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Filter } from 'lucide-react';
import { anilist } from '../lib/anilist';
import { AnimeMedia } from '../lib/types';
import { AnimeCard } from '../components/AnimeCard';
import { SAISONS } from '../lib/config';

interface SeasonPageProps {
  annee?: string;
  saisonSlug?: string;
  onNavigate: (path: string) => void;
}

export const SeasonPage: React.FC<SeasonPageProps> = ({ annee, saisonSlug, onNavigate }) => {
  const anneeVal = annee ? parseInt(annee, 10) : new Date().getFullYear();
  const saisonItem = SAISONS.find((s) => s.slug === (saisonSlug || 'printemps')) || SAISONS[0];

  const [medias, setMedias] = useState<AnimeMedia[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let ignore = false;
    setChargement(true);

    const query = `
      query ($season: MediaSeason, $seasonYear: Int) {
        Page(page: 1, perPage: 24) {
          media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
            id
            idMal
            title { romaji english native }
            coverImage { large extraLarge color }
            genres
            averageScore
            episodes
            status
            format
            seasonYear
            nextAiringEpisode { episode airingAt }
          }
        }
      }
    `;

    anilist(query, { season: saisonItem.id, seasonYear: anneeVal })
      .then((data) => {
        if (!ignore) {
          setMedias(data?.Page?.media || []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Erreur saison:', err);
          setMedias([]);
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, [saisonItem.id, anneeVal]);

  const annees = [2026, 2025, 2024, 2023, 2022];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#2B50FF] dark:text-[#7F95FF]" />
          <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
            Animes de la saison : {saisonItem.label} {anneeVal}
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
          Les animes les plus populaires diffusés durant la saison {saisonItem.label.toLowerCase()} {anneeVal}.
        </p>
      </div>

      {/* Season & Year Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D]">
        {/* Seasons buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {SAISONS.map((s) => {
            const isSelected = s.slug === saisonItem.slug;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(`/saison/${anneeVal}/${s.slug}`)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#2B50FF] text-white shadow-sm shadow-[#2B50FF]/25'
                    : 'bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Year dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#55607A] dark:text-[#A3AEC8] font-medium">Année :</span>
          <select
            value={anneeVal}
            onChange={(e) => onNavigate(`/saison/${e.target.value}/${saisonItem.slug}`)}
            className="p-1.5 rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] text-xs font-semibold outline-none"
          >
            {annees.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of anime cards */}
      {chargement ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : medias.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D]">
          <p className="text-sm font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            Aucun anime répertorié pour la saison {saisonItem.label} {anneeVal}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {medias.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};
