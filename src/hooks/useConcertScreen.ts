import { useCallback, useMemo } from "react";

import { formatTime, FALLBACK_STAGE_ID, type StageCodes } from "@/components/mappers";
import { stageNumber } from "@/components/PerformanceCard";
import { stageCodesOf } from "@/hooks/planRows";
import type { Concert, Stage } from "@/domain/entities/Event";
import {
  selectIsCheckedIn,
  selectIsCheckInPending,
  selectIsPlanned,
  selectIsSchedulePending,
  useCheckInStore,
  useLineupStore,
  useScheduleStore,
} from "@/store";
import type { LoadStatus } from "@/store/optimistic";
import { strings } from "@/strings";

import { useSession } from "./useSession";

export interface ConcertScreen {
  readonly loadStatus: LoadStatus;
  readonly concert: Concert | null;
  readonly stage: Stage | null;
  readonly stageNum: number;
  readonly stageName: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly isCheckedIn: boolean;
  readonly checkInPending: boolean;
  readonly checkInNote: string | null;
  readonly isPlanned: boolean;
  readonly schedulePending: boolean;
  readonly checkIn: () => void;
  readonly togglePlan: () => void;
}

export function useConcertScreen(concertId: string): ConcertScreen {
  const { userId, eventId } = useSession();
  const loadStatus = useLineupStore((s) => s.loadStatus);
  const concert = useLineupStore((s) => s.concerts.find((c) => c.id === concertId) ?? null);
  const stages = useLineupStore((s) => s.stages);

  const stageCodes = useMemo(() => stageCodesOf(stages), [stages]);

  const stage = useMemo(
    () => (concert ? stages.find((s) => s.id === concert.stageId) ?? null : null),
    [concert, stages],
  );

  const stageId = stage ? (stageCodes[stage.id] ?? FALLBACK_STAGE_ID) : FALLBACK_STAGE_ID;
  const stageNum = stageNumber(stageId);
  const stageName = stage?.name ?? "";

  const startTime = concert ? formatTime(concert.startsAt) : "";
  const endTime = concert ? formatTime(concert.endsAt) : "";

  const isCheckedIn = useCheckInStore(selectIsCheckedIn(concertId));
  const checkInPending = useCheckInStore(selectIsCheckInPending(concertId));
  const checkInError = useCheckInStore((s) => s.lastError);
  const doCheckIn = useCheckInStore((s) => s.checkIn);

  const isPlanned = useScheduleStore(selectIsPlanned(concertId));
  const schedulePending = useScheduleStore(selectIsSchedulePending(concertId));
  const addToSchedule = useScheduleStore((s) => s.add);
  const removeFromSchedule = useScheduleStore((s) => s.remove);

  const checkInNote = useMemo((): string | null => {
    if (!checkInError) return null;
    if (checkInError.kind === "loadFailed") return null;
    if (checkInError.concertId !== concertId) return null;
    switch (checkInError.kind) {
      case "tooFar":
        return strings.concert.tooFar(Math.round(checkInError.distanceMeters));
      case "closed":
        return strings.concert.closed;
      case "locationUnavailable":
        return strings.concert.noLocation;
      default:
        return strings.concert.error;
    }
  }, [checkInError, concertId]);

  const checkIn = useCallback(() => {
    void doCheckIn(userId, eventId, concertId);
  }, [doCheckIn, userId, eventId, concertId]);

  const togglePlan = useCallback(() => {
    if (isPlanned) {
      void removeFromSchedule(concertId);
    } else {
      void addToSchedule(concertId);
    }
  }, [isPlanned, addToSchedule, removeFromSchedule, concertId]);

  return {
    loadStatus,
    concert,
    stage,
    stageNum,
    stageName,
    startTime,
    endTime,
    isCheckedIn,
    checkInPending,
    checkInNote,
    isPlanned,
    schedulePending,
    checkIn,
    togglePlan,
  };
}
