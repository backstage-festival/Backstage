import { memo, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import {
  hitSlopFor,
  motion,
  radius,
  size,
  spacing,
  textStyle,
  textStyles,
  type TextLevel,
  type Theme,
} from "@/theme/theme";
import type { IconName, MessageBubbleProps, MessageStatus } from "@/types/components";

import { Icon } from "./Icon";
import { useReduceMotion, usePressScale } from "./motion";
import { StatusTag } from "./StatusTag";

/** C04: bubble max width 280, padding 10 / 12 (border eats into it), header gap 6, status icon 14. */
const MAX_WIDTH = 280;
const PAD_VERTICAL = 10;
const PAD_HORIZONTAL = 12;
const HEADER_GAP = 6;
const STATUS_ICON = 14;

const STATUS_ICON_NAME: Record<"queued" | "sending" | "sent", IconName> = {
  queued: "clock",
  sending: "sync",
  sent: "inPlan",
};

function visibleStatus(status: MessageStatus, time: string, statusLabel: string | undefined): string {
  if (statusLabel !== undefined) return statusLabel;
  switch (status) {
    case "queued":
      return strings.message.status.queued(time);
    case "sending":
      return strings.message.status.sending;
    case "sent":
      return strings.message.status.sent(time);
    case "stale":
      return strings.status.stale;
    case "failed":
      return strings.message.status.failed;
  }
}

function spokenStatus(status: MessageStatus, time: string, label: string): string {
  switch (status) {
    case "queued":
      return strings.message.a11y.queued;
    case "sending":
      return strings.message.a11y.sending;
    case "sent":
      return strings.message.a11y.sent(time);
    case "stale":
      return strings.message.a11y.stale(label);
    case "failed":
      return strings.message.a11y.failed;
  }
}

/** Small secondary button in the bubble: min. 48 high, textStyle.buttonSmall. */
function BubbleAction({
  label,
  hint,
  onPress,
  theme,
  level,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  theme: Theme;
  level: TextLevel;
}) {
  const c = theme.colors;
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.action,
            {
              minHeight: size.buttonSmall[level],
              borderColor: c.textPrimary,
              borderWidth: theme.borderWidth.control,
              backgroundColor: pressed ? c.surfaceRaised : "transparent",
              transform: [{ scale }],
            },
          ]}
        >
          <Text allowFontScaling={false} style={[textStyle("buttonSmall", level), { color: c.textPrimary }]}>
            {label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Animates only the status label on change (motion.statusChange); the bubble stays put. */
function useStatusChange(status: MessageStatus | undefined, reduceMotion: boolean) {
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(status);

  useEffect(() => {
    if (previous.current === status) return;
    previous.current = status;

    if (status === "sent") AccessibilityInfo.announceForAccessibility(strings.message.a11y.announceSent);
    if (status === "failed") AccessibilityInfo.announceForAccessibility(strings.message.a11y.announceFailed);

    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.statusChange.duration,
      easing: Easing.bezier(...motion.statusChange.easing),
      useNativeDriver: true,
    }).start();
  }, [status, reduceMotion, progress]);

  return {
    opacity: progress,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.statusChange.scale, 1] }) }],
  };
}

/**
 * C04 · MessageBubble. Status is always icon + word under the bubble, never
 * colour alone; the queue is a dashed frame like offline.
 */
