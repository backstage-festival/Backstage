import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ConnectionBar } from "@/components/ConnectionBar";
import { Icon } from "@/components/Icon";
import { PASS_CONTENT_LEFT, PassFrame } from "@/components/PassFrame";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import {
  authErrorToForm,
  type FieldName,
  type FormErrors,
  hasErrors,
  type LoginMode,
  parseMode,
  passwordChecks,
  passwordsDiffer,
  validateForm,
} from "@/hooks/loginForm";
import { useConnectionBar } from "@/hooks/useConnectionBar";
import { authStore, useAuthStore } from "@/store";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, textStyle } from "@/theme/theme";
import type { SegmentedOption } from "@/types/components";

const a = strings.auth;

/** S01 spacing: pass → segment 21, segment → login 23, login → password 14, password → button 24. */
const GAP = { passToSegment: 21, segmentToLogin: 23, loginToPassword: 14, passwordToButton: 24 } as const;

const MODE_OPTIONS: readonly SegmentedOption<LoginMode>[] = [
  { value: "login", label: a.loginTab, accessibilityLabel: a.loginTabA11y },
  { value: "register", label: a.registerTab, accessibilityLabel: a.registerTabA11y },
];

// TODO: address of the password reset page (not decided yet).
const openPasswordReset = (): void => undefined;

/** S01 festival pass – one TalkBack stop. */
function FestivalPass() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  return (
    <PassFrame band={a.pass.band} bandTrailing={a.pass.dates} accessibilityLabel={a.pass.a11y}>
      <View style={styles.passBody}>
        <Text allowFontScaling={false} style={[textStyle("passName", level), { color: c.textOnLaminate }]}>
          {a.pass.name}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("bodyM", level), { color: c.textOnLaminateSecondary }]}>
          {a.pass.place}
        </Text>
        <Text allowFontScaling={false} style={[textStyle("tagMeta", level), styles.serial, { color: c.textOnLaminateSecondary }]}>
          {a.pass.serial}
        </Text>
      </View>
    </PassFrame>
  );
}

