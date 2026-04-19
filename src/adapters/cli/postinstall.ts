#!/usr/bin/env node

import { CliBootstrapManager } from "./bootstrap.js";

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function runPostinstall(): Promise<void> {
  if (isTruthy(process.env.MEDIAUSE_SKIP_POSTINSTALL)) {
    console.log("[mediause-core] MEDIAUSE_SKIP_POSTINSTALL=1, skip CLI bootstrap.");
    return;
  }

  const expectedVersion = process.env.MEDIAUSE_CLI_VERSION?.trim();
  const manifestUrl = process.env.MEDIAUSE_CLI_MANIFEST_URL?.trim() || "https://releases.mediause.dev/cli";
  const latestVersionUrl = process.env.MEDIAUSE_CLI_LATEST_VERSION_URL?.trim();
  const cacheDir = process.env.MEDIAUSE_CLI_CACHE_DIR?.trim();
  const binaryName = process.env.MEDIAUSE_CLI_BINARY_NAME?.trim();

  const manager = new CliBootstrapManager({
    expectedVersion: expectedVersion && expectedVersion.length > 0 ? expectedVersion : undefined,
    manifestUrl,
    latestVersionUrl: latestVersionUrl && latestVersionUrl.length > 0 ? latestVersionUrl : undefined,
    cacheDir: cacheDir && cacheDir.length > 0 ? cacheDir : undefined,
    binaryName: binaryName && binaryName.length > 0 ? binaryName : undefined,
    autoInstall: true,
    enabled: true,
  });

  const result = await manager.ensureInstalled();
  console.log(`[mediause-core] CLI ready: ${result.version} (${result.binaryPath})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPostinstall().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mediause-core] postinstall bootstrap failed: ${message}`);
    process.exit(1);
  });
}
