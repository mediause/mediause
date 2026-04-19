import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CliPlatform = "windows" | "linux" | "macos";
export type CliArch = "x64" | "arm64";

export type CliAsset = {
  url: string;
  sha256: string;
};

export type CliReleaseManifest = {
  version: string;
  assets: Record<string, CliAsset>;
};

export type CliBinaryInfo = {
  binaryPath: string;
  version: string;
  source: "cache" | "system-path";
};

export type CliBootstrapOptions = {
  expectedVersion?: string;
  enabled?: boolean;
  autoInstall?: boolean;
  forceReinstall?: boolean;
  binaryName?: string;
  cacheDir?: string;
  manifestUrl?: string;
  latestVersionUrl?: string;
  releaseManifest?: CliReleaseManifest;
  commandTimeoutMs?: number;
};

export class CliBootstrapError extends Error {}

export class UnsupportedPlatformError extends CliBootstrapError {}

export class CliVersionMismatchError extends CliBootstrapError {}

export class CliBinaryMissingError extends CliBootstrapError {}

const DEFAULT_BINARY_NAME = "mediause";
const DEFAULT_TIMEOUT_MS = 8_000;

export class CliBootstrapManager {
  private latestResolvedManifest?: CliReleaseManifest;

  private readonly options: Required<
    Pick<CliBootstrapOptions, "enabled" | "autoInstall" | "forceReinstall" | "binaryName" | "commandTimeoutMs">
  > &
    Omit<
      CliBootstrapOptions,
      "enabled" | "autoInstall" | "forceReinstall" | "binaryName" | "commandTimeoutMs"
    >;

  constructor(options: CliBootstrapOptions) {
    this.options = {
      enabled: options.enabled ?? true,
      autoInstall: options.autoInstall ?? true,
      forceReinstall: options.forceReinstall ?? false,
      binaryName: options.binaryName ?? DEFAULT_BINARY_NAME,
      commandTimeoutMs: options.commandTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...options,
    };
  }

  async ensureInstalled(): Promise<CliBinaryInfo> {
    if (!this.options.enabled) {
      return {
        binaryPath: this.options.binaryName,
        version: "unknown",
        source: "system-path",
      };
    }

    const cacheDir = this.resolveCacheDir();
    await mkdir(cacheDir, { recursive: true });

    const lockPath = path.join(cacheDir, ".install.lock");
    const release = await this.acquireLock(lockPath);

    try {
      const targetVersion = await this.resolveTargetVersion();

      if (!this.options.forceReinstall) {
        const active = await this.readCurrent(cacheDir);
        if (active) {
          const resolved = await this.resolveBinaryInfo(active.binaryPath, "cache");
          if (resolved && resolved.version === targetVersion) {
            return resolved;
          }
        }
      }

      const systemBinary = await this.resolveBinaryInfo(this.options.binaryName, "system-path");
      if (systemBinary && systemBinary.version === targetVersion) {
        return systemBinary;
      }

      if (!this.options.autoInstall) {
        if (systemBinary && systemBinary.version !== targetVersion) {
          throw new CliVersionMismatchError(
            `Expected mediause CLI ${targetVersion} but found ${systemBinary.version}`,
          );
        }

        throw new CliBinaryMissingError(
          `mediause CLI ${targetVersion} is required but was not found`,
        );
      }

      return this.installAndActivate(cacheDir, targetVersion);
    } finally {
      await release();
    }
  }

