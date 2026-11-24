import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { MAX_PLACE_LABEL_LENGTH } from "@/domain/utils/textRules";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";

import { Button } from "./Button";
import { useReduceMotion } from "./motion";

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
 * bottom sheet. Rename swaps the menu for a text field.
 * TODO(#29 part C): use TextField once it exists.
 * The parent remounts the sheet per place (key), so the field starts fresh.
 */
export function PlaceMenuSheet({ visible, label, startRenaming, onRename, onDelete, onClose }: PlaceMenuSheetProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const reduceMotion = useReduceMotion();
  const [renaming, setRenaming] = useState(startRenaming);
  const [text, setText] = useState(label);
  const valid = text.trim().length > 0;

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
              <Text allowFontScaling={false} style={[textStyle("label", level), { color: c.textPrimary }]}>
                {t.menu.nameLabel}
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                autoFocus
                maxLength={MAX_PLACE_LABEL_LENGTH}
                returnKeyType="done"
                onSubmitEditing={save}
                allowFontScaling={false}
                accessibilityLabel={t.menu.nameLabel}
                selectionColor={c.accent}
                style={[
                  textStyle("input", level),
                  styles.input,
                  { color: c.textPrimary, borderColor: c.border, borderWidth: theme.borderWidth.control },
                ]}
              />
              <Button
                label={t.menu.save}
                variant="primary"
                surface="dark"
                disabled={!valid}
                {...(valid ? null : { disabledReason: t.note.invalidLabel })}
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
  field: { gap: spacing.s2 },
  input: { minHeight: size.input, borderRadius: radius.button, paddingHorizontal: spacing.s3 },
});
