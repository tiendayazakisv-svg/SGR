"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";

export type AppColorMode = "light" | "dark";

interface AppThemeContextValue {
  mode: AppColorMode;
  setMode: (mode: AppColorMode) => void;
}

const STORAGE_KEY = "sgr-color-mode";
const CHANGE_EVENT = "sgr-color-mode-change";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export default function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const mode = useSyncExternalStore(
    subscribeToMode,
    getBrowserMode,
    getServerMode
  );

  const setMode = (nextMode: AppColorMode) => {
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === "dark" ? "#4ea5ff" : "#1976d2",
          },
          secondary: {
            main: "#f57c00",
          },
          background: {
            default: mode === "dark" ? "#0f172a" : "#f5f7fa",
            paper: mode === "dark" ? "#172033" : "#ffffff",
          },
          text: {
            primary: mode === "dark" ? "#f8fafc" : "#111827",
            secondary: mode === "dark" ? "#cbd5e1" : "#475569",
          },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: mode === "dark" ? "#0f172a" : "#f5f7fa",
                color: mode === "dark" ? "#f8fafc" : "#111827",
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <AppThemeContext.Provider value={{ mode, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }

  return context;
}

function subscribeToMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getBrowserMode(): AppColorMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerMode(): AppColorMode {
  return "light";
}
