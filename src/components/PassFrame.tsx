import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { PassFrameProps } from "@/types/components";

/** Pass slot („dziurka”) like NowPass (C01): 16 from the left, 46 from the top; content from 44. */
const SLOT_LEFT = 16;
const SLOT_TOP = 46;
export const PASS_CONTENT_LEFT = 44;

/**
 * Laminate pass shell shared by the S07 tent pass and the S01 festival pass:
 * accent band with a label (and an optional trailing label), the slot on the
 * left, children below the band. NowPass keeps its own shell (press scale and
 * the ink band when an alert is on screen) – it could move here later.
 */
export function PassFrame({ band, bandTrailing, accessibilityLabel, children, testID }: PassFrameProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const single = accessibilityLabel !== undefined;

  return (
    <View
      testID={testID}
      accessible={single}
      {...(single ? { accessibilityLabel } : null)}
      style={[styles.pass, { backgroundColor: c.laminate }]}
    >
      <View style={[styles.band, { backgroundColor: c.accent }, level > 0 ? styles.bandStacked : null]}>
        <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.shrink, { color: c.textOnAccent }]}>
          {band}
        </Text>
        {bandTrailing ? (
          <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: c.textOnAccent }]}>
            {bandTrailing}
          </Text>
        ) : null}
      </View>
      {children}
      <View
        style={[styles.slot, { width: size.passSlot.width, height: size.passSlot.height, backgroundColor: c.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pass: { borderRadius: radius.pass, overflow: "hidden" },
  band: {
    minHeight: size.passBand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s2,
    paddingLeft: PASS_CONTENT_LEFT,
    paddingRight: spacing.s4,
  },
  bandStacked: { flexDirection: "column", alignItems: "flex-start", paddingVertical: spacing.s1 },
  shrink: { flexShrink: 1 },
  slot: { position: "absolute", left: SLOT_LEFT, top: SLOT_TOP, borderRadius: radius.slot },
});
