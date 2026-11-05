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
}

export interface ThemeProviderProps {
  /** Overrides – default: off. Later these come from the settings store. */
  readonly highContrast?: boolean;
  readonly colorVisionMode?: boolean;
  readonly textSize?: TextSizeSetting;
  readonly children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Local state for now (no store yet): default theme, text level from
 * effectiveTextSize(setting, system font scale). Nested providers can
 * override settings, e.g. placeholders showing the 200 % variant.
 */
export function ThemeProvider({
  highContrast = false,
  colorVisionMode = false,
  textSize = "standard",
  children,
}: ThemeProviderProps) {
  // Same value as PixelRatio.getFontScale(), but re-renders when the user changes it.
  const { fontScale } = useWindowDimensions();

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolveTheme({ highContrast, colorVisionMode }),
      level: effectiveTextSize(textSize, fontScale),
    }),
    [highContrast, colorVisionMode, textSize, fontScale],
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
