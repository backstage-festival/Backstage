import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { EmptyStateProps } from "@/types/components";

import { EmptyState } from "./EmptyState";
import { ScreenHeader } from "./ScreenHeader";

/** X-Stan: skeleton only after 300 ms of loading, so fast reads never flash. */
export const SKELETON_DELAY_MS = 300;

/** X-Stan block sizes: bar 72, pass 180, rows 80 (time 84 · name · toggle 72). */
const BAR_HEIGHT = 72;
const PASS_HEIGHT = 180;
const ROW_HEIGHT = 80;
const ROW_TIME_WIDTH = 84;
const ROW_TOGGLE = 72;

export type ScreenStateKind =
  | { readonly kind: "loading" }
  | { readonly kind: "message"; readonly empty: EmptyStateProps };

export interface ScreenStateProps {
  title: string;
  titleAccessory?: ReactNode;
  state: ScreenStateKind;
}

function Skeleton() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const block = { backgroundColor: c.surface };
  const row = (
    <View style={[styles.row, { borderBottomColor: c.divider, borderBottomWidth: theme.borderWidth.hairline }]}>
      <View style={[block, styles.rowTime]} />
      <View style={[block, styles.rowName]} />
      <View style={[block, styles.rowToggle]} />
    </View>
  );
  return (
    <View style={styles.skeleton} accessible accessibilityLabel={strings.screen.loading} accessibilityLiveRegion="polite">
      <Text allowFontScaling={false} style={[textStyle("sectionLabel", level), { color: c.textSecondary }]}>
        {strings.screen.loading}
      </Text>
      {/* Static blocks – no shimmer, no animation (X-Stan). */}
      <View style={[block, styles.bar]} />
      <View style={[block, styles.pass]} />
      {row}
      {row}
    </View>
  );
}

/**
 * X-Stan · whole-screen state: loading skeleton, empty or error. Used only
 * when the screen has no data to show; offline with cached data is the
 * normal view plus the ConnectionBar.
 */
export function ScreenState({ title, titleAccessory, state }: ScreenStateProps) {
  const showSkeleton = useDelayedFlag(state.kind === "loading", SKELETON_DELAY_MS);
  return (
    <View style={styles.container}>
      <ScreenHeader title={title} accessory={titleAccessory} />
      {state.kind === "message" ? <EmptyState {...state.empty} /> : showSkeleton ? <Skeleton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.screen, gap: spacing.section },
  skeleton: { gap: spacing.s4 },
  bar: { height: BAR_HEIGHT, borderRadius: radius.button },
  pass: { height: PASS_HEIGHT, borderRadius: radius.pass },
  row: {
    height: ROW_HEIGHT + spacing.s6,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s4,
  },
  rowTime: { width: ROW_TIME_WIDTH, height: size.touchMin },
  rowName: { flex: 1, height: ROW_HEIGHT },
  rowToggle: { width: ROW_TOGGLE, height: ROW_TOGGLE, borderRadius: radius.button },
});
