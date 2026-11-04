import { Link } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { findConflict, toNowPassProps, toPerformanceCardProps } from "@/components/mappers";
import { NowPass } from "@/components/NowPass";
import { PerformanceCard } from "@/components/PerformanceCard";
import type { Concert, Stage } from "@/domain/entities/Event";
import { mockClock, mockConcerts, mockPassSerial, mockPlannedConcertIds, mockStages } from "@/mocks/mockData";
import { strings } from "@/strings";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

// TEMP: mock data until #27
const stageById = new Map<string, Stage>(mockStages.map((stage) => [stage.id, stage]));

function stageOf(concert: Concert): Stage | undefined {
  return stageById.get(concert.stageId);
}

function VariantLabel({ text }: { text: string }) {
  const { theme, level } = useTheme();
  return (
    <Text allowFontScaling={false} style={[textStyle("sectionLabel", level), { color: theme.colors.textSecondary }]}>
      {text}
    </Text>
  );
}

export default function PlanScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const now = mockClock.plan;

  // TEMP: local optimistic state until useScheduleStore exists.
  const [planned, setPlanned] = useState<ReadonlySet<string>>(() => new Set(mockPlannedConcertIds));

  const togglePlan = useCallback((id: string) => {
    setPlanned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const openConcert = useCallback(() => undefined, []);

  const current = mockConcerts.find(
    (concert) => new Date(concert.startsAt) <= now && now < new Date(concert.endsAt),
  );
  const currentStage = current ? stageOf(current) : undefined;

  const cards = useMemo(() => {
    const plannedConcerts = mockConcerts.filter((concert) => planned.has(concert.id));
    return mockConcerts.flatMap((concert) => {
      const stage = stageOf(concert);
      if (!stage) return [];
      const inPlan = planned.has(concert.id);
      const other = inPlan ? findConflict(concert, plannedConcerts) : undefined;
      const otherStage = other ? stageOf(other) : undefined;
      return [
        toPerformanceCardProps(concert, stage, {
          inPlan,
          now,
          ...(other && otherStage ? { conflictWith: { concert: other, stage: otherStage } } : null),
        }),
      ];
    });
  }, [planned, now]);

  const variantCard = cards.find((card) => card.state === "conflict");
  const linkText = [textStyle("label", level), { color: c.textSecondary }];

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {current && currentStage ? (
          <NowPass
            {...toNowPassProps(current, currentStage, {
              inPlan: planned.has(current.id),
              serial: mockPassSerial,
              accentSuppressed: false,
              now,
            })}
            onPress={openConcert}
          />
        ) : null}

        <View>
          {cards.map((card) => (
            <PerformanceCard key={card.id} {...card} onPress={openConcert} onTogglePlan={togglePlan} />
          ))}
        </View>

        <Button
          label={strings.placeholder.prepare}
          variant="primary"
          surface="dark"
          disabled={false}
          width="fill"
          onPress={openConcert}
        />
        <Button
          label={strings.placeholder.downloadMap}
          variant="secondary"
          surface="dark"
          icon="download"
          disabled
          disabledReason={strings.placeholder.downloadMapDisabled}
          width="fill"
          onPress={openConcert}
        />

        {/* TEMP: theme variants from the boards (200 %, patterns, high contrast) */}
        {variantCard ? (
          <>
            <ThemeProvider textSize="xlarge">
              <VariantLabel text={strings.placeholder.variant200} />
              <PerformanceCard {...variantCard} onPress={openConcert} onTogglePlan={togglePlan} />
            </ThemeProvider>
            <ThemeProvider colorVisionMode>
              <VariantLabel text={strings.placeholder.variantPatterns} />
              <PerformanceCard {...variantCard} onPress={openConcert} onTogglePlan={togglePlan} />
            </ThemeProvider>
            <ThemeProvider highContrast>
              <VariantLabel text={strings.placeholder.variantHighContrast} />
              <PerformanceCard {...variantCard} onPress={openConcert} onTogglePlan={togglePlan} />
            </ThemeProvider>
          </>
        ) : null}

        {/* TEMP: replaced by real entry points in screen tasks */}
        <View style={styles.links}>
          <Link href="/prepare">
            <Text allowFontScaling={false} style={linkText}>
              Przygotuj się
            </Text>
          </Link>
          <Link href={{ pathname: "/performance/[id]", params: { id: "demo" } }}>
            <Text allowFontScaling={false} style={linkText}>
              Karta koncertu
            </Text>
          </Link>
          <Link href="/badges">
            <Text allowFontScaling={false} style={linkText}>
              Odznaki
            </Text>
          </Link>
          <Link href="/settings/accessibility">
            <Text allowFontScaling={false} style={linkText}>
              Dostępność
            </Text>
          </Link>
          <Link href="/login">
            <Text allowFontScaling={false} style={linkText}>
              Logowanie
            </Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.section },
  links: { gap: spacing.s3, alignItems: "flex-start" },
});
