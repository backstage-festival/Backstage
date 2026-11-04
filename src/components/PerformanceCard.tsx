import { memo, useCallback, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle, type TextLevel, type Theme } from "@/theme/theme";
import type { PerformanceCardProps, StageId } from "@/types/components";

import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { usePressScale } from "./motion";
import { StatusTag, statusTagLabel } from "./StatusTag";

/** C01: fixed row height at 100 % text (incl. 1 dp separator) – use in getItemLayout. */
export const PERFORMANCE_CARD_HEIGHT = 86;
/** C01: row height at 100 % text when a statusLine is shown. */
export const PERFORMANCE_CARD_HEIGHT_WITH_STATUS = 114;

export function performanceCardHeight(hasStatusLine: boolean): number {
  return hasStatusLine ? PERFORMANCE_CARD_HEIGHT_WITH_STATUS : PERFORMANCE_CARD_HEIGHT;
}

/** C01 columns: 56 · 1fr · 48, gap 10. */
const TIME_COLUMN_WIDTH = 56;
const COLUMN_GAP = 10;
/** C01: row press scale (smaller than motion.press, the row is large). */
const ROW_PRESS_SCALE = 0.98;
/** C01: stage code chip padding 2 / 6. */
const CODE_PAD_VERTICAL = 2;
const CODE_PAD_HORIZONTAL = 6;
/** C01: status line sits 6 dp under the stage row. */
const STATUS_GAP = 6;
const SMALL_ICON = 12;

export function stageNumber(stage: StageId): number {
  return stage === "s1" ? 1 : stage === "s2" ? 2 : 3;
}

