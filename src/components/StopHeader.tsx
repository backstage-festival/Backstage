import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { StopCardProps } from "@/types/components";

/** L-Listy: stop header 35 (padding 4 / 8) first, 45 (padding 14 / 8) after a stop; separator included. */
export const STOP_HEADER_HEIGHT = 35;
export const STOP_HEADER_NEXT_HEIGHT = 45;
const PAD_TOP_FIRST = spacing.s1;
const PAD_TOP_NEXT = 14;
const PAD_BOTTOM = spacing.s2;

export function stopHeaderHeight(first: boolean): number {
  return first ? STOP_HEADER_HEIGHT : STOP_HEADER_NEXT_HEIGHT;
}

export interface StopHeaderProps extends Pick<StopCardProps, "name" | "meta" | "freshness" | "onGuide"> {
  /** The first stop in a list sits closer to what is above it. */
  first?: boolean;
}

/**
 * C05 · StopCard header – the heading for TalkBack; activating it starts
 * guidance. Also the section header row in the flat Powrót list.
 */
function StopHeaderBase({ name, meta, freshness, onGuide, first = true }: StopHeaderProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const headerMeta = freshness === "stale" ? strings.transit.byTimetable : meta;

  return (
    <Pressable
      onPress={onGuide}
      accessibilityRole="header"
      accessibilityLabel={strings.transit.a11y.header(name, headerMeta)}
      accessibilityHint={strings.transit.a11y.guideHint}
      style={[
        styles.header,
        level > 0 ? styles.headerStacked : { height: stopHeaderHeight(first) },
        { paddingTop: first ? PAD_TOP_FIRST : PAD_TOP_NEXT },
        { borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.name, textStyle("displayS", level), { color: c.textPrimary }]}>
        {name}
      </Text>
      <Text allowFontScaling={false} style={[textStyle("tag", level), { color: c.textSecondary }]}>
        {headerMeta}
      </Text>
    </Pressable>
  );
}

export const StopHeader = memo(StopHeaderBase);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.s2,
    paddingBottom: PAD_BOTTOM,
  },
  headerStacked: { flexDirection: "column", alignItems: "flex-start" },
  name: { flexShrink: 1 },
});
