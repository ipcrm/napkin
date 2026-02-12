/**
 * Theme store for dark/light mode management
 */

import { writable, type Writable } from 'svelte/store';

/**
 * Theme type
 */
export type Theme = 'light' | 'dark';

/**
 * Theme state interface
 */
export interface ThemeState {
  current: Theme;
}

/**
 * Color scheme for different themes
 */
export interface ColorScheme {
  background: string;
  canvasBackground: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  surfaceHover: string;
  primary: string;
  primaryHover: string;
  shadow: string;
}

/**
 * Light theme colors
 */
export const LIGHT_THEME: ColorScheme = {
  background: '#ffffff',
  canvasBackground: '#fafafa',
  text: '#333333',
  textSecondary: '#666666',
  border: '#dddddd',
  surface: '#ffffff',
  surfaceHover: '#f5f5f5',
  primary: '#2196F3',
  primaryHover: '#1976D2',
  shadow: 'rgba(0, 0, 0, 0.1)'
};

/**
 * Dark theme colors
 */
export const DARK_THEME: ColorScheme = {
  background: '#1e1e1e',
  canvasBackground: '#252525',
  text: '#e0e0e0',
  textSecondary: '#999999',
  border: '#404040',
  surface: '#2d2d2d',
  surfaceHover: '#383838',
  primary: '#42A5F5',
  primaryHover: '#64B5F6',
  shadow: 'rgba(0, 0, 0, 0.3)'
};

/**
 * Storage key for theme preference
 */
const THEME_STORAGE_KEY = 'napkin_theme';

/**
 * Get initial theme from localStorage or system preference
 */
function getInitialTheme(): Theme {
  // Check localStorage first
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

/**
 * Create the theme store
 */
function createThemeStore(): Writable<ThemeState> {
  const initialTheme = getInitialTheme();
  const { subscribe, set, update } = writable<ThemeState>({
    current: initialTheme
  });

  // Apply theme on initialization
  applyThemeToDOM(initialTheme);

  return {
    subscribe,
    set,
    update
  };
}

/**
 * Apply theme CSS variables to DOM
 */
function applyThemeToDOM(theme: Theme): void {
  const colors = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const root = document.documentElement;

  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-canvas-background', colors.canvasBackground);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-secondary', colors.textSecondary);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-surface', colors.surface);
  root.style.setProperty('--color-surface-hover', colors.surfaceHover);
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-hover', colors.primaryHover);
  root.style.setProperty('--color-shadow', colors.shadow);

  // Set data attribute for theme
  root.setAttribute('data-theme', theme);
}

/**
 * Export the theme store
 */
export const themeStore = createThemeStore();

/**
 * Toggle between light and dark theme
 */
export function toggleTheme(): void {
  themeStore.update(state => {
    const newTheme = state.current === 'light' ? 'dark' : 'light';
    applyThemeToDOM(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    return { current: newTheme };
  });
}

/**
 * Set a specific theme
 */
export function setTheme(theme: Theme): void {
  themeStore.update(state => {
    applyThemeToDOM(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    return { current: theme };
  });
}

/**
 * Get the current color scheme
 */
export function getColorScheme(theme: Theme): ColorScheme {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

/**
 * Listen for system theme changes
 */
export function initThemeListener(): void {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only update if user hasn't manually set a preference
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}
