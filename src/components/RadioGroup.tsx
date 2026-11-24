import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle, type TextLevel, type Theme } from "@/theme/theme";
import type { RadioGroupProps, RadioOption } from "@/types/components";

/** Radio mark 24, inner dot 12. */
const MARK = 24;
const DOT = 12;

interface RadioRowProps<T extends string> {
  option: RadioOption<T>;
  checked: boolean;
  theme: Theme;
  level: TextLevel;
  onPress: (value: T) => void;
}

function RadioRowBase<T extends string>({ option, checked, theme, level, onPress }: RadioRowProps<T>) {
  const c = theme.colors;
  const handlePress = useCallback(() => onPress(option.value), [onPress, option.value]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityHint={option.description}
      accessibilityState={{ checked }}
      style={({ pressed }) => [
        styles.row,
        { minHeight: size.control[level], borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline },
        pressed ? { backgroundColor: c.surfaceRaised } : null,
      ]}
    >
      <View
        style={[
          styles.mark,
          // E11: the checked mark is light, not accent (one accent per screen).
          { borderColor: checked ? c.textPrimary : c.border, borderWidth: theme.borderWidth.icon },
        ]}
      >
        {checked ? <View style={[styles.dot, { backgroundColor: c.textPrimary }]} /> : null}
      </View>
      <View style={styles.text}>
        <Text allowFontScaling={false} style={[textStyle("settingTitle", level), { color: c.textPrimary }]}>
          {option.label}
        </Text>
        {option.description ? (
          <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
            {option.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const RadioRow = memo(RadioRowBase) as typeof RadioRowBase;

/** S10 radio list: one value, never empty. Group = TalkBack radiogroup with a label. */
export function RadioGroup<T extends string>({ groupLabel, options, value, onChange }: RadioGroupProps<T>) {
  const { theme, level } = useTheme();
  const handlePress = useCallback(
    (picked: T) => {
      if (picked !== value) onChange(picked);
    },
    [value, onChange],
  );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
      {options.map((option) => (
        <RadioRow
          key={option.value}
          option={option}
          checked={option.value === value}
          theme={theme}
          level={level}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    paddingVertical: spacing.s3,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: DOT, height: DOT, borderRadius: radius.round },
  text: { flexShrink: 1, gap: spacing.s1 },
});
