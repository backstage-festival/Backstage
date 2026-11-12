import { DomainError } from "../errors/DomainError";

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** Shortest signed angular distance from `a` to `b`, in degrees, in range (-180, 180]. */
const shortestDelta = (a: number, b: number): number => {
  const diff = normalizeDegrees(b - a + 180) - 180;
  return diff === -180 ? 180 : diff;
};

export class HeadingSmoother {
  private smoothed: number | null = null;

  constructor(private readonly smoothingFactor: number = 0.2) {
    if (!Number.isFinite(smoothingFactor) || smoothingFactor <= 0 || smoothingFactor > 1) {
      throw new DomainError("INVALID_ARGUMENT", "smoothingFactor must be a finite number in (0, 1]");
    }
  }

  update(degrees: number): number {
    if (!Number.isFinite(degrees)) {
      return this.smoothed ?? 0;
    }

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
