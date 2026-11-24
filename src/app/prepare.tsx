import { router } from "expo-router";
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";

import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ScreenHeader } from "@/components/ScreenHeader";
import { usePrepareScreen } from "@/hooks/usePrepareScreen";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle } from "@/theme/theme";
import type { DownloadStep } from "@/infrastructure/sync/EventPackageDownloader";

const STEP_ORDER: readonly DownloadStep[] = [
  "event",
  "stops",
  "departures",
  "alerts",
  "weather",
  "saving",
];

function DatasetRow({
  label,
  done,
  current,
}: {
  label: string;
  done: boolean;
  current: boolean;
}) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.datasetRow} accessibilityLabel={label}>
      <Icon
        name={done ? "inPlan" : current ? "sync" : "clock"}
        size={16}
        color={done ? c.success : current ? c.accent : c.textDisabled}
      />
      <Text
        allowFontScaling={false}
        style={[
          textStyle("bodyS", level),
          {
            color: done
              ? c.textPrimary
              : current
                ? c.accent
                : c.textDisabled,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** S02 · Prepare – download the event package for offline use. */
export default function PrepareScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const screen = usePrepareScreen();

  useEffect(() => {
    if (screen.phase === "done") {
      AccessibilityInfo.announceForAccessibility(
        strings.prepare.a11y.doneAnnounce,
      );
    }
  }, [screen.phase]);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <ScreenHeader title={strings.prepare.title} />
        {(screen.phase === "done" || screen.phase === "error") && (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={strings.prepare.close}
            hitSlop={8}
          >
            <Icon name="close" size={24} color={c.textPrimary} />
          </Pressable>
        )}
      </View>

      {screen.phase === "idle" && (
        <View style={styles.section}>
          <Text
            allowFontScaling={false}
            style={[textStyle("body", level), { color: c.textSecondary }]}
          >
            {strings.prepare.startBody}
          </Text>
          <Button
            label={strings.prepare.download}
            variant="primary"
            surface="dark"
            icon="download"
            disabled={false}
            width="fill"
            accessibilityHint={strings.prepare.a11y.downloadHint}
            onPress={screen.download}
          />
        </View>
      )}

      {screen.phase === "downloading" && (
        <View style={styles.section} accessibilityLiveRegion="polite">
          <Text
            allowFontScaling={false}
            style={[textStyle("bodyStrong", level), { color: c.textPrimary }]}
          >
            {strings.prepare.downloading}
          </Text>
          <View style={styles.steps}>
            {STEP_ORDER.map((step, i) => {
              const done = screen.completed > i + 1;
              const current = screen.completed === i + 1;
              return (
                <DatasetRow
                  key={step}
                  label={strings.prepare.steps[step] ?? step}
                  done={done}
                  current={current}
                />
              );
            })}
          </View>
          {screen.total > 0 && (
            <View
              style={[styles.progressBar, { backgroundColor: c.surfaceRaised }]}
              accessibilityRole="progressbar"
              accessibilityLabel={screen.progressLabel ?? ""}
              accessibilityValue={{
                min: 0,
                max: screen.total,
                now: screen.completed,
              }}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: c.accent,
                    width: `${(screen.completed / screen.total) * 100}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {screen.phase === "done" && (
        <View style={styles.section}>
          <Icon name="flag" size={32} color={c.success} />
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[textStyle("targetName", level), { color: c.textPrimary }]}
          >
            {strings.prepare.done}
          </Text>
          <Text
            allowFontScaling={false}
            style={[textStyle("body", level), { color: c.textSecondary }]}
          >
            {strings.prepare.doneBody}
          </Text>
          <Button
            label={strings.prepare.close}
            variant="primary"
            surface="dark"
            disabled={false}
            width="fill"
            onPress={() => router.back()}
          />
        </View>
      )}

      {screen.phase === "error" && (
        <View style={styles.section}>
          <Icon name="warning" size={32} color={c.error} />
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[textStyle("targetName", level), { color: c.textPrimary }]}
          >
            {strings.prepare.errorTitle}
          </Text>
          <Text
            allowFontScaling={false}
            style={[textStyle("body", level), { color: c.textSecondary }]}
          >
            {strings.prepare.errorBody}
          </Text>
          <Button
            label={strings.prepare.retry}
            variant="primary"
            surface="dark"
            disabled={false}
            width="fill"
            onPress={screen.download}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.screen, paddingBottom: spacing.s12 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  section: { marginTop: spacing.section, gap: spacing.s4 },
  steps: { gap: spacing.s2 },
  datasetRow: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  progressBar: {
    height: 4,
    borderRadius: radius.tag,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: radius.tag },
});
