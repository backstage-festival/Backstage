import type { Unsubscribe } from "@/domain/entities/common";

import {
  createConnectionStore,
  toConnectionBarState,
} from "../connectionStore";
import { deferred } from "../testing/deferred";

describe("connectionStore", () => {
  let listener: ((online: boolean) => void) | null;
  let initial: ReturnType<typeof deferred<boolean>>;
  const unsubscribe = jest.fn<void, []>();
  const makeNetwork = () => ({
    isOnline: jest.fn<Promise<boolean>, []>(() => initial.promise),
    onChange: jest.fn<Unsubscribe, [(online: boolean) => void]>((next) => {
      listener = next;
      return unsubscribe;
    }),
  });
  let network: ReturnType<typeof makeNetwork>;
  let onOnline: jest.Mock<void, []>;

  const emit = (online: boolean): void => {
    if (listener === null) throw new Error("not subscribed");
    listener(online);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2027-07-10T18:00:00Z"));
    listener = null;
    initial = deferred<boolean>();
    unsubscribe.mockClear();
    network = makeNetwork();
    onOnline = jest.fn<void, []>();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts unknown and takes the state from isOnline()", async () => {
    const store = createConnectionStore({ network, onOnline });
    expect(store.getState().online).toBeNull();

    store.getState().start();
    initial.resolve(true);
    await initial.promise;

    expect(store.getState().online).toBe(true);
    expect(store.getState().lastOnlineAt).toBe("2027-07-10T18:00:00.000Z");
    // null → true is not an offline → online transition.
    expect(onOnline).not.toHaveBeenCalled();
  });

  it("calls onOnline on an offline → online transition only", async () => {
    const store = createConnectionStore({ network, onOnline });
    store.getState().start();
    initial.resolve(false);
    await initial.promise;

    expect(store.getState()).toMatchObject({ online: false, lastOnlineAt: null });

    jest.setSystemTime(new Date("2027-07-10T18:05:00Z"));
    emit(true);
    emit(true);

    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(store.getState().lastOnlineAt).toBe("2027-07-10T18:05:00.000Z");

    emit(false);
    expect(store.getState().online).toBe(false);
    expect(store.getState().lastOnlineAt).toBe("2027-07-10T18:05:00.000Z");
  });

  it("ignores a stale isOnline() answer that arrives after onChange", async () => {
    const store = createConnectionStore({ network });
    store.getState().start();

    emit(true);
    initial.resolve(false);
    await initial.promise;

    expect(store.getState().online).toBe(true);
  });

  it("does not subscribe twice and can be restarted after stopping", () => {
    const store = createConnectionStore({ network });

    const stop = store.getState().start();
    expect(store.getState().start()).toBe(stop);
    expect(network.onChange).toHaveBeenCalledTimes(1);

    stop();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    store.getState().start();
    expect(network.onChange).toHaveBeenCalledTimes(2);
  });

  it("stays unknown when isOnline() rejects", async () => {
    network.isOnline.mockRejectedValueOnce(new Error("no NetInfo"));
    const store = createConnectionStore({ network });

    store.getState().start();
    await Promise.resolve();

    expect(store.getState().online).toBeNull();
  });
});

describe("toConnectionBarState", () => {
  it.each([
    [{ online: true, syncing: true, hasData: true }, "syncing"],
    [{ online: true, syncing: true, hasData: false }, "syncing"],
    [{ online: null, syncing: true, hasData: true }, "syncing"],
    [{ online: false, syncing: true, hasData: true }, "offline"],
    [{ online: true, syncing: false, hasData: false }, "noData"],
    [{ online: false, syncing: false, hasData: false }, "noData"],
    [{ online: false, syncing: false, hasData: true }, "offline"],
    [{ online: true, syncing: false, hasData: true }, "online"],
    [{ online: null, syncing: false, hasData: true }, "online"],
  ] as const)("%p → %s", (input, expected) => {
    expect(toConnectionBarState(input)).toBe(expected);
  });
});
