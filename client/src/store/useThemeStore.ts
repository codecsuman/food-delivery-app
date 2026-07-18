import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "system";

type ThemeStore = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
};

const applyTheme = (theme: Theme) => {
  const root = window.document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "light",

      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },

      initializeTheme: () => {
        if (typeof window !== "undefined") {
          const storedTheme =
            (localStorage.getItem("vite-ui-theme") as Theme) || "light";
          applyTheme(storedTheme);
          set({ theme: storedTheme });
        }
      },
    }),
    {
      name: "theme-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
