import { fonts, type FontFamily } from "./theme";

/**
 * Pliki fontów dla useFonts (expo-font). Klucz = nazwa rodziny = nazwa pliku,
 * więc ten sam zestaw zadziała później z config pluginem bez zmian w kodzie.
 * `satisfies` pilnuje, żeby żadnej rodziny z `fonts` nie zabrakło.
 */
export const fontAssets = {
  [fonts.condensedBlack]: require("../../assets/fonts/Archivo-ExtraCondensedBlack.ttf"),
  [fonts.condensedExtraBold]: require("../../assets/fonts/Archivo-ExtraCondensedExtraBold.ttf"),
  [fonts.archivoRegular]: require("../../assets/fonts/Archivo-Regular.ttf"),
  [fonts.archivoSemiBold]: require("../../assets/fonts/Archivo-SemiBold.ttf"),
  [fonts.monoRegular]: require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
  [fonts.monoSemiBold]: require("../../assets/fonts/IBMPlexMono-SemiBold.ttf"),
  [fonts.monoBold]: require("../../assets/fonts/IBMPlexMono-Bold.ttf"),
} satisfies Record<FontFamily, number>;
