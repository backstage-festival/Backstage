import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { SettingSwitchProps } from "@/types/components";

import { Icon } from "./Icon";

/** Switch track 52 × 32, thumb 24 (no animation – the thumb jumps, H03-safe). */
const TRACK = { width: 52, height: 32 } as const;
const THUMB = 24;
const THUMB_ICON = 16;

/**
 * S10 setting row: title, optional description and a switch. The whole row is
 * one touch target and one TalkBack stop („Wysoki kontrast, przełącznik, włączone”).
 * The thumb carries a check icon when on, so the state never relies on colour only.
 */
function SettingSwitchBase({ title, description, value, onValueChange, testID }: SettingSwitchProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const toggle = useCallback(() => onValueChange(!value), [onValueChange, value]);

  return (
    <Pressable
      testID={testID}
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [
        styles.row,
        { minHeight: size.listRowMin },
        level === 2 ? styles.stacked : null,
        pressed ? { backgroundColor: c.surfaceRaised } : null,
      ]}
    >
      <View style={styles.text}>
        <Text allowFontScaling={false} style={[textStyle("settingTitle", level), { color: c.textPrimary }]}>
          {title}
        </Text>
        {description ? (
          <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.track,
          value
            ? { backgroundColor: c.accent, justifyContent: "flex-end" }
            : { borderColor: c.border, borderWidth: theme.borderWidth.control, justifyContent: "flex-start" },
        ]}
      >
        <View style={[styles.thumb, { backgroundColor: value ? c.textOnAccent : c.textSecondary }]}>
          {value ? <Icon name="inPlan" size={THUMB_ICON} color={c.accent} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export const SettingSwitch = memo(SettingSwitchBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s4,
    paddingVertical: spacing.s3,
  },
  stacked: { flexDirection: "column", alignItems: "flex-start" },
  text: { flexShrink: 1, flexGrow: 1, gap: spacing.s1 },
  track: {
    width: TRACK.width,
    height: TRACK.height,
    borderRadius: radius.round,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: (TRACK.height - THUMB) / 2,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
});
