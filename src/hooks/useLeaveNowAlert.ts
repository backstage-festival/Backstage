import { formatTime, leaveNowModeOf } from "@/components/mappers";
import { demoConcerts } from "@/mocks/demoData";
import { mockStages } from "@/mocks/mockData";
import { selectIsPlanned, useScheduleStore, useSettingsStore } from "@/store";
import { strings } from "@/strings";
import type { LeaveNowAlertProps } from "@/types/components";

export type LeaveNowAlertData = Omit<LeaveNowAlertProps, "onGuide" | "onSnooze" | "onMute" | "testID">;

const MINUTE_MS = 60_000;
/** C02: the alert shows up to 15 min before leaving (longest lead time in settings). */
const ALERT_WINDOW_MIN = 15;

// TEMP: until CalculateLeaveTimeUseCase is wired (#32) – fixed concert and distance from E04.
const ALERT_CONCERT_ID = "c-wilga-i-fale";
const ALERT_DISTANCE_M = 450;

/**
 * Data for the „Wyjdź teraz” slot above the Plan filters, or null when
 * there is nothing to leave for. Mock until the use case is wired (#32).
 */
export function useLeaveNowAlert(now: Date): LeaveNowAlertData | null {
  const planned = useScheduleStore(selectIsPlanned(ALERT_CONCERT_ID));
  const alertSetting = useSettingsStore((state) => state.leaveNowAlerts);
  const snoozeMinutes = useSettingsStore((state) => state.snoozeMinutes);

  const concert = demoConcerts.find((c) => c.id === ALERT_CONCERT_ID);
  const stage = mockStages.find((s) => s.id === concert?.stageId);
  if (!planned || concert === undefined || stage === undefined) return null;

  const minutes = Math.ceil((Date.parse(concert.startsAt) - now.getTime()) / MINUTE_MS);
  if (minutes <= 0 || minutes > ALERT_WINDOW_MIN) return null;

  return leaveNowAlertData(concert.artist, stage.name, concert.startsAt, minutes, {
    mode: leaveNowModeOf(alertSetting),
    snoozeMinutes,
  });
}

/** Shared by the Plan slot and the S10 live preview. */
export function leaveNowAlertData(
  artist: string,
  stageName: string,
  startsAt: string,
  minutes: number,
  settings: Pick<LeaveNowAlertData, "mode" | "snoozeMinutes">,
): LeaveNowAlertData {
  return {
    kind: "stage",
    eyebrow: strings.leaveNow.eyebrow(minutes, stageName),
    meta: strings.leaveNow.meta(artist, formatTime(startsAt), ALERT_DISTANCE_M),
    announcement: strings.leaveNow.a11y.announce(artist, stageName, minutes, ALERT_DISTANCE_M),
    mode: settings.mode,
    snoozeMinutes: settings.snoozeMinutes,
    // C02: „Za 5 min” is disabled with less than 5 min left – generalised to the S10 snooze length.
    canSnooze: minutes >= settings.snoozeMinutes,
  };
}
