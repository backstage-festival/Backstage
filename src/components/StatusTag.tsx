import { StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle, type Theme } from "@/theme/theme";
import type { IconName, StatusTagProps, StatusTagTone } from "@/types/components";

import { Icon } from "./Icon";

/** C11: height 22 = 3 + 16 + 3, padding 3 / 6, icon 12, gap 4. */
const PAD_VERTICAL = 3;
const PAD_HORIZONTAL = 6;
const ICON_SIZE = 12;
/** C11 pattern mode: warning gets a 2 dp ink outline. */
const PATTERN_OUTLINE_WIDTH = 2;

const DEFAULT_ICON: Partial<Record<StatusTagTone, IconName>> = {
  warning: "warning",
  error: "close",
};

/** Label with the pattern-mode prefix („Uwaga:” / „Błąd:”). Parents use it for their own labels. */
export function statusTagLabel(label: string, tone: StatusTagTone, theme: Theme): string {
  if (theme.statusDecoration !== "pattern") return label;
  if (tone === "warning") return `${strings.statusTag.warningPrefix} ${label}`;
  if (tone === "error") return `${strings.statusTag.errorPrefix} ${label}`;
  return label;
}

function toneColor(theme: Theme, tone: StatusTagTone): string {
  const c = theme.colors;
  switch (tone) {
    case "neutral":
      return c.surfaceRaised;
    case "laminate":
      return c.laminate;
    case "accent":
      return c.accent;
    case "success":
      return c.success;
    case "warning":
      return c.warning;
    case "error":
      return c.error;
    case "offline":
      return c.offline;
  }
}

function solidForeground(theme: Theme, tone: StatusTagTone): string {
  const c = theme.colors;
  if (tone === "neutral") return c.textPrimary;
  if (tone === "laminate") return c.textOnLaminate;
  return c.textOnAccent;
}

function outlineForeground(theme: Theme, tone: StatusTagTone): string {
  const c = theme.colors;
  if (tone === "neutral") return c.textPrimary;
  if (tone === "offline") return c.textOffline;
  return toneColor(theme, tone);
}

/**
 * C11 · StatusTag. Always a word – colour is only the second channel.
 * Not a focus element of its own: its text becomes part of the parent's label.
 * Error is always a frame + ×; offline usually dashed.
 */
export function StatusTag({ label, tone, icon, fill, testID }: StatusTagProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const pattern = theme.statusDecoration === "pattern";
  const effectiveFill = tone === "error" && fill === "solid" ? "outline" : fill;
  const solid = effectiveFill === "solid";

  const foreground = solid ? solidForeground(theme, tone) : outlineForeground(theme, tone);
  const iconName = icon ?? DEFAULT_ICON[tone];

  const frame = solid
    ? pattern && tone === "warning"
      ? { backgroundColor: toneColor(theme, tone), borderColor: c.textOnAccent, borderWidth: PATTERN_OUTLINE_WIDTH }
      : { backgroundColor: toneColor(theme, tone), borderColor: "transparent", borderWidth: 0 }
    : {
        backgroundColor: "transparent",
        borderColor: tone === "neutral" ? c.border : toneColor(theme, tone),
        borderWidth: effectiveFill === "dashed" ? theme.borderWidth.offline : theme.borderWidth.control,
        borderStyle: effectiveFill === "dashed" ? ("dashed" as const) : ("solid" as const),
      };

  // Keep outer size constant: the border eats into the padding.
  const inset = frame.borderWidth;

  return (
    <View
      testID={testID}
      style={[
        styles.tag,
        frame,
        {
          paddingVertical: Math.max(0, PAD_VERTICAL - inset),
          paddingHorizontal: Math.max(0, PAD_HORIZONTAL - inset),
        },
      ]}
    >
      {iconName ? <Icon name={iconName} size={ICON_SIZE} color={foreground} /> : null}
      <Text allowFontScaling={false} style={[textStyle("status", level), styles.text, { color: foreground }]}>
        {statusTagLabel(label, tone, theme)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s1,
    borderRadius: radius.tag,
    maxWidth: "100%",
  },
  text: { flexShrink: 1 },
});
