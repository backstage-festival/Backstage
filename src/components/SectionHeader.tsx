import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

/** L-Listy: section header 46 = padding 24 + label 16 + 6 (100 % text). */
export const SECTION_HEADER_HEIGHT = 46;
const PAD_TOP = spacing.s6;
const PAD_BOTTOM = 6;

export interface SectionHeaderProps {
  label: string;
  /** Rule after the label (L-Listy). E07a / E11 show the label alone. Default true. */
  rule?: boolean;
  /** E11 settings: 16 above, 12 below instead of the list header height. */
  compact?: boolean;
}

/** „TERAZ · 20:03”, „DALEJ” – a TalkBack heading, by default with a rule after the label. */
function SectionHeaderBase({ label, rule = true, compact = false }: SectionHeaderProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.row, compact ? styles.compact : level === 0 ? { height: SECTION_HEADER_HEIGHT } : null]}>
      <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("sectionLabel", level), { color: c.textPrimary }]}>
        {label}
      </Text>
      {rule ? <View style={[styles.rule, { backgroundColor: c.divider, height: theme.borderWidth.hairline }]} /> : null}
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
  compact: { paddingTop: spacing.s4, paddingBottom: spacing.s3 },
  rule: { flex: 1, marginBottom: spacing.s2 },
});
