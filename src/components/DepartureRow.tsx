import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle, type TextLevel, type Theme } from "@/theme/theme";
import type { DepartureRowProps } from "@/types/components";

import { Icon } from "./Icon";
import { StatusTag } from "./StatusTag";

/** C05: row min. 56 + 1 dp separator = 57 at 100 % text – use in getItemLayout. */
export const DEPARTURE_ROW_HEIGHT = 57;

/** C05 columns: 44 · 1fr · auto, gap 10; line chip 44 × 28. */
const LINE_WIDTH = 44;
const LINE_HEIGHT = 28;
const COLUMN_GAP = 10;
const SMALL_ICON = 12;
/** Lines with 3+ characters (SKM, N12) use the smaller code style. */
const LONG_LINE = 3;

export interface DepartureRowViewProps extends DepartureRowProps {
  /** First SKM row on a card reads „SKM, Szybka Kolej Miejska”. Set by StopCard. */
  spellOutKind?: boolean;
}

export function departureA11yLabel(p: DepartureRowViewProps): string {
  const kind = p.kind === "skm" && p.spellOutKind ? strings.transit.a11y.skmFull : strings.transit.a11y.kind[p.kind];
  let label = strings.transit.a11y.row(kind, p.line, p.direction, p.time);
  if (p.freshness === "stale") return `${label}, ${strings.transit.a11y.stale}`;
  if (p.state === "missed") label += `, ${strings.transit.a11y.missed}`;
  else if (p.state === "leaveNow") label += `, ${strings.transit.a11y.leaveNow}`;
  else if (p.note) label += `, ${p.note}`;
  return label;
}

function LineChip({ line, missed, theme, level }: { line: string; missed: boolean; theme: Theme; level: TextLevel }) {
  const c = theme.colors;
  return (
    <View
      style={[
        styles.chip,
        missed
          ? { borderColor: c.border, borderWidth: theme.borderWidth.hairline }
          : { backgroundColor: c.laminate },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          textStyle(line.length >= LONG_LINE ? "code" : "codeL", level),
          { color: missed ? c.textSecondary : c.textOnLaminate },
        ]}
      >
        {line}
      </Text>
    </View>
  );
}

function StateLine({ p, theme, level }: { p: DepartureRowProps; theme: Theme; level: TextLevel }) {
  const c = theme.colors;
  const stale = p.freshness === "stale";

  if (!stale && p.state === "leaveNow") {
    return <StatusTag label={strings.transit.leaveNow} tone="accent" fill="solid" />;
  }
  if (!stale && p.state === "missed") {
    return (
      <View style={styles.inline}>
        <Icon name="close" size={SMALL_ICON} color={c.textSecondary} />
        <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color: c.textSecondary }]}>
          {strings.transit.missed}
        </Text>
      </View>
    );
  }
  if (!p.note) return null;
  // „later” notes are disruptions (delay / detour) → warning colour; the rest is neutral.
  const color = !stale && p.state === "later" ? c.warning : c.textSecondary;
  return (
    <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color }]}>
      {p.note}
    </Text>
  );
}

/**
 * C05 · DepartureRow. A missed departure stays in the list, greyed out, so the
 * next one is visible. Stale data: timetable time first, „ok. 8 min”, no „Wyjdź teraz”.
 */
function DepartureRowBase(props: DepartureRowViewProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const { line, direction, time, inMinutes, state, freshness } = props;
  const missed = state === "missed" && freshness === "live";
  const stale = freshness === "stale";
  const primary = missed ? c.textSecondary : c.textPrimary;

  const big = stale ? time : inMinutes;
  const small = stale ? inMinutes : time;

  const separator = { borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline };

  if (level > 0) {
    // 150 / 200 %: line + minutes + time in a row, direction and state below.
    return (
      <View accessible accessibilityLabel={departureA11yLabel(props)} style={[styles.stacked, separator]}>
        <View style={styles.inlineWide}>
          <LineChip line={line} missed={missed} theme={theme} level={level} />
          <Text allowFontScaling={false} style={[textStyle("dataL", level), { color: primary }]}>
            {big}
          </Text>
          <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color: c.textSecondary }]}>
            {small}
          </Text>
        </View>
        <Text allowFontScaling={false} style={[textStyle("bodyStrong", level), { color: primary }]}>
          {direction}
        </Text>
        <StateLine p={props} theme={theme} level={level} />
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={departureA11yLabel(props)} style={[styles.row, separator]}>
      <LineChip line={line} missed={missed} theme={theme} level={level} />
      <View style={styles.middle}>
        <Text allowFontScaling={false} numberOfLines={1} style={[textStyle("bodyStrong", level), { color: primary }]}>
          {direction}
        </Text>
        <StateLine p={props} theme={theme} level={level} />
      </View>
      <View style={styles.right}>
        <Text allowFontScaling={false} style={[textStyle("dataL", level), { color: primary }]}>
          {big}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color: c.textSecondary }]}>
          {small}
        </Text>
      </View>
    </View>
  );
}

export const DepartureRow = memo(DepartureRowBase);

const styles = StyleSheet.create({
  row: {
    minHeight: DEPARTURE_ROW_HEIGHT, // border-box: 56 + 1 dp separator
    flexDirection: "row",
    alignItems: "center",
    gap: COLUMN_GAP,
    paddingVertical: spacing.s1,
  },
  stacked: { paddingVertical: spacing.s3, gap: spacing.s2 },
  chip: {
    width: LINE_WIDTH,
    height: LINE_HEIGHT,
    borderRadius: radius.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: spacing.s1, alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  inlineWide: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: COLUMN_GAP },
});
