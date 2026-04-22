export type Platform = string;

export type TaskStatus =
  | "pending"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "cancelled";

export type MediaObject = {
  url: string;
  type?: "image" | "video" | "audio" | "file";
};

export type PostInput = {
  title?: string;
  text?: string;
  media?: MediaObject[];
  metadata?: Record<string, unknown>;
};

export type TaskPriority = "low" | "normal" | "high";

export type ExecutionTask = {
  id: string;
  platform: Platform;
  action: string;
  payload: Record<string, unknown>;
  priority?: TaskPriority;
  maxRetries?: number;
  tags?: string[];
};

export type TaskResult<T = unknown> = {
  taskId: string;
  status: TaskStatus;
  startedAt: number;
  endedAt: number;
  attempt: number;
  data?: T;
  error?: string;
};

export type RetryPolicyConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: number;
};

export type ScheduleSpec = {
  id?: string;
  cron?: string;
  intervalMs?: number;
  runAt?: Date;
  task: ExecutionTask;
};

export type AccountIdentity = {
  platform: Platform;
  accountId: string;
  alias?: string;
};

export type AccountRecord = AccountIdentity & {
  token?: string;
  session?: Record<string, unknown>;
  health?: "healthy" | "degraded" | "invalid";
  updatedAt: number;
};

export type WorkflowStep = {
  id: string;
  platform: Platform;
  action: ExecutionTask["action"];
  payload: Record<string, unknown>;
  continueOnError?: boolean;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  steps: WorkflowStep[];
};

export type WorkflowRunResult = {
  workflowId: string;
  runId: string;
  status: "succeeded" | "failed";
  steps: TaskResult[];
};

export type ActiveContext = {
  account?: AccountIdentity;
  policy?: string;
  idleTimeoutSeconds?: number;
};
