import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'banner') {
      return (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2B50FF] flex items-center justify-center text-white shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#14213D] dark:text-[#EEF1F8]">Installer AnimeAlert Buea</p>
              <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">Accès ultra rapide et fiches consultables hors-ligne.</p>
            </div>
          </div>
          <button
            onClick={install}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#2B50FF] text-white hover:bg-blue-700 transition-colors shrink-0"
          >
            Installer
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2B50FF] text-white hover:brightness-105 active:scale-95 transition-all shadow-sm"
        title="Installer l'application sur ton appareil"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installer l'app</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Installer sur iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#2B50FF]" />
          <span className="hidden sm:inline">Installer sur iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5DBE8] dark:border-[#27324D]">
                <h3 className="text-base font-bold text-[#14213D] dark:text-[#EEF1F8]">Installer sur iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-[#55607A] hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#55607A] dark:text-[#A3AEC8]">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#2B50FF]">1.</span>
                  <span>Touche le bouton <strong>Partager</strong> <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">⎋</span> dans la barre de Safari en bas.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#2B50FF]">2.</span>
                  <span>Fais défiler et sélectionne <strong>Sur l'écran d'accueil</strong>.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-[#2B50FF]">3.</span>
                  <span>Appuie sur <strong>Ajouter</strong> en haut à droite.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#2B50FF] py-2.5 text-sm font-semibold text-white hover:brightness-105 transition-all"
              >
                C'est compris !
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
