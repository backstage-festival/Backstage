import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { shortestRotation } from "@/hooks/tentRows";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { CompassArrowProps } from "@/types/components";

import { Icon } from "./Icon";

/** C06: ring 296 dp, 260 dp at 200 % text. */
const RING_XL = 260;
const RING_BORDER_FACTOR = 2;
/** C06 arrow: head up, notch at the bottom. Width and notch depth as a share of the height. */
const ARROW_WIDTH_RATIO = 0.72;
const ARROW_NOTCH_RATIO = 0.28;
/** C06: 3 dp outline in the background colour, so the arrow stands off the ring. */
const ARROW_OUTLINE = 3;
/** Text inside the ring keeps clear of the border. */
const RING_TEXT_RATIO = 0.7;

const t = strings.tent.compass;

interface ArrowShapeProps {
  height: number;
  color: string;
  notchColor: string | null;
}

/**
 * Arrow drawn with the border trick: two right-triangle halves make the head,
 * a third triangle in the background colour cuts the notch. Sharp at any size
 * (the navArrow icon is a 96 px bitmap and blurs at 184 dp).
 */
function ArrowShape({ height, color, notchColor }: ArrowShapeProps) {
  const half = Math.round((height * ARROW_WIDTH_RATIO) / 2);
  const notch = Math.round(height * ARROW_NOTCH_RATIO);
  return (
    <View style={{ width: half * 2, height }}>
      <View style={styles.halves}>
        <View
          style={[
            styles.triangle,
            { borderLeftWidth: half, borderBottomWidth: height, borderBottomColor: color },
          ]}
        />
        <View
          style={[
            styles.triangle,
            { borderRightWidth: half, borderBottomWidth: height, borderBottomColor: color },
          ]}
        />
      </View>
      {notchColor ? (
        <View
          style={[
            styles.triangle,
            styles.notch,
            { borderLeftWidth: half, borderRightWidth: half, borderBottomWidth: notch, borderBottomColor: notchColor },
          ]}
        />
      ) : null}
    </View>
  );
}

/**
 * C06 · CompassArrow – ring with the N mark, the arrow (guiding) or a state
 * message, then distance, walking time and „<opis> · ±8 m” under the ring.
 * Rotation: transform rotate on an Animated.Value set along the shortest turn.
 * TODO(#34): smooth Animated.timing(motion.compass, useNativeDriver: true).
 * The whole block is one TalkBack stop; its label is throttled by the caller.
 */
export function CompassArrow({
  state,
  bearingDeg,
  distance,
  walk,
  accuracy,
  targetName,
  accessibilityLabel,
  testID,
}: CompassArrowProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const ring = level === 2 ? RING_XL : size.compassRing;
  const arrow = Math.min(size.compassArrow, ring - spacing.s12 * 2);
  const textWidth = ring * RING_TEXT_RATIO;

  // Unbounded degrees, so 350° → 10° turns forward, not all the way back.
  const [rotation] = useState(() => new Animated.Value(0));
  const rotate = useMemo(
    () => rotation.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }),
    [rotation],
  );
  const current = useRef(0);

  useEffect(() => {
    current.current = shortestRotation(current.current, bearingDeg);
    rotation.setValue(current.current);
  }, [bearingDeg, rotation]);

  const message = (title: string, body: string, color: string, warning: boolean) => (
    <View style={[styles.message, { maxWidth: textWidth }]}>
      {warning ? <Icon name="warning" size={size.icon} color={color} /> : null}
      <Text allowFontScaling={false} style={[textStyle("status", level), styles.center, { color }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={[textStyle("bodyS", level), styles.center, { color: c.textSecondary }]}>
        {body}
      </Text>
    </View>
  );

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={styles.block}
    >
      <View
        style={[
          styles.ring,
          { width: ring, height: ring, borderColor: c.border, borderWidth: theme.borderWidth.control * RING_BORDER_FACTOR },
        ]}
      >
        <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.north, { color: c.textPrimary }]}>
          {t.north}
        </Text>
        {state === "guiding" ? (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <View style={styles.arrowStack}>
              <ArrowShape height={arrow + ARROW_OUTLINE * 4} color={c.background} notchColor={null} />
              <View style={styles.arrowOnTop}>
                <ArrowShape height={arrow} color={c.accent} notchColor={c.background} />
              </View>
            </View>
          </Animated.View>
        ) : null}
        {state === "near" ? message(t.near(distance), t.nearBody, c.textPrimary, false) : null}
        {state === "calibrating" ? message(t.calibrating, t.calibratingBody, c.warning, true) : null}
        {state === "noHeading" ? message(t.noHeading, t.noHeadingBody, c.textPrimary, false) : null}
      </View>

      <View style={[styles.data, level === 2 ? styles.dataStacked : null]}>
        <Text allowFontScaling={false} style={[textStyle("dataXXL", level), { color: c.textPrimary }]}>
          {distance}
        </Text>
        {walk ? (
          <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textSecondary }]}>
            {walk}
          </Text>
        ) : null}
      </View>
      <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.center, { color: c.textSecondary }]}>
        {t.meta(targetName, accuracy)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: "center", gap: spacing.s3 },
  ring: { borderRadius: radius.round, alignItems: "center", justifyContent: "center" },
  north: { position: "absolute", top: spacing.s3 },
  halves: { flexDirection: "row" },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  notch: { position: "absolute", bottom: 0, left: 0 },
  arrowStack: { alignItems: "center", justifyContent: "center" },
  arrowOnTop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  message: { alignItems: "center", gap: spacing.s1 },
  center: { textAlign: "center" },
  data: { flexDirection: "row", alignItems: "baseline", gap: spacing.s3 },
  dataStacked: { flexDirection: "column", alignItems: "center", gap: spacing.s1 },
});
