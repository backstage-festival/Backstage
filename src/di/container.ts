import { getSupabase } from "@/infrastructure/api/supabaseClient";
import { SupabaseEventApiClient } from "@/infrastructure/api/SupabaseEventApiClient";
import { SupabaseMessageGateway } from "@/infrastructure/api/SupabaseMessageGateway";
import { CkanClient } from "@/infrastructure/api/CkanClient";
import { OpenMeteoClient } from "@/infrastructure/api/OpenMeteoClient";
import { BcryptPasswordHasher } from "@/infrastructure/auth/BcryptPasswordHasher";
import { ExpoLocationService } from "@/infrastructure/location/ExpoLocationService";
import { SqliteBadgeRepository } from "@/infrastructure/storage/repositories/SqliteBadgeRepository";
import { SqliteCheckInRepository } from "@/infrastructure/storage/repositories/SqliteCheckInRepository";
import { SqliteEventRepository } from "@/infrastructure/storage/repositories/SqliteEventRepository";
import { SqliteOutboxRepository } from "@/infrastructure/storage/repositories/SqliteOutboxRepository";
import { SqliteSavedPlaceRepository } from "@/infrastructure/storage/repositories/SqliteSavedPlaceRepository";
import { SqliteScheduleRepository } from "@/infrastructure/storage/repositories/SqliteScheduleRepository";
import { SqliteTransitRepository } from "@/infrastructure/storage/repositories/SqliteTransitRepository";
import { SqliteUserRepository } from "@/infrastructure/storage/repositories/SqliteUserRepository";
import { SqliteWeatherRepository } from "@/infrastructure/storage/repositories/SqliteWeatherRepository";
import { EventPackageDownloader } from "@/infrastructure/sync/EventPackageDownloader";
import { AddToScheduleUseCase } from "@/use-cases/AddToScheduleUseCase";
import { CheckInUseCase } from "@/use-cases/CheckInUseCase";
import { GetBadgesUseCase } from "@/use-cases/GetBadgesUseCase";
import { GetNearbyStopsUseCase } from "@/use-cases/GetNearbyStopsUseCase";
import { LoginUseCase } from "@/use-cases/LoginUseCase";
import { QueueMessageUseCase } from "@/use-cases/QueueMessageUseCase";
import { RegisterUseCase } from "@/use-cases/RegisterUseCase";
import { RetryMessageUseCase } from "@/use-cases/RetryMessageUseCase";
import { SavePlaceUseCase } from "@/use-cases/SavePlaceUseCase";
import { SyncOutboxUseCase } from "@/use-cases/SyncOutboxUseCase";
import type { AuthStoreDeps } from "@/store/authStore";
import type { CheckInStoreDeps } from "@/store/checkInStore";
import type { ConnectionStoreDeps } from "@/store/connectionStore";
import type { LineupStoreDeps } from "@/store/lineupStore";
import type { MessageStoreDeps } from "@/store/messageStore";
import type { PlacesStoreDeps } from "@/store/placesStore";
import type { ScheduleStoreDeps } from "@/store/scheduleStore";
import type { SettingsStoreDeps } from "@/store/settingsStore";
import type { TransitStoreDeps } from "@/store/transitStore";
import type { AccessibilitySettings, SettingKey } from "@/store/settingsStore";
import { withSetting, DEFAULT_SETTINGS } from "@/store/settingsStore";
import type { INetworkService } from "@/domain/repositories/INetworkService";
import type { Unsubscribe } from "@/domain/entities/common";
import { getDb } from "@/infrastructure/storage/database";
import { expoIdGenerator } from "./ExpoIdGenerator";

// ---------------------------------------------------------------------------
// Infrastructure singletons
// ---------------------------------------------------------------------------

const supabase = getSupabase();

