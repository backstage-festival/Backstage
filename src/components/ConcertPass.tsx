import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { ConcertPassProps } from "@/types/components";

import { PASS_CONTENT_LEFT, PassFrame } from "./PassFrame";

/** C01: progress bar 8 dp, radius 2 (as NowPass). */
const PROGRESS_HEIGHT = 8;
const PROGRESS_RADIUS = 2;

/**
 * S05 · large pass of the concert card: NowPass content (C01) on the shared
 * PassFrame with the ink band (E05a). Not pressable – one TalkBack stop
 * with the full description.
 */
export function ConcertPass({
  band,
  artist,
  when,
  progress,
  remaining,
  duration,
  serial,
  accessibilityLabel,
  testID,
}: ConcertPassProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const percent = progress === null ? 0 : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const compact = level === 0;

  return (
    <PassFrame band={band} accessibilityLabel={accessibilityLabel} {...(testID ? { testID } : null)}>
      <View style={styles.content}>
        <Text allowFontScaling={false} style={[textStyle("titleHero", level), { color: c.textOnLaminate }]}>
          {artist}
        </Text>
        <View style={compact ? styles.row : styles.column}>
          <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textOnLaminate }]}>
            {when}
          </Text>
          {duration !== null ? (
            <Text allowFontScaling={false} style={[textStyle("data", level), { color: c.textOnLaminate }]}>
              {duration}
            </Text>
          ) : null}
        </View>
        {progress !== null ? (
          <View style={[styles.track, { backgroundColor: c.laminateTrack }]}>
            <View style={[styles.fill, { width: `${percent}%`, backgroundColor: c.textOnLaminate }]} />
          </View>
        ) : null}
        <View style={[compact ? styles.row : styles.column, remaining === null ? styles.end : null]}>
          {remaining !== null ? (
            <Text allowFontScaling={false} style={[textStyle("tagMeta", level), { color: c.textOnLaminateSecondary }]}>
              {remaining}
            </Text>
          ) : null}
          <Text allowFontScaling={false} style={[textStyle("tagMeta", level), { color: c.textOnLaminateSecondary }]}>
            {serial}
          </Text>
        </View>
      </View>
    </PassFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingLeft: PASS_CONTENT_LEFT,
    paddingRight: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s3,
    gap: spacing.s2,
  },
  row: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.s2 },
  column: { gap: spacing.s2 },
  end: { justifyContent: "flex-end", alignItems: "flex-end" },
  track: { height: PROGRESS_HEIGHT, borderRadius: PROGRESS_RADIUS, overflow: "hidden" },
  fill: { height: PROGRESS_HEIGHT, borderRadius: PROGRESS_RADIUS },
});
