import type { ActiveContext, ExecutionTask } from "../types.js";

export class PolicyEngine {
  resolve(task: ExecutionTask, context: ActiveContext): string {
    if (context.policy) {
      return context.policy;
    }

    if (task.action === "post") {
      return "safe-post";
    }

    return "default";
  }
}
