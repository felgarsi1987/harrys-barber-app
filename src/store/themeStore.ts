import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "dark" | "light";

const THEME_KEY = "@harrys_theme";

interface ThemeState {
  mode: ThemeMode;
  isLoaded: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: "dark" as ThemeMode,
  isLoaded: false,

  toggleTheme: () => {
    const next = get().mode === "dark" ? "light" : "dark";
    set({ mode: next });
    AsyncStorage.setItem(THEME_KEY, next).catch(console.error);
  },

  setTheme: (mode: ThemeMode) => {
    set({ mode });
    AsyncStorage.setItem(THEME_KEY, mode).catch(console.error);
  },

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        set({ mode: saved, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));