import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gh-timeline-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // localStorage can throw in private modes or when cookies are blocked.
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persisting is a nicety; the toggle still works for this page view.
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Applies the theme before React mounts. An inline <head> script would avoid
 * any flash entirely, but it would violate the strict CSP; CSS also falls back
 * to `prefers-color-scheme` so the only possible flash is for manual overrides.
 */
export function applyInitialTheme(): void {
  document.documentElement.dataset.theme = readStoredTheme() ?? getSystemTheme();
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [storedTheme, setStoredTheme] = useState<Theme | null>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // An explicit choice wins; otherwise follow the OS live.
  const theme = storedTheme ?? systemTheme;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(next);
    writeStoredTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
}
