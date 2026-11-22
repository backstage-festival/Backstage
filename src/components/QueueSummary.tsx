import { StyleSheet, Text, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";

import { Icon } from "./Icon";

/** S06 · QueueSummary – dashed frame „2 czekają na wysyłkę”. Hidden when the queue is empty. */
export function QueueSummary({ count }: { count: number }) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  if (count <= 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={strings.crewScreen.a11y.queue(count)}
      accessibilityLiveRegion="polite"
      style={[styles.frame, { borderColor: c.offline, borderWidth: theme.borderWidth.offline }]}
    >
      <Icon name="clock" size={size.iconSmall} color={c.textOffline} />
      <View style={styles.text}>
        <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textPrimary }]}>
          {strings.crewScreen.queueTitle(count)}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("labelMeta", level), { color: c.textSecondary }]}>
          {strings.crewScreen.queueBody(count)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    borderStyle: "dashed",
    borderRadius: radius.button,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s3,
  },
  text: { flex: 1 },
});
