let idCounter = 0;

export function now(): number {
  return Date.now();
}

export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${now()}-${idCounter}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
