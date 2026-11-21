import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Check, AlertTriangle, Send } from 'lucide-react';
import { tr } from '../lib/i18n';
import {
  NotificationPrefs,
  NotificationLeadMinutes,
  NotificationScope,
  lireNotificationPrefs,
  sauvegarderNotificationPrefs,
  getNotificationPermission,
  isPushSupported,
  enableCameroonPushNotifications,
  disableCameroonPushNotifications,
  sendTestCameroonNotification
} from '../lib/notifications';

interface PushNotificationsPanelProps {
  compact?: boolean;
}

export const PushNotificationsPanel: React.FC<PushNotificationsPanelProps> = ({ compact = false }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => lireNotificationPrefs());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const supported = isPushSupported();

  useEffect(() => {
    const handleUpdate = () => {
      setPrefs(lireNotificationPrefs());
      setPermission(getNotificationPermission());
    };
    window.addEventListener('animealert:notifications-change', handleUpdate);
    return () => window.removeEventListener('animealert:notifications-change', handleUpdate);
  }, []);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleEnabled = async () => {
    if (prefs.enabled && permission === 'granted') {
      disableCameroonPushNotifications();
      setPrefs(lireNotificationPrefs());
      showToast(tr('Notifications push désactivées.', 'Push notifications disabled.'));
      return;
    }

    const res = await enableCameroonPushNotifications();
    setPermission(res.permission);
    setPrefs(lireNotificationPrefs());

    if (res.ok) {
      showToast(
        tr(
          'Notifications push activées via le Service Worker (heure du Cameroun).',
          'Push notifications enabled via Service Worker (Cameroon time).'
        )
      );
    } else if (res.permission === 'denied') {
      showToast(
        tr(
          'Permission refusée dans le navigateur. Autorise les notifications dans les paramètres du site.',
          'Permission denied by browser. Allow notifications in site settings.'
        )
      );
    }
  };

  const handleChangeScope = (scope: NotificationScope) => {
    const next = { ...prefs, scope };
    setPrefs(next);
    sauvegarderNotificationPrefs(next);
  };

  const handleChangeLead = (leadMinutes: NotificationLeadMinutes) => {
    const next = { ...prefs, leadMinutes };
    setPrefs(next);
    sauvegarderNotificationPrefs(next);
  };

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await sendTestCameroonNotification();
      setPermission(res.permission);
      setPrefs(lireNotificationPrefs());
      if (res.ok) {
        showToast(
          tr(
            'Notification de test envoyée par le Service Worker.',
            'Test notification sent via Service Worker.'
          )
        );
      } else if (res.permission === 'denied') {
        showToast(
          tr(
            'Notifications bloquées par le navigateur.',
            'Notifications are blocked by your browser.'
          )
        );
      } else {
        showToast(
          tr(
            'Impossible d’afficher la notification dans cet environnement.',
            'Unable to display notifications in this environment.'
          )
        );
      }
    } finally {
      setTesting(false);
    }
  };

  if (!supported) {
    return null;
  }

  const isActive = prefs.enabled && permission === 'granted';

  if (compact) {
    return (
      <div className="p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isActive
                ? 'bg-[#2B50FF] text-white'
                : 'bg-[#F2F4F8] dark:bg-[#0D1322] text-[#55607A] dark:text-[#A3AEC8]'
            }`}
          >
            {isActive ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-[#14213D] dark:text-[#EEF1F8]">
              {tr('Alertes push des sorties au Cameroun', 'Cameroon release push alerts')}
            </p>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8]">
              {isActive
                ? tr(
                    `Actif via Service Worker · ${prefs.leadMinutes === 0 ? 'à la sortie' : `${prefs.leadMinutes} min avant`}`,
                    `Active via Service Worker · ${prefs.leadMinutes === 0 ? 'at release' : `${prefs.leadMinutes} min before`}`
                  )
                : tr(
                    'Reçois une notification navigateur quand un de tes animes sort (UTC+1).',
                    'Get a browser notification when one of your anime airs (UTC+1).'
                  )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-2 min-h-[40px] text-xs font-semibold rounded-xl border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors whitespace-nowrap"
            >
              {testing ? tr('Envoi...', 'Sending...') : tr('Tester', 'Test')}
            </button>
          )}
          <button
            onClick={handleToggleEnabled}
            className={`px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
              isActive
                ? 'border border-[#D5DBE8] dark:border-[#27324D] text-[#14213D] dark:text-[#EEF1F8] hover:border-rose-400'
                : 'bg-[#2B50FF] text-white hover:brightness-105'
            }`}
          >
            {isActive ? tr('Désactiver', 'Disable') : tr('Activer les alertes', 'Enable alerts')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="p-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#161F35] border border-[#D5DBE8] dark:border-[#27324D] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isActive
                ? 'bg-[#2B50FF] text-white'
                : 'bg-[#F2F4F8] dark:bg-[#0D1322] text-[#55607A] dark:text-[#A3AEC8]'
            }`}
          >
            {isActive ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="font-['Bricolage_Grotesque'] text-base sm:text-lg font-bold text-[#14213D] dark:text-[#EEF1F8]">
              {tr('Notifications push Service Worker (Cameroun UTC+1)', 'Service Worker Push Notifications (Cameroon UTC+1)')}
            </h2>
            <p className="text-xs text-[#55607A] dark:text-[#A3AEC8] mt-0.5">
              {tr(
                'Préviens automatiquement ton appareil avant la diffusion des nouveaux épisodes.',
                'Automatically notify your device before new episodes air.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#D5DBE8] dark:border-[#27324D] bg-[#F2F4F8] dark:bg-[#0D1322] text-xs font-semibold text-[#14213D] dark:text-[#EEF1F8] hover:border-[#2B50FF] transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5 text-[#2B50FF] dark:text-[#7F95FF]" />
            <span>{testing ? tr('Envoi...', 'Sending...') : tr('Tester une notif', 'Test notification')}</span>
          </button>

          <button
            onClick={handleToggleEnabled}
            className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-[#2B50FF] text-white hover:brightness-105'
            }`}
          >
            {isActive ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{tr('Activées', 'Enabled')}</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5" />
                <span>{tr('Activer', 'Enable')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Controls row: Scope & Lead time */}
      <div className="pt-3 border-t border-[#D5DBE8]/70 dark:border-[#27324D]/70 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#55607A] dark:text-[#A3AEC8]">
            {tr('Animes surveillés :', 'Watch scope:')}
          </span>
          <div className="inline-flex p-1 rounded-xl bg-[#F2F4F8] dark:bg-[#0D1322] border border-[#D5DBE8] dark:border-[#27324D]">
            <button
              type="button"
              onClick={() => handleChangeScope('favorites_and_subs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                prefs.scope === 'favorites_and_subs'
                  ? 'bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] shadow-sm'
                  : 'text-[#55607A] dark:text-[#A3AEC8]'
              }`}
            >
              {tr('Favoris & suivis', 'Favorites & followed')}
            </button>
            <button
              type="button"
              onClick={() => handleChangeScope('all_cameroon')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                prefs.scope === 'all_cameroon'
                  ? 'bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] shadow-sm'
                  : 'text-[#55607A] dark:text-[#A3AEC8]'
              }`}
            >
              {tr('Toutes sorties populaires', 'All popular releases')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#55607A] dark:text-[#A3AEC8]">
            {tr('Délai :', 'Lead time:')}
          </span>
          <div className="inline-flex p-1 rounded-xl bg-[#F2F4F8] dark:bg-[#0D1322] border border-[#D5DBE8] dark:border-[#27324D]">
            {([0, 15, 30] as NotificationLeadMinutes[]).map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleChangeLead(mins)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap tabular-nums ${
                  prefs.leadMinutes === mins
                    ? 'bg-[#FFFFFF] dark:bg-[#161F35] text-[#14213D] dark:text-[#EEF1F8] shadow-sm'
                    : 'text-[#55607A] dark:text-[#A3AEC8]'
                }`}
              >
                {mins === 0 ? tr('À la sortie', 'At release') : `${mins} min`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {tr(
              'Les notifications sont bloquées par ton navigateur. Clique sur l’icône de cadenas dans la barre d’adresse pour les autoriser.',
              'Notifications are blocked by your browser. Click the lock icon in the address bar to allow them.'
            )}
          </span>
        </div>
      )}

      {feedback && (
        <p className="text-xs font-semibold text-[#2B50FF] dark:text-[#7F95FF]">{feedback}</p>
      )}
    </section>
  );
};
