import type { Ref } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle, type ColorTokens, type Theme } from "@/theme/theme";
import type { IconName } from "@/types/components";
import type { ButtonProps, ButtonSurface, ButtonVariant } from "@/types/components";

import { Icon } from "./Icon";
import { usePressScale } from "./motion";

/** C09: icon next to the label is 20 dp. */
const LABEL_ICON_SIZE = 20;
/** C09: secondary border on laminate / accent zone is 2 dp of ink. */
const INK_BORDER_WIDTH = 2;

interface ButtonColors {
  background: string;
  backgroundPressed: string;
  foreground: string;
  border: string | null;
  borderWidth: number;
}

export function buttonColors(
  theme: Theme,
  variant: ButtonVariant,
  surface: ButtonSurface,
  disabled: boolean,
): ButtonColors {
  const c: ColorTokens = theme.colors;
  const transparent = "transparent";
  const onDark = surface === "dark";
  const ink = c.textOnLaminate;

  if (disabled) {
    const outlined = variant === "secondary" || variant === "destructive";
    return {
      background: variant === "primary" ? c.surfaceRaised : transparent,
      backgroundPressed: variant === "primary" ? c.surfaceRaised : transparent,
      foreground: c.textDisabled,
      border: outlined ? c.textDisabled : null,
      borderWidth: theme.borderWidth.control,
    };
  }

  switch (variant) {
    case "primary":
      // On laminate / accent zone the primary button is ink.
      return onDark
        ? {
            background: c.accent,
            backgroundPressed: c.accentPressed,
            foreground: c.textOnAccent,
            border: null,
            borderWidth: 0,
          }
        : { background: ink, backgroundPressed: ink, foreground: c.laminate, border: null, borderWidth: 0 };
    case "secondary":
      return onDark
        ? {
            background: transparent,
            backgroundPressed: c.surfaceRaised,
            foreground: c.textPrimary,
            border: c.textPrimary,
            borderWidth: theme.borderWidth.control,
          }
        : {
            background: transparent,
            backgroundPressed: transparent,
            foreground: ink,
            border: ink,
            borderWidth: INK_BORDER_WIDTH,
          };
    case "destructive":
      return onDark
        ? {
            background: transparent,
            backgroundPressed: c.surfaceRaised,
            foreground: c.error,
            border: c.error,
            borderWidth: theme.borderWidth.control,
          }
        : {
            background: transparent,
            backgroundPressed: transparent,
            foreground: ink,
            border: ink,
            borderWidth: INK_BORDER_WIDTH,
          };
    case "link":
      return {
        background: transparent,
        backgroundPressed: transparent,
        foreground: onDark ? c.textSecondary : c.textOnLaminateSecondary,
        border: null,
        borderWidth: 0,
      };
    case "ghost":
      return {
        background: transparent,
        backgroundPressed: onDark ? c.surfaceRaised : transparent,
        foreground: onDark ? c.textPrimary : ink,
        border: null,
        borderWidth: 0,
      };
  }
}

/**
 * C09: the icon sits before the label (pin, map, ×, ←), except the „go” arrow →
 * and the sync spinner that replaces it while sending – so the label never jumps.
 */
export function iconLeads(icon: IconName): boolean {
  return icon !== "arrowRight" && icon !== "sync";
}

/** Link: mono label, the 48 dp touch height comes from hitSlop, not from layout. */
function linkHitSlop(lineHeight: number) {
  const y = Math.max(0, (size.touchMin - lineHeight) / 2);
  return { top: y, bottom: y, left: 0, right: 0 };
}

/**
 * C09 · Button. One primary per screen. Destructive = × icon + word.
 * When disabled, the reason is shown under the button (bodyS) and read as hint.
 */
/** C09 props plus a ref to the pressable (dialogs move TalkBack focus to it). */
export interface ButtonElementProps extends ButtonProps {
  ref?: Ref<View>;
}

export function Button({
  ref,
  label,
  variant,
  surface,
  icon,
  disabled,
  disabledReason,
  width,
  accessibilityHint,
  underline = false,
  onPress,
}: ButtonElementProps) {
  const { theme, level } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale();
  const colors = buttonColors(theme, variant, surface, disabled);
  const iconName = icon ?? (variant === "destructive" ? "close" : undefined);
  const fill = width === "fill";
  const leading = iconName !== undefined && iconLeads(iconName);
  const link = variant === "link";
  const labelStyle = textStyle(link ? "label" : "button", level);
  const iconSize = link ? size.iconSmall : LABEL_ICON_SIZE;

  return (
    <View style={fill ? styles.fill : styles.hug}>
      <Pressable
        ref={ref}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={disabled ? disabledReason : accessibilityHint}
        accessibilityState={{ disabled }}
        {...(link ? { hitSlop: linkHitSlop(Number(labelStyle.lineHeight)) } : null)}
      >
        {({ pressed }) => (
          <Animated.View
            style={[
              link ? styles.linkBody : styles.body,
              {
                minHeight: link ? undefined : size.button[level],
                backgroundColor: pressed ? colors.backgroundPressed : colors.background,
                borderColor: colors.border ?? "transparent",
                borderWidth: colors.borderWidth,
                transform: [{ scale }],
              },
            ]}
          >
            {leading && iconName ? (
              <Icon name={iconName} size={iconSize} color={pressed && link ? theme.colors.textPrimary : colors.foreground} />
            ) : null}
            <Text
              allowFontScaling={false}
              // No hyphenation: S10 preview broke „Prowadź” into „Prowad-ź”.
              android_hyphenationFrequency="none"
              textBreakStrategy="simple"
              style={[
                labelStyle,
                link ? styles.linkLabel : styles.label,
                { color: pressed && link ? theme.colors.textPrimary : colors.foreground },
                underline && link ? styles.underline : null,
              ]}
            >
              {label}
            </Text>
            {!leading && iconName ? (
              <Icon name={iconName} size={iconSize} color={colors.foreground} />
            ) : null}
          </Animated.View>
        )}
      </Pressable>
      {disabled && disabledReason ? (
        <Text
          allowFontScaling={false}
          style={[textStyle("bodyS", level), styles.reason, { color: theme.colors.textSecondary }]}
        >
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  body: {
    minWidth: size.touchMin,
    paddingHorizontal: spacing.s3,
    borderRadius: radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
  },
  label: { textAlign: "center", flexShrink: 1 },
  linkBody: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  linkLabel: { flexShrink: 1 },
  underline: { textDecorationLine: "underline" },
  reason: { marginTop: spacing.s1 },
});
