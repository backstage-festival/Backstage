import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from "react-native";
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
  missingChecks,
  parseMode,
  passwordChecks,
  passwordsDiffer,
  validateForm,
} from "@/hooks/loginForm";
import { useConnectionBar } from "@/hooks/useConnectionBar";
import { authStore, useAuthStore } from "@/store";
import { strings } from "@/strings";
import { useTheme } from "@/theme/ThemeProvider";
import { size, spacing, textStyle } from "@/theme/theme";
import type { SegmentedOption } from "@/types/components";

const a = strings.auth;

/** S01 spacing: pass → segment 21, segment → login 23, login → password 14, password → button 24. */
const GAP = { passToSegment: 21, segmentToLogin: 23, loginToPassword: 14, passwordToButton: 24 } as const;

/** Room kept under a field revealed above the keyboard (its error text ends there). */
const REVEAL_MARGIN = spacing.s4;

interface Box {
  y: number;
  height: number;
}

/** Field positions for scrolling: login is a direct child of the content, password and repeat sit in `group`. */
interface FieldLayouts {
  login?: Box;
  group?: Box;
  password?: Box;
  repeat?: Box;
}

function fieldBox(layouts: FieldLayouts, field: FieldName): Box | undefined {
  if (field === "login") return layouts.login;
  const inner = layouts[field];
  const group = layouts.group;
  if (inner === undefined || group === undefined) return undefined;
  return { y: group.y + inner.y, height: inner.height };
}

const boxOf = (event: LayoutChangeEvent): Box => ({
  y: event.nativeEvent.layout.y,
  height: event.nativeEvent.layout.height,
});

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
    <PassFrame band={a.pass.band} bandTrailing={a.pass.dates} bandLook="condensed" accessibilityLabel={a.pass.a11y}>
      <View style={styles.passBody}>
        <Text allowFontScaling={false} style={[textStyle("passName", level), { color: c.textOnLaminate }]}>
          {a.pass.name}
        </Text>
        {/* E01: one mono line – place left, serial right; may wrap at 200 %. */}
        <View style={styles.passMeta}>
          <Text allowFontScaling={false} style={[textStyle("labelMeta", level), styles.shrink, { color: c.textOnLaminate }]}>
            {a.pass.place}
          </Text>
          <Text allowFontScaling={false} style={[textStyle("labelMeta", level), { color: c.textOnLaminateSecondary }]}>
            {a.pass.serial}
          </Text>
        </View>
      </View>
    </PassFrame>
  );
}

/**
 * „✓ min. 8 znaków  ✓ cyfra” under the password while registering (E01: mono).
 * Met = success tick; unmet = tick and text in textDisabled, so the difference
 * is not carried by hue alone. After a refused send (`tried`) an unmet hint is
 * the error: × and text in colors.error – it replaces the text under the field.
 * TalkBack reads „spełnione / niespełnione”.
 */