const eventRepository = new SqliteEventRepository();
const scheduleRepository = new SqliteScheduleRepository();
const outboxRepository = new SqliteOutboxRepository();
const checkInRepository = new SqliteCheckInRepository();
const userRepository = new SqliteUserRepository();
const savedPlaceRepository = new SqliteSavedPlaceRepository();
const transitRepository = new SqliteTransitRepository();
const badgeRepository = new SqliteBadgeRepository();
const weatherRepository = new SqliteWeatherRepository();
const passwordHasher = new BcryptPasswordHasher();
const locationService = new ExpoLocationService();
const messageGateway = new SupabaseMessageGateway(supabase);

const eventApiClient = new SupabaseEventApiClient(supabase);
const ckanClient = new CkanClient();
const openMeteoClient = new OpenMeteoClient();

// ---------------------------------------------------------------------------
// Network service (simple implementation using expo-network when available,
// falls back to navigator.onLine until #56 merges NetInfoNetworkService)
// ---------------------------------------------------------------------------

const networkListeners = new Set<(online: boolean) => void>();

const networkService: INetworkService = {
  isOnline: async () => {
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return navigator.onLine;
    }
    return true;
  },
  onChange: (listener): Unsubscribe => {
    networkListeners.add(listener);

    const handleOnline = () => listener(true);
    const handleOffline = () => listener(false);

    if (typeof addEventListener === "function") {
      addEventListener("online", handleOnline);
      addEventListener("offline", handleOffline);
    }

    return () => {
      networkListeners.delete(listener);
      if (typeof removeEventListener === "function") {
        removeEventListener("online", handleOnline);
        removeEventListener("offline", handleOffline);
      }
    };
  },
};

// ---------------------------------------------------------------------------
// Settings repository (reads/writes user_settings in SQLite)
// ---------------------------------------------------------------------------

interface SettingsRow {
  high_contrast: number;
  cvd_patterns: number;
  text_scale: number;
  reduce_motion: number;
  leave_alert_mode: string;
  alert_lead_minutes: number;
  snoozed_until: string | null;
  updated_at: string;
}

function toAccessibilitySettings(row: SettingsRow): AccessibilitySettings {
  return {
    highContrast: row.high_contrast === 1,
    colorVisionMode: row.cvd_patterns === 1,
    textSize: row.text_scale === 200 ? "xlarge" : row.text_scale === 150 ? "large" : "standard",
    reduceMotion: row.reduce_motion === 1 ? true : row.reduce_motion === 0 ? false : null,
    leaveNowAlerts: row.leave_alert_mode as AccessibilitySettings["leaveNowAlerts"],
    snoozeMinutes: row.alert_lead_minutes as AccessibilitySettings["snoozeMinutes"],
  };
}

const settingsLoadSave = {
  loadSettings: async (userId: string): Promise<AccessibilitySettings | null> => {
    const db = await getDb();
    const row = await db.getFirstAsync<SettingsRow>(
      "SELECT * FROM user_settings WHERE user_id = ?",
      [userId],
    );
    return row ? toAccessibilitySettings(row) : null;
  },

  saveSetting: async <K extends SettingKey>(
    userId: string,
    key: K,
    value: AccessibilitySettings[K],
  ): Promise<void> => {
    const db = await getDb();
    const existing = await settingsLoadSave.loadSettings(userId);
    const settings = withSetting(existing ?? DEFAULT_SETTINGS, key, value);
    const now = new Date().toISOString();
    const textScale = settings.textSize === "xlarge" ? 200 : settings.textSize === "large" ? 150 : 100;

    await db.runAsync(
      `INSERT INTO user_settings
         (user_id, high_contrast, cvd_patterns, text_scale, reduce_motion,
          leave_alert_mode, alert_lead_minutes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         high_contrast = excluded.high_contrast,
         cvd_patterns = excluded.cvd_patterns,
         text_scale = excluded.text_scale,
         reduce_motion = excluded.reduce_motion,
         leave_alert_mode = excluded.leave_alert_mode,
         alert_lead_minutes = excluded.alert_lead_minutes,
         updated_at = excluded.updated_at`,
      [
        userId,
        settings.highContrast ? 1 : 0,
        settings.colorVisionMode ? 1 : 0,
        textScale,
        settings.reduceMotion === null ? 0 : settings.reduceMotion ? 1 : 0,
        settings.leaveNowAlerts,
        settings.snoozeMinutes,
        now,
      ],
    );
  },
};

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