function MessageBubbleBase({
  id,
  author,
  senderName,
  time,
  text,
  status,
  statusLabel,
  onCancel,
  onSendAnyway,
  onDelete,
  testID,
}: MessageBubbleProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const statusAnimation = useStatusChange(status, reduceMotion);

  const own = author === "me";
  const effectiveStatus: MessageStatus | undefined = own ? (status ?? "sent") : undefined;

  // Bubble look per author / status.
  let background = c.surfaceRaised;
  let foreground = c.textPrimary;
  let borderColor = theme.name === "highContrast" ? c.border : "transparent";
  let borderWidth = theme.name === "highContrast" ? theme.borderWidth.hairline : 0;
  let dashed = false;
  if (own) {
    if (effectiveStatus === "sent") {
      background = c.laminate;
      foreground = c.textOnLaminate;
      borderWidth = 0;
    } else {
      background = "transparent";
      dashed = true;
      borderWidth = theme.borderWidth.offline;
      borderColor = effectiveStatus === "stale" ? c.warning : effectiveStatus === "failed" ? c.error : c.offline;
      foreground = effectiveStatus === "stale" || effectiveStatus === "failed" ? c.textSecondary : c.textPrimary;
    }
  }

  const label = effectiveStatus ? visibleStatus(effectiveStatus, time, statusLabel) : "";
  const a11yLabel = own
    ? `${strings.message.a11y.own(text)} ${effectiveStatus ? spokenStatus(effectiveStatus, time, label) : ""}`.trim()
    : strings.message.a11y.crew(senderName ?? "", time, text);

  const linkHeight = textStyles.tag.levels[level][1];

  return (
    <View testID={testID} style={[styles.container, own ? styles.own : styles.crew]}>
      <View accessible accessibilityLabel={a11yLabel} style={[styles.group, own ? styles.own : styles.crew]}>
        {!own && senderName ? (
          <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textSecondary }]}>
            {senderName}
            {strings.common.separator}
            {time}
          </Text>
        ) : null}

        <View
          style={[
            styles.bubble,
            own ? styles.ownCorner : styles.crewCorner,
            {
              backgroundColor: background,
              borderColor,
              borderWidth,
              borderStyle: dashed ? "dashed" : "solid",
              paddingVertical: PAD_VERTICAL - borderWidth,
              paddingHorizontal: PAD_HORIZONTAL - borderWidth,
            },
          ]}
        >
          <Text allowFontScaling={false} style={[textStyle("body", level), { color: foreground }]}>
            {text}
          </Text>
        </View>

        {effectiveStatus ? (
          <Animated.View style={[styles.status, statusAnimation]}>
            {effectiveStatus === "stale" ? (
              <StatusTag label={label} tone="warning" icon="warning" fill="solid" />
            ) : effectiveStatus === "failed" ? (
              <StatusTag label={label} tone="error" icon="close" fill="outline" />
            ) : (
              <>
                <Icon name={STATUS_ICON_NAME[effectiveStatus]} size={STATUS_ICON} color={c.textOffline} />
                <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textOffline }]}>
                  {label}
                </Text>
              </>
            )}
          </Animated.View>
        ) : null}
      </View>

      {effectiveStatus === "queued" && onCancel ? (
        <Pressable
          onPress={() => onCancel(id)}
          hitSlop={hitSlopFor(size.touchMin, linkHeight)}
          accessibilityRole="button"
          accessibilityLabel={strings.message.cancelSending}
          accessibilityHint={strings.message.a11y.cancelHint}
          style={styles.link}
        >
          <Text
            allowFontScaling={false}
            style={[textStyle("tag", level), styles.underline, { color: c.textPrimary }]}
          >
            {strings.message.cancelSending}
          </Text>
        </Pressable>
      ) : null}

      {effectiveStatus === "stale" || effectiveStatus === "failed" ? (
        <View style={styles.actions}>
          {onSendAnyway ? (
            <BubbleAction
              label={effectiveStatus === "stale" ? strings.message.sendAnyway : strings.message.retry}
              hint={effectiveStatus === "stale" ? strings.message.a11y.sendAnywayHint : strings.message.a11y.retryHint}
              onPress={() => onSendAnyway(id)}
              theme={theme}
              level={level}
            />
          ) : null}
          {onDelete ? (
            <BubbleAction
              label={strings.message.delete}
              hint={strings.message.a11y.deleteHint}
              onPress={() => onDelete(id)}
              theme={theme}
              level={level}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);

const styles = StyleSheet.create({
  container: { gap: spacing.s2 },
  own: { alignItems: "flex-end" },
  crew: { alignItems: "flex-start" },
  group: { gap: HEADER_GAP },
  bubble: {
    maxWidth: MAX_WIDTH,
    borderRadius: radius.button,
  },
  ownCorner: { borderBottomRightRadius: radius.none },
  crewCorner: { borderBottomLeftRadius: radius.none },
  status: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  link: { paddingVertical: spacing.s1 },
  underline: { textDecorationLine: "underline" },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.s2 },
  action: {
    minWidth: size.touchMin,
    paddingHorizontal: spacing.s3,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
});
