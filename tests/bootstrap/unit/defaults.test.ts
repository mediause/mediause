import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLI_LATEST_URL,
  DEFAULT_CLI_MANIFEST_BASE_URL,
  resolveDefaultExpectedCliVersion,
  resolveSdkPackageVersion,
} from "../../../src/adapters/cli/defaults.js";

describe("cli defaults", () => {
  it("uses official release host by default", () => {
    expect(DEFAULT_CLI_MANIFEST_BASE_URL).toBe("https://release.mediause.dev/cli");
    expect(DEFAULT_CLI_LATEST_URL).toBe(
      "https://release.mediause.dev/cli/latest.json",
    );
  });

  it("derives expected CLI version from SDK package version", () => {
    const packageJson = JSON.parse(readFileSync("./package.json", "utf8")) as {
      version: string;
    };

    const sdkVersion = resolveSdkPackageVersion();
    expect(sdkVersion).toBe(packageJson.version);

    const expectedCliVersion = resolveDefaultExpectedCliVersion();
    const normalized = packageJson.version.replace(/^v/, "");

    if (normalized.startsWith("0.")) {
      expect(expectedCliVersion).toBeUndefined();
      return;
    }

    expect(expectedCliVersion).toBe(normalized);
  });
});
