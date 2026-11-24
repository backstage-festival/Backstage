import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle, type TextLevel, type Theme } from "@/theme/theme";
import type { SegmentedControlProps, SegmentedOption } from "@/types/components";

/** C13 chips („zakres”): 176 × 48 outer, frame 1.5, segments 45 high. */
const CHIPS_WIDTH = 176;
const CHIPS_INNER_HEIGHT = 45;
/** C13 dayTabs at 200 %: two columns. */
const TWO_COLUMNS: DimensionValue = "47%";

type Look = SegmentedControlProps<string>["look"];

interface SegmentProps<T extends string> {
  option: SegmentedOption<T>;
  selected: boolean;
  single: boolean;
  tab: boolean;
  look: Look;
  theme: Theme;
  level: TextLevel;
  onPress: (value: T) => void;
}

function SegmentBase<T extends string>({ option, selected, single, tab, look, theme, level, onPress }: SegmentProps<T>) {
  const c = theme.colors;
  const handlePress = useCallback(() => onPress(option.value), [onPress, option.value]);
  const joined = look === "joined";
  const foreground = selected ? c.textOnLaminate : joined ? c.textSecondary : c.textPrimary;

  const frame: StyleProp<ViewStyle> =
    look === "dayTabs"
      ? [
          styles.dayTab,
          { minHeight: size.control[level] },
          level === 2 ? { flexBasis: TWO_COLUMNS } : null,
          selected
            ? { backgroundColor: c.laminate }
            : { borderColor: c.border, borderWidth: theme.borderWidth.control },
        ]
      : joined
        ? [
            styles.joinedSegment,
            { minHeight: size.control[level], backgroundColor: selected ? c.laminate : c.background },
            level === 2 ? styles.joinedSegmentStacked : null,
          ]
        : look === "chips"
        ? [styles.chip, { minHeight: CHIPS_INNER_HEIGHT }, selected ? { backgroundColor: c.laminate } : null]
        : [styles.stage, selected ? { backgroundColor: c.laminate } : null];

  const textName =
    look === "dayTabs" || joined ? (option.labelStyle ?? "displayS") : look === "chips" ? "chip" : "code";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole={tab ? "tab" : single ? "radio" : "button"}
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={single && !tab ? { checked: selected } : { selected }}
      style={({ pressed }) => [frame, pressed && !selected ? { backgroundColor: c.surfaceRaised } : null]}
    >
      <Text allowFontScaling={false} style={[textStyle(textName, level), styles.center, { color: foreground }]}>
        {option.label}
      </Text>
      {joined && option.sublabel ? (
        <Text allowFontScaling={false} style={[textStyle("tag", level), { color: foreground }]}>
          {option.sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const Segment = memo(SegmentBase) as typeof SegmentBase;

/**
 * C13 · SegmentedControl. single = radiogroup (one value, never empty);
 * multi = toggle buttons (any subset, empty = no filter).
 */
export function SegmentedControl<T extends string>({
  groupLabel,
  options,
  mode,
  value,
  look,
  segmentRole = "radio",
  onChange,
}: SegmentedControlProps<T>) {
  const { theme, level } = useTheme();
  const single = mode === "single";
  const tab = single && segmentRole === "tab";

  const handlePress = useCallback(
    (picked: T) => {
      if (single) {
        if (value[0] !== picked) onChange([picked]);
        return;
      }
      onChange(value.includes(picked) ? value.filter((v) => v !== picked) : [...value, picked]);
    },
    [single, value, onChange],
  );

  return (
    <View
      accessibilityRole={tab ? "tablist" : single ? "radiogroup" : undefined}
      accessibilityLabel={groupLabel}
      style={[
        // dayTabs wrap only at 200 % (2 + 1); below that the three always share one row.
        look === "dayTabs" ? [styles.dayTabs, level === 2 ? styles.dayTabsWrap : null] : styles.row,
        look === "chips"
          ? [styles.chips, { borderColor: theme.colors.border, borderWidth: theme.borderWidth.control }]
          : null,
        look === "chips" && level > 0 ? styles.chipsWide : null,
        look === "joined"
          ? [
              styles.joined,
              { borderColor: theme.colors.border, borderWidth: theme.borderWidth.control },
              // 200 %: segments one under another, long labels never break mid-word.
              level === 2 ? styles.joinedStacked : null,
            ]
          : null,
      ]}
    >
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          selected={value.includes(option.value)}
          single={single}
          tab={tab}
          look={look}
          theme={theme}
          level={level}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dayTabs: { flexDirection: "row", gap: spacing.s2 },
  dayTabsWrap: { flexWrap: "wrap" },
  dayTab: {
    flexGrow: 1,
    flexBasis: 0,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s2,
  },
  row: { flexDirection: "row", alignItems: "center" },
  center: { textAlign: "center" },
  joined: { alignItems: "stretch", borderRadius: radius.button, overflow: "hidden" },
  joinedStacked: { flexDirection: "column" },
  joinedSegment: {
    flexGrow: 1,
    flexBasis: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s2,
    paddingVertical: spacing.s1,
  },
  joinedSegmentStacked: { flexBasis: "auto" },
  chips: { width: CHIPS_WIDTH, borderRadius: radius.button, overflow: "hidden" },
  chipsWide: { width: "100%" },
  chip: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.s1 },
  stage: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
});
