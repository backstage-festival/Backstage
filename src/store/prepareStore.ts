import { createStore } from "zustand/vanilla";

import type { DownloadProgress, DownloadStep } from "@/infrastructure/sync/EventPackageDownloader";

export interface PrepareStoreDeps {
  readonly download: (
    eventId: string,
    onProgress?: (progress: DownloadProgress) => void,
  ) => Promise<void>;
}

export type PreparePhase = "idle" | "downloading" | "done" | "error";

export interface PrepareData {
  readonly phase: PreparePhase;
  readonly progress: DownloadProgress | null;
}

export interface PrepareState extends PrepareData {
  start(eventId: string): Promise<boolean>;
  reset(): void;
}

export type PrepareStore = ReturnType<typeof createPrepareStore>;

const initialData = (): PrepareData => ({
  phase: "idle",
  progress: null,
});

export function createPrepareStore(deps: PrepareStoreDeps) {
  let token = 0;

  return createStore<PrepareState>()((set) => ({
    ...initialData(),

    async start(eventId) {
      const t = ++token;
      set({ phase: "downloading", progress: null });
      try {
        await deps.download(eventId, (p) => {
          if (t !== token) return;
          set({ progress: p });
        });
        if (t !== token) return false;
        set({ phase: "done" });
        return true;
      } catch {
        if (t !== token) return false;
        set({ phase: "error" });
        return false;
      }
    },

    reset() {
      token += 1;
      set(initialData());
    },
  }));
}
