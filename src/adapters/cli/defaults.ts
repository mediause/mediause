import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFAULT_CLI_MANIFEST_BASE_URL = "https://release.mediause.dev/cli";
export const DEFAULT_CLI_LATEST_URL = `${DEFAULT_CLI_MANIFEST_BASE_URL}/latest.json`;

let cachedSdkVersion: string | undefined;

export function resolveSdkPackageVersion(): string | undefined {
  if (cachedSdkVersion !== undefined) {
    return cachedSdkVersion;
  }

  try {
    const packageJsonPath = fileURLToPath(
      new URL("../../../package.json", import.meta.url),
    );
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    cachedSdkVersion = parsed.version?.trim();
    return cachedSdkVersion;
  } catch {
    cachedSdkVersion = undefined;
    return undefined;
  }
}

export function resolveDefaultExpectedCliVersion(): string | undefined {
  const sdkVersion = resolveSdkPackageVersion();
  if (!sdkVersion) {
    return undefined;
  }

  const normalized = sdkVersion.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized)) {
    return undefined;
  }

  // Keep 0.x as development channel and let it resolve latest CLI.
  if (normalized.startsWith("0.")) {
    return undefined;
  }

  return normalized;
}
