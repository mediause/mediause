import type { ExecutionTask, ScheduleSpec } from "../types.js";
import { generateId } from "../utils.js";
import { cronToIntervalMs } from "./cron.js";
import { TaskQueue } from "./queue.js";

export type ScheduledHandle = {
  id: string;
  cancel: () => void;
};

export class Scheduler {
  private readonly queue = new TaskQueue<ExecutionTask>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>();

  constructor(
    private readonly submit: (task: ExecutionTask) => Promise<unknown>,
  ) {}

  async run(task: ExecutionTask): Promise<unknown> {
    return this.submit(task);
  }

  schedule(spec: ScheduleSpec): ScheduledHandle {
    const id = spec.id ?? generateId("schedule");
    const enqueueTask = (): void => {
      this.queue.enqueue({
        id: `${id}-queue`,
        payload: spec.task,
        priority: this.toPriority(spec.task.priority),
      });
      void this.flush();
    };

    if (spec.runAt) {
      const delay = Math.max(0, spec.runAt.getTime() - Date.now());
      const timer = setTimeout(enqueueTask, delay);
      this.timers.set(id, timer);
      return { id, cancel: () => this.cancel(id) };
    }

    if (spec.intervalMs && spec.intervalMs > 0) {
      const timer = setInterval(enqueueTask, spec.intervalMs);
      this.timers.set(id, timer);
      return { id, cancel: () => this.cancel(id) };
    }

    if (spec.cron) {
      const interval = cronToIntervalMs(spec.cron);
      const timer = setInterval(enqueueTask, interval);
      this.timers.set(id, timer);
      return { id, cancel: () => this.cancel(id) };
    }

    throw new Error("schedule spec requires runAt, intervalMs, or cron");
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    clearInterval(timer);
    this.timers.delete(id);
  }

  listQueueSize(): number {
    return this.queue.size();
  }

  private async flush(): Promise<void> {
    while (this.queue.size() > 0) {
      const item = this.queue.dequeue();
      if (!item) {
        return;
      }
      await this.submit(item.payload);
    }
  }

  private toPriority(priority: ExecutionTask["priority"]): number {
    if (priority === "high") {
      return 100;
    }
    if (priority === "normal" || !priority) {
      return 50;
    }
    return 10;
  }
}
