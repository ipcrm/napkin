/**
 * Colors store for managing recent colors
 */

import { writable, type Writable } from 'svelte/store';

/**
 * Storage key for recent colors
 */
const COLORS_STORAGE_KEY = 'napkin_recent_colors';

/**
 * Maximum number of recent colors to track
 */
const MAX_RECENT_COLORS = 10;

/**
 * Recent colors state
 */
export interface ColorsState {
  recentColors: string[];
}

/**
 * Initial colors state
 */
const initialState: ColorsState = {
  recentColors: []
};

/**
 * Create the colors store
 */
function createColorsStore(): Writable<ColorsState> {
  const { subscribe, set, update } = writable<ColorsState>(initialState);

  // Try to load from localStorage
  try {
    const stored = localStorage.getItem(COLORS_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      set({
        recentColors: Array.isArray(data.recentColors) ? data.recentColors : []
      });
    }
  } catch (error) {
    console.error('Failed to load recent colors from storage:', error);
  }

  return {
    subscribe,
    set,
    update
  };
}

/**
 * Export the colors store
 */
export const colorsStore = createColorsStore();

/**
 * Save colors to localStorage
 */
function saveToStorage(state: ColorsState): void {
  try {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save recent colors to storage:', error);
  }
}

/**
 * Add a color to recent colors
 */
export function addRecentColor(color: string): void {
  // Ignore transparent
  if (color === 'transparent' || !color) {
    return;
  }

  colorsStore.update(state => {
    // Remove the color if it already exists (to move it to front)
    const filtered = state.recentColors.filter(c => c !== color);

    // Add to front and limit to MAX_RECENT_COLORS
    const newRecentColors = [color, ...filtered].slice(0, MAX_RECENT_COLORS);

    const newState = {
      recentColors: newRecentColors
    };

    saveToStorage(newState);
    return newState;
  });
}

/**
 * Clear all recent colors
 */
export function clearRecentColors(): void {
  const newState: ColorsState = {
    recentColors: []
  };

  colorsStore.set(newState);
  saveToStorage(newState);
}
