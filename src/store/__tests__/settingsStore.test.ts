import {
  type AccessibilitySettings,
  createSettingsStore,
  DEFAULT_SETTINGS,
  selectIsSettingPending,
  type SettingKey,
  settingsOf,
  type SettingsStoreDeps,
  withSetting,
} from "../settingsStore";
import { deferred } from "../testing/deferred";

const saved: AccessibilitySettings = {
  highContrast: true,
  colorVisionMode: false,
  textSize: "large",
  reduceMotion: true,
  leaveNowAlerts: "vibrate",
  snoozeMinutes: 15,
};

describe("settingsStore", () => {
  const makeDeps = () => ({
    loadSettings: jest.fn<Promise<AccessibilitySettings | null>, [string]>(),
    saveSetting: jest.fn<Promise<void>, [string, SettingKey, AccessibilitySettings[SettingKey]]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const setup = async (row: AccessibilitySettings | null = null) => {
    deps.loadSettings.mockResolvedValueOnce(row);
    const store = createSettingsStore(deps satisfies SettingsStoreDeps);
    await store.getState().load("user-1");
    return store;
  };

  beforeEach(() => {
    deps = makeDeps();
  });

  describe("load", () => {
    it("uses the defaults before load()", () => {
      const store = createSettingsStore(deps);

      expect(settingsOf(store.getState())).toEqual(DEFAULT_SETTINGS);
      expect(store.getState().reduceMotion).toBeNull();
      expect(store.getState().loadStatus).toBe("idle");
    });

    it("loads the saved settings of the user", async () => {
      const store = await setup(saved);

      expect(deps.loadSettings).toHaveBeenCalledWith("user-1");
      expect(settingsOf(store.getState())).toEqual(saved);
      expect(store.getState()).toMatchObject({ userId: "user-1", loadStatus: "ready" });
    });

    it("keeps the defaults when the user has no saved row", async () => {
      const store = await setup(null);

      expect(settingsOf(store.getState())).toEqual(DEFAULT_SETTINGS);
      expect(store.getState().loadStatus).toBe("ready");
    });

    it("keeps the defaults and sets loadFailed when loading fails", async () => {
      deps.loadSettings.mockRejectedValueOnce(new Error("db"));
      const store = createSettingsStore(deps);

      await expect(store.getState().load("user-1")).resolves.toBe(false);
      expect(settingsOf(store.getState())).toEqual(DEFAULT_SETTINGS);
      expect(store.getState().lastError).toEqual({ kind: "loadFailed" });
      expect(store.getState().loadStatus).toBe("error");
    });

    it("ignores an older load that finishes after a newer one", async () => {
      const first = deferred<AccessibilitySettings | null>();
      deps.loadSettings.mockReturnValueOnce(first.promise).mockResolvedValueOnce(saved);
      const store = createSettingsStore(deps);

      const older = store.getState().load("user-1");
      await store.getState().load("user-1");
      first.resolve(DEFAULT_SETTINGS);

      await expect(older).resolves.toBe(false);
      expect(store.getState().highContrast).toBe(true);
    });

    it("keeps a change made while the load was in flight", async () => {
      const loading = deferred<AccessibilitySettings | null>();
      deps.loadSettings.mockReturnValueOnce(loading.promise);
      deps.saveSetting.mockResolvedValue();
      const store = createSettingsStore(deps);

      const load = store.getState().load("user-1");
      await store.getState().update("textSize", "xlarge");
      loading.resolve(saved);
      await load;

      expect(store.getState().textSize).toBe("xlarge");
      // Keys the user did not touch come from the load.
      expect(store.getState().highContrast).toBe(true);
    });
  });

  describe("update", () => {
    it("applies the value before the write finishes", async () => {
      const store = await setup();
      const writing = deferred<void>();
      deps.saveSetting.mockReturnValueOnce(writing.promise);

      const updating = store.getState().update("highContrast", true);

      expect(store.getState().highContrast).toBe(true);
      expect(selectIsSettingPending("highContrast")(store.getState())).toBe(true);

      writing.resolve();
      await expect(updating).resolves.toBe(true);
      expect(selectIsSettingPending("highContrast")(store.getState())).toBe(false);
      expect(deps.saveSetting).toHaveBeenCalledWith("user-1", "highContrast", true);
    });

    it("rolls back only the failed key", async () => {
      const store = await setup();
      const failing = deferred<void>();
      deps.saveSetting.mockReturnValueOnce(failing.promise).mockResolvedValueOnce();

      const contrast = store.getState().update("highContrast", true);
      await store.getState().update("snoozeMinutes", 15);
      failing.reject(new Error("disk full"));

      await expect(contrast).resolves.toBe(false);
      expect(store.getState().highContrast).toBe(false);
      expect(store.getState().snoozeMinutes).toBe(15);
      expect(store.getState().lastError).toEqual({ kind: "saveFailed", key: "highContrast" });
      expect(selectIsSettingPending("highContrast")(store.getState())).toBe(false);
    });

    it("does not roll back a key that a newer tap changed meanwhile", async () => {
      const store = await setup();
      const first = deferred<void>();
      const second = deferred<void>();
      deps.saveSetting.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      const large = store.getState().update("textSize", "large");
      const xlarge = store.getState().update("textSize", "xlarge");
      first.reject(new Error("disk full"));

      await expect(large).resolves.toBe(false);
      expect(store.getState().textSize).toBe("xlarge");
      expect(store.getState().lastError).toBeNull();
      // Still pending: the newer write has not settled.
      expect(selectIsSettingPending("textSize")(store.getState())).toBe(true);

      second.resolve();
      await expect(xlarge).resolves.toBe(true);
      expect(selectIsSettingPending("textSize")(store.getState())).toBe(false);
    });

    it("keeps storage equal to RAM after a rollback while another key was written", async () => {
      // Fake user_settings row: each write changes one key, a write can be held or failed by hand.
      let row: AccessibilitySettings = DEFAULT_SETTINGS;
      const contrastWrite = deferred<void>();
      deps.loadSettings.mockResolvedValueOnce(null);
      deps.saveSetting.mockImplementation(async (_userId, key, value) => {
        if (key === "highContrast") await contrastWrite.promise;
        row = withSetting(row, key, value);
      });
      const store = createSettingsStore(deps);
      await store.getState().load("user-1");

      // A: contrast on, write in flight. B: snooze change, written while A is pending.
      const a = store.getState().update("highContrast", true);
      await store.getState().update("snoozeMinutes", 15);
      // A fails.
      contrastWrite.reject(new Error("disk full"));
      await a;

      expect(settingsOf(store.getState())).toEqual(row);
      expect(row.highContrast).toBe(false);
      expect(row.snoozeMinutes).toBe(15);
    });

    it("rolls back the newest tap to the value of the previous tap", async () => {
      const store = await setup();
      deps.saveSetting.mockResolvedValueOnce().mockRejectedValueOnce(new Error("disk full"));

      await store.getState().update("leaveNowAlerts", "vibrate");
      await store.getState().update("leaveNowAlerts", "muted");

      expect(store.getState().leaveNowAlerts).toBe("vibrate");
    });

    it("stores null for reduceMotion (follow the system)", async () => {
      const store = await setup(saved);
      deps.saveSetting.mockResolvedValueOnce();

      await store.getState().update("reduceMotion", null);

      expect(store.getState().reduceMotion).toBeNull();
    });

    it("does not write when the value does not change", async () => {
      const store = await setup();

      await expect(store.getState().update("textSize", "standard")).resolves.toBe(true);
      expect(deps.saveSetting).not.toHaveBeenCalled();
    });

    it("keeps the value in RAM only before load()", async () => {
      const store = createSettingsStore(deps);

      await expect(store.getState().update("highContrast", true)).resolves.toBe(true);
      expect(store.getState().highContrast).toBe(true);
      expect(store.getState().pendingKeys.size).toBe(0);
      expect(deps.saveSetting).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("goes back to the defaults", async () => {
      const store = await setup(saved);

      store.getState().reset();

      expect(settingsOf(store.getState())).toEqual(DEFAULT_SETTINGS);
      expect(store.getState()).toMatchObject({ userId: null, loadStatus: "idle", lastError: null });
    });

    it("drops a load that finishes after reset", async () => {
      const loading = deferred<AccessibilitySettings | null>();
      deps.loadSettings.mockReturnValueOnce(loading.promise);
      const store = createSettingsStore(deps);

      const load = store.getState().load("user-1");
      store.getState().reset();
      loading.resolve(saved);

      await expect(load).resolves.toBe(false);
      expect(settingsOf(store.getState())).toEqual(DEFAULT_SETTINGS);
      expect(store.getState().loadStatus).toBe("idle");
    });

    it("drops a write that fails after reset (no rollback into the new state)", async () => {
      const store = await setup();
      const writing = deferred<void>();
      deps.saveSetting.mockReturnValueOnce(writing.promise);

      const updating = store.getState().update("highContrast", true);
      store.getState().reset();
      deps.loadSettings.mockResolvedValueOnce({ ...DEFAULT_SETTINGS, highContrast: true });
      await store.getState().load("user-2");
      writing.reject(new Error("disk full"));

      await expect(updating).resolves.toBe(false);
      expect(store.getState().highContrast).toBe(true);
      expect(store.getState().lastError).toBeNull();
      expect(store.getState().pendingKeys.size).toBe(0);
    });
  });
});
