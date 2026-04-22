import { describe, expect, it, vi } from "vitest";

import { CliBootstrapManager } from "../../../src/adapters/cli/bootstrap.js";

describe("CliBootstrapManager latest version resolution", () => {
  it("resolves latest payload format", async () => {
    const manager = new CliBootstrapManager({
      manifestUrl: "https://releases.example.test/cli",
      autoInstall: true,
      enabled: true,
      cacheDir: "./.tmp-tests/cache-latest",
      binaryName: "__mediause_not_exists__",
    });

    const latestSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ latest: "v3.2.1" }), { status: 200 }),
      );

    const version = await (
      manager as unknown as { resolveTargetVersion: () => Promise<string> }
    ).resolveTargetVersion();

    expect(version).toBe("3.2.1");
    expect(latestSpy).toHaveBeenCalled();
    latestSpy.mockRestore();
  });
});
