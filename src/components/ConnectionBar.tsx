import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, size, spacing, textStyle } from "@/theme/theme";
import type { ConnectionBarProps, IconName } from "@/types/components";

import { Icon } from "./Icon";
import { useReduceMotion } from "./motion";

/** C03: sync progress bar is 3 dp at the bottom edge. */
const PROGRESS_HEIGHT = 3;

function useSpin(active: boolean, reduceMotion: boolean) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduceMotion) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: motion.syncSpin.duration,
        easing: Easing.bezier(...motion.syncSpin.easing),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, rotation]);

  return rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

function useProgress(ratio: number, reduceMotion: boolean) {
  const value = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    if (reduceMotion) {
      value.setValue(ratio);
      return;
    }
    Animated.timing(value, {
      toValue: ratio,
      duration: motion.statusChange.duration,
      easing: Easing.bezier(...motion.statusChange.easing),
      useNativeDriver: true,
    }).start();
  }, [ratio, reduceMotion, value]);

  return value;
}

/**
 * C03 · ConnectionBar – always right above the tab bar. Says where the data
 * comes from and how many messages wait. Polite live region; never takes focus.
 */
export function ConnectionBar({ state, detail, queued, syncProgress, trailing, testID }: ConnectionBarProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();

  const syncing = state === "syncing";
  const online = state === "online";
  const done = syncProgress?.done ?? 0;
  const total = syncProgress?.total ?? queued;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;

  const spin = useSpin(syncing, reduceMotion);
  const progress = useProgress(ratio, reduceMotion);

  const icon: IconName = syncing ? "sync" : online ? "signal" : "noSignal";
  const labelColor = syncing ? c.textOnLaminate : c.textOffline;
  const metaColor = syncing ? c.textOnLaminate : c.textSecondary;
  const iconColor = syncing ? c.textOnLaminate : c.offline;

  const stateWord = online ? strings.connection.online : strings.connection.offline;
  const right = syncing ? strings.connection.progress(done, total) : trailing;
  const showQueue = !syncing && queued > 0;

  let a11yLabel: string;
  if (syncing) {
    a11yLabel = strings.connection.a11y.syncing(done, total);
  } else {
    a11yLabel = `${stateWord}. ${detail}.`;
    if (showQueue) a11yLabel += ` ${strings.connection.a11y.queued(queued)}`;
    if (trailing) a11yLabel += ` ${trailing}.`;
  }

  const frame = syncing
    ? { backgroundColor: c.laminate, borderColor: c.laminate, borderStyle: "solid" as const }
    : online
      ? { backgroundColor: c.background, borderColor: c.divider, borderStyle: "solid" as const }
      : { backgroundColor: c.background, borderColor: c.offline, borderStyle: "dashed" as const };
  const frameWidth = online || syncing ? theme.borderWidth.hairline : theme.borderWidth.offline;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        frame,
        { minHeight: size.connectionBar[level], borderWidth: frameWidth },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Icon name={icon} size={size.iconSmall} color={iconColor} />
      </Animated.View>

      <Text allowFontScaling={false} style={[styles.shrink, textStyle("barLabel", level), { color: labelColor }]}>
        {syncing ? strings.connection.sending(total) : stateWord}
        {syncing ? null : (
          <Text allowFontScaling={false} style={[textStyle("barMeta", level), { color: metaColor }]}>
            {strings.common.separator}
            {detail}
          </Text>
        )}
      </Text>

      {showQueue ? (
        <Text allowFontScaling={false} style={[styles.end, textStyle("barLabel", level), { color: labelColor }]}>
          {strings.connection.queued(queued)}
        </Text>
      ) : null}

      {right ? (
        <Text
          allowFontScaling={false}
          style={[showQueue ? null : styles.end, textStyle("barLabel", level), { color: labelColor }]}
        >
          {right}
        </Text>
      ) : null}

      {syncing ? (
        <Animated.View
          style={[
            styles.progress,
            { backgroundColor: c.textOnLaminate, transform: [{ scaleX: progress }] },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    paddingHorizontal: spacing.screen,
  },
  shrink: { flexShrink: 1 },
  end: { marginLeft: "auto" },
  progress: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: PROGRESS_HEIGHT,
    transformOrigin: "left",
  },
});
