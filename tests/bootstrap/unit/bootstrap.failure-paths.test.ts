import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CliBinaryMissingError,
  CliBootstrapError,
  CliBootstrapManager,
} from "../../../src/adapters/cli/bootstrap.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CliBootstrapManager failure paths", () => {
  it("fails when no version resolution source is configured", async () => {
    const manager = new CliBootstrapManager({
      autoInstall: true,
      enabled: true,
      cacheDir: "./.tmp-tests/cache-no-source",
    });

    let caught: unknown;
    try {
      await manager.ensureInstalled();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CliBootstrapError);
  });

  it("fails when auto install is disabled and binary is missing", async () => {
    const manager = new CliBootstrapManager({
      expectedVersion: "9.9.9",
      autoInstall: false,
      enabled: true,
      cacheDir: "./.tmp-tests/cache-no-binary",
      binaryName: "__mediause_not_exists__",
    });

    let caught: unknown;
    try {
      await manager.ensureInstalled();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CliBinaryMissingError);
  });

  it("prefers expectedVersion over releaseManifest version", async () => {
    const manager = new CliBootstrapManager({
      expectedVersion: "1.0.0",
      autoInstall: true,
      enabled: true,
      cacheDir: "./.tmp-tests/cache-manifest-mismatch",
      releaseManifest: {
        version: "2.0.0",
        assets: {
          "linux-x64": {
            url: "https://example.com/mediause-linux-x64",
            sha256: "abcd",
          },
        },
      },
    });

    const version = await (
      manager as unknown as { resolveTargetVersion: () => Promise<string> }
    ).resolveTargetVersion();

    expect(version).toBe("1.0.0");
  });
});
