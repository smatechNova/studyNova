import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, type AppColors, type ThemeMode } from "@/theme";

type ThemeContextValue = {
  colors: AppColors;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(() => (systemScheme === "dark" ? "dark" : "light"));

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === "dark";
    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
      mode,
      toggleTheme: () => setMode((current) => (current === "dark" ? "light" : "dark"))
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
