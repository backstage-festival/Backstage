import { useCallback, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { PassFrameProps } from "@/types/components";

/**
 * Pass slot („dziurka”) like NowPass (C01): 16 from the left, 46 from the top
 * with the 30 dp band – i.e. 16 under the band. The band grows (two lines at
 * 200 %), so the slot follows its measured height. Content from 44.
 */
const SLOT_LEFT = 16;
const SLOT_BELOW_BAND = 46 - size.passBand;
export const PASS_CONTENT_LEFT = 44;

/**
 * Laminate pass shell shared by the S07 tent pass and the S01 festival pass:
 * ink band (E01, E07a) set into the laminate – a laminate hairline around it,
 * the same as the NowPass ink band (C01) – with a light label (and an optional trailing label), the slot on the
 * left, children below the band. NowPass keeps its own shell (press scale and
 * the ink band when an alert is on screen) – it could move here later.
 */
export function PassFrame({ band, bandTrailing, bandLook = "mono", accessibilityLabel, children, testID }: PassFrameProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const single = accessibilityLabel !== undefined;
  const [bandHeight, setBandHeight] = useState<number>(size.passBand);
  const onBandLayout = useCallback((event: LayoutChangeEvent) => {
    setBandHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <View
      testID={testID}
      accessible={single}
      {...(single ? { accessibilityLabel } : null)}
      style={[styles.pass, { backgroundColor: c.laminate }]}
    >
      <View
        onLayout={onBandLayout}
        style={[
          styles.band,
          { backgroundColor: c.textOnLaminate, borderColor: c.laminate, borderWidth: theme.borderWidth.hairline },
          level > 0 ? styles.bandStacked : null,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[textStyle(bandLook === "condensed" ? "displayXS" : "eyebrow", level), styles.shrink, { color: c.laminate }]}
        >
          {band}
        </Text>
        {bandTrailing ? (
          <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.laminate }]}>
            {bandTrailing}
          </Text>
        ) : null}
      </View>
      {children}
      <View
        style={[
          styles.slot,
          {
            top: bandHeight + SLOT_BELOW_BAND,
            width: size.passSlot.width,
            height: size.passSlot.height,
            backgroundColor: c.background,
          },
        ]}
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
    // As NowPass: the border sits inside, so the ink corners follow the pass radius minus the inset.
    borderTopLeftRadius: radius.pass,
    borderTopRightRadius: radius.pass,
  },
  bandStacked: { flexDirection: "column", alignItems: "flex-start", paddingVertical: spacing.s1 },
  shrink: { flexShrink: 1 },
  slot: { position: "absolute", left: SLOT_LEFT, borderRadius: radius.slot },
});
