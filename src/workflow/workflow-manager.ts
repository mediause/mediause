import type { WorkflowDefinition, WorkflowRunResult } from "../types.js";
import { WorkflowEngine } from "../control-plane/workflow-engine.js";
import type { Orchestrator } from "../control-plane/orchestrator.js";

export class WorkflowManager {
  private readonly workflows = new Map<string, WorkflowDefinition>();
  private readonly engine: WorkflowEngine;

  constructor(orchestrator: Orchestrator) {
    this.engine = new WorkflowEngine(orchestrator);
  }

  register(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
  }

  unregister(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  get(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  async run(workflowId: string): Promise<WorkflowRunResult> {
    const definition = this.workflows.get(workflowId);
    if (!definition) {
      throw new Error(`Workflow '${workflowId}' is not registered`);
    }

    return this.engine.run(definition);
  }
}
