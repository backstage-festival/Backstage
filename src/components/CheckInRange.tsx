import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { CheckInRangeProps } from "@/types/components";

/** Same bar height as the C01 NowPass progress (8 dp, radius 2). */
const TRACK_HEIGHT = 8;
const TRACK_RADIUS = 2;
/** E05b: the „Ty” marker sticks out of the bar by 4 dp above and below. */
const MARKER_OVERHANG = spacing.s1;

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * S05 / E05b · CheckInRange – under the disabled check-in button: „Podejdź
 * bliżej · check-in od 50 m”, a bar with the 50 m zone in success and a „Ty”
 * marker at the user's distance (clamped to the end), „Scena · 50 m” /
 * „Ty · 450 m” under it. Hidden from TalkBack: the button hint carries it.
 */
export function CheckInRange({ title, zone, progress, stageLabel, youLabel, testID }: CheckInRangeProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const marker = theme.borderWidth.indicator;
  // Marker centred on its point, but never past either end of the bar.
  const markerLeft = Math.min(Math.max(0, width - marker), Math.max(0, clamp01(progress) * width - marker / 2));

  return (
    <View testID={testID} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.block}>
      <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textPrimary }]}>
        {title}
      </Text>
      <View onLayout={onLayout} style={styles.trackArea}>
        <View style={[styles.track, { backgroundColor: c.surfaceRaised }]}>
          <View style={[styles.zone, { width: `${clamp01(zone) * 100}%`, backgroundColor: c.success }]} />
        </View>
        <View
          style={[
            styles.marker,
            { width: marker, left: markerLeft, backgroundColor: c.textPrimary },
          ]}
        />
      </View>
      <View style={[styles.labels, level === 2 ? styles.labelsStacked : null]}>
        <Text allowFontScaling={false} style={[textStyle("labelMeta", level), { color: c.textSecondary }]}>
          {stageLabel}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("labelMeta", level), { color: c.textSecondary }]}>
          {youLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.s2 },
  trackArea: { height: TRACK_HEIGHT + MARKER_OVERHANG * 2, justifyContent: "center" },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_RADIUS, overflow: "hidden" },
  zone: { height: TRACK_HEIGHT },
  marker: { position: "absolute", top: 0, bottom: 0 },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.s2 },
  labelsStacked: { flexDirection: "column" },
});