const loginUseCase = new LoginUseCase(userRepository, passwordHasher);
const registerUseCase = new RegisterUseCase(userRepository, passwordHasher, expoIdGenerator);
const addToScheduleUseCase = new AddToScheduleUseCase(eventRepository, scheduleRepository);
const checkInUseCase = new CheckInUseCase(eventRepository, checkInRepository, locationService, expoIdGenerator);
const getBadgesUseCase = new GetBadgesUseCase(eventRepository, checkInRepository, badgeRepository);
const queueMessageUseCase = new QueueMessageUseCase(outboxRepository, expoIdGenerator);
const retryMessageUseCase = new RetryMessageUseCase(outboxRepository);
const syncOutboxUseCase = new SyncOutboxUseCase(outboxRepository, messageGateway, networkService);
const getNearbyStopsUseCase = new GetNearbyStopsUseCase(transitRepository, locationService);
const savePlaceUseCase = new SavePlaceUseCase(savedPlaceRepository, locationService, expoIdGenerator);

const eventPackageDownloader = new EventPackageDownloader(eventApiClient, ckanClient, openMeteoClient);

// ---------------------------------------------------------------------------
// Store deps — the only export; store/index.ts uses these instead of mocks
// ---------------------------------------------------------------------------

export const authDeps: AuthStoreDeps = {
  login: (login, password) => loginUseCase.execute({ login, password }),
  register: (login, password) => registerUseCase.execute({ login, password }),
};

export const scheduleDeps: ScheduleStoreDeps = {
  addToSchedule: addToScheduleUseCase,
  loadSchedule: (userId) => scheduleRepository.getForUser(userId),
  removeFromSchedule: (userId, concertId) => scheduleRepository.remove(userId, concertId),
};

export const messageDeps: MessageStoreDeps = {
  queueMessage: queueMessageUseCase,
  retryMessage: retryMessageUseCase,
  syncOutbox: syncOutboxUseCase,
  loadMessages: (crewId) => outboxRepository.getForCrew(crewId),
};

export const checkInDeps: CheckInStoreDeps = {
  checkIn: checkInUseCase,
  loadCheckIns: (userId) => checkInRepository.getForUser(userId),
};

export const lineupDeps: LineupStoreDeps = {
  loadLineup: async (eventId) => {
    const [event, stages, concerts] = await Promise.all([
      eventRepository.getCurrentEvent(),
      eventRepository.getStages(eventId),
      eventRepository.getConcerts(eventId),
    ]);
    return { event: event?.id === eventId ? event : null, stages, concerts };
  },
};

export const transitDeps: TransitStoreDeps = {
  getNearbyStops: getNearbyStopsUseCase,
  loadDepartures: async (stopIds) => {
    const lists = await Promise.all(stopIds.map((id) => transitRepository.getDepartures(id)));
    return lists.flat();
  },
  loadAlerts: () => transitRepository.getAlerts(),
};

export const connectionDeps: Omit<ConnectionStoreDeps, "onOnline"> = {
  network: networkService,
};

export const settingsDeps: SettingsStoreDeps = settingsLoadSave;

export const placesDeps: PlacesStoreDeps = {
  savePlace: savePlaceUseCase,
  location: locationService,
  loadPlaces: (userId) => savedPlaceRepository.getForUser(userId),
  removePlace: (placeId) => savedPlaceRepository.remove(placeId),
  renamePlace: (place) => savedPlaceRepository.save(place),
};

export { getBadgesUseCase, eventPackageDownloader, locationService, networkService };
