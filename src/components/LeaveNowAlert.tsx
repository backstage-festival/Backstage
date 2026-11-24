import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle, type TextLevel, type Theme } from "@/theme/theme";
import type { LeaveNowAlertProps } from "@/types/components";

import { Button } from "./Button";
import { Icon } from "./Icon";

/** C02 padding 6 · 6 · 12 · 38 (left leaves room for the slot); 200 %: 14 · 12 · 14 · 38. */
const PAD = { top: 6, right: 6, bottom: 12, left: 38 } as const;
const PAD_XL = { top: 14, right: 12, bottom: 14, left: 38 } as const;
/** C02 slot („dziurka”): 10 × 48, left 14, top 20. */
const SLOT = { width: 10, height: 48, left: 14, top: 20 } as const;
/** C02 static frame: 3 dp background, then 3 dp textPrimary (two Views). */
const FRAME = 3;
/** C02 gaps: content 4; buttons margin-top 6, gap 8; „Za 5 min” frame 2. */
const CONTENT_GAP = spacing.s1;
const BUTTONS_MARGIN = 6;
const INK_BORDER = 2;
const TAG_PAD = { vertical: 1, horizontal: 4 } as const;

function AlertAction({
  label,
  accessibilityLabel,
  hint,
  disabled,
  icon,
  onPress,
  theme,
  level,
}: {
  label: string;
  accessibilityLabel: string;
  hint: string;
  disabled: boolean;
  icon?: "bellOff";
  onPress: () => void;
  theme: Theme;
  level: TextLevel;
}) {
  const c = theme.colors;
  const color = disabled ? c.accentPressed : c.textOnAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={[styles.action, { minHeight: size.button[level], borderColor: color }, level > 0 ? styles.actionWide : null]}
    >
      {icon ? <Icon name={icon} size={size.icon} color={color} /> : null}
      <Text allowFontScaling={false} style={[textStyle("button", level), { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * C02 · LeaveNowAlert – „Wyjdź teraz” at the top of Plan. Static double frame
 * for now (the pulse comes with #34). The container is not a TalkBack stop
 * of its own: children are read in order eyebrow → title → meta → buttons.
 */
// `kind` (stage / transit) changes only the copy, which the caller builds.
export function LeaveNowAlert({
  eyebrow,
  meta,
  announcement,
  mode,
  snoozeMinutes,
  canSnooze,
  onGuide,
  onSnooze,
  onMute,
  testID,
}: LeaveNowAlertProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const muted = mode === "muted";

  useEffect(() => {
    if (!muted) AccessibilityInfo.announceForAccessibility(announcement);
    // Announce once per alert, not on every re-render.
  }, [announcement, muted]);

  if (muted) {
    return (
      <View
        testID={testID}
        style={[styles.muted, { borderColor: c.border, borderWidth: theme.borderWidth.offline }]}
        accessible
        accessibilityLabel={strings.leaveNow.muted}
      >
        <Icon name="bellOff" size={size.iconSmall} color={c.textSecondary} />
        <Text allowFontScaling={false} style={[textStyle("label", level), styles.shrink, { color: c.textSecondary }]}>
          {strings.leaveNow.muted}
        </Text>
      </View>
    );
  }

  const pad = level === 2 ? PAD_XL : PAD;
  const wide = level > 0;
  const snoozeLabel = wide ? strings.leaveNow.snoozeLong(snoozeMinutes) : strings.leaveNow.snooze(snoozeMinutes);
  const snoozeHint = canSnooze ? strings.leaveNow.a11y.snoozeHint : strings.leaveNow.a11y.snoozeDisabled;

  return (
    <View testID={testID} style={[styles.frameOuter, { borderColor: c.textPrimary }]}>
      <View style={[styles.frameInner, { borderColor: c.background }]}>
        <View
          accessible={false}
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            {
              backgroundColor: c.accent,
              paddingTop: pad.top,
              paddingRight: pad.right,
              paddingBottom: pad.bottom,
              paddingLeft: pad.left,
            },
          ]}
        >
          <View style={[styles.slot, { backgroundColor: c.textOnAccent }]} />

          <View style={styles.topRow}>
            <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.shrink, { color: c.textOnAccent }]}>
              {eyebrow}
            </Text>
            {wide ? null : (
              <Pressable
                onPress={onMute}
                accessibilityRole="button"
                accessibilityLabel={strings.leaveNow.a11y.mute}
                accessibilityHint={strings.leaveNow.a11y.muteHint}
                style={styles.muteIcon}
              >
                <Icon name="bellOff" size={size.icon} color={c.textOnAccent} />
              </Pressable>
            )}
          </View>

          {mode === "vibrationOnly" ? (
            <View style={[styles.tag, { borderColor: c.textOnAccent }]}>
              <Text allowFontScaling={false} style={[textStyle("tag", level), { color: c.textOnAccent }]}>
                {strings.leaveNow.vibrationOnly}
              </Text>
            </View>
          ) : null}

          <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("alertTitle", level), { color: c.textOnAccent }]}>
            {strings.leaveNow.title}
          </Text>
          <Text allowFontScaling={false} style={[textStyle("alertMeta", level), { color: c.textOnAccent }]}>
            {meta}
          </Text>

          <View style={[styles.buttons, wide ? styles.buttonsColumn : null]}>
            <View style={wide ? null : styles.guide}>
              <Button
                label={strings.leaveNow.guide}
                variant="primary"
                surface="accent"
                icon="arrowRight"
                disabled={false}
                width="fill"
                accessibilityHint={strings.leaveNow.a11y.guideHint}
                onPress={onGuide}
              />
            </View>
            <AlertAction
              label={snoozeLabel}
              accessibilityLabel={strings.leaveNow.a11y.snooze(snoozeMinutes)}
              hint={snoozeHint}
              disabled={!canSnooze}
              onPress={onSnooze}
              theme={theme}
              level={level}
            />
            {wide ? (
              <AlertAction
                label={strings.leaveNow.mute}
                accessibilityLabel={strings.leaveNow.a11y.mute}
                hint={strings.leaveNow.a11y.muteHint}
                disabled={false}
                icon="bellOff"
                onPress={onMute}
                theme={theme}
                level={level}
              />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameOuter: { borderWidth: FRAME, borderRadius: radius.pass + FRAME * 2 },
  frameInner: { borderWidth: FRAME, borderRadius: radius.pass + FRAME },
  card: { borderRadius: radius.pass, gap: CONTENT_GAP },
  slot: {
    position: "absolute",
    left: SLOT.left,
    top: SLOT.top,
    width: SLOT.width,
    height: SLOT.height,
    borderRadius: radius.round,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.s2 },
  muteIcon: { width: size.touchMin, height: size.touchMin, alignItems: "center", justifyContent: "center" },
  shrink: { flexShrink: 1 },
  tag: {
    alignSelf: "flex-start",
    borderWidth: INK_BORDER / 2,
    borderRadius: radius.tag,
    paddingVertical: TAG_PAD.vertical,
    paddingHorizontal: TAG_PAD.horizontal,
  },
  buttons: { flexDirection: "row", gap: spacing.s2, marginTop: BUTTONS_MARGIN, marginRight: spacing.s1 },
  buttonsColumn: { flexDirection: "column" },
  guide: { flex: 1 },
  action: {
    minWidth: size.touchMin,
    borderWidth: INK_BORDER,
    borderRadius: radius.button,
    paddingHorizontal: spacing.s3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
  },
  actionWide: { alignSelf: "stretch" },
  muted: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    borderStyle: "dashed",
    borderRadius: radius.button,
    padding: spacing.s3,
  },
});
