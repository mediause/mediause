import type { AccountRecord, ExecutionTask, TaskResult } from "../types.js";
import { normalizeResult } from "./normalization.js";
import type { RuntimeContext, SitePlugin } from "./site-runtime.js";

export class RuntimeManager {
  private readonly plugins = new Map<string, SitePlugin>();

  register(plugin: SitePlugin): void {
    this.plugins.set(plugin.platform, plugin);
  }

  unregister(platform: string): void {
    this.plugins.delete(platform);
  }

  listSites(): string[] {
    return Array.from(this.plugins.keys());
  }

  async execute(task: ExecutionTask, account?: AccountRecord): Promise<TaskResult> {
    const plugin = this.plugins.get(task.platform);
    if (!plugin) {
      throw new Error(`No site plugin registered for platform: ${task.platform}`);
    }

    if (!plugin.supports(task)) {
      throw new Error(`Plugin ${plugin.id} does not support action '${task.action}'`);
    }

    const context: RuntimeContext = { account };
    const raw = await plugin.execute(task, context);
    return normalizeResult(raw);
  }
}
