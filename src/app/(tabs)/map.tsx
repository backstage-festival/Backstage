import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpoLocationService } from "@/infrastructure/location/ExpoLocationService";
import { MapView } from "@/infrastructure/map/MapView";
import type { MapMarker, MapTheme } from "@/infrastructure/map/mapMessages";
import { mockStageCodes, mockStages } from "@/mocks/mockData";
import { useTheme } from "@/theme/ThemeProvider";
import type { Theme } from "@/theme/theme";
import { HeadingSmoother } from "@/domain/utils/headingSmoother";
import type { Coordinates } from "@/domain/entities/common";

// TEMP: mock POIs until the Poi repository lands (#17 / #26).
const mockPois: readonly MapMarker[] = [
  { id: "poi-toilet-1", type: "toilet", latitude: 54.3614, longitude: 18.6478 },
  { id: "poi-water-1", type: "water", latitude: 54.3622, longitude: 18.649 },
  { id: "poi-medical-1", type: "medical", latitude: 54.363, longitude: 18.6485 },
  { id: "poi-food-1", type: "food", latitude: 54.3611, longitude: 18.6498 },
  { id: "poi-gate-1", type: "gate", latitude: 54.3598, longitude: 18.6475 },
];

function toMapTheme(name: Theme["name"]): MapTheme {
  if (name === "highContrast") return "wysoki-kontrast";
  if (name === "colorVision") return "wzory-cvd";
  return "domyslny";
}

export default function MapScreen() {
  const { theme } = useTheme();
  const mapTheme = toMapTheme(theme.name);

  // TEMP: inject via src/di (#32)
  const locationService = useMemo(() => new ExpoLocationService(), []);
  const headingSmoother = useRef(new HeadingSmoother()).current;

  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribePosition: (() => void) | undefined;
    let unsubscribeHeading: (() => void) | undefined;

    (async () => {
      const granted = await locationService.requestPermissions();
      if (!granted || cancelled) {
        return;
      }

      const current = await locationService.getCurrentPosition();
      if (!cancelled && current) {
        setUserPosition(current);
      }

      unsubscribePosition = await locationService.watchPosition((position) => {
        setUserPosition(position);
      });
      if (cancelled) { unsubscribePosition?.(); return; }

      unsubscribeHeading = await locationService.watchHeading((degrees) => {
        setHeadingDegrees(headingSmoother.update(degrees));
      });
      if (cancelled) { unsubscribeHeading?.(); return; }
    })();

    return () => {
      cancelled = true;
      unsubscribePosition?.();
      unsubscribeHeading?.();
    };
  }, [locationService, headingSmoother]);

  const markers = useMemo<MapMarker[]>(() => {
    const stageMarkers: MapMarker[] = mockStages.map((stage) => ({
      id: stage.id,
      type: mockStageCodes[stage.id] ?? "s1",
      latitude: stage.location.latitude,
      longitude: stage.location.longitude,
      selected: stage.id === selectedMarkerId,
    }));
    const poiMarkers = mockPois.map((poi) => ({
      ...poi,
      selected: poi.id === selectedMarkerId,
    }));
    return [...stageMarkers, ...poiMarkers];
  }, [selectedMarkerId]);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <MapView
        testID="map-view"
        markers={markers}
        theme={mapTheme}
        userPosition={userPosition}
        userHeadingDegrees={headingDegrees}
        onMarkerPress={setSelectedMarkerId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