/** „✓ min. 8 znaków  ✓ cyfra” under the password while registering. */
function PasswordHints({ password }: { password: string }) {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const checks = passwordChecks(password);
  const items = [
    { label: a.checkMinLength, met: checks.minLength },
    { label: a.checkDigit, met: checks.hasDigit },
  ];
  return (
    <View
      accessible
      accessibilityLabel={items.map((item) => a.a11y.check(item.label, item.met)).join(", ")}
      style={styles.hints}
    >
      {items.map((item) => (
        <View key={item.label} style={styles.hint}>
          <Icon name="inPlan" size={spacing.s4} color={item.met ? c.success : c.textDisabled} />
          <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: item.met ? c.textPrimary : c.textSecondary }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * S01 · Logowanie / Rejestracja (variant 01b). Not optimistic: the user is
 * signed in only after authStore confirms. Offline is not blocked – the
 * LoginUseCase is local (F1); the hint under the button only informs.
 * TODO(Q5): no route guard and no session restore until the session contract.
 */
export default function LoginScreen() {
  const { theme, level } = useTheme();
  const c = theme.colors;
  const bar = useConnectionBar();
  const mode = parseMode(useLocalSearchParams<{ mode?: string }>().mode);
  const register = mode === "register";

  const submitting = useAuthStore((state) => state.status === "submitting");
  const authError = useAuthStore((state) => state.lastError);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [localErrors, setLocalErrors] = useState<FormErrors | null>(null);

  const loginRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const repeatRef = useRef<TextInput>(null);

  const focusField = useCallback((field: FieldName | null) => {
    const ref = field === "login" ? loginRef : field === "password" ? passwordRef : field === "repeat" ? repeatRef : null;
    ref?.current?.focus();
  }, []);

  /** Typing clears the errors shown for the last attempt. */
  const clearErrors = useCallback(() => {
    setLocalErrors(null);
    if (authStore.getState().lastError !== null) authStore.getState().clearError();
  }, []);

  const onLogin = useCallback((value: string) => {
    setLogin(value);
    clearErrors();
  }, [clearErrors]);
  const onPassword = useCallback((value: string) => {
    setPassword(value);
    clearErrors();
  }, [clearErrors]);
  const onRepeat = useCallback((value: string) => {
    setRepeat(value);
    clearErrors();
  }, [clearErrors]);

  const onMode = useCallback(
    (value: readonly LoginMode[]) => {
      const next = value[0];
      if (next === undefined) return;
      clearErrors();
      // No animation: only the route param changes (S01).
      router.setParams({ mode: next });
    },
    [clearErrors],
  );

  const submit = useCallback(async () => {
    if (authStore.getState().status === "submitting") return;
    const errors = validateForm(mode, { login, password, repeat });
    if (hasErrors(errors)) {
      setLocalErrors(errors);
      focusField(errors.focus);
      return;
    }
    setLocalErrors(null);
    const action = register ? authStore.getState().register : authStore.getState().login;
    const ok = await action(login.trim(), password);
    if (ok) {
      // TODO(#45): go to /prepare when the phone has no event data yet.
      router.replace("/(tabs)");
      return;
    }
    const error = authStore.getState().lastError;
    if (error !== null) focusField(authErrorToForm(error).focus);
  }, [mode, register, login, password, repeat, focusField]);

  const onSubmit = useCallback(() => {
    void submit();
  }, [submit]);
  const toPassword = useCallback(() => focusField("password"), [focusField]);
  const toRepeat = useCallback(() => focusField("repeat"), [focusField]);

  // Local checks win; otherwise the store error of the last attempt.
  const fromStore = useMemo(() => (authError === null ? null : authErrorToForm(authError)), [authError]);
  const errors = localErrors ?? fromStore;
  const bothFrames = localErrors === null && fromStore?.bothFrames === true;
  const repeatError = errors?.repeat ?? (register && passwordsDiffer(password, repeat) ? a.error.passwordsDiffer : undefined);
  const modeValue = useMemo(() => [mode], [mode]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={["top", "bottom"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text
          allowFontScaling={false}
          importantForAccessibility="no"
          style={[textStyle("wordmark", level), { color: c.textPrimary }]}
        >
          {a.wordmark}
        </Text>
        <View style={styles.pass}>
          <FestivalPass />
        </View>

        <View style={{ marginTop: GAP.passToSegment }}>
          <SegmentedControl
            groupLabel={a.modeGroup}
            options={MODE_OPTIONS}
            mode="single"
            value={modeValue}
            look="dayTabs"
            segmentRole="tab"
            onChange={onMode}
          />
        </View>

        <View style={{ marginTop: GAP.segmentToLogin }}>
          <TextField
            ref={loginRef}
            label={register ? a.loginLabelRegister : a.loginLabel}
            value={login}
            onChangeText={onLogin}
            {...(errors?.login ? { error: errors.login } : null)}
            invalid={bothFrames}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={toPassword}
            editable={!submitting}
          />
        </View>

        <View style={[styles.group, { marginTop: GAP.loginToPassword }]}>
          <TextField
            ref={passwordRef}
            label={a.passwordLabel}
            value={password}
            onChangeText={onPassword}
            {...(errors?.password ? { error: errors.password } : null)}
            secure
            autoComplete={register ? "new-password" : "current-password"}
            textContentType={register ? "newPassword" : "password"}
            returnKeyType={register ? "next" : "go"}
            onSubmitEditing={register ? toRepeat : onSubmit}
            editable={!submitting}
          />
          {register ? (
            <>
              <PasswordHints password={password} />
              <TextField
                ref={repeatRef}
                label={a.repeatLabel}
                value={repeat}
                onChangeText={onRepeat}
                {...(repeatError ? { error: repeatError } : null)}
                secure
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!submitting}
              />
            </>
          ) : null}
        </View>

        <View style={[styles.group, { marginTop: GAP.passwordToButton }]}>
          <Button
            label={register ? a.submitRegister : a.submitLogin}
            variant="primary"
            surface="dark"
            icon={submitting ? "sync" : "arrowRight"}
            disabled={submitting}
            {...(submitting ? { disabledReason: a.submitting } : null)}
            width="fill"
            onPress={onSubmit}
          />
          {register ? null : (
            <Button
              label={a.forgotPassword}
              variant="ghost"
              surface="dark"
              disabled={false}
              width="hug"
              accessibilityHint={a.a11y.forgotHint}
              onPress={openPasswordReset}
            />
          )}
          <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
            {register ? a.hintRegister : a.hintLogin}
          </Text>
        </View>
      </ScrollView>
      <ConnectionBar {...bar} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // No gap: the S01 distances are set per block with marginTop.
  content: { paddingHorizontal: spacing.screen, paddingVertical: spacing.s4 },
  pass: { marginTop: spacing.s4 },
  passBody: { paddingLeft: PASS_CONTENT_LEFT, paddingRight: spacing.s4, paddingVertical: spacing.s3, gap: spacing.s1 },
  serial: { alignSelf: "flex-end" },
  group: { gap: spacing.s3 },
  hints: { flexDirection: "row", flexWrap: "wrap", gap: spacing.s4 },
  hint: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
});
