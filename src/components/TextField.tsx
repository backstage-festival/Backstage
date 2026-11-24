import { type Ref, useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";
import type { TextFieldProps } from "@/types/components";

import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

/** S01: error frame 2.5 dp. */
const ERROR_BORDER = 2.5;
const ERROR_ICON = 16;

export interface TextFieldElementProps extends TextFieldProps {
  /** The screen moves focus back to the field after a failed login. */
  ref?: Ref<TextInput>;
}

/**
 * S01 text field: label above, input (min. 52 dp), error frame and text under
 * the field (E01: mono uppercase). Password fields get a frameless eye / eyeOff button („Pokaż hasło” /
 * „Ukryj hasło”). TalkBack: „Hasło, hasło ukryte” + „pole edycji” from Android;
 * the error is part of the label, so it is read when the focus comes back.
 */
export function TextField({
  ref,
  label,
  value,
  onChangeText,
  error,
  invalid = false,
  accessibilityError,
  secure = false,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  editable,
  testID,
}: TextFieldElementProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const [hidden, setHidden] = useState(true);
  const toggle = useCallback(() => setHidden((value) => !value), []);
  const showError = error !== undefined || invalid;
  const masked = secure && hidden;

  const baseLabel = masked ? strings.auth.a11y.passwordHidden(label) : label;
  const spokenError = error ?? accessibilityError;
  const a11yLabel = spokenError ? strings.auth.a11y.withError(baseLabel, spokenError) : baseLabel;

  return (
    <View style={styles.field}>
      <Text
        allowFontScaling={false}
        importantForAccessibility="no"
        style={[textStyle("label", level), { color: c.textSecondary }]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            minHeight: Math.max(size.input, size.control[level]),
            borderColor: showError ? c.error : c.border,
            borderWidth: showError ? ERROR_BORDER : theme.borderWidth.control,
            backgroundColor: c.surface,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={masked}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          {...(onSubmitEditing ? { onSubmitEditing, submitBehavior: returnKeyType === "next" ? "submit" : "blurAndSubmit" } : null)}
          allowFontScaling={false}
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: !editable }}
          selectionColor={c.accent}
          style={[textStyle("input", level), styles.input, { color: editable ? c.textPrimary : c.textDisabled }]}
        />
        {secure ? (
          <IconButton
            icon={hidden ? "eye" : "eyeOff"}
            accessibilityLabel={hidden ? strings.auth.a11y.showPassword : strings.auth.a11y.hidePassword}
            surface="dark"
            bare
            disabled={false}
            onPress={toggle}
          />
        ) : null}
      </View>
      {error ? (
        <View style={styles.error} importantForAccessibility="no-hide-descendants">
          <Icon name="close" size={ERROR_ICON} color={c.error} />
          <Text allowFontScaling={false} style={[textStyle("statusMeta", level), styles.shrink, { color: c.error }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.s1 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.button,
    paddingLeft: spacing.s3,
    paddingRight: spacing.s1,
  },
  input: { flex: 1, paddingVertical: spacing.s2 },
  error: { flexDirection: "row", alignItems: "flex-start", gap: spacing.s1 },
  shrink: { flexShrink: 1 },
});
