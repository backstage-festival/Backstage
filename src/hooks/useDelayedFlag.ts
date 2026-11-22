import { useEffect, useState } from "react";

/**
 * True only after `active` has stayed true for `delayMs` (X-Stan: the
 * loading skeleton appears after 300 ms, so quick reads never flash it).
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return active && shown;
}