function StageRow({
  stage,
  stageName,
  played,
  inPlan,
  theme,
  level,
}: {
  stage: StageId;
  stageName: string;
  played: boolean;
  inPlan: boolean;
  theme: Theme;
  level: TextLevel;
}) {
  const c = theme.colors;
  return (
    <View style={styles.stageRow}>
      <View
        style={[
          styles.code,
          played
            ? { borderColor: c.border, borderWidth: theme.borderWidth.hairline }
            : { backgroundColor: c.laminate },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[textStyle("code", level), { color: played ? c.textSecondary : c.textOnLaminate }]}
        >
          {strings.plan.stageCode(stageNumber(stage))}
        </Text>
      </View>
      <Text allowFontScaling={false} style={[textStyle("tagMeta", level), { color: c.textSecondary }]}>
        {played ? strings.plan.played : stageName}
      </Text>
      {inPlan ? (
        <View style={styles.inPlan}>
          <Icon name="inPlan" size={SMALL_ICON} color={c.textPrimary} />
          <Text allowFontScaling={false} style={[textStyle("tag", level), { color: c.textPrimary }]}>
            {strings.plan.inPlan}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** 150 / 200 %: full-width plan toggle with a label, height size.control[level]. */
function WidePlanToggle({
  inPlan,
  label,
  hint,
  onPress,
  theme,
  level,
}: {
  inPlan: boolean;
  label: string;
  hint: string;
  onPress: () => void;
  theme: Theme;
  level: TextLevel;
}) {
  const c = theme.colors;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const foreground = inPlan ? c.textOnLaminate : c.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: inPlan }}
    >
      <Animated.View
        style={[
          styles.wideToggle,
          { minHeight: size.control[level], transform: [{ scale }] },
          inPlan
            ? { backgroundColor: c.laminate }
            : { borderColor: c.border, borderWidth: theme.borderWidth.control },
        ]}
      >
        <Icon name={inPlan ? "inPlan" : "add"} size={size.icon} color={foreground} />
        <Text allowFontScaling={false} style={[textStyle("button", level), { color: foreground }]}>
          {inPlan ? strings.plan.inPlan : strings.plan.addToPlan}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * C01 · PerformanceCard – a line-up row on Plan. Whole row is one Pressable
 * (opens the concert modal); the plan toggle is a separate 48 × 48 button.
 * At 100 % the height is fixed (getItemLayout); at 150 / 200 % one column.
 */
function PerformanceCardBase({
  id,
  artist,
  stage,
  stageName,
  start,
  end,
  state,
  statusLine,
  onPress,
  onTogglePlan,
  testID,
}: PerformanceCardProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const [pressed, setPressed] = useState(false);
  const { scale, onPressIn, onPressOut } = usePressScale(ROW_PRESS_SCALE);

  const played = state === "played";
  const inPlan = state === "inPlan" || state === "conflict";
  const showStatus = state === "conflict" && statusLine !== undefined;
  const n = stageNumber(stage);

  const handlePress = useCallback(() => onPress(id), [onPress, id]);
  const handleToggle = useCallback(() => onTogglePlan(id), [onTogglePlan, id]);
  const handlePressIn = useCallback(() => {
    setPressed(true);
    onPressIn();
  }, [onPressIn]);
  const handlePressOut = useCallback(() => {
    setPressed(false);
    onPressOut();
  }, [onPressOut]);

  let rowLabel = strings.plan.a11y.card({ artist, stageNumber: n, stageName, start, end, inPlan });
  if (showStatus) rowLabel += `, ${statusTagLabel(statusLine, "warning", theme)}`;
  if (played) rowLabel += `, ${strings.plan.a11y.played}`;

  const toggleLabel = inPlan ? strings.plan.a11y.remove(artist) : strings.plan.a11y.add(artist, n, start);
  const toggleHint = inPlan ? strings.plan.a11y.removeHint : strings.plan.a11y.addHint;

  const compact = level === 0;
  const artistColor = played ? c.textSecondary : c.textPrimary;

  const statusTag = showStatus ? (
    <View style={styles.status}>
      <StatusTag label={statusLine} tone="warning" icon="warning" fill="solid" />
    </View>
  ) : null;

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.row,
        {
          borderBottomColor: c.divider,
          borderBottomWidth: theme.borderWidth.hairline,
          backgroundColor: pressed ? c.surfaceRaised : c.background,
          transform: [{ scale }],
        },
        compact ? { height: performanceCardHeight(showStatus) } : null,
      ]}
    >
      {compact ? (
        <View style={styles.columns}>
          <Pressable
            style={styles.mainPress}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessible
            accessibilityRole="button"
            accessibilityLabel={rowLabel}
            accessibilityHint={strings.plan.a11y.cardHint}
          >
            <View style={styles.timeColumn}>
              <Text allowFontScaling={false} style={[textStyle("data", level), { color: artistColor }]}>
                {start}
              </Text>
              <Text allowFontScaling={false} style={[textStyle("timeEnd", level), { color: c.textSecondary }]}>
                {end}
              </Text>
            </View>
            <View style={styles.middle}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[textStyle("cardName", level), { color: artistColor }]}
              >
                {artist}
              </Text>
              <StageRow stage={stage} stageName={stageName} played={played} inPlan={inPlan} theme={theme} level={level} />
              {statusTag}
            </View>
          </Pressable>
          {played ? null : (
            <IconButton
              icon={inPlan ? "inPlan" : "add"}
              selected={inPlan}
              surface="dark"
              disabled={false}
              accessibilityLabel={toggleLabel}
              accessibilityHint={toggleHint}
              onPress={handleToggle}
            />
          )}
        </View>
      ) : (
        <View style={styles.stack}>
          <Pressable
            style={styles.stack}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessible
            accessibilityRole="button"
            accessibilityLabel={rowLabel}
            accessibilityHint={strings.plan.a11y.cardHint}
          >
            <Text allowFontScaling={false} style={[textStyle("data", level), { color: artistColor }]}>
              {strings.plan.timeRange(start, end)}
            </Text>
            <Text allowFontScaling={false} numberOfLines={2} style={[textStyle("cardName", level), { color: artistColor }]}>
              {artist}
            </Text>
            <StageRow stage={stage} stageName={stageName} played={played} inPlan={inPlan} theme={theme} level={level} />
            {statusTag}
          </Pressable>
          {played ? null : (
            <WidePlanToggle
              inPlan={inPlan}
              label={toggleLabel}
              hint={toggleHint}
              onPress={handleToggle}
              theme={theme}
              level={level}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}

export const PerformanceCard = memo(PerformanceCardBase);

const styles = StyleSheet.create({
  row: {
    padding: spacing.s4,
    justifyContent: "center",
  },
  columns: {
    flexDirection: "row",
    alignItems: "center",
    gap: COLUMN_GAP,
  },
  mainPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: COLUMN_GAP,
  },
  timeColumn: { width: TIME_COLUMN_WIDTH },
  middle: { flex: 1, gap: spacing.s1 },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  code: {
    borderRadius: radius.tag,
    paddingVertical: CODE_PAD_VERTICAL,
    paddingHorizontal: CODE_PAD_HORIZONTAL,
  },
  inPlan: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  status: { marginTop: STATUS_GAP - spacing.s1 },
  stack: { gap: spacing.s2 },
  wideToggle: {
    marginTop: spacing.s1,
    borderRadius: radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
});