  private async installAndActivate(cacheDir: string, targetVersion: string): Promise<CliBinaryInfo> {
    const platformKey = this.getPlatformArchKey();
    const manifest = await this.loadManifest(targetVersion);
    const asset = manifest.assets[platformKey];

    if (!asset) {
      throw new UnsupportedPlatformError(
        `No mediause CLI artifact for platform '${platformKey}' at version ${targetVersion}`,
      );
    }

    const versionDir = path.join(cacheDir, "versions", targetVersion, platformKey);
    await mkdir(versionDir, { recursive: true });

    const extension = this.detectBinaryExtension();
    const binaryFileName = `${this.options.binaryName}${extension}`;
    const finalBinaryPath = path.join(versionDir, binaryFileName);

    if (!this.options.forceReinstall) {
      const existing = await this.resolveBinaryInfo(finalBinaryPath, "cache");
      if (existing && existing.version === targetVersion) {
        await this.writeCurrent(cacheDir, {
          version: targetVersion,
          binaryPath: finalBinaryPath,
        });
        return existing;
      }
    }

    const tmpDownloadPath = path.join(versionDir, `${binaryFileName}.download`);
    await this.downloadFile(asset.url, tmpDownloadPath);

    const hash = await this.sha256(tmpDownloadPath);
    if (hash !== asset.sha256.toLowerCase()) {
      await rm(tmpDownloadPath, { force: true });
      throw new CliBootstrapError(
        `Checksum mismatch for mediause CLI ${targetVersion}. Expected ${asset.sha256}, got ${hash}`,
      );
    }

    await rename(tmpDownloadPath, finalBinaryPath);
    if (process.platform !== "win32") {
      await chmod(finalBinaryPath, 0o755);
    }

    const validated = await this.resolveBinaryInfo(finalBinaryPath, "cache");
    if (!validated || validated.version !== targetVersion) {
      throw new CliVersionMismatchError(
        `Installed mediause CLI version mismatch. Expected ${targetVersion}, got ${validated?.version ?? "unknown"}`,
      );
    }

    await this.writeCurrent(cacheDir, {
      version: targetVersion,
      binaryPath: finalBinaryPath,
    });

    return validated;
  }

  private async loadManifest(version: string): Promise<CliReleaseManifest> {
    if (this.options.releaseManifest) {
      if (this.options.releaseManifest.version !== version) {
        throw new CliBootstrapError(
          `Provided releaseManifest version '${this.options.releaseManifest.version}' does not match expected '${version}'`,
        );
      }
      return this.options.releaseManifest;
    }

    if (this.latestResolvedManifest && this.latestResolvedManifest.version === version) {
      return this.latestResolvedManifest;
    }

    const latestManifest = await this.tryLoadLatestManifest();
    if (latestManifest && latestManifest.version.replace(/^v/, "").trim() === version.replace(/^v/, "").trim()) {
      this.latestResolvedManifest = latestManifest;
      return latestManifest;
    }

    if (!this.options.manifestUrl) {
      throw new CliBootstrapError(
        "manifestUrl or releaseManifest is required for auto-install",
      );
    }

    const url = `${this.options.manifestUrl.replace(/\/$/, "")}/${version}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      if (latestManifest) {
        throw new CliBootstrapError(
          `Manifest ${url} not found and latest.json points to ${latestManifest.version}. Ensure requested version ${version} is published in latest.json assets.`,
        );
      }
      throw new CliBootstrapError(
        `Failed to fetch mediause CLI manifest from ${url} (${response.status})`,
      );
    }

    const data = (await response.json()) as CliReleaseManifest;
    if (!data.version || !data.assets) {
      throw new CliBootstrapError(`Invalid manifest format from ${url}`);
    }

    return data;
  }

  private async tryLoadLatestManifest(): Promise<CliReleaseManifest | undefined> {
    const latestUrl = this.options.latestVersionUrl
      ? this.options.latestVersionUrl
      : `${this.options.manifestUrl?.replace(/\/$/, "")}/latest.json`;

    if (!latestUrl) {
      return undefined;
    }

    try {
      const response = await fetch(latestUrl);
      if (!response.ok) {
        return undefined;
      }

      const payload = (await response.json()) as {
        version?: string;
        assets?: Record<string, CliAsset>;
      };

      if (!payload.version || !payload.assets || typeof payload.assets !== "object") {
        return undefined;
      }

      return {
        version: payload.version,
        assets: payload.assets,
      };
    } catch {
      return undefined;
    }
  }

  private async resolveTargetVersion(): Promise<string> {
    if (this.options.expectedVersion && this.options.expectedVersion.trim().length > 0) {
      return this.options.expectedVersion.trim();
    }

    if (this.options.releaseManifest?.version) {
      return this.options.releaseManifest.version;
    }

    if (!this.options.manifestUrl && !this.options.latestVersionUrl) {
      throw new CliBootstrapError(
        "expectedVersion is missing and no manifestUrl/latestVersionUrl is configured to resolve latest version",
      );
    }

    const latestUrl = this.options.latestVersionUrl
      ? this.options.latestVersionUrl
      : `${this.options.manifestUrl?.replace(/\/$/, "")}/latest.json`;

    const response = await fetch(latestUrl);
    if (!response.ok) {
      throw new CliBootstrapError(
        `Failed to resolve latest mediause CLI version from ${latestUrl} (${response.status})`,
      );
    }

    const payload = (await response.json()) as {
      version?: string;
      latest?: string;
      tag_name?: string;
      assets?: Record<string, CliAsset>;
    };
    const version = payload.version ?? payload.latest ?? payload.tag_name;
    if (!version || typeof version !== "string") {
      throw new CliBootstrapError(
        `Invalid latest-version payload from ${latestUrl}: missing version/latest/tag_name`,
      );
    }

    if (payload.assets && typeof payload.assets === "object") {
      this.latestResolvedManifest = {
        version,
        assets: payload.assets,
      };
    } else {
      this.latestResolvedManifest = undefined;
    }

    return version.replace(/^v/, "").trim();
  }

  private async resolveBinaryInfo(binaryPath: string, source: CliBinaryInfo["source"]): Promise<CliBinaryInfo | undefined> {
    try {
      const version = await this.readCliVersion(binaryPath);
      return {
        binaryPath,
        version,
        source,
      };
    } catch {
      return undefined;
    }
  }

  private readCliVersion(binaryPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, ["version", "--json"], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new CliBootstrapError(`Version probe timed out for ${binaryPath}`));
      }, this.options.commandTimeoutMs);

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new CliBootstrapError(`Version probe failed (${code}): ${stderr.trim()}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as { version?: string };
          if (parsed.version) {
            resolve(parsed.version);
            return;
          }
        } catch {
          // Fallback to regex parsing if output is not JSON.
        }

