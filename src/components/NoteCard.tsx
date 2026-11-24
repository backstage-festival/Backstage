import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";

import { Icon } from "./Icon";
import { statusTagLabel } from "./StatusTag";

export interface NoteCardProps {
  /** „Utrudnienia · Tramwaje 2 i 6” */
  title: string;
  body: string;
}

/** S08 · Note (warning frame) – disruptions and the stale-data notice on Powrót. */
export function NoteCard({ title, body }: NoteCardProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const label = statusTagLabel(title, "warning", theme);
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${body}`}
      style={[styles.card, { borderColor: c.warning, borderWidth: theme.borderWidth.control }]}
    >
      <View style={styles.title}>
        <Icon name="warning" size={size.iconSmall} color={c.warning} />
        <Text allowFontScaling={false} style={[textStyle("label", level), styles.shrink, { color: c.warning }]}>
          {label}
        </Text>
      </View>
      <Text allowFontScaling={false} style={[textStyle("bodyM", level), { color: c.textPrimary }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.button, padding: spacing.s3, gap: spacing.s2 },
  title: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  shrink: { flexShrink: 1 },
});
