import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";

export interface ScreenHeaderProps {
  title: string;
  /** titleCompact when something large (an alert) sits right under the title. */
  compact?: boolean;
  /** Right side: date eyebrow (Plan) or data-age StatusTag (Powrót). */
  accessory?: ReactNode;
}

/** Screen title (titleHero / titleCompact) – first TalkBack stop, a header. */
export function ScreenHeader({ title, compact = false, accessory }: ScreenHeaderProps) {
  const { theme, level } = useTheme();
  return (
    <View style={[styles.row, level > 0 ? styles.stacked : null]}>
      <Text
        allowFontScaling={false}
        accessibilityRole="header"
        style={[textStyle(compact ? "titleCompact" : "titleHero", level), { color: theme.colors.textPrimary }]}
      >
        {title}
      </Text>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  stacked: { flexDirection: "column", alignItems: "flex-start" },
});
