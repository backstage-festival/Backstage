const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** Shortest signed angular distance from `a` to `b`, in degrees, in range (-180, 180]. */
const shortestDelta = (a: number, b: number): number => {
  const diff = normalizeDegrees(b - a + 180) - 180;
  return diff === -180 ? 180 : diff;
};

/**
 * Exponential smoothing for compass heading, so the compass needle doesn't
 * jitter with raw sensor noise. Handles the 0°/360° wrap-around correctly.
 */
export class HeadingSmoother {
  private smoothed: number | null = null;

  constructor(private readonly smoothingFactor: number = 0.2) {
    if (smoothingFactor <= 0 || smoothingFactor > 1) {
      throw new Error("smoothingFactor must be in (0, 1]");
    }
  }

  update(degrees: number): number {
    const normalized = normalizeDegrees(degrees);
    if (this.smoothed === null) {
      this.smoothed = normalized;
      return this.smoothed;
    }

    const delta = shortestDelta(this.smoothed, normalized);
    this.smoothed = normalizeDegrees(this.smoothed + this.smoothingFactor * delta);
    return this.smoothed;
  }

  reset(): void {
    this.smoothed = null;
  }
}
