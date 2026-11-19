import { createStore } from "zustand/vanilla";

import type { User } from "@/domain/entities/User";
import { DomainError } from "@/domain/errors/DomainError";

/**
 * Auth is deliberately NOT optimistic: the password has to be verified
 * (bcrypt on the use-case side) before we may treat the user as signed in.
 * Showing a signed-in state and then rolling it back would flash private
 * screens to someone with a wrong password.
 */
export interface AuthStoreDeps {
  // TODO(#32): LoginUseCase / RegisterUseCase
  readonly login: (login: string, password: string) => Promise<User>;
  // TODO(#32): LoginUseCase / RegisterUseCase
  readonly register: (login: string, password: string) => Promise<User>;
}

export type AuthError =
  | { readonly kind: "invalidCredentials" }
  | { readonly kind: "loginTaken" }
  | { readonly kind: "unknown" };

export type AuthStatus = "idle" | "submitting";

/** The signed-in user without the password hash – the hash never stays in RAM. */
export type SessionUser = Omit<User, "passwordHash">;

/** Copies only the public fields (no spread, so new private fields stay out too). */
const toSessionUser = (user: User): SessionUser => ({
  id: user.id,
  login: user.login,
  createdAt: user.createdAt,
});

export interface AuthState {
  readonly user: SessionUser | null;
  readonly status: AuthStatus;
  readonly lastError: AuthError | null;

  login(login: string, password: string): Promise<boolean>;
  register(login: string, password: string): Promise<boolean>;
  logout(): void;
  clearError(): void;
}

export type AuthStore = ReturnType<typeof createAuthStore>;

const toAuthError = (error: unknown): AuthError => {
  if (error instanceof DomainError) {
    if (error.code === "INVALID_CREDENTIALS") {
      return { kind: "invalidCredentials" };
    }
    if (error.code === "LOGIN_TAKEN") return { kind: "loginTaken" };
  }
  return { kind: "unknown" };
};

export function createAuthStore(deps: AuthStoreDeps) {
  return createStore<AuthState>()((set, get) => {
    const submit = async (
      action: (login: string, password: string) => Promise<User>,
      login: string,
      password: string,
    ): Promise<boolean> => {
      // Ignore a second tap while the first request is in flight.
      if (get().status === "submitting") return false;
      set({ status: "submitting", lastError: null });
      try {
        const user = await action(login, password);
        set({ user: toSessionUser(user), status: "idle" });
        return true;
      } catch (error) {
        set({ status: "idle", lastError: toAuthError(error) });
        return false;
      }
    };

    return {
      user: null,
      status: "idle",
      lastError: null,

      login(login, password) {
        return submit(deps.login, login, password);
      },

      register(login, password) {
        return submit(deps.register, login, password);
      },

      logout() {
        set({ user: null, lastError: null });
      },

      clearError() {
        set({ lastError: null });
      },
    };
  });
}

export const selectIsSignedIn = (state: AuthState): boolean =>
  state.user !== null;
