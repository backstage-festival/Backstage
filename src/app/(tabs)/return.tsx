import { useCallback } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { toDepartureRowProps, walkMeta } from "@/components/mappers";
import { StopCard } from "@/components/StopCard";
import { mockClock, mockDepartures, mockStops, mockWalkSeconds } from "@/mocks/mockData";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/theme";
import type { StopCardProps } from "@/types/components";

// TEMP: mock data until #27
function stopCard(stopId: number, now: Date): Omit<StopCardProps, "onGuide"> | null {
  const stop = mockStops.find((s) => s.id === stopId);
  if (!stop) return null;
  const walkSeconds = mockWalkSeconds[stopId] ?? 0;
  const departures = mockDepartures
    .filter((d) => d.stopId === stopId)
    .map((d) => toDepartureRowProps(d, walkSeconds, now));
  return {
    name: stop.name,
    meta: walkMeta(walkSeconds),
    freshness: departures.every((d) => d.freshness === "live") ? "live" : "stale",
    departures,
  };
}

const cards = [
  stopCard(14701, mockClock.return),
  stopCard(14702, mockClock.return),
  stopCard(14703, mockClock.night),
].filter((card): card is Omit<StopCardProps, "onGuide"> => card !== null);

export default function ReturnScreen() {
  const { theme } = useTheme();
  const guide = useCallback(() => undefined, []);

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {cards.map((card, index) => (
          <StopCard key={`${card.name}-${index}`} {...card} onGuide={guide} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.section },
});
