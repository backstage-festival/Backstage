import type { TextStyle } from "react-native";

/* ------------------------------------------------------------------ */
/* Poziomy tekstu (H02): 0 = 100 %, 1 = 150 %, 2 = 200 %               */
/* ------------------------------------------------------------------ */

export type TextLevel = 0 | 1 | 2;
export type TextSizeSetting = "standard" | "large" | "xlarge";

/** Wartość na trzech poziomach tekstu: [100 %, 150 %, 200 %]. */
type Leveled<T> = readonly [T, T, T];

const SETTING_TO_LEVEL: Record<TextSizeSetting, TextLevel> = {
  standard: 0,
  large: 1,
  xlarge: 2,
};

/**
 * Wyższy z dwóch poziomów: ustawienie w aplikacji albo skala fontu systemu.
 * Progi skali systemowej (1,3 i 1,75) to nasze założenie – nie ma ich na tablicach.
 */
export function effectiveTextSize(setting: TextSizeSetting, fontScale: number): TextLevel {
  const fromSystem: TextLevel = fontScale >= 1.75 ? 2 : fontScale >= 1.3 ? 1 : 0;
  return Math.max(SETTING_TO_LEVEL[setting], fromSystem) as TextLevel;
}

/* ------------------------------------------------------------------ */
/* Kolory (H01)                                                         */
/* ------------------------------------------------------------------ */

export interface ColorTokens {
  readonly background: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly laminate: string;
  readonly laminateTrack: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textDisabled: string;
  readonly textOnLaminate: string;
  readonly textOnLaminateSecondary: string;
  readonly textOnAccent: string;
  readonly textOffline: string;
  readonly accent: string;
  readonly accentPressed: string;
  readonly border: string;
  readonly divider: string;
  readonly focus: string;
  readonly focusHalo: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly offline: string;
  readonly mapLand: string;
  readonly mapWater: string;
  readonly mapWaterHatch: string;
  readonly mapPath: string;
  readonly mapBuilding: string;
  readonly mapBuildingStroke: string;
  readonly mapLabel: string;
}

const defaultColors: ColorTokens = {
  background: "#0D0D0C",
  surface: "#1A1A18",
  surfaceRaised: "#262622",
  laminate: "#F1EFE8",
  laminateTrack: "#D3D0C7",
  textPrimary: "#F1EFE8",
  textSecondary: "#B8B5AD",
  textDisabled: "#6E6C66",
  textOnLaminate: "#0D0D0C",
  textOnLaminateSecondary: "#4A4843",
  textOnAccent: "#0D0D0C",
  textOffline: "#C9C6BE",
  accent: "#FF7A3A",
  accentPressed: "#F0692B",
  border: "#6E6C66",
  divider: "#2A2A27",
  focus: "#F1EFE8",
  focusHalo: "#0D0D0C",
  success: "#2FBF71",
  warning: "#FFC21A",
  error: "#FF8A80",
  offline: "#8C8A84",
  mapLand: "#1A1A18",
  mapWater: "#0D0D0C",
  mapWaterHatch: "#6E6C66",
  mapPath: "#33322E",
  mapBuilding: "#262622",
  mapBuildingStroke: "#3A3935",
  mapLabel: "#C9C6BE",
};

const highContrastColors: ColorTokens = {
  ...defaultColors,
  background: "#000000",
  surface: "#000000",
  surfaceRaised: "#1F1F1F",
  laminate: "#FFFFFF",
  laminateTrack: "#BDBDBD",
  textPrimary: "#FFFFFF",
  textSecondary: "#FFFFFF",
  textDisabled: "#9E9E9E",
  textOnLaminate: "#000000",
  textOnLaminateSecondary: "#000000",
  textOnAccent: "#000000",
  textOffline: "#FFFFFF",
  border: "#FFFFFF",
  divider: "#FFFFFF",
  focus: "#FFFFFF",
  focusHalo: "#000000",
  offline: "#FFFFFF",
  mapLand: "#000000",
  mapWater: "#000000",
  mapWaterHatch: "#FFFFFF",
  mapPath: "#5C5C5C",
  mapBuilding: "#1F1F1F",
  mapBuildingStroke: "#FFFFFF",
  mapLabel: "#FFFFFF",
};

