import type { WorkflowDefinition, WorkflowRunResult } from "../types.js";
import { generateId } from "../utils.js";
import type { Orchestrator } from "./orchestrator.js";

export class WorkflowEngine {
  constructor(private readonly orchestrator: Orchestrator) {}

  async run(definition: WorkflowDefinition): Promise<WorkflowRunResult> {
    const runId = generateId("workflow-run");
    this.orchestrator.stateStore.setWorkflowState(runId, "running");

    const stepResults: WorkflowRunResult["steps"] = [];

    for (const step of definition.steps) {
      const result = await this.orchestrator.run({
        id: generateId(`wf-${definition.id}-${step.id}`),
        platform: step.platform,
        action: step.action,
        payload: step.payload,
      });

      stepResults.push(result);

      if (result.status === "failed" && !step.continueOnError) {
        this.orchestrator.stateStore.setWorkflowState(runId, "failed");
        return {
          workflowId: definition.id,
          runId,
          status: "failed",
          steps: stepResults,
        };
      }
    }

    this.orchestrator.stateStore.setWorkflowState(runId, "succeeded");
    return {
      workflowId: definition.id,
      runId,
      status: "succeeded",
      steps: stepResults,
    };
  }
}
