import { useCallback } from "react";

import type { DownloadStep } from "@/infrastructure/sync/EventPackageDownloader";
import { lineupStore, usePrepareStore } from "@/store";
import type { PreparePhase } from "@/store/prepareStore";
import { strings } from "@/strings";

import { useSession } from "./useSession";

export interface PrepareScreen {
  readonly phase: PreparePhase;
  readonly currentStep: string | null;
  readonly completed: number;
  readonly total: number;
  readonly progressLabel: string | null;
  readonly download: () => void;
}

export function usePrepareScreen(): PrepareScreen {
  const { eventId } = useSession();
  const phase = usePrepareStore((s) => s.phase);
  const progress = usePrepareStore((s) => s.progress);
  const start = usePrepareStore((s) => s.start);

  const download = useCallback(() => {
    void start(eventId).then((ok) => {
      if (ok) void lineupStore.getState().load(eventId);
    });
  }, [start, eventId]);

  const currentStep = progress ? (strings.prepare.steps[progress.step] ?? null) : null;
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;

  const progressLabel =
    currentStep && total > 0
      ? strings.prepare.a11y.progress(currentStep, completed, total)
      : null;

  return { phase, currentStep, completed, total, progressLabel, download };
}
