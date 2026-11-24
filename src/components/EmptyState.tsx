import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { size, spacing, textStyle } from "@/theme/theme";
import type { EmptyStateKind, EmptyStateProps } from "@/types/components";

import { Button } from "./Button";
import { Icon } from "./Icon";

/** C12: gap 12; actions gap 8, margin-top 12 (on top of the gap). */
const GAP = spacing.s3;
const ACTIONS_GAP = spacing.s2;
const ACTIONS_MARGIN = spacing.s3;

/** Kinds that report a problem: the eyebrow gets the warning icon and error colour. */
const PROBLEM_KINDS: ReadonlySet<EmptyStateKind> = new Set(["noData", "downloadError", "loadError"]);

/**
 * C12 · EmptyState – empty lists and errors in one component. Always says
 * what happened and what to do. Left-aligned, 24 under the last element.
 */
export function EmptyState({ kind, eyebrow, title, body, primary, secondary, testID }: EmptyStateProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const problem = PROBLEM_KINDS.has(kind);
  const eyebrowColor = problem ? c.error : c.textSecondary;

  return (
    <View testID={testID} style={styles.container}>
      {eyebrow ? (
        <View style={styles.eyebrow}>
          {problem ? <Icon name="warning" size={size.iconSmall} color={eyebrowColor} /> : null}
          <Text allowFontScaling={false} style={[textStyle("eyebrow", level), styles.shrink, { color: eyebrowColor }]}>
            {eyebrow}
          </Text>
        </View>
      ) : null}
      <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("passName", level), { color: c.textPrimary }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={[textStyle("bodyM", level), { color: c.textSecondary }]}>
        {body}
      </Text>
      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? (
            <Button
              label={primary.label}
              variant={primary.prominent ? "primary" : "secondary"}
              surface="dark"
              {...(primary.icon ? { icon: primary.icon } : null)}
              disabled={primary.disabledReason !== undefined}
              {...(primary.disabledReason ? { disabledReason: primary.disabledReason } : null)}
              width="fill"
              onPress={primary.onPress}
            />
          ) : null}
          {secondary ? (
            <Button
              label={secondary.label}
              variant="secondary"
              surface="dark"
              {...(secondary.icon ? { icon: secondary.icon } : null)}
              disabled={false}
              width="fill"
              onPress={secondary.onPress}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: GAP, alignItems: "stretch" },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  shrink: { flexShrink: 1 },
  actions: { gap: ACTIONS_GAP, marginTop: ACTIONS_MARGIN },
});
