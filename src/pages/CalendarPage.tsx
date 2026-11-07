import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Filter, ChevronRight, Play } from 'lucide-react';
import { anilist, QUERY_CALENDRIER_7J } from '../lib/anilist';
import { AiringScheduleItem } from '../lib/types';
import { heureCameroun, jourCamerounCourt, titreDe, formatCompteARebours } from '../lib/format';
import { FORMATS, GENRES_FR } from '../lib/config';

interface CalendarPageProps {
  onNavigate: (path: string) => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ onNavigate }) => {
  const [schedules, setSchedules] = useState<AiringScheduleItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = aujourd'hui, 1 = demain, etc.
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [maintenant, setMaintenant] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setMaintenant(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calcul des 7 prochains jours (start of day timestamps en UTC / local)
  const jours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return {
      offset: i,
      timestamp: Math.floor(d.getTime() / 1000),
      label:
        i === 0
          ? "Aujourd'hui"
          : i === 1
          ? "Demain"
          : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    };
  });

  // Charger les épisodes sur les 7 jours
  useEffect(() => {
    let ignore = false;
    setChargement(true);

    const debut = Math.floor(Date.now() / 1000);
    const fin = debut + 7 * 86400;

    anilist(QUERY_CALENDRIER_7J, { debut, fin, page: 1 })
      .then((data) => {
        if (ignore) return;
        const items: AiringScheduleItem[] = (data?.Page?.airingSchedules || [])
          .filter((i: any) => !i.media.isAdult)
          .sort((a: any, b: any) => a.airingAt - b.airingAt);
        setSchedules(items);
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Erreur calendrier:", err);
          setSchedules([]);
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Délimiter le jour sélectionné
  const currentSelectedDay = jours[selectedDayOffset];
  const nextDayTimestamp = currentSelectedDay.timestamp + 86400;

  const filteredEpisodes = schedules.filter((item) => {
    const inDay = item.airingAt >= currentSelectedDay.timestamp && item.airingAt < nextDayTimestamp;
    if (!inDay) return false;
    if (formatFilter && item.media.format !== formatFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-[#2B50FF] dark:text-[#7F95FF]" />
          <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
            Planning hebdomadaire des sorties
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
          Tous les épisodes diffusés sur les 7 prochains jours · Horaires calés sur le fuseau du Cameroun (Africa/Douala).
        </p>
      </div>

      {/* 7 Days Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {jours.map((jour) => {
          const isSelected = selectedDayOffset === jour.offset;
          // Count episodes for this day
          const count = schedules.filter(
            (s) => s.airingAt >= jour.timestamp && s.airingAt < jour.timestamp + 86400
          ).length;

          return (
            <button
              key={jour.offset}
              onClick={() => setSelectedDayOffset(jour.offset)}
              className={`flex flex-col items-center justify-center min-w-[100px] px-3.5 py-2.5 rounded-2xl border text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#2B50FF] text-white border-[#2B50FF] shadow-md shadow-[#2B50FF]/20 scale-105'
                  : 'bg-[#FFFFFF] dark:bg-[#161F35] border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]'
              }`}
            >
              <span className="capitalize">{jour.label}</span>
              {!chargement && (
                <span className={`text-[10px] mt-0.5 tabular-nums ${isSelected ? 'text-white/80' : 'text-[#55607A] dark:text-[#A3AEC8]'}`}>
                  {count} {count > 1 ? 'épisodes' : 'épisode'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary filter by format */}
      <div className="flex items-center justify-between text-xs text-[#55607A] dark:text-[#A3AEC8] pt-2">
        <span className="font-medium">
          {chargement ? (
            'Chargement du planning...'
          ) : (
            <strong className="text-[#14213D] dark:text-[#EEF1F8] tabular-nums">
              {filteredEpisodes.length} sortie(s) prévue(s)
            </strong>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] text-xs outline-none"
          >
            <option value="">Tous formats</option>
            <option value="TV">Séries TV</option>
            <option value="MOVIE">Films</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
          </select>
        </div>
      </div>

      {/* Episode list */}
      {chargement ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-[#D5DBE8] dark:border-[#27324D] space-y-2">
          <p className="text-sm font-semibold text-[#14213D] dark:text-[#EEF1F8]">
            Aucune diffusion répertoriée pour ce jour avec ces critères.
          </p>
          <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
            Consulte les autres jours de la semaine ou retire les filtres.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredEpisodes.map((item) => {
            const titre = titreDe(item.media.title);
            const heure = heureCameroun(item.airingAt);
            const diff = item.airingAt - maintenant;
            const cover = item.media.coverImage?.medium || item.media.coverImage?.large;
            const formatStr = item.media.format ? FORMATS[item.media.format] || item.media.format : '';

            return (
              <div
                key={`${item.id}-${item.episode}`}
                onClick={() => onNavigate(`/anime/${item.media.id}`)}
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] hover:border-[#2B50FF] hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-16 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                    {cover ? (
                      <img
                        src={cover}
                        alt={titre}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        <Play className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <span className="text-[11px] font-semibold text-[#2B50FF] dark:text-[#7F95FF]">
                      Épisode {item.episode} · {formatStr}
                    </span>
                    <h3 className="font-bold text-sm text-[#14213D] dark:text-[#EEF1F8] truncate group-hover:text-[#2B50FF] transition-colors">
                      {titre}
                    </h3>
                    <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>{heure} (Cameroun)</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className="font-['Bricolage_Grotesque'] text-sm sm:text-base font-extrabold text-[#1F3FD6] dark:text-[#7F95FF] tabular-nums block">
                    {formatCompteARebours(diff)}
                  </span>
                  <span className="text-[10px] text-[#55607A] dark:text-[#A3AEC8]">
                    {diff > 0 ? 'avant sortie' : 'en ligne'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