/** Zaburzenia widzenia barw: zmienia się tylko success (niebieski). */
const colorVisionColors: ColorTokens = {
  ...defaultColors,
  success: "#6CB6FF",
};

/* ------------------------------------------------------------------ */
/* Wymiary (H03)                                                        */
/* ------------------------------------------------------------------ */

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
  s12: 48,
  screen: 16,
  section: 24,
} as const;

export const radius = {
  none: 0,
  tag: 3,
  slot: 5,
  button: 6,
  pass: 12,
  round: 999,
} as const;

export interface BorderWidthTokens {
  readonly hairline: number;
  readonly control: number;
  readonly offline: number;
  readonly indicator: number;
  readonly focus: number;
  readonly focusOffset: number;
  readonly focusHalo: number;
  readonly icon: number;
}

const defaultBorderWidth: BorderWidthTokens = {
  hairline: 1,
  control: 1.5,
  offline: 1.5,
  indicator: 3,
  focus: 3,
  focusOffset: 2,
  focusHalo: 6,
  icon: 2,
};

const highContrastBorderWidth: BorderWidthTokens = {
  ...defaultBorderWidth,
  hairline: 1.5,
  control: 2,
  offline: 2,
  icon: 2.5,
};

/** Rozmiary w dp. Tablice = poziomy tekstu [100, 150, 200 %]. */
export const size = {
  touchMin: 48,
  control: [48, 56, 64],
  button: [48, 56, 64],
  buttonSmall: [48, 56, 64],
  iconButton: 48,
  icon: 24,
  iconSmall: 16,
  input: 52,
  tabBar: [64, 80, 96],
  connectionBar: [36, 44, 56],
  passBand: 30,
  passSlot: { width: 10, height: 52 },
  mapMarker: 30,
  mapMarkerStage: 40,
  mapMarkerHit: 48,
  badgeCount: 18,
  listRowMin: 72,
  compassRing: 296,
  compassArrow: 184,
} as const satisfies Record<string, number | Leveled<number> | { width: number; height: number }>;

/**
 * Pole dotyku min. 48 × 48 (H03). Dla elementu w × h zwraca hitSlop,
 * który dobija brakującą szerokość/wysokość równo z obu stron.
 */
export function hitSlopFor(width: number, height: number = width) {
  const x = Math.max(0, (size.touchMin - width) / 2);
  const y = Math.max(0, (size.touchMin - height) / 2);
  return { top: y, bottom: y, left: x, right: x };
}

/* ------------------------------------------------------------------ */
/* Ruch (H03) – tylko transform i opacity, useNativeDriver: true        */
/* ------------------------------------------------------------------ */

/** Argumenty dla Easing.bezier(x1, y1, x2, y2) z react-native. */
export type Bezier = readonly [number, number, number, number];

export interface MotionToken {
  readonly duration: number;
  readonly easing: Bezier;
  readonly loop: boolean;
  /** Wartości końcowe/początkowe z tablicy H03 (opcjonalne, zależnie od animacji). */
  readonly scale?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly translateY?: number;
  readonly opacityFrom?: number;
}

export const motion = {
  press: { duration: 120, easing: [0.2, 0, 0, 1], loop: false, scale: 0.97 },
  appear: { duration: 160, easing: [0, 0, 0.2, 1], loop: false, translateY: 8 },
  sheet: { duration: 220, easing: [0, 0, 0.2, 1], loop: false, translateY: 64 },
  statusChange: { duration: 200, easing: [0.2, 0, 0, 1], loop: false, scale: 0.96 },
  pulse: {
    duration: 1600,
    easing: [0, 0, 0.2, 1],
    loop: true,
    scaleX: 1.04,
    scaleY: 1.08,
    opacityFrom: 0.9,
  },
  syncSpin: { duration: 900, easing: [0, 0, 1, 1], loop: true },
  compass: { duration: 150, easing: [0.2, 0, 0, 1], loop: false },
} as const satisfies Record<string, MotionToken>;

/* ------------------------------------------------------------------ */
/* Typografia (H02)                                                     */
/* ------------------------------------------------------------------ */

