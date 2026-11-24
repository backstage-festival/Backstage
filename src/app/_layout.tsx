import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { useConnectionMonitor } from "@/hooks/useConnectionBar";
import { useSettingsLoader } from "@/hooks/useSettingsLoader";
import { useSettingsStore } from "@/store";
import { fontAssets } from "@/theme/fontAssets";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Splash zostaje, dopóki fonty się nie wczytają (albo nie zawiodą).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Network state for the ConnectionBar and outbox sync – once per app run.
  useConnectionMonitor();
  useSettingsLoader();
  // Separate selectors: each returns a primitive, so no new objects per render.
  const highContrast = useSettingsStore((state) => state.highContrast);
  const colorVisionMode = useSettingsStore((state) => state.colorVisionMode);
  const textSize = useSettingsStore((state) => state.textSize);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);

  useEffect(() => {
    if (fontError) {
      console.warn("Nie udało się wczytać fontów, używam systemowego.", fontError);
    }
    if (fontsLoaded || fontError) {
      SplashScreen.hide();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider
      highContrast={highContrast}
      colorVisionMode={colorVisionMode}
      textSize={textSize}
      reduceMotion={reduceMotion}
    >
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="prepare"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="performance/[id]"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="badges" />
        <Stack.Screen name="settings/accessibility" />
      </Stack>
    </ThemeProvider>
  );
}
