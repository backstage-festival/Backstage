import { HeadingSmoother } from "../headingSmoother";

describe("HeadingSmoother", () => {
  it("returns the first reading as-is", () => {
    const smoother = new HeadingSmoother(0.5);
    expect(smoother.update(90)).toBe(90);
  });

  it("moves the smoothed value only partway towards a new reading", () => {
    const smoother = new HeadingSmoother(0.5);
    smoother.update(0);
    expect(smoother.update(90)).toBe(45);
  });

  it("converges towards a steady reading over repeated updates", () => {
    const smoother = new HeadingSmoother(0.5);
    smoother.update(0);
    smoother.update(90);
    const result = smoother.update(90);
    expect(result).toBeCloseTo(67.5, 5);
  });

  it("takes the short way around the 0/360 wrap-around", () => {
    const smoother = new HeadingSmoother(0.5);
    smoother.update(350);
    const result = smoother.update(10);
    // shortest path from 350 to 10 is +20, half of that is +10 -> 0 (360)
    expect(result).toBeCloseTo(0, 5);
  });

  it("resets back to taking the next reading as-is", () => {
    const smoother = new HeadingSmoother(0.5);
    smoother.update(0);
    smoother.update(90);
    smoother.reset();
    expect(smoother.update(200)).toBe(200);
  });

  it("rejects an out-of-range smoothing factor", () => {
    expect(() => new HeadingSmoother(0)).toThrow();
    expect(() => new HeadingSmoother(1.5)).toThrow();
  });

  it("rejects NaN as smoothing factor", () => {
    expect(() => new HeadingSmoother(NaN)).toThrow();
  });

  it("ignores NaN readings and returns last smoothed value", () => {
    const smoother = new HeadingSmoother(0.5);
    smoother.update(90);
    expect(smoother.update(NaN)).toBe(90);
  });
});
