import type { ActiveContext, TaskResult, TaskStatus } from "../types.js";

export type StoredTaskState = {
  id: string;
  status: TaskStatus;
  attempts: number;
  updatedAt: number;
  lastResult?: TaskResult;
};

export class StateStore {
  private readonly taskStates = new Map<string, StoredTaskState>();
  private readonly workflowStates = new Map<string, "running" | "succeeded" | "failed">();
  private activeContext: ActiveContext = {};

  setTaskState(state: StoredTaskState): void {
    this.taskStates.set(state.id, state);
  }

  getTaskState(taskId: string): StoredTaskState | undefined {
    return this.taskStates.get(taskId);
  }

  listTaskStates(): StoredTaskState[] {
    return Array.from(this.taskStates.values());
  }

  setWorkflowState(runId: string, status: "running" | "succeeded" | "failed"): void {
    this.workflowStates.set(runId, status);
  }

  getWorkflowState(runId: string): "running" | "succeeded" | "failed" | undefined {
    return this.workflowStates.get(runId);
  }

  getContext(): ActiveContext {
    return { ...this.activeContext };
  }

  setContext(context: Partial<ActiveContext>): ActiveContext {
    this.activeContext = {
      ...this.activeContext,
      ...context,
    };
    return this.getContext();
  }

  clearContext(): void {
    this.activeContext = {};
  }
}
