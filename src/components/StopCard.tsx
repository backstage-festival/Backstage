import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { StopCardProps } from "@/types/components";

import { DepartureRow } from "./DepartureRow";

/** C05 header padding 4 / 0 / 8. */
const HEADER_PAD_TOP = spacing.s1;
const HEADER_PAD_BOTTOM = spacing.s2;

/**
 * C05 · StopCard – a stop with its departures on Powrót. The header is the
 * heading for TalkBack; activating it starts guidance (onGuide).
 */
function StopCardBase({ name, meta, freshness, departures, onGuide }: StopCardProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const headerMeta = freshness === "stale" ? strings.transit.byTimetable : meta;
  const firstSkm = departures.findIndex((d) => d.kind === "skm");

  return (
    <View>
      <Pressable
        onPress={onGuide}
        accessibilityRole="header"
        accessibilityLabel={strings.transit.a11y.header(name, headerMeta)}
        accessibilityHint={strings.transit.a11y.guideHint}
        style={[
          styles.header,
          level > 0 ? styles.headerStacked : null,
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
      {departures.map((departure, index) => (
        <DepartureRow
          key={`${departure.line}-${departure.time}-${index}`}
          {...departure}
          spellOutKind={index === firstSkm}
        />
      ))}
    </View>
  );
}

export const StopCard = memo(StopCardBase);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.s2,
    paddingTop: HEADER_PAD_TOP,
    paddingBottom: HEADER_PAD_BOTTOM,
  },
  headerStacked: { flexDirection: "column", alignItems: "flex-start" },
  name: { flexShrink: 1 },
});
