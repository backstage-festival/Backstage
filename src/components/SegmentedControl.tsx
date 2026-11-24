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
  const foreground = selected ? c.textOnLaminate : c.textPrimary;

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
      : look === "chips"
        ? [styles.chip, { minHeight: CHIPS_INNER_HEIGHT }, selected ? { backgroundColor: c.laminate } : null]
        : [styles.stage, selected ? { backgroundColor: c.laminate } : null];

  const textName = look === "dayTabs" ? "displayS" : look === "chips" ? "chip" : "code";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole={tab ? "tab" : single ? "radio" : "button"}
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={single && !tab ? { checked: selected } : { selected }}
      style={({ pressed }) => [frame, pressed && !selected ? { backgroundColor: c.surfaceRaised } : null]}
    >
      <Text allowFontScaling={false} style={[textStyle(textName, level), { color: foreground }]}>
        {option.label}
      </Text>
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
        look === "dayTabs" ? styles.dayTabs : styles.row,
        look === "chips"
          ? [styles.chips, { borderColor: theme.colors.border, borderWidth: theme.borderWidth.control }]
          : null,
        look === "chips" && level > 0 ? styles.chipsWide : null,
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
  dayTabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.s2 },
  dayTab: {
    flexGrow: 1,
    flexBasis: 0,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s2,
  },
  row: { flexDirection: "row", alignItems: "center" },
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
