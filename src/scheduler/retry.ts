import type { RetryPolicyConfig } from "../types.js";
import { sleep } from "../utils.js";

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  backoffFactor: 2,
  jitter: 0.2,
};

export function computeRetryDelay(
  attempt: number,
  policy: RetryPolicyConfig,
): number {
  const exponential = policy.baseDelayMs * policy.backoffFactor ** Math.max(0, attempt - 1);
  const bounded = Math.min(exponential, policy.maxDelayMs);
  const jitterDelta = bounded * policy.jitter;
  const randomized = bounded + (Math.random() * 2 - 1) * jitterDelta;
  return Math.max(0, Math.round(randomized));
}

export async function waitForRetry(
  attempt: number,
  policy: RetryPolicyConfig,
): Promise<void> {
  const delayMs = computeRetryDelay(attempt, policy);
  await sleep(delayMs);
}
