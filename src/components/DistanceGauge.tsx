import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { shortestRotation } from "@/hooks/tentRows";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, radius, size, spacing, textStyle } from "@/theme/theme";
import type { DistanceGaugeProps } from "@/types/components";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { useReduceMotion } from "./motion";
import { StatusTag } from "./StatusTag";

const t = strings.concert;

/** S05: the ring is 48 dp, like a touch target (size.iconButton). */
const RING = size.iconButton;

/** Arrow rotation along the shortest turn (C06); instant under reduced motion. */
function useRotation(bearingDeg: number, reduceMotion: boolean) {
  const [rotation] = useState(() => new Animated.Value(0));
  const current = useRef(0);
  const rotate = useMemo(
    () => rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }),
    [rotation],
  );

  useEffect(() => {
    current.current = shortestRotation(current.current, bearingDeg);
    if (reduceMotion) {
      rotation.setValue(current.current);
      return undefined;
    }
    const animation = Animated.timing(rotation, {
      toValue: current.current,
      duration: motion.compass.duration,
      easing: Easing.bezier(...motion.compass.easing),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [bearingDeg, reduceMotion, rotation]);

  return rotate;
}

/**
 * S05 · DistanceGauge – 48 dp ring with the arrow to the stage, the distance
 * and under it: „W zasięgu check-inu” (success ring), the walking time with
 * „Prowadź”, or the GPS state with its action. The ring and texts are one
 * TalkBack stop (throttled label, polite live region); buttons are their own.
 */
export function DistanceGauge({
  state,
  bearingDeg,
  distance,
  walk,
  accessibilityLabel,
  onGuide,
  onRetry,
  onOpenSettings,
  testID,
}: DistanceGaugeProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const rotate = useRotation(bearingDeg ?? 0, reduceMotion);
  const inRange = state === "inRange";
  const stacked = level > 0;

  return (
    <View
      testID={testID}
      style={[styles.block, { borderColor: c.divider, borderTopWidth: theme.borderWidth.hairline, borderBottomWidth: theme.borderWidth.hairline }]}
    >
      <View style={[styles.row, stacked ? styles.rowStacked : null]}>
        <View accessible accessibilityLabel={accessibilityLabel} accessibilityLiveRegion="polite" style={styles.reading}>
          <View
            style={[
              styles.ring,
              { borderColor: inRange ? c.success : c.border, borderWidth: theme.borderWidth.control * 2 },
            ]}
          >
            {bearingDeg !== null ? (
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Icon name="navArrow" size={size.icon} color={c.textPrimary} />
              </Animated.View>
            ) : null}
          </View>
          <View style={styles.texts}>
            {/* E05: about 19 dp per glyph = dataXL (32). With dataXXL „450 M” did not fit next to „Prowadź”. */}
            <Text allowFontScaling={false} style={[textStyle("dataXL", level), { color: c.textPrimary }]}>
              {distance}
            </Text>
            {inRange ? <StatusTag label={t.inRange} tone="success" icon="inPlan" fill="outline" /> : null}
            {state === "tooFar" && walk !== null ? (
              <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textSecondary }]}>
                {walk}
              </Text>
            ) : null}
            {state === "locating" ? (
              <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textSecondary }]}>
                {t.locating}
              </Text>
            ) : null}
            {state === "noPermission" ? (
              <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.warning }]}>
                {t.noPermission}
              </Text>
            ) : null}
          </View>
        </View>
        {state === "tooFar" ? (
          <Button
            label={t.guide}
            variant="secondary"
            surface="dark"
            disabled={false}
            width={stacked ? "fill" : "hug"}
            accessibilityHint={t.a11y.guideHint}
            onPress={onGuide}
          />
        ) : null}
      </View>

      {state === "noPermission" ? (
        <View style={styles.actions}>
          <Button
            label={t.openSettings}
            variant="secondary"
            surface="dark"
            disabled={false}
            width="fill"
            accessibilityHint={t.a11y.settingsHint}
            onPress={onOpenSettings}
          />
          <Button
            label={t.retry}
            variant="link"
            surface="dark"
            disabled={false}
            width="hug"
            accessibilityHint={t.a11y.retryHint}
            onPress={onRetry}
          />
        </View>
      ) : null}
      {state === "locating" ? (
        <Button
          label={t.retry}
          variant="link"
          surface="dark"
          disabled={false}
          width="hug"
          accessibilityHint={t.a11y.retryHint}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: spacing.s3, gap: spacing.s3 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.s3 },
  rowStacked: { flexDirection: "column", alignItems: "stretch" },
  reading: { flexDirection: "row", alignItems: "center", gap: spacing.s4, flexShrink: 1 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flexShrink: 1, gap: spacing.s1 },
  actions: { gap: spacing.s2 },
});
