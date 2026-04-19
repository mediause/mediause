export function cronToIntervalMs(cron: string): number {
  const trimmed = cron.trim();

  // Supports minimal second-level format: */N * * * * *
  const secondPattern = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*\s+\*$/;
  const secondMatch = trimmed.match(secondPattern);
  if (secondMatch?.[1]) {
    const seconds = Number.parseInt(secondMatch[1], 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  // Supports minimal minute-level format: */N * * * *
  const minutePattern = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/;
  const minuteMatch = trimmed.match(minutePattern);
  if (minuteMatch?.[1]) {
    const minutes = Number.parseInt(minuteMatch[1], 10);
    if (Number.isFinite(minutes) && minutes > 0) {
      return minutes * 60 * 1000;
    }
  }

  throw new Error(
    `Unsupported cron expression: ${cron}. Supported: '*/N * * * * *' or '*/N * * * *'`,
  );
}
