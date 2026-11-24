import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { LeaveNowAlert } from "@/components/LeaveNowAlert";
import { PerformanceCard } from "@/components/PerformanceCard";
import { PlanNoteRow } from "@/components/PlanNoteRow";
import { RadioGroup } from "@/components/RadioGroup";
import { SectionHeader } from "@/components/SectionHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useSystemReduceMotion } from "@/components/motion";
import { SettingSwitch } from "@/components/SettingSwitch";
import { useAccessibilityPreview } from "@/hooks/useAccessibilityPreview";
import {
  type LeaveNowAlertSetting,
  type SettingsError,
  settingsStore,
  type SnoozeMinutes,
  useSettingsStore,
} from "@/store";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle, type TextSizeSetting } from "@/theme/theme";
import type { RadioOption, SegmentedOption } from "@/types/components";

type SnoozeChoice = "5" | "10" | "15";

const t = strings.settings;

const TEXT_SIZE_OPTIONS: readonly SegmentedOption<TextSizeSetting>[] = [
  { value: "standard", label: t.textSize.standard, accessibilityLabel: t.textSize.a11y.standard },
  { value: "large", label: t.textSize.large, accessibilityLabel: t.textSize.a11y.large },
  { value: "xlarge", label: t.textSize.xlarge, accessibilityLabel: t.textSize.a11y.xlarge },
];

const ALERT_OPTIONS: readonly RadioOption<LeaveNowAlertSetting>[] = [
  { value: "sound", label: t.alerts.sound },
  { value: "vibrate", label: t.alerts.vibrate },
  { value: "muted", label: t.alerts.muted },
];

const SNOOZE_VALUES: readonly SnoozeMinutes[] = [5, 10, 15];
const SNOOZE_OPTIONS: readonly SegmentedOption<SnoozeChoice>[] = SNOOZE_VALUES.map((minutes) => ({
  value: snoozeChoiceOf(minutes),
  label: t.snooze.option(minutes),
  accessibilityLabel: t.snooze.a11y(minutes),
}));

function snoozeChoiceOf(minutes: SnoozeMinutes): SnoozeChoice {
  return minutes === 5 ? "5" : minutes === 10 ? "10" : "15";
}

function snoozeMinutesOf(choice: SnoozeChoice): SnoozeMinutes {
  return choice === "5" ? 5 : choice === "10" ? 10 : 15;
}

const update = settingsStore.getState().update;
const clearError = (): void => settingsStore.getState().clearError();
const goBack = (): void => router.back();
const noop = (): void => undefined;

function errorNote(error: SettingsError | null) {
  if (error === null) return null;
  return error.kind === "saveFailed"
    ? { label: t.saveFailed, a11y: t.saveFailedA11y }
    : { label: t.loadFailed, a11y: t.loadFailedA11y };
}

/** „Podgląd na żywo” – the Plan alert and card in the current theme. One TalkBack stop, not interactive. */
function LivePreview() {
  const { alert, card } = useAccessibilityPreview();
  return (
    <View
      accessible
      accessibilityLabel={t.a11y.preview}
      pointerEvents="none"
      style={styles.preview}
    >
      {alert ? <LeaveNowAlert {...alert} onGuide={noop} onSnooze={noop} onMute={noop} /> : null}
      {card ? <PerformanceCard {...card} onPress={noop} onTogglePlan={noop} /> : null}
    </View>
  );
}

/**
 * S10 · Dostępność. Every change applies at once (optimistic store update),
 * no „Zapisz” button. TalkBack order = visual order, top to bottom.
 */
export default function AccessibilityScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;

  const highContrast = useSettingsStore((state) => state.highContrast);
  const colorVisionMode = useSettingsStore((state) => state.colorVisionMode);
  const textSize = useSettingsStore((state) => state.textSize);
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const systemReduceMotion = useSystemReduceMotion();
  const leaveNowAlerts = useSettingsStore((state) => state.leaveNowAlerts);
  const snoozeMinutes = useSettingsStore((state) => state.snoozeMinutes);
  const lastError = useSettingsStore((state) => state.lastError);

  const textSizeValue = useMemo(() => [textSize], [textSize]);
  const snoozeValue = useMemo(() => [snoozeChoiceOf(snoozeMinutes)], [snoozeMinutes]);
  const note = errorNote(lastError);

  const onHighContrast = useCallback((value: boolean) => void update("highContrast", value), []);
  const onColorVision = useCallback((value: boolean) => void update("colorVisionMode", value), []);
  const onTextSize = useCallback((value: readonly TextSizeSetting[]) => {
    const picked = value[0];
    if (picked !== undefined) void update("textSize", picked);
  }, []);
  // null (system) only until the first tap – then an explicit true / false is saved.
  const onMotion = useCallback((value: boolean) => void update("reduceMotion", value), []);
  const onAlerts = useCallback((value: LeaveNowAlertSetting) => void update("leaveNowAlerts", value), []);
  const onSnooze = useCallback((value: readonly SnoozeChoice[]) => {
    const picked = value[0];
    if (picked !== undefined) void update("snoozeMinutes", snoozeMinutesOf(picked));
  }, []);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button
          label={t.back}
          variant="ghost"
          surface="dark"
          icon="arrowLeft"
          disabled={false}
          width="hug"
          accessibilityHint={t.a11y.back}
          onPress={goBack}
        />
        <Text
          allowFontScaling={false}
          accessibilityRole="header"
          style={[textStyle("titleSettings", level), { color: c.textPrimary }]}
        >
          {t.title}
        </Text>

        {note ? (
          <PlanNoteRow label={note.label} accessibilityLabel={note.a11y} tone="error" onDismiss={clearError} />
        ) : null}

        <SectionHeader label={t.preview} />
        <LivePreview />

        <SectionHeader label={t.contrast.section} />
        <SettingSwitch
          title={t.contrast.title}
          description={t.contrast.description}
          value={highContrast}
          onValueChange={onHighContrast}
        />

        <SectionHeader label={t.colors.section} />
        <SettingSwitch
          title={t.colors.title}
          description={t.colors.description}
          value={colorVisionMode}
          onValueChange={onColorVision}
        />

        <SectionHeader label={t.textSize.section} />
        <SegmentedControl
          groupLabel={t.textSize.group}
          options={TEXT_SIZE_OPTIONS}
          mode="single"
          value={textSizeValue}
          look="dayTabs"
          onChange={onTextSize}
        />
        <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
          {t.textSize.description}
        </Text>

        <SectionHeader label={t.motion.section} />
        <SettingSwitch
          title={t.motion.title}
          description={t.motion.description}
          value={reduceMotion ?? systemReduceMotion}
          onValueChange={onMotion}
        />

        <SectionHeader label={t.alerts.section} />
        <RadioGroup groupLabel={t.alerts.group} options={ALERT_OPTIONS} value={leaveNowAlerts} onChange={onAlerts} />

        <SectionHeader label={t.snooze.section} />
        <SegmentedControl
          groupLabel={t.snooze.group}
          options={SNOOZE_OPTIONS}
          mode="single"
          value={snoozeValue}
          look="dayTabs"
          onChange={onSnooze}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.s3, paddingBottom: spacing.s12 },
  preview: { gap: spacing.s3 },
});