function PasswordHints({ password, tried }: { password: string; tried: boolean }) {
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
      {items.map((item) => {
        const failed = tried && !item.met;
        const unmetColor = failed ? c.error : c.textDisabled;
        return (
          <View key={item.label} style={styles.hint}>
            <Icon name={failed ? "close" : "inPlan"} size={size.iconSmall} color={item.met ? c.success : unmetColor} />
            <Text allowFontScaling={false} style={[textStyle("statusMeta", level), { color: item.met ? c.textSecondary : unmetColor }]}>
              {item.label}
            </Text>
          </View>
        );
      })}
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
  /** Register: a send was refused for the password rules – unmet hints stay red until met. */
  const [rulesTried, setRulesTried] = useState(false);

  const loginRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const repeatRef = useRef<TextInput>(null);

  /*
   * Edge-to-edge (SDK 57): the window does not resize for the keyboard, the
   * KeyboardAvoidingView shrinks the ScrollView instead. After a failed send the
   * field with the error is scrolled into view, its error text above the
   * keyboard. The scroll is retried on every layout change (keyboard opening,
   * error text appearing) until the user scrolls or types.
   */
  const scrollRef = useRef<ScrollView>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const layouts = useRef<FieldLayouts>({});
  const revealTarget = useRef<FieldName | null>(null);

  const reveal = useCallback(() => {
    const field = revealTarget.current;
    const box = field === null ? undefined : fieldBox(layouts.current, field);
    if (box === undefined || viewportHeight.current === 0) return;
    let target = scrollY.current;
    const bottom = box.y + box.height + REVEAL_MARGIN;
    if (bottom > target + viewportHeight.current) target = bottom - viewportHeight.current;
    // A field taller than the view shows its label first.
    if (box.y < target) target = box.y;
    if (target !== scrollY.current) scrollRef.current?.scrollTo({ y: target, animated: false });
  }, []);

  const onViewport = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      reveal();
    },
    [reveal],
  );
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);
  const stopReveal = useCallback(() => {
    revealTarget.current = null;
  }, []);
  const onLoginLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layouts.current.login = boxOf(event);
      reveal();
    },
    [reveal],
  );
  const onGroupLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layouts.current.group = boxOf(event);
      reveal();
    },
    [reveal],
  );
  const onPasswordLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layouts.current.password = boxOf(event);
      reveal();
    },
    [reveal],
  );
  const onRepeatLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layouts.current.repeat = boxOf(event);
      reveal();
    },
    [reveal],
  );

  const focusField = useCallback((field: FieldName | null) => {
    const ref = field === "login" ? loginRef : field === "password" ? passwordRef : field === "repeat" ? repeatRef : null;
    ref?.current?.focus();
  }, []);

  /** Focus back on the field with the error and keep its error text above the keyboard. */
  const showError = useCallback(
    (field: FieldName | null) => {
      revealTarget.current = field;
      focusField(field);
      reveal();
    },
    [focusField, reveal],
  );

  /*
   * lastError lives in authStore and outlives the screen: clear it on entry
   * (an old attempt's red frames on empty fields) and when the screen unmounts.
   */
  useEffect(() => {
    if (authStore.getState().lastError !== null) authStore.getState().clearError();
    return () => {
      if (authStore.getState().lastError !== null) authStore.getState().clearError();
    };
  }, []);

  /** Typing clears the errors shown for the last attempt. */
  const clearErrors = useCallback(() => {
    revealTarget.current = null;
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
      setRulesTried(false);
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
      if (errors.weakPassword === true) setRulesTried(true);
      showError(errors.focus);
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
    if (error !== null) showError(authErrorToForm(error).focus);
  }, [mode, register, login, password, repeat, showError]);

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
  // Register, after a refused send: the red hints are the error, TalkBack reads what is missing.
  const missing = register && rulesTried ? missingChecks(passwordChecks(password)) : [];
  const passwordA11yError = missing.length > 0 ? a.a11y.missing(missing) : undefined;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={["top", "bottom"]}>
      {/*
        behavior="padding" on both platforms. The ConnectionBar is outside, so the
        padding covers only the part of the keyboard above the bar: the bar stays
        under the keyboard and the form ends at the keyboard's top edge.
      */}
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          onLayout={onViewport}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={stopReveal}
        >
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
              look="joined"
              segmentRole="tab"
              onChange={onMode}
            />
          </View>

          <View style={{ marginTop: GAP.segmentToLogin }} onLayout={onLoginLayout}>
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

          <View style={[styles.group, { marginTop: GAP.loginToPassword }]} onLayout={onGroupLayout}>
            <View onLayout={onPasswordLayout}>
              <TextField
                ref={passwordRef}
                label={a.passwordLabel}
                value={password}
                onChangeText={onPassword}
                {...(errors?.password ? { error: errors.password } : null)}
                {...(passwordA11yError ? { accessibilityError: passwordA11yError } : null)}
                invalid={passwordA11yError !== undefined}
                secure
                autoComplete={register ? "new-password" : "current-password"}
                textContentType={register ? "newPassword" : "password"}
                returnKeyType={register ? "next" : "go"}
                onSubmitEditing={register ? toRepeat : onSubmit}
                editable={!submitting}
              />
            </View>
            {register ? (
              <>
                <PasswordHints password={password} tried={rulesTried} />
                <View onLayout={onRepeatLayout}>
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
                </View>
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
                variant="link"
                surface="dark"
                disabled={false}
                width="hug"
                underline
                accessibilityHint={a.a11y.forgotHint}
                onPress={openPasswordReset}
              />
            )}
            <Text allowFontScaling={false} style={[textStyle("bodyS", level), { color: c.textSecondary }]}>
              {register ? a.hintRegister : a.hintLogin}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  passMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: spacing.s3,
    marginTop: spacing.s2,
  },
  shrink: { flexShrink: 1 },
  group: { gap: spacing.s3 },
  hints: { flexDirection: "row", flexWrap: "wrap", gap: spacing.s4 },
  hint: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
});
