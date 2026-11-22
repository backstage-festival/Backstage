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

/**
 * A failed plan write, shown right under its card until dismissed (store clearError).
 * 100 % text: one row of fixed height (getItemLayout). 150 / 200 %: the tag takes
 * the full width and wraps by words, the buttons go to a row below. TalkBack
 * order in both: message → „Dodaj mimo to” → Zamknij.
 */
function PlanNoteRowBase({ label, tone, action, onDismiss }: PlanNoteRowProps) {
  const { level } = useTheme();
  const stacked = level > 0;

  const tag = <StatusTag label={label} tone={tone} fill={tone === "error" ? "outline" : "solid"} />;
  const actionButton = action ? (
    <Button
      label={action.label}
      variant="ghost"
      surface="dark"
      disabled={false}
      width="hug"
      accessibilityHint={action.hint}
      onPress={action.onPress}
    />
  ) : null;
  const close = (
    <IconButton
      icon="close"
      accessibilityLabel={strings.planScreen.note.dismiss}
      surface="dark"
      disabled={false}
      onPress={onDismiss}
    />
  );

  if (stacked) {
    return (
      <View style={styles.stack} accessibilityLiveRegion="polite">
        {tag}
        <View style={[styles.buttons, action ? null : styles.buttonsEnd]}>
          {actionButton ? <View style={styles.action}>{actionButton}</View> : null}
          {close}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { height: PLAN_NOTE_HEIGHT }]} accessibilityLiveRegion="polite">
      <View style={styles.tag}>{tag}</View>
      {actionButton}
      {close}
    </View>
  );
}

export const PlanNoteRow = memo(PlanNoteRowBase);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.s2, paddingVertical: spacing.s1, overflow: "hidden" },
  tag: { flex: 1 },
  stack: { gap: spacing.s2, paddingVertical: spacing.s2 },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.s2 },
  buttonsEnd: { justifyContent: "flex-end" },
  // Lets a long label at 200 % wrap instead of pushing the close button out.
  action: { flexShrink: 1 },
});
