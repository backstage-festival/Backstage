import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { textStyle } from "@/theme/theme";

/** L-Listy: day separator „SOB 3.07” in the chat, 40 dp, sectionLabel. */
export const DAY_SEPARATOR_HEIGHT = 40;

function DaySeparatorBase({ label }: { label: string }) {
  const { theme, level } = useTheme();
  return (
    <View style={[styles.row, level === 0 ? { height: DAY_SEPARATOR_HEIGHT } : null]}>
      <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("sectionLabel", level), { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

export const DaySeparator = memo(DaySeparatorBase);

const styles = StyleSheet.create({
  row: { alignItems: "center", justifyContent: "center" },
});
