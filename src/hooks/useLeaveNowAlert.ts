import { formatTime } from "@/components/mappers";
import { demoConcerts } from "@/mocks/demoData";
import { mockStages } from "@/mocks/mockData";
import { selectIsPlanned, useScheduleStore } from "@/store";
import { strings } from "@/strings";
import type { LeaveNowAlertProps } from "@/types/components";

export type LeaveNowAlertData = Omit<LeaveNowAlertProps, "onGuide" | "onSnooze" | "onMute" | "testID">;

const MINUTE_MS = 60_000;
/** C02: the alert shows up to 15 min before leaving (longest lead time in settings). */
const ALERT_WINDOW_MIN = 15;
/** C02: „Za 5 min” is disabled when less than 5 minutes are left. */
const MIN_SNOOZE_MIN = 5;

// TEMP: until CalculateLeaveTimeUseCase is wired (#32) – fixed concert and distance from E04.
const ALERT_CONCERT_ID = "c-wilga-i-fale";
const ALERT_DISTANCE_M = 450;

/**
 * Data for the „Wyjdź teraz” slot above the Plan filters, or null when
 * there is nothing to leave for. Mock until the use case is wired (#32).
 */
export function useLeaveNowAlert(now: Date): LeaveNowAlertData | null {
  const planned = useScheduleStore(selectIsPlanned(ALERT_CONCERT_ID));

  const concert = demoConcerts.find((c) => c.id === ALERT_CONCERT_ID);
  const stage = mockStages.find((s) => s.id === concert?.stageId);
  if (!planned || concert === undefined || stage === undefined) return null;

  const minutes = Math.ceil((Date.parse(concert.startsAt) - now.getTime()) / MINUTE_MS);
  if (minutes <= 0 || minutes > ALERT_WINDOW_MIN) return null;

  return {
    kind: "stage",
    eyebrow: strings.leaveNow.eyebrow(minutes, stage.name),
    meta: strings.leaveNow.meta(concert.artist, formatTime(concert.startsAt), ALERT_DISTANCE_M),
    announcement: strings.leaveNow.a11y.announce(concert.artist, stage.name, minutes, ALERT_DISTANCE_M),
    mode: "soundAndVibration",
    snoozeMinutes: 5,
    canSnooze: minutes >= MIN_SNOOZE_MIN,
  };
}
