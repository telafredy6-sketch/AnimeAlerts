import React, { useState, useEffect } from 'react';
import { Star, Heart, Calendar, PlayCircle } from 'lucide-react';
import { AnimeMedia } from '../lib/types';
import { titreDe, urlSure } from '../lib/format';
import { FORMATS, STATUTS } from '../lib/config';
import { estFavori, basculerFavori } from '../lib/favoris';

interface AnimeCardProps {
  anime: AnimeMedia;
  onNavigate: (path: string) => void;
  layout?: 'grid' | 'compact' | 'horizontal';
}

export const AnimeCard: React.FC<AnimeCardProps> = ({ anime, onNavigate, layout = 'grid' }) => {
  const [isFav, setIsFav] = useState(() => estFavori(anime.id));
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const handleFavChange = () => {
      setIsFav(estFavori(anime.id));
    };
    window.addEventListener('favoris:change', handleFavChange);
    return () => window.removeEventListener('favoris:change', handleFavChange);
  }, [anime.id]);

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = basculerFavori({
      id: anime.id,
      idMal: anime.idMal,
      titre: titreDe(anime.title),
      titreOriginal: anime.title?.native || anime.title?.romaji,
      affiche: anime.coverImage?.large || anime.coverImage?.extraLarge || '',
      noteAniList: anime.averageScore,
      format: anime.format,
      episodesTotal: anime.episodes
    });
    setIsFav(added);
  };

  const title = titreDe(anime.title);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const formatStr = anime.format ? FORMATS[anime.format] || anime.format : null;
  const statusInfo = anime.status ? STATUTS[anime.status] : null;
  const coverUrl = anime.coverImage?.large || anime.coverImage?.extraLarge || anime.coverImage?.medium;

  if (layout === 'horizontal') {
    return (
      <article
        onClick={() => onNavigate(`/anime/${anime.id}`)}
        className="group relative flex gap-4 p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] dark:hover:border-[#7F95FF] hover:shadow-md transition-all cursor-pointer"
      >
        <div className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              Affiche
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#55607A] dark:text-[#A3AEC8] mb-1">
              {formatStr && <span>{formatStr}</span>}
              {anime.seasonYear && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{anime.seasonYear}</span>
                </>
              )}
              {score && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-0.5 text-[#14213D] dark:text-[#EEF1F8] font-bold">
                    <Star className="w-3 h-3 fill-[#FFC83D] text-[#FFC83D]" />
                    {score}
                  </span>
                </>
              )}
            </div>

            <h3 className="font-['Bricolage_Grotesque'] text-sm sm:text-base font-bold text-[#14213D] dark:text-[#EEF1F8] leading-snug line-clamp-2 group-hover:text-[#2B50FF] dark:group-hover:text-[#7F95FF] transition-colors">
              {title}
            </h3>

            {anime.genres && anime.genres.length > 0 && (
              <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] mt-1 truncate">
                {anime.genres.slice(0, 3).join(', ')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#D5DBE8]/60 dark:border-[#27324D]/60 mt-2">
            <span className="text-[11px] text-[#55607A] dark:text-[#A3AEC8]">
              {anime.episodes ? `${anime.episodes} épisodes` : 'Épisodes en cours'}
            </span>
            <button
              onClick={handleToggleFav}
              className={`p-1.5 rounded-lg border transition-colors ${
                isFav
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-600'
                  : 'border-transparent text-[#55607A] hover:text-rose-600'
              }`}
              title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600' : ''}`} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => onNavigate(`/anime/${anime.id}`)}
      className="group relative flex flex-col rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] dark:hover:border-[#7F95FF] hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer"
    >
      {/* Cover image slot with fallback */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 text-center">
            <PlayCircle className="w-8 h-8 text-slate-400 mb-1" />
            <span className="text-xs font-medium text-slate-500">{title}</span>
          </div>
        )}

        {/* Top gradient scrim */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* Quick Favorite Toggle */}
        <button
          onClick={handleToggleFav}
          className={`absolute top-2.5 right-2.5 p-2 rounded-xl backdrop-blur-md transition-all ${
            isFav
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-black/40 text-white/90 hover:bg-black/60 hover:text-white'
          }`}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-label="Favori"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
        </button>

        {/* Score Badge */}
        {score && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-bold tabular-nums">
            <Star className="w-3.5 h-3.5 fill-[#FFC83D] text-[#FFC83D]" />
            <span>{score}</span>
          </div>
        )}

        {/* Airing Tag if upcoming episode */}
        {anime.nextAiringEpisode && (
          <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg bg-[#1F3FD6]/90 backdrop-blur-sm text-white text-[11px] font-semibold flex items-center justify-between">
            <span>Ép. {anime.nextAiringEpisode.episode}</span>
            <span className="text-[#FFC83D]">À venir</span>
          </div>
        )}
      </div>

      {/* Info Body */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div>
          {/* Metadata: format, year, status */}
          <div className="flex items-center gap-1.5 text-xs text-[#55607A] dark:text-[#A3AEC8] mb-1">
            {formatStr && <span>{formatStr}</span>}
            {anime.seasonYear && (
              <>
                <span aria-hidden="true">·</span>
                <span>{anime.seasonYear}</span>
              </>
            )}
            {anime.episodes && (
              <>
                <span aria-hidden="true">·</span>
                <span>{anime.episodes} ép.</span>
              </>
            )}
          </div>

          <h3 className="font-['Bricolage_Grotesque'] text-sm font-bold text-[#14213D] dark:text-[#EEF1F8] leading-tight line-clamp-2 group-hover:text-[#2B50FF] dark:group-hover:text-[#7F95FF] transition-colors">
            {title}
          </h3>
        </div>

        {/* Genres unboxed with separators */}
        {anime.genres && anime.genres.length > 0 && (
          <div className="text-[11px] text-[#55607A] dark:text-[#A3AEC8] truncate">
            {anime.genres.slice(0, 3).join(' · ')}
          </div>
        )}
      </div>
    </article>
  );
};
