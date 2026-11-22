import { StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle } from "@/theme/theme";

import { IconButton } from "./IconButton";

/** S06: laminate card, slot 6 × 32 on the left like the NowPass. */
const SLOT = { width: 6, height: 32 } as const;

export interface CrewCodeProps {
  /** Raw code „STK7Q4M”. */
  code: string;
  onShare: () => void;
}

/** S06 · CrewCode – the crew code on laminate with a share button. */
export function CrewCode({ code, onShare }: CrewCodeProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.card, { backgroundColor: c.laminate }]}>
      <View style={[styles.slot, { backgroundColor: c.textOnLaminate }]} />
      <View style={styles.text} accessible accessibilityLabel={strings.crewScreen.a11y.code(code)}>
        <Text allowFontScaling={false} style={[textStyle("eyebrow", level), { color: c.textOnLaminateSecondary }]}>
          {strings.crewScreen.codeLabel}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("crewCode", level), { color: c.textOnLaminate }]}>
          {strings.crewScreen.code(code)}
        </Text>
      </View>
      <IconButton
        icon="share"
        accessibilityLabel={strings.crewScreen.a11y.share}
        surface="laminate"
        selected
        disabled={false}
        onPress={onShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    borderRadius: radius.pass,
    paddingVertical: spacing.s2,
    paddingLeft: spacing.s4,
    paddingRight: spacing.s2,
  },
  slot: { width: SLOT.width, height: SLOT.height, borderRadius: radius.round },
  text: { flex: 1 },
});
