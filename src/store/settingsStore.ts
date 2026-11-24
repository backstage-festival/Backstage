import { createStore } from "zustand/vanilla";

import type { TextSizeSetting } from "@/theme/theme";

import type { LoadStatus } from "./optimistic";

/** user_settings.leave_alert_mode */
export type LeaveNowAlertSetting = "sound" | "vibrate" | "muted";
/** „Odłóż alert o” (S10). */
export type SnoozeMinutes = 5 | 10 | 15;

/**
 * S10 settings. Values and defaults follow the user_settings table and S10.
 * TODO(#32): user_settings has no column for snoozeMinutes – alert_lead_minutes
 * is the alert lead time, not the snooze length.
 */
export interface AccessibilitySettings {
  readonly highContrast: boolean;
  readonly colorVisionMode: boolean;
  readonly textSize: TextSizeSetting;
  /** null = follow the system setting (AccessibilityInfo). */
  readonly reduceMotion: boolean | null;
  readonly leaveNowAlerts: LeaveNowAlertSetting;
  readonly snoozeMinutes: SnoozeMinutes;
}

export type SettingKey = keyof AccessibilitySettings;

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  colorVisionMode: false,
  textSize: "standard",
  reduceMotion: null,
  leaveNowAlerts: "sound",
  snoozeMinutes: 5,
};

const SETTING_KEYS: readonly SettingKey[] = [
  "highContrast",
  "colorVisionMode",
  "textSize",
  "reduceMotion",
  "leaveNowAlerts",
  "snoozeMinutes",
];

export interface SettingsStoreDeps {
  // TODO(#32): settings repository / use case – no contract in src/domain yet.
  /** null = the user has no saved row yet, defaults apply. */
  readonly loadSettings: (userId: string) => Promise<AccessibilitySettings | null>;
  /**
   * Writes one key only, so a write never carries optimistic values of other keys
   * (a rollback would leave RAM and storage out of sync).
   * TODO(#32): UPDATE of one user_settings column – no contract in src/domain yet.
   */
  readonly saveSetting: <K extends SettingKey>(
    userId: string,
    key: K,
    value: AccessibilitySettings[K],
  ) => Promise<void>;
}

export type SettingsError =
  | { readonly kind: "saveFailed"; readonly key: SettingKey }
  | { readonly kind: "loadFailed" };

export interface SettingsData extends AccessibilitySettings {
  readonly userId: string | null;
  readonly loadStatus: LoadStatus;
  /** Keys with a write in flight. */
  readonly pendingKeys: ReadonlySet<SettingKey>;
  readonly lastError: SettingsError | null;
}

export interface SettingsState extends SettingsData {
  load(userId: string): Promise<boolean>;
  /**
   * Optimistic: the value applies at once. Before load() (no user) it is only
   * kept in RAM. Several taps on one key are allowed – the last one wins.
   */
  update<K extends SettingKey>(key: K, value: AccessibilitySettings[K]): Promise<boolean>;
  clearError(): void;
  /** Back to the defaults; late responses of earlier calls are dropped. */
  reset(): void;
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

type MutableSettings = { -readonly [K in SettingKey]: AccessibilitySettings[K] };

/** Only the six settings, without status fields. */
export const settingsOf = (state: AccessibilitySettings): AccessibilitySettings => ({
  highContrast: state.highContrast,
  colorVisionMode: state.colorVisionMode,
  textSize: state.textSize,
  reduceMotion: state.reduceMotion,
  leaveNowAlerts: state.leaveNowAlerts,
  snoozeMinutes: state.snoozeMinutes,
});

export const withSetting = <K extends SettingKey>(
  settings: AccessibilitySettings,
  key: K,
  value: AccessibilitySettings[K],
): AccessibilitySettings => {
  const next: MutableSettings = { ...settings };
  next[key] = value;
  return next;
};

const copyKey = <K extends SettingKey>(target: MutableSettings, source: AccessibilitySettings, key: K): void => {
  target[key] = source[key];
};

const initialSettingsData = (): SettingsData => ({
  ...DEFAULT_SETTINGS,
  userId: null,
  loadStatus: "idle",
  pendingKeys: new Set<SettingKey>(),
  lastError: null,
});

const withKey = (keys: ReadonlySet<SettingKey>, key: SettingKey): ReadonlySet<SettingKey> => {
  if (keys.has(key)) return keys;
  const next = new Set(keys);
  next.add(key);
  return next;
};

const withoutKey = (keys: ReadonlySet<SettingKey>, key: SettingKey): ReadonlySet<SettingKey> => {
  if (!keys.has(key)) return keys;
  const next = new Set(keys);
  next.delete(key);
  return next;
};

export function createSettingsStore(deps: SettingsStoreDeps) {
  let loadToken = 0;
  // Bumped by reset(): writes started before it must not touch the new state.
  let epoch = 0;
  // Per key: bumped by every update(). A failed write rolls back only if it is
  // still the latest write of its key – a newer tap must not be undone.
  const versions = new Map<SettingKey, number>();
  // Keys written since the current load started – local value is newer than the load.
  let settledKeys = new Set<SettingKey>();

  return createStore<SettingsState>()((set, get) => ({
    ...initialSettingsData(),

    async load(userId) {
      const token = ++loadToken;
      settledKeys = new Set<SettingKey>();
      set({ userId, loadStatus: "loading" });
      try {
        const loaded = (await deps.loadSettings(userId)) ?? DEFAULT_SETTINGS;
        if (token !== loadToken) return false;
        const state = get();
        const merged: MutableSettings = { ...settingsOf(state) };
        for (const key of SETTING_KEYS) {
          if (!state.pendingKeys.has(key) && !settledKeys.has(key)) copyKey(merged, loaded, key);
        }
        set({ ...merged, loadStatus: "ready" });
        return true;
      } catch {
        if (token !== loadToken) return false;
        set({ loadStatus: "error", lastError: { kind: "loadFailed" } });
        return false;
      }
    },

    async update(key, value) {
      const state = get();
      const previous = state[key];
      if (previous === value) return true;

      const version = (versions.get(key) ?? 0) + 1;
      versions.set(key, version);
      const isLatest = () => versions.get(key) === version;
      const startedIn = epoch;

      // 1. Optimistic change in RAM (0 ms) – the theme switches at once.
      set((current) => ({
        ...withSetting(settingsOf(current), key, value),
        pendingKeys: current.userId === null ? current.pendingKeys : withKey(current.pendingKeys, key),
        lastError: null,
      }));

      const { userId } = state;
      if (userId === null) return true;

      try {
        await deps.saveSetting(userId, key, value);
        if (startedIn !== epoch) return true;
        settledKeys.add(key);
        if (isLatest()) set((current) => ({ pendingKeys: withoutKey(current.pendingKeys, key) }));
        return true;
      } catch {
        if (startedIn !== epoch) return false;
        settledKeys.add(key);
        // 2. Roll back only this key, and only if no newer tap changed it meanwhile.
        if (!isLatest()) return false;
        set((current) => ({
          ...withSetting(settingsOf(current), key, previous),
          pendingKeys: withoutKey(current.pendingKeys, key),
          lastError: { kind: "saveFailed", key },
        }));
        return false;
      }
    },

    clearError() {
      set({ lastError: null });
    },

    reset() {
      loadToken += 1;
      epoch += 1;
      versions.clear();
      settledKeys = new Set<SettingKey>();
      set(initialSettingsData());
    },
  }));
}

export const selectIsSettingPending =
  (key: SettingKey) =>
  (state: SettingsState): boolean =>
    state.pendingKeys.has(key);
