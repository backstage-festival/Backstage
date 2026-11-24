import {
  authErrorToForm,
  hasErrors,
  MIN_PASSWORD_LENGTH,
  parseMode,
  passwordChecks,
  passwordsDiffer,
  validateForm,
} from "../loginForm";

describe("parseMode", () => {
  it("reads the register tab and falls back to login", () => {
    expect(parseMode("register")).toBe("register");
    expect(parseMode(["register", "login"])).toBe("register");
    expect(parseMode("login")).toBe("login");
    expect(parseMode("anything")).toBe("login");
    expect(parseMode(undefined)).toBe("login");
  });
});

describe("passwordChecks", () => {
  it("needs at least 8 characters and a digit", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordChecks("abcdefg1")).toEqual({ minLength: true, hasDigit: true });
    expect(passwordChecks("abcdef1")).toEqual({ minLength: false, hasDigit: true });
    expect(passwordChecks("abcdefgh")).toEqual({ minLength: true, hasDigit: false });
    expect(passwordChecks("")).toEqual({ minLength: false, hasDigit: false });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(passwordChecks("😀😀😀😀1").minLength).toBe(false);
    expect(passwordChecks("żółćźń12").minLength).toBe(true);
  });
});

describe("passwordsDiffer", () => {
  it("shows the mismatch only once the repeat field is filled", () => {
    expect(passwordsDiffer("abcdefg1", "")).toBe(false);
    expect(passwordsDiffer("abcdefg1", "abcdefg")).toBe(true);
    expect(passwordsDiffer("abcdefg1", "abcdefg1")).toBe(false);
  });
});

describe("validateForm", () => {
  it("accepts a filled login form without password rules", () => {
    const errors = validateForm("login", { login: "kuba", password: "x", repeat: "" });

    expect(hasErrors(errors)).toBe(false);
  });

  it("requires login and password, focusing the first empty field", () => {
    expect(validateForm("login", { login: "  ", password: "", repeat: "" })).toEqual({
      login: "Wpisz login.",
      password: "Wpisz hasło.",
      focus: "login",
    });
    expect(validateForm("login", { login: "kuba", password: "", repeat: "" }).focus).toBe("password");
  });

  it("checks the password rules and the repeat field when registering", () => {
    expect(validateForm("register", { login: "kuba", password: "krotkie", repeat: "krotkie" })).toEqual({
      password: "Hasło: min. 8 znaków i cyfra.",
      focus: "password",
    });
    expect(validateForm("register", { login: "kuba", password: "dlugie123", repeat: "dlugie12" })).toEqual({
      repeat: "Hasła się różnią",
      focus: "repeat",
    });
    expect(hasErrors(validateForm("register", { login: "kuba", password: "dlugie123", repeat: "dlugie123" }))).toBe(
      false,
    );
  });
});

describe("authErrorToForm", () => {
  it("marks both fields on wrong credentials, with the text under the password", () => {
    expect(authErrorToForm({ kind: "invalidCredentials" })).toEqual({
      password: "Login albo hasło się nie zgadzają. Sprawdź oba pola i spróbuj ponownie.",
      focus: "password",
      bothFrames: true,
    });
  });

  it("puts a taken login on the login field", () => {
    expect(authErrorToForm({ kind: "loginTaken" })).toMatchObject({ focus: "login", bothFrames: false });
  });
});
