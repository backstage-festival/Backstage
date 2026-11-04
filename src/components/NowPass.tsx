import { memo, useCallback } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { NowPassProps } from "@/types/components";

import { usePressScale } from "./motion";
import { stageNumber } from "./PerformanceCard";

/** C01 NowPass: slot 16 from the left, 46 from the top; content starts 44 from the left. */
const SLOT_LEFT = 16;
const SLOT_TOP = 46;
const CONTENT_LEFT = 44;
/** C01: progress bar 8 dp, radius 2. */
const PROGRESS_HEIGHT = 8;
const PROGRESS_RADIUS = 2;

/**
 * C01 · NowPass – the „TERAZ” pass above the Plan list. The zone band is
 * accent only when no alert is on screen (accentSuppressed → ink band).
 */
function NowPassBase({
  id,
  artist,
  stage,
  stageName,
  range,
  remainingMin,
  progress,
  serial,
  inPlan,
  alsoNow,
  accentSuppressed,
  onPress,
}: NowPassProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const handlePress = useCallback(() => onPress(id), [onPress, id]);

  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);
  const compact = level === 0;

  const label =
    strings.plan.a11y.nowPass(artist, stageName, remainingMin) +
    (inPlan ? ` ${strings.plan.a11y.nowPassInPlan}` : "") +
    (alsoNow ? ` ${strings.plan.pass.alsoNow(alsoNow)}.` : "");

  const bandColors = accentSuppressed
    ? { backgroundColor: c.textOnLaminate, borderColor: c.laminate, borderWidth: theme.borderWidth.hairline }
    : { backgroundColor: c.accent, borderColor: c.accent, borderWidth: 0 };
  const bandText = accentSuppressed ? c.laminate : c.textOnAccent;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.pass, { backgroundColor: c.laminate, transform: [{ scale }] }]}>
        <View style={[styles.band, bandColors]}>
          <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: bandText }]}>
            {strings.plan.pass.eyebrow(stageNumber(stage), stageName)}
          </Text>
        </View>

        <View style={styles.content}>
          <Text allowFontScaling={false} style={[textStyle("passName", level), { color: c.textOnLaminate }]}>
            {artist}
          </Text>
          {alsoNow ? (
            <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textOnLaminateSecondary }]}>
              {strings.plan.pass.alsoNow(alsoNow)}
            </Text>
          ) : null}
          <View style={compact ? styles.timesRow : styles.timesColumn}>
            <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textOnLaminate }]}>
              {range}
            </Text>
            <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textOnLaminate }]}>
              {strings.plan.pass.remaining(remainingMin)}
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={strings.plan.a11y.progress(percent)}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            style={[styles.track, { backgroundColor: c.laminateTrack }]}
          >
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: c.textOnLaminate }]} />
          </View>
          <Text
            allowFontScaling={false}
            style={[textStyle("tagMeta", level), styles.serial, { color: c.textOnLaminateSecondary }]}
          >
            {strings.plan.pass.serial(serial)}
          </Text>
        </View>

        <View
          style={[
            styles.slot,
            { width: size.passSlot.width, height: size.passSlot.height, backgroundColor: c.background },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export const NowPass = memo(NowPassBase);

const styles = StyleSheet.create({
  pass: {
    borderRadius: radius.pass,
    overflow: "hidden",
  },
  band: {
    minHeight: size.passBand,
    justifyContent: "center",
    paddingLeft: CONTENT_LEFT,
    paddingRight: spacing.s4,
    borderTopLeftRadius: radius.pass,
    borderTopRightRadius: radius.pass,
  },
  content: {
    paddingLeft: CONTENT_LEFT,
    paddingRight: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s3,
    gap: spacing.s2,
  },
  timesRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.s2 },
  timesColumn: { gap: spacing.s2 },
  track: {
    height: PROGRESS_HEIGHT,
    borderRadius: PROGRESS_RADIUS,
    overflow: "hidden",
  },
  fill: { height: PROGRESS_HEIGHT, borderRadius: PROGRESS_RADIUS },
  serial: { alignSelf: "flex-end" },
  slot: {
    position: "absolute",
    left: SLOT_LEFT,
    top: SLOT_TOP,
    borderRadius: radius.slot,
  },
});
