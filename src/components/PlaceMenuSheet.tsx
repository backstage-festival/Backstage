import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, type TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MAX_PLACE_LABEL_LENGTH } from "@/domain/utils/textRules";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle } from "@/theme/theme";

import { Button } from "./Button";
import { useReduceMotion } from "./motion";
import { TextField } from "./TextField";

const BACKDROP_ALPHA = "CC";
/** Room under the last button; the navigation-bar inset is added on top while the keyboard is closed. */
const SHEET_BOTTOM = spacing.s8;
/** Wait after the sheet is shown before focusing the field, so Android opens the keyboard. */
const FOCUS_DELAY_MS = 120;
const t = strings.tent;

export interface PlaceMenuSheetProps {
  visible: boolean;
  label: string;
  /** Open straight in rename mode (TalkBack action „Zmień nazwę”). */
  startRenaming: boolean;
  onRename: (label: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * „More” menu of a saved place: Zmień nazwę / Usuń / Anuluj, as a simple
 * bottom sheet. Rename swaps the menu for the S01 TextField; an empty name
 * shows the error under the field and disables „Zapisz”.
 * The parent remounts the sheet per place (key), so the field starts fresh.
 *
 * Keyboard (Android edge-to-edge): the Modal is a window of its own, so the
 * screen's layout does not help – the sheet has its own KeyboardAvoidingView.
 * The Modal draws under the status and navigation bars (both translucent), so
 * the view measures from the screen edges; the scrim stays full screen and
 * only the sheet rises above the keyboard. The navigation-bar inset is added
 * under the buttons only while the keyboard is closed (the keyboard covers it).
 */
export function PlaceMenuSheet({ visible, label, startRenaming, onRename, onDelete, onClose }: PlaceMenuSheetProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  /** The Modal finished its enter animation (onShow) – focus before that may not open the keyboard. */
  const [shown, setShown] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [renaming, setRenaming] = useState(startRenaming);
  const [text, setText] = useState(label);
  const valid = text.trim().length > 0;
  const fieldRef = useRef<TextInput>(null);

  // Rename mode: focus the field once the sheet is in place; selectTextOnFocus lets typing replace the name.
  // Android opens no keyboard for a focus() in the same frame as the Modal's window
  // getting focus, so the call waits FOCUS_DELAY_MS after onShow / the switch to rename.
  useEffect(() => {
    if (!renaming || !shown) return undefined;
    const timer = setTimeout(() => fieldRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [renaming, shown]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const onShow = useCallback(() => setShown(true), []);

  const startRename = useCallback(() => setRenaming(true), []);
  const save = useCallback(() => {
    if (text.trim().length > 0) onRename(text);
  }, [onRename, text]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: `${c.background}${BACKDROP_ALPHA}` }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        {/* box-none: taps above the sheet still reach the scrim and close it. */}
        <KeyboardAvoidingView behavior="padding" style={styles.avoid} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                borderWidth: theme.borderWidth.control,
                paddingBottom: SHEET_BOTTOM + (keyboardOpen ? 0 : insets.bottom),
              },
            ]}
          >
            <Text allowFontScaling={false} accessibilityRole="header" style={[textStyle("displayXS", level), { color: c.textPrimary }]}>
              {renaming ? t.menu.rename : t.menu.title(label)}
            </Text>
            {renaming ? (
              <View style={styles.field}>
                <TextField
                  ref={fieldRef}
                  label={t.menu.nameLabel}
                  value={text}
                  onChangeText={setText}
                  {...(valid ? null : { error: t.note.invalidLabel })}
                  autoComplete="off"
                  textContentType="none"
                  returnKeyType="done"
                  onSubmitEditing={save}
                  maxLength={MAX_PLACE_LABEL_LENGTH}
                  selectTextOnFocus
                  editable
                />
                <Button
                  label={t.menu.save}
                  variant="primary"
                  surface="dark"
                  disabled={!valid}
                  // The error is already under the field – the reason goes to TalkBack only.
                  {...(valid ? null : { accessibilityHint: t.note.invalidLabelA11y })}
                  width="fill"
                  onPress={save}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button label={t.menu.rename} variant="secondary" surface="dark" disabled={false} width="fill" onPress={startRename} />
                <Button label={t.menu.delete} variant="destructive" surface="dark" disabled={false} width="fill" onPress={onDelete} />
              </View>
            )}
            <Button label={t.menu.cancel} variant="ghost" surface="dark" disabled={false} width="fill" onPress={onClose} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  avoid: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.pass,
    borderTopRightRadius: radius.pass,
    padding: spacing.s6,
    gap: spacing.s3,
  },
  actions: { gap: spacing.s2 },
  field: { gap: spacing.s3 },
});
