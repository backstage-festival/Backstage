import { useEffect, useState } from "react";

/** S06 / S08: time-based states („Nieaktualna”, „Nie zdążysz”) refresh every 30 s. */
export const NOW_TICK_MS = 30_000;

/**
 * The current time, refreshed by one interval per caller (cleared on
 * unmount). Pass the result to selectors as `now`, so a screen re-renders
 * on its own clock tick instead of on every store change.
 */
export function useNow(intervalMs: number = NOW_TICK_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
