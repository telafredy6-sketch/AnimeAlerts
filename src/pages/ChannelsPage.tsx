import React, { useState } from 'react';
import { Send, CheckCircle2, PlusCircle, ExternalLink, ShieldCheck, Users, Sparkles, Bot } from 'lucide-react';
import { CONFIG } from '../lib/config';
import { lienBot, urlSure } from '../lib/format';
import { CanalTelegram } from '../lib/types';

interface ChannelsPageProps {
  onNavigate: (path: string) => void;
}

export const ChannelsPage: React.FC<ChannelsPageProps> = ({ onNavigate }) => {
  const [selectedCategorie, setSelectedCategorie] = useState<string>('tous');
  const [showProposerModal, setShowProposerModal] = useState(false);

  // Formulaire proposition
  const [propNom, setPropNom] = useState('');
  const [propLien, setPropLien] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propCat, setPropCat] = useState('streaming');
  const [formSucces, setFormSucces] = useState(false);

  const bot = lienBot();

  const categories = [
    { id: 'tous', label: 'Tous les canaux' },
    { id: 'officiel', label: 'Officiel' },
    { id: 'sorties', label: 'Sorties & Alertes' },
    { id: 'streaming', label: 'Streaming' },
    { id: 'mangas', label: 'Mangas & Scans' },
    { id: 'communaute', label: 'Communauté' }
  ];

  const filteredCanaux = CONFIG.canaux.filter((c) => {
    if (selectedCategorie === 'tous') return true;
    return c.categorie === selectedCategorie;
  });

  const handleSubmitProposition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propNom.trim() || !propLien.trim()) return;

    // Simulation d'envoi
    setFormSucces(true);
    setTimeout(() => {
      setFormSucces(false);
      setShowProposerModal(false);
      setPropNom('');
      setPropLien('');
      setPropDesc('');
    }, 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="w-6 h-6 text-[#2B50FF] dark:text-[#7F95FF]" />
            <h1 className="font-['Bricolage_Grotesque'] text-2xl sm:text-3xl font-extrabold text-[#14213D] dark:text-[#EEF1F8]">
              Nos Canaux Telegram à Buea
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
            Rejoins les canaux anime les plus actifs du Cameroun. Alertes de sortie instantanées, épisodes en direct et mangas.
          </p>
        </div>

        <button
          onClick={() => setShowProposerModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] hover:text-[#2B50FF] transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-[#2B50FF]" />
          <span>Proposer un canal</span>
        </button>
      </div>

      {/* Bot Telegram Highlight Banner */}
      {bot && (
        <section className="p-6 rounded-3xl bg-gradient-to-br from-[#1F3FD6] to-[#14213D] text-white shadow-xl shadow-[#1F3FD6]/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#FFC83D]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bot Telegram Officiel</span>
            </div>
            <h2 className="font-['Bricolage_Grotesque'] text-2xl font-bold">
              Le Bot AnimeAlert Buea
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              Ajoute tes séries en favoris directement dans Telegram et reçois un message privé 15 minutes avant la sortie de chaque épisode en heure du Cameroun.
            </p>
          </div>
          <a
            href={bot}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-2xl bg-[#FFC83D] text-[#14213D] font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-md whitespace-nowrap flex items-center gap-2"
          >
            <Bot className="w-4 h-4 text-[#14213D]" />
            <span>Démarrer le Bot (@AnimeAlert)</span>
          </a>
        </section>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => {
          const isSelected = selectedCategorie === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategorie(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[#2B50FF] text-white shadow-sm'
                  : 'bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCanaux.map((canal) => (
          <article
            key={canal.nom}
            className="flex flex-col justify-between p-5 rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm hover:border-[#2B50FF] hover:shadow-md transition-all space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {canal.badge && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#2B50FF] dark:text-[#7F95FF] border border-blue-200 dark:border-blue-900">
                    {canal.badge}
                  </span>
                )}
                {canal.membres && (
                  <span className="text-[11px] font-medium text-[#55607A] dark:text-[#A3AEC8] flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{canal.membres} membres</span>
                  </span>
                )}
              </div>

              <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
                {canal.nom}
              </h3>

              <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] leading-relaxed">
                {canal.description}
              </p>
            </div>

            <a
              href={urlSure(canal.lien)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2B50FF] text-white text-xs font-semibold hover:brightness-105 active:scale-95 transition-all shadow-sm"
            >
              <span>Rejoindre le canal</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </article>
        ))}
      </div>

      {/* Modal Proposer un canal */}
      {showProposerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] p-6 shadow-2xl space-y-4">
            <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
              Proposer un canal Telegram
            </h3>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
              Tu gères ou connais un bon canal anime/manga à Buea ou au Cameroun ? Soumets-le pour vérification par l'équipe AnimeAlert.
            </p>

            {formSucces ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Merci ! Ta proposition a été transmise avec succès à l'équipe.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitProposition} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    Nom du canal Telegram *
                  </label>
                  <input
                    type="text"
                    required
                    value={propNom}
                    onChange={(e) => setPropNom(e.target.value)}
                    placeholder="Ex. Anime Douala Zone"
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    Lien du canal (t.me/...) *
                  </label>
                  <input
                    type="url"
                    required
                    value={propLien}
                    onChange={(e) => setPropLien(e.target.value)}
                    placeholder="https://t.me/nom_du_canal"
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    Catégorie
                  </label>
                  <select
                    value={propCat}
                    onChange={(e) => setPropCat(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
                  >
                    <option value="streaming">Streaming & Épisodes</option>
                    <option value="sorties">Sorties & Alertes</option>
                    <option value="mangas">Mangas & Scans</option>
                    <option value="communaute">Communauté & Débats</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    Courte description
                  </label>
                  <textarea
                    rows={2}
                    value={propDesc}
                    onChange={(e) => setPropDesc(e.target.value)}
                    placeholder="Ce que les utilisateurs y trouveront..."
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProposerModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2B50FF] text-white hover:brightness-105"
                  >
                    Envoyer la proposition
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
