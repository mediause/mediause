import { spawn } from "node:child_process";
import type { CliTransport } from "./cli-executor.js";

export type LocalCliTransportOptions = {
  binaryPath: string;
  cwd?: string;
  timeoutMs?: number;
  appendJsonFlag?: boolean;
  payloadEnvVarName?: string;
  payloadArgName?: string;
  env?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_PAYLOAD_ENV_NAME = "MEDIAUSE_SDK_PAYLOAD";

export class LocalCliTransport implements CliTransport {
  private readonly options: Required<
    Pick<LocalCliTransportOptions, "timeoutMs" | "appendJsonFlag" | "payloadEnvVarName">
  > & Omit<LocalCliTransportOptions, "timeoutMs" | "appendJsonFlag" | "payloadEnvVarName">;

  constructor(options: LocalCliTransportOptions) {
    this.options = {
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      appendJsonFlag: options.appendJsonFlag ?? true,
      payloadEnvVarName: options.payloadEnvVarName ?? DEFAULT_PAYLOAD_ENV_NAME,
      ...options,
    };
  }

  async execute(command: string[], payload?: Record<string, unknown>): Promise<unknown> {
    const args = [...command];

    if (this.options.appendJsonFlag && !args.includes("--json")) {
      args.push("--json");
    }

    const mergedEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(this.options.env ?? {}),
    };

    if (payload && Object.keys(payload).length > 0) {
      const payloadJson = JSON.stringify(payload);
      if (this.options.payloadArgName) {
        args.push(this.options.payloadArgName, payloadJson);
      } else {
        mergedEnv[this.options.payloadEnvVarName] = payloadJson;
      }
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.options.binaryPath, args, {
        cwd: this.options.cwd,
        env: mergedEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(
          new Error(
            `mediause CLI command timed out after ${this.options.timeoutMs}ms: ${this.options.binaryPath} ${args.join(" ")}`,
          ),
        );
      }, this.options.timeoutMs);

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
          reject(
            new Error(
              `mediause CLI failed with code ${code}: ${stderr.trim() || stdout.trim()}`,
            ),
          );
          return;
        }

        const output = stdout.trim();
        if (!output) {
          resolve(undefined);
          return;
        }

        try {
          resolve(JSON.parse(output));
          return;
        } catch {
          resolve(output);
        }
      });
    });
  }
}
