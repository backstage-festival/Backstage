import { useCallback, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, size, spacing, textStyle } from "@/theme/theme";

import { IconButton } from "./IconButton";

export interface ComposerProps {
  /** Resolves false when the store rolled the message back – the text comes back. */
  onSend: (body: string) => Promise<boolean>;
}

/**
 * S06 · Composer – text field + accent send button. Empty text disables the
 * button; any other validation is the use case's job.
 */
export function Composer({ onSend }: ComposerProps) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  const send = useCallback(() => {
    const body = text;
    if (body.trim().length === 0) return;
    setText(""); // optimistic: the bubble is already in the list
    void onSend(body).then((sent) => {
      if (!sent) setText((current) => (current.length === 0 ? body : current));
    });
  }, [text, onSend]);

  return (
    <View style={[styles.row, { borderTopColor: c.divider, borderTopWidth: theme.borderWidth.hairline }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={strings.crewScreen.placeholder}
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={strings.crewScreen.a11y.input}
        allowFontScaling={false}
        multiline
        style={[
          styles.input,
          textStyle("input", level),
          {
            minHeight: size.input,
            color: c.textPrimary,
            borderColor: c.border,
            borderWidth: theme.borderWidth.control,
          },
        ]}
      />
      <IconButton
        icon="arrowRight"
        emphasis={canSend ? "accent" : undefined}
        accessibilityLabel={strings.crewScreen.a11y.send}
        accessibilityHint={canSend ? strings.crewScreen.a11y.sendHint : strings.crewScreen.a11y.sendDisabled}
        surface="dark"
        disabled={!canSend}
        onPress={send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.s2,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.s2,
  },
  input: {
    flex: 1,
    borderRadius: radius.button,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s3,
    textAlignVertical: "top",
  },
});
