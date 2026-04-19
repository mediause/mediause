type QueueItem<T> = {
  id: string;
  priority: number;
  payload: T;
};

export class TaskQueue<T> {
  private readonly items: QueueItem<T>[] = [];

  enqueue(item: QueueItem<T>): void {
    this.items.push(item);
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): QueueItem<T> | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
