import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { size, spacing, textStyle } from "@/theme/theme";

import { Icon } from "./Icon";

/** L-Listy: „Zagrane · 3” collapsed into one 49 dp row (48 + 1 dp separator). */
export const PLAYED_ROW_HEIGHT = 49;

export interface PlayedRowProps {
  count: number;
  expanded: boolean;
  onPress: () => void;
}

function PlayedRowBase({ count, expanded, onPress }: PlayedRowProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const label = strings.planScreen.played(count);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={expanded ? strings.planScreen.a11y.playedHideHint : strings.planScreen.a11y.playedHint}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [
        styles.row,
        level === 0 ? { height: PLAYED_ROW_HEIGHT } : { minHeight: size.control[level] },
        {
          borderBottomColor: c.divider,
          borderBottomWidth: theme.borderWidth.hairline,
          backgroundColor: pressed ? c.surfaceRaised : c.background,
        },
      ]}
    >
      <Text allowFontScaling={false} style={[textStyle("sectionLabel", level), styles.label, { color: c.textSecondary }]}>
        {label}
      </Text>
      <Icon
        name={expanded ? "chevronDown" : "chevronRight"}
        size={size.iconSmall}
        color={c.textSecondary}
      />
    </Pressable>
  );
}

export const PlayedRow = memo(PlayedRowBase);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.s2, paddingVertical: spacing.s2 },
  label: { flex: 1 },
});
