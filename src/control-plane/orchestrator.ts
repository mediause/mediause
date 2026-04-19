import { AccountManager } from "../accounts/account-manager.js";
import { DEFAULT_RETRY_POLICY, waitForRetry } from "../scheduler/retry.js";
import { Scheduler } from "../scheduler/scheduler.js";
import type {
  ExecutionTask,
  RetryPolicyConfig,
  ScheduleSpec,
  TaskResult,
  TaskStatus,
} from "../types.js";
import { now } from "../utils.js";
import { RuntimeManager } from "../runtime/runtime-manager.js";
import { PolicyEngine } from "./policy-engine.js";
import { StateStore } from "./state-store.js";

export type OrchestratorOptions = {
  retryPolicy?: Partial<RetryPolicyConfig>;
};

export class Orchestrator {
  readonly stateStore: StateStore;
  readonly scheduler: Scheduler;
  readonly policyEngine: PolicyEngine;

  private readonly retryPolicy: RetryPolicyConfig;

  constructor(
    private readonly runtime: RuntimeManager,
    private readonly accounts: AccountManager,
    options: OrchestratorOptions = {},
  ) {
    this.stateStore = new StateStore();
    this.policyEngine = new PolicyEngine();
    this.retryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...(options.retryPolicy ?? {}),
    };

    this.scheduler = new Scheduler(async (task) => this.run(task));
  }

  async run(task: ExecutionTask): Promise<TaskResult> {
    const startedAt = now();
    const context = this.stateStore.getContext();
    const selectedPolicy = this.policyEngine.resolve(task, context);

    const account = context.account
      ? this.accounts.get(context.account)
      : undefined;

    let attempt = 0;
    const maxAttempts = task.maxRetries ?? this.retryPolicy.maxAttempts;
    let lastError = "Unknown error";

    while (attempt < maxAttempts) {
      attempt += 1;
      this.stateStore.setTaskState({
        id: task.id,
        status: attempt === 1 ? "running" : "retrying",
        attempts: attempt,
        updatedAt: now(),
      });

      try {
        const result = await this.runtime.execute(task, account);
        const finalResult: TaskResult = {
          ...result,
          taskId: task.id,
          status: "succeeded",
          startedAt,
          endedAt: now(),
          attempt,
          data: {
            ...(typeof result.data === "object" && result.data !== null
              ? (result.data as Record<string, unknown>)
              : { result: result.data }),
            policy: selectedPolicy,
          },
        };

        this.stateStore.setTaskState({
          id: task.id,
          status: finalResult.status,
          attempts: attempt,
          updatedAt: now(),
          lastResult: finalResult,
        });

        return finalResult;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt >= maxAttempts) {
          break;
        }

        await waitForRetry(attempt, this.retryPolicy);
      }
    }

    const failedStatus: TaskStatus = "failed";
    const failedResult: TaskResult = {
      taskId: task.id,
      status: failedStatus,
      startedAt,
      endedAt: now(),
      attempt,
      error: lastError,
    };

    this.stateStore.setTaskState({
      id: task.id,
      status: failedStatus,
      attempts: attempt,
      updatedAt: now(),
      lastResult: failedResult,
    });

    return failedResult;
  }

  schedule(spec: ScheduleSpec): { id: string; cancel: () => void } {
    return this.scheduler.schedule(spec);
  }
}
