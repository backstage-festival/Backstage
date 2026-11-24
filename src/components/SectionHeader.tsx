import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

/** L-Listy: section header 46 = padding 24 + label 16 + 6 (100 % text). */
export const SECTION_HEADER_HEIGHT = 46;
const PAD_TOP = spacing.s6;
const PAD_BOTTOM = 6;

/** „TERAZ · 20:03”, „DALEJ” – a TalkBack heading with a rule after the label. */
function SectionHeaderBase({ label }: { label: string }) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.row, level === 0 ? { height: SECTION_HEADER_HEIGHT } : null]}>
      <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("sectionLabel", level), { color: c.textPrimary }]}>
        {label}
      </Text>
      <View style={[styles.rule, { backgroundColor: c.divider, height: theme.borderWidth.hairline }]} />
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.s2,
    paddingTop: PAD_TOP,
    paddingBottom: PAD_BOTTOM,
  },
  rule: { flex: 1, marginBottom: spacing.s2 },
});