        const match = stdout.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/);
        if (match?.[0]) {
          resolve(match[0]);
          return;
        }

        reject(new CliBootstrapError(`Could not parse CLI version output: ${stdout}`));
      });
    });
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new CliBootstrapError(`Failed to download mediause CLI from ${url} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await writeFile(outputPath, Buffer.from(arrayBuffer));
  }

  private async sha256(filePath: string): Promise<string> {
    const data = await readFile(filePath);
    return createHash("sha256").update(data).digest("hex");
  }

  private resolveCacheDir(): string {
    if (this.options.cacheDir) {
      return this.options.cacheDir;
    }

    if (process.platform === "win32") {
      const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
      return path.join(base, "mediause", "cli-cache");
    }

    if (process.platform === "darwin") {
      return path.join(os.homedir(), "Library", "Caches", "mediause", "cli-cache");
    }

    const xdgCache = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
    return path.join(xdgCache, "mediause", "cli-cache");
  }

  private detectBinaryExtension(): string {
    return process.platform === "win32" ? ".exe" : "";
  }

  private getPlatformArchKey(): string {
    const platform = this.normalizePlatform(process.platform);
    const arch = this.normalizeArch(process.arch);
    return `${platform}-${arch}`;
  }

  private normalizePlatform(rawPlatform: NodeJS.Platform): CliPlatform {
    if (rawPlatform === "win32") {
      return "windows";
    }
    if (rawPlatform === "linux") {
      return "linux";
    }
    if (rawPlatform === "darwin") {
      return "macos";
    }

    throw new UnsupportedPlatformError(`Unsupported platform: ${rawPlatform}`);
  }

  private normalizeArch(rawArch: string): CliArch {
    if (rawArch === "x64") {
      return "x64";
    }
    if (rawArch === "arm64") {
      return "arm64";
    }

    throw new UnsupportedPlatformError(`Unsupported architecture: ${rawArch}`);
  }

  private async acquireLock(lockPath: string): Promise<() => Promise<void>> {
    const maxAttempts = 30;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const handle = await open(lockPath, "wx");
        return async () => {
          await handle.close();
          await rm(lockPath, { force: true });
        };
      } catch {
        if (attempt === maxAttempts) {
          throw new CliBootstrapError(`Could not acquire install lock: ${lockPath}`);
        }
        await this.sleep(200);
      }
    }

    throw new CliBootstrapError(`Could not acquire install lock: ${lockPath}`);
  }

  private async readCurrent(cacheDir: string): Promise<{ version: string; binaryPath: string } | undefined> {
    const currentPath = path.join(cacheDir, "current.json");
    try {
      const data = await readFile(currentPath, "utf8");
      const parsed = JSON.parse(data) as { version?: string; binaryPath?: string };
      if (!parsed.version || !parsed.binaryPath) {
        return undefined;
      }

      await stat(parsed.binaryPath);
      return {
        version: parsed.version,
        binaryPath: parsed.binaryPath,
      };
    } catch {
      return undefined;
    }
  }

  private async writeCurrent(
    cacheDir: string,
    current: { version: string; binaryPath: string },
  ): Promise<void> {
    const currentPath = path.join(cacheDir, "current.json");
    await writeFile(currentPath, JSON.stringify(current, null, 2), "utf8");
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
