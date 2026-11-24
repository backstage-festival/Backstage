import { leaveNowModeOf, type PerformanceCardData, toPerformanceCardProps } from "@/components/mappers";
import { mockClock, mockConcerts, mockStageCodes, mockStages } from "@/mocks/mockData";
import { useSettingsStore } from "@/store";

import { type LeaveNowAlertData, leaveNowAlertData } from "./useLeaveNowAlert";

// TEMP: fixed mock concerts for the S10 preview – the alert as on Plan (C02, E04),
// the card in conflict (E11), so „Wzory zamiast koloru” shows on its status tag.
const PREVIEW_CONCERT_ID = "c-wilga-i-fale";
const PREVIEW_CARD_ID = "c-hanna-sieradz";
const PREVIEW_CONFLICT_ID = "c-mewy-noca";
const PREVIEW_MINUTES = 12;

export interface AccessibilityPreview {
  readonly alert: LeaveNowAlertData | null;
  readonly card: PerformanceCardData | null;
}

/**
 * Data for the S10 „Podgląd na żywo”: the Plan alert and card built from mocks.
 * The theme comes from ThemeProvider, so the preview follows every switch;
 * mode and snooze length come from the settings store.
 */
export function useAccessibilityPreview(): AccessibilityPreview {
  const alertSetting = useSettingsStore((state) => state.leaveNowAlerts);
  const snoozeMinutes = useSettingsStore((state) => state.snoozeMinutes);

  const concert = mockConcerts.find((c) => c.id === PREVIEW_CONCERT_ID);
  const stage = mockStages.find((s) => s.id === concert?.stageId);
  if (concert === undefined || stage === undefined) return { alert: null, card: null };
  const cardConcert = mockConcerts.find((c) => c.id === PREVIEW_CARD_ID);
  const cardStage = mockStages.find((s) => s.id === cardConcert?.stageId);
  const conflict = mockConcerts.find((c) => c.id === PREVIEW_CONFLICT_ID);
  const conflictStage = mockStages.find((s) => s.id === conflict?.stageId);

  return {
    alert: {
      ...leaveNowAlertData(concert.artist, stage.name, concert.startsAt, PREVIEW_MINUTES, {
        mode: leaveNowModeOf(alertSetting),
        snoozeMinutes,
      }),
      // The preview is hidden from TalkBack and must not announce itself.
      announcement: "",
    },
    card:
      cardConcert === undefined || cardStage === undefined
        ? null
        : toPerformanceCardProps(cardConcert, cardStage, {
            inPlan: true,
            stageCodes: mockStageCodes,
            now: mockClock.plan,
            ...(conflict && conflictStage ? { conflictWith: { concert: conflict, stage: conflictStage } } : null),
          }),
  };
}
