import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ScreenState } from "@/components/ScreenState";
import { StatusTag } from "@/components/StatusTag";
import { useConcertScreen } from "@/hooks/useConcertScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

/** S05 · Concert card modal – details, check-in and plan toggle. */
export default function ConcertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, level } = useTheme();
  const c = theme.colors;
  const screen = useConcertScreen(id as string);

  if (screen.loadStatus !== "ready" || !screen.concert) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <BackButton />
        <ScreenState
          title=""
          state={
            screen.loadStatus === "error"
              ? {
                  kind: "message",
                  empty: {
                    kind: "loadError",
                    title: "Brak danych",
                    body: "Koncert nie został znaleziony.",
                  },
                }
              : { kind: "loading" }
          }
        />
      </View>
    );
  }

  const a11yLabel = strings.concert.a11y.card(
    screen.concert.artist,
    screen.stageName,
    screen.startTime,
    screen.endTime,
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
      accessible={false}
    >
      <BackButton />

      <View style={styles.section} accessible accessibilityLabel={a11yLabel}>
        <Text
          allowFontScaling={false}
          style={[textStyle("eyebrow", level), { color: c.textSecondary }]}
        >
          {strings.concert.stage(screen.stageNum, screen.stageName)}
        </Text>
        <Text
          allowFontScaling={false}
          accessibilityRole="header"
          style={[textStyle("titleHero", level), { color: c.textPrimary }]}
        >
          {screen.concert.artist}
        </Text>
        <Text
          allowFontScaling={false}
          style={[textStyle("dataL", level), { color: c.textSecondary }]}
        >
          {strings.concert.time(screen.startTime, screen.endTime)}
        </Text>
      </View>

      <View style={styles.section}>
        {screen.isCheckedIn ? (
          <StatusTag
            label={strings.concert.checkInDone}
            tone="success"
            fill="solid"
            icon="inPlan"
          />
        ) : screen.checkInNote ? (
          <StatusTag
            label={screen.checkInNote}
            tone="warning"
            fill="outline"
            icon="locate"
          />
        ) : null}

        {!screen.isCheckedIn && (
          <Button
            label={
              screen.checkInPending
                ? strings.concert.checkInPending
                : strings.concert.checkIn
            }
            variant="primary"
            surface="dark"
            icon="flag"
            disabled={screen.checkInPending}
            width="fill"
            accessibilityHint={strings.concert.a11y.checkInHint}
            onPress={screen.checkIn}
          />
        )}
      </View>

      <View style={styles.section}>
        <Button
          label={
            screen.isPlanned
              ? strings.concert.inPlan
              : strings.concert.addToPlan
          }
          variant={screen.isPlanned ? "secondary" : "primary"}
          surface="dark"
          icon={screen.isPlanned ? "inPlan" : "add"}
          disabled={screen.schedulePending}
          width="fill"
          onPress={screen.togglePlan}
        />
      </View>
    </ScrollView>
  );
}

function BackButton() {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={strings.concert.back}
      style={styles.backButton}
      hitSlop={8}
    >
      <Icon name="arrowLeft" size={24} color={theme.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.s12,
    gap: spacing.section,
  },
  section: { gap: spacing.s3 },
  backButton: { alignSelf: "flex-start", padding: spacing.s2 },
});
