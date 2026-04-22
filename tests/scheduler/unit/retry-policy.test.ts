import { describe, expect, it } from "vitest";

import { computeRetryDelay, DEFAULT_RETRY_POLICY } from "../../../src/scheduler/retry.js";

describe("retry policy", () => {
  it("computes non-negative delay", () => {
    const delay = computeRetryDelay(1, DEFAULT_RETRY_POLICY);
    expect(delay).toBeGreaterThanOrEqual(0);
  });

  it("respects max delay cap", () => {
    const delay = computeRetryDelay(100, {
      ...DEFAULT_RETRY_POLICY,
      baseDelayMs: 100,
      maxDelayMs: 500,
      backoffFactor: 2,
      jitter: 0,
    });

    expect(delay).toBe(500);
  });
});
