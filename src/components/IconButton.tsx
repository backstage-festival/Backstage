import { Animated, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, type Theme } from "@/theme/theme";
import type { ButtonSurface, IconButtonProps } from "@/types/components";

import { Icon } from "./Icon";
import { usePressScale } from "./motion";

/** C09: secondary border on laminate / accent zone is 2 dp of ink. */
const INK_BORDER_WIDTH = 2;

function iconButtonColors(theme: Theme, surface: ButtonSurface, selected: boolean, disabled: boolean) {
  const c = theme.colors;
  const ink = c.textOnLaminate;
  const transparent = "transparent";

  if (disabled) {
    return {
      background: transparent,
      backgroundPressed: transparent,
      foreground: c.textDisabled,
      border: c.divider,
      borderWidth: theme.borderWidth.control,
    };
  }
  if (surface === "dark") {
    return selected
      ? { background: c.laminate, backgroundPressed: c.laminate, foreground: ink, border: c.laminate, borderWidth: 0 }
      : {
          background: transparent,
          backgroundPressed: c.surfaceRaised,
          foreground: c.textPrimary,
          border: c.border,
          borderWidth: theme.borderWidth.control,
        };
  }
  return selected
    ? { background: ink, backgroundPressed: ink, foreground: c.laminate, border: ink, borderWidth: 0 }
    : { background: transparent, backgroundPressed: transparent, foreground: ink, border: ink, borderWidth: INK_BORDER_WIDTH };
}

/** C09 · IconButton – 48 × 48, icon 24, label required (no visible text). */
export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  selected,
  surface,
  disabled,
  onPress,
}: IconButtonProps) {
  const { theme } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale();
  const colors = iconButtonColors(theme, surface, selected === true, disabled);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }}
      style={styles.hit}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.body,
            {
              backgroundColor: pressed ? colors.backgroundPressed : colors.background,
              borderColor: colors.border,
              borderWidth: colors.borderWidth,
              transform: [{ scale }],
            },
          ]}
        >
          <Icon name={icon} size={size.icon} color={colors.foreground} />
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: size.iconButton, height: size.iconButton },
  body: {
    flex: 1,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
});
