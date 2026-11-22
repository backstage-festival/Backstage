import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing } from "@/theme/theme";

import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { StatusTag } from "./StatusTag";

/** Fixed height at 100 % text (getItemLayout): 48 dp controls + 4 + 4 padding. */
export const PLAN_NOTE_HEIGHT = 56;

export interface PlanNoteRowProps {
  label: string;
  tone: "warning" | "error";
  /** „Dodaj mimo to” after a conflict. */
  action?: { label: string; hint: string; onPress: () => void };
  onDismiss: () => void;
}

/** A failed plan write, shown right under its card until dismissed (store clearError). */
function PlanNoteRowBase({ label, tone, action, onDismiss }: PlanNoteRowProps) {
  const { level } = useTheme();
  return (
    <View style={[styles.row, level === 0 ? { height: PLAN_NOTE_HEIGHT } : styles.wrap]} accessibilityLiveRegion="polite">
      <View style={styles.tag}>
        <StatusTag label={label} tone={tone} fill={tone === "error" ? "outline" : "solid"} />
      </View>
      {action ? (
        <Button
          label={action.label}
          variant="ghost"
          surface="dark"
          disabled={false}
          width="hug"
          accessibilityHint={action.hint}
          onPress={action.onPress}
        />
      ) : null}
      <IconButton
        icon="close"
        accessibilityLabel={strings.planScreen.note.dismiss}
        surface="dark"
        disabled={false}
        onPress={onDismiss}
      />
    </View>
  );
}

export const PlanNoteRow = memo(PlanNoteRowBase);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.s2, paddingVertical: spacing.s1, overflow: "hidden" },
  wrap: { flexWrap: "wrap" },
  tag: { flex: 1 },
});
