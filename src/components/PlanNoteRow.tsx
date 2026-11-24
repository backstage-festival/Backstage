import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { size, spacing, textStyles } from "@/theme/theme";

import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { StatusTag, statusTagLabel } from "./StatusTag";

/** C11: one-line StatusTag at 100 % text = 3 + status lineHeight + 3 (= 22). */
const TAG_PAD_VERTICAL = 3;
export const PLAN_NOTE_TAG_HEIGHT = TAG_PAD_VERTICAL + textStyles.status.levels[0][1] + TAG_PAD_VERTICAL;
const PAD_VERTICAL = spacing.s2;
const GAP = spacing.s2;

/**
 * Fixed height at 100 % text (getItemLayout):
 * padding 8 + tag 22 + gap 8 + buttons 48 + padding 8 = 94.
 */
export const PLAN_NOTE_HEIGHT = PAD_VERTICAL + PLAN_NOTE_TAG_HEIGHT + GAP + size.touchMin + PAD_VERTICAL;

export interface PlanNoteRowProps {
  /** Short text on the tag, e.g. „Kolizja · S2 od 02:00”. */
  label: string;
  /** Full sentence read by TalkBack instead of the short text. */
  accessibilityLabel: string;
  tone: "warning" | "error";
  /** „Dodaj mimo to” after a conflict. */
  action?: { label: string; hint: string; onPress: () => void };
  onDismiss: () => void;
}

/**
 * A failed plan write, shown right under its card until dismissed (store clearError).
 * Always stacked: the tag on its own line, the buttons below. At 100 % text the
 * tag keeps one line and the row has a fixed height; at 150 / 200 % the tag wraps
 * by words. TalkBack order: message → „Dodaj mimo to” → Zamknij.
 */
function PlanNoteRowBase({ label, accessibilityLabel, tone, action, onDismiss }: PlanNoteRowProps) {
  const { theme, level } = useTheme();
  const fixed = level === 0;

  return (
    <View style={[styles.stack, fixed ? { height: PLAN_NOTE_HEIGHT } : null]} accessibilityLiveRegion="polite">
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={statusTagLabel(accessibilityLabel, tone, theme)}
        // StatusTag has no numberOfLines: at 100 % the box is one tag line high.
        style={fixed ? styles.oneLine : null}
      >
        <StatusTag label={label} tone={tone} fill={tone === "error" ? "outline" : "solid"} />
      </View>
      <View style={[styles.buttons, action ? null : styles.buttonsEnd]}>
        {action ? (
          <View style={styles.action}>
            <Button
              label={action.label}
              variant="ghost"
              surface="dark"
              disabled={false}
              width="hug"
              accessibilityHint={action.hint}
              onPress={action.onPress}
            />
          </View>
        ) : null}
        <IconButton
          icon="close"
          accessibilityLabel={strings.planScreen.note.dismiss}
          surface="dark"
          disabled={false}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}

export const PlanNoteRow = memo(PlanNoteRowBase);

const styles = StyleSheet.create({
  stack: { gap: GAP, paddingVertical: PAD_VERTICAL },
  oneLine: { height: PLAN_NOTE_TAG_HEIGHT, overflow: "hidden" },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.s2 },
  buttonsEnd: { justifyContent: "flex-end" },
  // Lets a long label at 200 % wrap instead of pushing the close button out.
  action: { flexShrink: 1 },
});
