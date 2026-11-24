import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";

import {
  effectiveTextSize,
  resolveTheme,
  type TextLevel,
  type TextSizeSetting,
  type Theme,
} from "./theme";

export interface ThemeContextValue {
  readonly theme: Theme;
  readonly level: TextLevel;
  /** App setting „Ograniczony ruch”; null = follow the system (useReduceMotion). */
  readonly reduceMotion: boolean | null;
}

export interface ThemeProviderProps {
  /** Default: off. The root layout passes them from the settings store (S10). */
  readonly highContrast?: boolean;
  readonly colorVisionMode?: boolean;
  readonly textSize?: TextSizeSetting;
  /** null (default) = follow the system setting. */
  readonly reduceMotion?: boolean | null;
  readonly children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme from the settings, text level from effectiveTextSize(setting, system
 * font scale). Nested providers can override settings, e.g. the live preview.
 */
export function ThemeProvider({
  highContrast = false,
  colorVisionMode = false,
  textSize = "standard",
  reduceMotion = null,
  children,
}: ThemeProviderProps) {
  // Same value as PixelRatio.getFontScale(), but re-renders when the user changes it.
  const { fontScale } = useWindowDimensions();

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolveTheme({ highContrast, colorVisionMode }),
      level: effectiveTextSize(textSize, fontScale),
      reduceMotion,
    }),
    [highContrast, colorVisionMode, textSize, fontScale, reduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme() must be used inside <ThemeProvider>.");
  }
  return value;
}
