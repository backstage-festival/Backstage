import { useEffect, useState } from "react";

import type { CompassState } from "@/types/components";

import { type Announcement, shouldAnnounce } from "./tentRows";

/**
 * C06: the compass label TalkBack gets (polite live region) changes only on a
 * state change, a turn of more than 30° or after 10 s – not on every sensor
 * reading. Between those moments the last announced label is kept. An empty
 * label (place still loading) is never stored as announced.
 */
export function useThrottledA11yLabel(
  label: string,
  state: CompassState,
  angle: number,
  hasDistance: boolean,
): string {
  const [announced, setAnnounced] = useState<Announcement | null>(null);

  useEffect(() => {
    if (label === "") return;
    const nowMs = Date.now();
    // Returning `previous` unchanged skips the re-render.
    setAnnounced((previous) =>
      shouldAnnounce(previous, { state, angle, hasDistance }, nowMs)
        ? { label, state, angle, hasDistance, atMs: nowMs }
        : previous,
    );
  }, [label, state, angle, hasDistance]);

  return announced?.label ?? label;
}
