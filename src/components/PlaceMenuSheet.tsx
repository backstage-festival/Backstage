import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, type TextInput, View } from "react-native";

import { MAX_PLACE_LABEL_LENGTH } from "@/domain/utils/textRules";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing, textStyle } from "@/theme/theme";

import { Button } from "./Button";
import { useReduceMotion } from "./motion";
import { TextField } from "./TextField";

const BACKDROP_ALPHA = "CC";
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
 */
export function PlaceMenuSheet({ visible, label, startRenaming, onRename, onDelete, onClose }: PlaceMenuSheetProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const [renaming, setRenaming] = useState(startRenaming);
  const [text, setText] = useState(label);
  const valid = text.trim().length > 0;
  const fieldRef = useRef<TextInput>(null);

  // Focus the field as soon as rename mode starts (was autoFocus on the own input).
  useEffect(() => {
    if (renaming) fieldRef.current?.focus();
  }, [renaming]);

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
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: `${c.background}${BACKDROP_ALPHA}` }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, borderWidth: theme.borderWidth.control }]}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.pass,
    borderTopRightRadius: radius.pass,
    padding: spacing.s6,
    paddingBottom: spacing.s8,
    gap: spacing.s3,
  },
  actions: { gap: spacing.s2 },
  field: { gap: spacing.s3 },
});
