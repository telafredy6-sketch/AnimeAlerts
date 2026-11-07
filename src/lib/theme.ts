export type ThemeMode = 'auto' | 'light' | 'dark';

const CLE_THEME = "animealert:theme";

export function lireThemeActuel(): ThemeMode {
  try {
    const t = localStorage.getItem(CLE_THEME);
    if (t === 'light' || t === 'dark' || t === 'auto') return t;
    return 'auto';
  } catch {
    return 'auto';
  }
}

export function appliquerTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(CLE_THEME, mode);
  } catch {}

  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  }

  window.dispatchEvent(new CustomEvent('animealert:theme-change', { detail: { mode, isDark } }));
}

export function basculerProchainTheme(): ThemeMode {
  const actuel = lireThemeActuel();
  const sequence: ThemeMode[] = ['auto', 'dark', 'light'];
  const next = sequence[(sequence.indexOf(actuel) + 1) % sequence.length];
  appliquerTheme(next);
  return next;
}
