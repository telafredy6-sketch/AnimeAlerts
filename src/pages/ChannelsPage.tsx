import { tr } from '../lib/i18n';
import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, PlusCircle, ExternalLink, Users, Sparkles, Bot } from 'lucide-react';
import { CONFIG } from '../lib/config';
import { lienBot, urlSure } from '../lib/format';

interface ChannelsPageProps {
  onNavigate: (path: string) => void;
}

export const ChannelsPage: React.FC<ChannelsPageProps> = () => {
  const [selectedCategorie, setSelectedCategorie] = useState<string>('tous');
  const [showProposerModal, setShowProposerModal] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('proposer') === '1') {
      setShowProposerModal(true);
    }
  }, []);

  // Formulaire proposition
  const [propNom, setPropNom] = useState('');
  const [propLien, setPropLien] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propCat, setPropCat] = useState('streaming');
  const [formSucces, setFormSucces] = useState(false);

  const bot = lienBot();

  const categories = [
    { id: 'tous', label: tr('Tous les canaux', 'All channels') },
    { id: 'officiel', label: tr('Officiel', 'Official') },
    { id: 'sorties', label: tr('Sorties & Alertes', 'Releases & Alerts') },
    { id: 'streaming', label: 'Streaming' },
    { id: 'mangas', label: tr('Mangas & Scans', 'Manga & Scans') },
    { id: 'communaute', label: tr('Communauté', 'Community') }
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
              {tr("Nos Canaux Telegram à Buea", "Our Telegram Channels in Buea")}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#55607A] dark:text-[#A3AEC8] mt-1">
            {tr("Rejoins les canaux anime les plus actifs du Cameroun. Alertes de sortie instantanées, épisodes en direct et mangas.", "Join the most active anime channels in Cameroon. Instant release alerts, live episodes and manga.")}
          </p>
        </div>

        <button
          onClick={() => setShowProposerModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#FFFFFF] dark:bg-[#161F35] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] hover:text-[#2B50FF] transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-[#2B50FF]" />
          <span>{tr("Proposer un canal", "Suggest a channel")}</span>
        </button>
      </div>

      {/* Bot Telegram Highlight Banner */}
      {bot && (
        <section className="p-6 rounded-2xl bg-gradient-to-br from-[#1F3FD6] to-[#14213D] text-white shadow-lg shadow-[#1F3FD6]/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#FFC83D]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr("Bot Telegram Officiel", "Official Telegram Bot")}</span>
            </div>
            <h2 className="font-['Bricolage_Grotesque'] text-2xl font-bold">
              Bot AnimeAlert
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
              {tr("Ajoute tes séries en favoris directement dans Telegram et reçois un message privé 15 minutes avant la sortie de chaque épisode en heure du Cameroun.", "Add your series to your favorites directly in Telegram and get a private message 15 minutes before each episode airs, in Cameroon time.")}
            </p>
          </div>
          <a
            href={bot}
            target="_blank"
            rel="noopener noreferrer"
            title="@animealert_buea_bot"
            className="px-5 py-3 rounded-xl bg-[#FFC83D] text-[#14213D] font-bold text-sm hover:brightness-105 active:scale-95 transition-all shadow-md whitespace-nowrap flex items-center gap-2 shrink-0"
          >
            <Bot className="w-4 h-4 text-[#14213D]" />
            <span>{tr("Démarrer le Bot", "Start the Bot")}</span>
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
      <div
        className={`grid gap-4 ${
          filteredCanaux.length === 1
            ? 'grid-cols-1'
            : filteredCanaux.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {filteredCanaux.map((canal) => (
          <article
            key={canal.nom}
            className="flex flex-col justify-between p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] shadow-sm hover:border-[#2B50FF] hover:shadow-md transition-all space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                {canal.badge && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-[#2B50FF] dark:text-[#7F95FF] border border-blue-200 dark:border-blue-900">
                    {canal.badge}
                  </span>
                )}
                {canal.membres && (
                  <span className="text-[11px] font-medium text-[#55607A] dark:text-[#A3AEC8] flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{canal.membres} {tr('membres', 'members')}</span>
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
              <span>{tr("Rejoindre le canal", "Join the channel")}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </article>
        ))}
      </div>

      {/* Modal Proposer un canal */}
      {showProposerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] p-6 shadow-2xl space-y-4">
            <h3 className="font-['Bricolage_Grotesque'] text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
              {tr("Proposer un canal Telegram", "Suggest a Telegram channel")}
            </h3>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
              {tr("Tu gères ou connais un bon canal anime/manga à Buea ou au Cameroun ? Soumets-le pour vérification par l'équipe AnimeAlert.", "Do you run or know a good anime/manga channel in Buea or Cameroon? Submit it for review by the AnimeAlert team.")}
            </p>

            {formSucces ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{tr("Merci ! Ta proposition a été transmise avec succès à l'équipe.", "Thank you! Your suggestion has been successfully sent to the team.")}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitProposition} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    {tr("Nom du canal Telegram *", "Telegram channel name *")}
                  </label>
                  <input
                    type="text"
                    required
                    value={propNom}
                    onChange={(e) => setPropNom(e.target.value)}
                    placeholder={tr("Ex. Anime Douala Zone", "E.g. Anime Douala Zone")}
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    {tr("Lien du canal (t.me/...) *", "Channel link (t.me/...) *")}
                  </label>
                  <input
                    type="url"
                    required
                    value={propLien}
                    onChange={(e) => setPropLien(e.target.value)}
                    placeholder={tr("https://t.me/nom_du_canal", "https://t.me/channel_name")}
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    {tr("Catégorie", "Category")}
                  </label>
                  <select
                    value={propCat}
                    onChange={(e) => setPropCat(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none"
                  >
                    <option value="streaming">{tr("Streaming & Épisodes", "Streaming & Episodes")}</option>
                    <option value="sorties">{tr("Sorties & Alertes", "Releases & Alerts")}</option>
                    <option value="mangas">{tr("Mangas & Scans", "Manga & Scans")}</option>
                    <option value="communaute">{tr("Communauté & Débats", "Community & Discussions")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] mb-1">
                    {tr("Courte description", "Short description")}
                  </label>
                  <textarea
                    rows={2}
                    value={propDesc}
                    onChange={(e) => setPropDesc(e.target.value)}
                    placeholder={tr("Ce que les utilisateurs y trouveront...", "What users will find there...")}
                    className="w-full p-2.5 text-xs rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-[#14213D] dark:text-[#EEF1F8] outline-none focus:border-[#2B50FF]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProposerModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {tr("Annuler", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2B50FF] text-white hover:brightness-105"
                  >
                    {tr("Envoyer la proposition", "Send suggestion")}
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
    
