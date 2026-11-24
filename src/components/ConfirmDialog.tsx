import { useCallback, useRef } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle } from "@/theme/theme";
import type { ConfirmDialogProps } from "@/types/components";

import { Button } from "./Button";
import { useReduceMotion } from "./motion";

/** Backdrop: background colour at 80 % (hex alpha). */
const BACKDROP_ALPHA = "CC";

/**
 * Confirmation before a destructive action. Modal for TalkBack
 * (accessibilityViewIsModal), focus starts on the safe choice („Zostaw”),
 * back button and backdrop = cancel. Buttons are stacked: safe first.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const cancelRef = useRef<View>(null);

  const focusCancel = useCallback(() => {
    if (cancelRef.current !== null) AccessibilityInfo.sendAccessibilityEvent(cancelRef.current, "focus");
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      statusBarTranslucent
      onShow={focusCancel}
      onRequestClose={onCancel}
    >
      <View style={[styles.backdrop, { backgroundColor: `${c.background}${BACKDROP_ALPHA}` }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} importantForAccessibility="no" />
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border, borderWidth: theme.borderWidth.control }]}
        >
          <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("displayXS", level), { color: c.textPrimary }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={[textStyle("body", level), { color: c.textSecondary }]}>
            {body}
          </Text>
          <View style={styles.actions}>
            <Button
              ref={cancelRef}
              label={cancelLabel}
              variant="secondary"
              surface="dark"
              disabled={false}
              width="fill"
              onPress={onCancel}
            />
            <Button label={confirmLabel} variant="destructive" surface="dark" disabled={false} width="fill" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.screen },
  dialog: { borderRadius: radius.pass, padding: spacing.s6, gap: spacing.s3 },
  actions: { gap: spacing.s2, marginTop: spacing.s2 },
});