/** Nazwy plików .ttf bez rozszerzenia (Android). Ładowane w #42. */
export const fonts = {
  condensedBlack: "Archivo-ExtraCondensedBlack",
  condensedExtraBold: "Archivo-ExtraCondensedExtraBold",
  archivoRegular: "Archivo-Regular",
  archivoSemiBold: "Archivo-SemiBold",
  monoRegular: "IBMPlexMono-Regular",
  monoSemiBold: "IBMPlexMono-SemiBold",
  monoBold: "IBMPlexMono-Bold",
} as const;

type FontFamily = (typeof fonts)[keyof typeof fonts];

/** [fontSize, lineHeight, letterSpacing?] */
type Metric = readonly [number, number, number?];

interface TextStyleToken {
  readonly fontFamily: FontFamily;
  readonly levels: Leveled<Metric>;
  readonly uppercase?: boolean;
}

const CB = fonts.condensedBlack;
const CX = fonts.condensedExtraBold;

export const textStyles = {
  // Archivo Extra Condensed – nagłówki i przyciski, zawsze wielkie litery
  titleHero: { fontFamily: CB, uppercase: true, levels: [[56, 48], [64, 56], [72, 64]] },
  titleSettings: { fontFamily: CB, uppercase: true, levels: [[48, 44], [56, 50], [64, 56]] },
  passName: { fontFamily: CB, uppercase: true, levels: [[42, 37], [49, 45], [56, 52]] },
  alertTitle: { fontFamily: CB, uppercase: true, levels: [[36, 32], [46, 42], [56, 52]] },
  titleCompact: { fontFamily: CB, uppercase: true, levels: [[32, 32], [40, 40], [48, 48]] },
  targetName: { fontFamily: CB, uppercase: true, levels: [[28, 27], [34, 33], [40, 40]] },
  displayXS: { fontFamily: CB, uppercase: true, levels: [[24, 28], [30, 34], [36, 40]] },
  wordmark: { fontFamily: CB, uppercase: true, levels: [[22, 24, 0.88], [27, 30, 0.54], [32, 36]] },
  badgeName: { fontFamily: CB, uppercase: true, levels: [[19, 18], [24, 24], [30, 30]] },
  cardName: { fontFamily: CX, uppercase: true, levels: [[28, 27], [34, 33], [40, 40]] },
  rowName: { fontFamily: CX, uppercase: true, levels: [[26, 26], [32, 32], [38, 38]] },
  displayS: { fontFamily: CX, uppercase: true, levels: [[22, 22], [29, 30], [36, 40]] },
  button: { fontFamily: CX, uppercase: true, levels: [[22, 24], [27, 30], [32, 36]] },
  buttonSmall: { fontFamily: CX, uppercase: true, levels: [[20, 22], [25, 28], [30, 34]] },

  // Archivo – tekst ciągły
  settingTitle: { fontFamily: fonts.archivoSemiBold, levels: [[18, 27], [24, 36], [30, 45]] },
  body: { fontFamily: fonts.archivoRegular, levels: [[16, 24], [22, 33], [28, 42]] },
  bodyM: { fontFamily: fonts.archivoRegular, levels: [[15, 23], [22, 33], [28, 42]] },
  bodyStrong: { fontFamily: fonts.archivoSemiBold, levels: [[15, 20], [22, 30], [28, 38]] },
  bodyS: { fontFamily: fonts.archivoRegular, levels: [[14, 21], [20, 30], [26, 39]] },
  bodySStrong: { fontFamily: fonts.archivoSemiBold, levels: [[14, 21], [20, 30], [26, 39]] },

  // IBM Plex Mono – dane
  dataXXL: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[72, 72, -1.44], [84, 84, -1.68], [96, 96, -1.92]] },
  dataXL: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[32, 36], [40, 44], [48, 52]] },
  crewCode: { fontFamily: fonts.monoBold, uppercase: true, levels: [[24, 28, 2.4], [30, 36, 1.5], [36, 44]] },
  dataL: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[20, 24], [26, 32], [32, 40]] },
  data: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[15, 20], [22, 30], [28, 38]] },
  alertMeta: { fontFamily: fonts.monoSemiBold, levels: [[13, 20], [20, 30], [26, 38]] },
  codeL: { fontFamily: fonts.monoBold, uppercase: true, levels: [[14, 18], [18, 24], [22, 28]] },
  input: { fontFamily: fonts.monoRegular, levels: [[16, 24], [22, 33], [28, 42]] },

  // IBM Plex Mono 12 – etykiety (rozstrzelenie niesie hierarchię)
  sectionLabel: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 1.44], [18, 24, 1.08], [24, 32]] },
  eyebrow: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 1.2], [18, 24, 0.9], [24, 32]] },
  label: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.96], [18, 24, 0.72], [24, 32]] },
  labelMeta: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[12, 16, 0.96], [18, 24, 0.72], [24, 32]] },
  tag: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.72], [18, 24, 0.54], [24, 32]] },
  tagMeta: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[12, 16, 0.72], [18, 24, 0.54], [24, 32]] },
  status: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.48], [18, 24, 0.36], [24, 32]] },
  statusMeta: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[12, 16, 0.48], [18, 24, 0.36], [24, 32]] },
  chip: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.72], [17, 23, 0.51], [22, 30]] },
  code: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16], [18, 24], [24, 32]] },
  timeEnd: { fontFamily: fonts.monoRegular, levels: [[12, 16], [18, 24], [24, 32]] },
  barLabel: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.96], [17, 23, 0.68], [22, 30]] },
  barMeta: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[12, 16, 0.96], [17, 23, 0.68], [22, 30]] },
  tabLabel: { fontFamily: fonts.monoSemiBold, uppercase: true, levels: [[12, 16, 0.96], [15, 20, 0.6], [17, 22]] },
  tabLabelActive: { fontFamily: fonts.monoBold, uppercase: true, levels: [[12, 16, 0.96], [15, 20, 0.6], [17, 22]] },
} as const satisfies Record<string, TextStyleToken>;

