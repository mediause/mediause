import { randomUUID } from "node:crypto";
import { access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mediause } from "../../src/sdk/mediause.js";

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const RUN_E2E = isTruthyEnv(process.env.MEDIAUSE_E2E);
const LIVE_MANIFEST_URL = "https://release.mediause.dev/cli";
const E2E_API_KEY = process.env.MEDIAUSE_API_KEY?.trim();

const maybeDescribe = RUN_E2E ? describe : describe.skip;

maybeDescribe("mediause cli bootstrap e2e (real network)", () => {
  it(
    "downloads latest CLI from live manifest and runs end-to-end commands",
    async () => {
      const cacheDir = path.join(os.tmpdir(), `mediause-cli-e2e-${randomUUID()}`);

      try {
        const sdk = mediause(undefined, {
          cli: {
            enabled: true,
            autoInstall: true,
            forceReinstall: true,
            manifestUrl: LIVE_MANIFEST_URL,
            cacheDir,
            commandTimeoutMs: 120_000,
          },
          cliTransport: {
            timeoutMs: 120_000,
          },
        });

        await sdk.initialize();

        const info = sdk.getCliBinaryInfo();
        expect(info).toBeDefined();
        expect(info?.version).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
        expect(info?.source).toBe("cache");

        await access(info!.binaryPath);

        const cli = await sdk.createCliExecutor();

        const versionOutput = await cli.executeCore(["version"]);
        expect(versionOutput).toBeDefined();

        const sitesOutput = await cli.sitesList({ json: true });
        expect(sitesOutput).toBeDefined();

        if (E2E_API_KEY) {
          await sdk.setApiKey(E2E_API_KEY);
          const currentKey = await sdk.getApiKey();
          expect(currentKey).toBe(E2E_API_KEY);
        }
      } finally {
        await rm(cacheDir, { recursive: true, force: true });
      }
    },
    240_000,
  );
});
