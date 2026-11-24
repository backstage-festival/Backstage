/**
 * Pure rules for S01 (Logowanie / Rejestracja). No React, no stores.
 * The password rule is not in src/domain (textRules has none) – kept here
 * until Marceli decides whether it moves to the domain (question in the PR).
 */
import type { AuthError } from "@/store/authStore";
import { strings } from "@/strings";

export const MIN_PASSWORD_LENGTH = 8;
const DIGIT = /\d/;

export type LoginMode = "login" | "register";

/** `?mode=` from the route → mode; anything else is the login tab. */
export function parseMode(value: string | string[] | undefined): LoginMode {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "register" ? "register" : "login";
}

export interface PasswordChecks {
  readonly minLength: boolean;
  readonly hasDigit: boolean;
}

/** S01 registration hints: „min. 8 znaków”, „cyfra”. Length counts characters, not UTF-16 units. */
export function passwordChecks(password: string): PasswordChecks {
  return {
    minLength: Array.from(password).length >= MIN_PASSWORD_LENGTH,
    hasDigit: DIGIT.test(password),
  };
}

/** Hint labels of the unmet rules, in hint order („min. 8 znaków”, „cyfra”). */
export function missingChecks(checks: PasswordChecks): string[] {
  const missing: string[] = [];
  if (!checks.minLength) missing.push(strings.auth.checkMinLength);
  if (!checks.hasDigit) missing.push(strings.auth.checkDigit);
  return missing;
}

/** „× Hasła się różnią” shows only once the repeat field has something in it. */
export function passwordsDiffer(password: string, repeat: string): boolean {
  return repeat.length > 0 && password !== repeat;
}

export interface LoginFields {
  readonly login: string;
  readonly password: string;
  /** Only in register mode. */
  readonly repeat: string;
}

export type FieldName = "login" | "password" | "repeat";

export interface FormErrors {
  readonly login?: string;
  readonly password?: string;
  readonly repeat?: string;
  /**
   * Register: the password misses a rule. No text under the field – the
   * unmet hints turn red instead (S01), TalkBack reads what is missing.
   */
  readonly weakPassword?: boolean;
  /** Field that gets the focus back (the first one with an error). */
  readonly focus: FieldName | null;
}

const NO_ERRORS: FormErrors = { focus: null };

const e = strings.auth.error;

/** Checks before sending. Login is trimmed by the caller only for the empty check. */
export function validateForm(mode: LoginMode, fields: LoginFields): FormErrors {
  const login = fields.login.trim().length === 0 ? e.loginEmpty : undefined;
  let password: string | undefined;
  let repeat: string | undefined;
  let weakPassword = false;

  if (fields.password.length === 0) {
    password = e.passwordEmpty;
  } else if (mode === "register") {
    weakPassword = missingChecks(passwordChecks(fields.password)).length > 0;
  }
  if (mode === "register" && fields.password !== fields.repeat) repeat = e.passwordsDiffer;

  const focus: FieldName | null = login ? "login" : password || weakPassword ? "password" : repeat ? "repeat" : null;
  if (focus === null) return NO_ERRORS;
  return {
    ...(login ? { login } : null),
    ...(password ? { password } : null),
    ...(repeat ? { repeat } : null),
    ...(weakPassword ? { weakPassword } : null),
    focus,
  };
}

export function hasErrors(errors: FormErrors): boolean {
  return errors.focus !== null;
}

/**
 * authStore error → field errors. Wrong credentials: both frames red, the text
 * under the password field (S01), focus back on the password.
 */
export function authErrorToForm(error: AuthError): FormErrors & { readonly bothFrames: boolean } {
  switch (error.kind) {
    case "invalidCredentials":
      return { password: e.invalidCredentials, focus: "password", bothFrames: true };
    case "loginTaken":
      return { login: e.loginTaken, focus: "login", bothFrames: false };
    case "unknown":
      return { password: e.unknown, focus: "password", bothFrames: false };
  }
}
