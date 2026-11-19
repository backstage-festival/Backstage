import type { User } from "@/domain/entities/User";
import { DomainError } from "@/domain/errors/DomainError";

import {
  type AuthStoreDeps,
  createAuthStore,
  selectIsSignedIn,
  type SessionUser,
} from "../authStore";
import { deferred } from "../testing/deferred";

const user: User = {
  id: "u-1",
  login: "ola",
  passwordHash: "$2b$hash",
  createdAt: "2027-07-10T18:00:00.000Z",
};

const sessionUser: SessionUser = {
  id: "u-1",
  login: "ola",
  createdAt: "2027-07-10T18:00:00.000Z",
};

describe("authStore", () => {
  const makeDeps = () => ({
    login: jest.fn<Promise<User>, [string, string]>(),
    register: jest.fn<Promise<User>, [string, string]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const create = () => createAuthStore(deps satisfies AuthStoreDeps);

  beforeEach(() => {
    deps = makeDeps();
  });

  it("is not optimistic: the user stays null until the password is verified", async () => {
    const store = create();
    const pending = deferred<User>();
    deps.login.mockReturnValueOnce(pending.promise);

    const loggingIn = store.getState().login("ola", "secret");

    expect(store.getState().status).toBe("submitting");
    expect(selectIsSignedIn(store.getState())).toBe(false);

    pending.resolve(user);
    await expect(loggingIn).resolves.toBe(true);
    expect(deps.login).toHaveBeenCalledWith("ola", "secret");
    expect(store.getState().user).toEqual(sessionUser);
    expect(store.getState().status).toBe("idle");
  });

  it("does not keep the password hash in the state", async () => {
    const store = create();
    deps.login.mockResolvedValueOnce({ ...user, passwordHash: "$2b$secret" });

    await store.getState().login("ola", "secret");

    expect(store.getState().user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(store.getState())).not.toContain("$2b$secret");
  });

  it("registers a new user", async () => {
    const store = create();
    deps.register.mockResolvedValueOnce(user);

    await expect(store.getState().register("ola", "secret")).resolves.toBe(
      true,
    );

    expect(deps.register).toHaveBeenCalledWith("ola", "secret");
    expect(store.getState().user).toEqual(sessionUser);
  });

  it.each([
    [
      "login",
      new DomainError("INVALID_CREDENTIALS", "x"),
      { kind: "invalidCredentials" },
    ],
    ["register", new DomainError("LOGIN_TAKEN", "x"), { kind: "loginTaken" }],
    ["login", new DomainError("INVALID_DATE", "x"), { kind: "unknown" }],
    ["register", new Error("db"), { kind: "unknown" }],
  ] as const)("%s maps %p", async (action, error, expected) => {
    const store = create();
    deps[action].mockRejectedValueOnce(error);

    await expect(store.getState()[action]("ola", "secret")).resolves.toBe(
      false,
    );

    expect(store.getState()).toMatchObject({
      user: null,
      status: "idle",
      lastError: expected,
    });
  });

  it("ignores a second submit while the first is in flight", async () => {
    const store = create();
    const pending = deferred<User>();
    deps.login.mockReturnValueOnce(pending.promise);

    const first = store.getState().login("ola", "secret");
    await expect(store.getState().register("ola", "secret")).resolves.toBe(
      false,
    );

    expect(deps.register).not.toHaveBeenCalled();
    pending.resolve(user);
    await first;
  });

  it("clears the previous error when submitting again", async () => {
    const store = create();
    deps.login.mockRejectedValueOnce(new DomainError("INVALID_CREDENTIALS", "x"));
    await store.getState().login("ola", "bad");
    const pending = deferred<User>();
    deps.login.mockReturnValueOnce(pending.promise);

    const retrying = store.getState().login("ola", "secret");

    expect(store.getState().lastError).toBeNull();
    pending.resolve(user);
    await retrying;
  });

  it("logout drops the user and the error", async () => {
    const store = create();
    deps.login.mockResolvedValueOnce(user);
    await store.getState().login("ola", "secret");

    store.getState().logout();

    expect(store.getState()).toMatchObject({ user: null, lastError: null });
  });

  it("clearError resets lastError", async () => {
    const store = create();
    deps.login.mockRejectedValueOnce(new Error("x"));
    await store.getState().login("ola", "secret");

    store.getState().clearError();

    expect(store.getState().lastError).toBeNull();
  });
});
