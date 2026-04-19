import type { AccountRecord, ExecutionTask, TaskResult } from "../types.js";

export type RuntimeContext = {
  account?: AccountRecord;
  signal?: AbortSignal;
};

export interface SitePlugin {
  readonly id: string;
  readonly platform: string;

  supports(task: ExecutionTask): boolean;

  execute(task: ExecutionTask, context: RuntimeContext): Promise<TaskResult>;
}