export type TextStyleName = keyof typeof textStyles;

/**
 * Styl tekstu dla poziomu. Nigdy nie ustawiamy fontWeight – grubość jest w pliku fontu.
 * Wielkie litery przez textTransform, nie w stringu (TalkBack czyta wtedy słowo).
 */
export function textStyle(name: TextStyleName, level: TextLevel): TextStyle {
  const token: TextStyleToken = textStyles[name];
  const [fontSize, lineHeight, letterSpacing = 0] = token.levels[level];
  return {
    fontFamily: token.fontFamily,
    fontSize,
    lineHeight,
    letterSpacing,
    ...(token.uppercase ? { textTransform: "uppercase" } : null),
  };
}

/* ------------------------------------------------------------------ */
/* Motywy                                                               */
/* ------------------------------------------------------------------ */

export type StatusDecoration = "color" | "pattern";

export interface Theme {
  readonly name: "default" | "highContrast" | "colorVision";
  readonly colors: ColorTokens;
  readonly borderWidth: BorderWidthTokens;
  readonly statusDecoration: StatusDecoration;
}

export const themes = {
  default: { name: "default", colors: defaultColors, borderWidth: defaultBorderWidth, statusDecoration: "color" },
  highContrast: {
    name: "highContrast",
    colors: highContrastColors,
    borderWidth: highContrastBorderWidth,
    statusDecoration: "color",
  },
  colorVision: {
    name: "colorVision",
    colors: colorVisionColors,
    borderWidth: defaultBorderWidth,
    statusDecoration: "pattern",
  },
} as const satisfies Record<string, Theme>;

export interface ThemeSettings {
  readonly highContrast: boolean;
  readonly colorVisionMode: boolean;
}

/**
 * Wysoki kontrast ma pierwszeństwo; „Wzory zamiast koloru” dokłada
 * statusDecoration: 'pattern' także w wysokim kontraście (H01).
 */
export function resolveTheme(settings: ThemeSettings): Theme {
  if (settings.highContrast) {
    return settings.colorVisionMode
      ? { ...themes.highContrast, statusDecoration: "pattern" }
      : themes.highContrast;
  }
  return settings.colorVisionMode ? themes.colorVision : themes.default;
}
