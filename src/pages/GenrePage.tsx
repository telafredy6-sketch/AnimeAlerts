import React, { useState, useEffect } from 'react';
import { Tag, Sparkles } from 'lucide-react';
import { anilist } from '../lib/anilist';
import { AnimeMedia } from '../lib/types';
import { AnimeCard } from '../components/AnimeCard';
import { GENRES, GENRES_FR } from '../lib/config';

interface GenrePageProps {
  slug?: string;
  onNavigate: (path: string) => void;
}

export const GenrePage: React.FC<GenrePageProps> = ({ slug, onNavigate }) => {
  // Trouver le nom du genre AniList correspondant
  const currentSlug = (slug || 'action').toLowerCase();
  const matchedGenre =
    GENRES.find((g) => g.toLowerCase() === currentSlug) || 'Action';
  const labelFr = GENRES_FR[matchedGenre] || matchedGenre;

  const [medias, setMedias] = useState<AnimeMedia[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let ignore = false;
    setChargement(true);

    const query = `
      query ($genre: String) {
        Page(page: 1, perPage: 24) {
          media(genre: $genre, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
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

    anilist(query, { genre: matchedGenre })
      .then((data) => {
        if (!ignore) {
          setMedias(data?.Page?.media || []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error('Erreur genre:', err);
          setMedias([]);
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, [matchedGenre]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-[#2B50FF] dark:text-[#7F95FF]" />
          <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
            Animes du genre : {labelFr}
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
          Les animes {labelFr.toLowerCase()} les plus plébiscités par la communauté internationale.
        </p>
      </div>

      {/* Genres Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D]">
        {GENRES.map((g) => {
          const isSelected = g.toLowerCase() === matchedGenre.toLowerCase();
          const fr = GENRES_FR[g] || g;
          return (
            <button
              key={g}
              onClick={() => onNavigate(`/genre/${g.toLowerCase()}`)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[#2B50FF] text-white shadow-sm shadow-[#2B50FF]/25 scale-105'
                  : 'bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]'
              }`}
            >
              {fr}
            </button>
          );
        })}
      </div>

      {/* Medias Grid */}
      {chargement ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : medias.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D]">
          <p className="text-sm font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            Aucun anime trouvé pour ce genre.
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
