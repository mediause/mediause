import type { TaskResult } from "../types.js";

export function normalizeResult(input: TaskResult): TaskResult {
  return {
    ...input,
    startedAt: Number.isFinite(input.startedAt) ? input.startedAt : Date.now(),
    endedAt: Number.isFinite(input.endedAt) ? input.endedAt : Date.now(),
  };
}
