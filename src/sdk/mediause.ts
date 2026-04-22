import { AccountManager } from "../accounts/account-manager.js";
import {
  CliBootstrapManager,
  type CliBinaryInfo,
  type CliBootstrapOptions,
} from "../adapters/cli/bootstrap.js";
import {
  DEFAULT_CLI_LATEST_URL,
  DEFAULT_CLI_MANIFEST_BASE_URL,
  resolveDefaultExpectedCliVersion,
} from "../adapters/cli/defaults.js";
import { CliExecutor } from "../adapters/cli/cli-executor.js";
import {
  LocalCliTransport,
  type LocalCliTransportOptions,
} from "../adapters/cli/local-cli-transport.js";
import { Orchestrator } from "../control-plane/orchestrator.js";
import { RuntimeManager } from "../runtime/runtime-manager.js";
import { SiteManager } from "../runtime/site-manager.js";
import type {
  AccountIdentity,
  AccountRecord,
  ExecutionTask,
  PostInput,
  ScheduleSpec,
  TaskResult,
  WorkflowDefinition,
  WorkflowRunResult,
} from "../types.js";
import { generateId } from "../utils.js";
import { WorkflowManager } from "../workflow/workflow-manager.js";

export type MediaUseToolkitOptions = {
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    jitter?: number;
  };
  cli?: CliBootstrapOptions;
  cliTransport?: Omit<LocalCliTransportOptions, "binaryPath">;
  apiKey?: string;
  api_key?: string;
};

export type MediaUseFactoryOptions = Omit<MediaUseToolkitOptions, "apiKey" | "api_key">;

export class MediaUseToolkit {
  readonly accounts: AccountManager;
  readonly runtime: RuntimeManager;
  readonly sites: SiteManager;
  readonly orchestrator: Orchestrator;
  readonly workflows: WorkflowManager;
  private readonly cliBootstrap?: CliBootstrapManager;
  private readonly cliTransportOptions?: Omit<LocalCliTransportOptions, "binaryPath">;
  private readonly initialApiKey?: string;
  private cliBinaryInfo?: CliBinaryInfo;
  private cliExecutor?: CliExecutor;
  private currentApiKey?: string;
  private initialized = false;

  constructor(options: MediaUseToolkitOptions = {}) {
    this.accounts = new AccountManager();
    this.runtime = new RuntimeManager();
    this.sites = new SiteManager(this.runtime);
    this.orchestrator = new Orchestrator(this.runtime, this.accounts, {
      retryPolicy: options.retry,
    });
    this.workflows = new WorkflowManager(this.orchestrator);

    if (options.cli) {
      const envVersion = options.cli.expectedVersion?.trim();
      const defaultExpectedVersion =
        envVersion && envVersion.length > 0
          ? envVersion
          : resolveDefaultExpectedCliVersion();

      this.cliBootstrap = new CliBootstrapManager({
        ...options.cli,
        expectedVersion: defaultExpectedVersion,
        manifestUrl:
          options.cli.manifestUrl?.trim() || DEFAULT_CLI_MANIFEST_BASE_URL,
        latestVersionUrl:
          options.cli.latestVersionUrl?.trim() || DEFAULT_CLI_LATEST_URL,
      });
    }

    this.cliTransportOptions = options.cliTransport;
    this.initialApiKey = options.apiKey ?? options.api_key;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.cliBootstrap) {
      this.cliBinaryInfo = await this.cliBootstrap.ensureInstalled();
    }

    this.initialized = true;

    if (this.initialApiKey) {
      await this.setApiKey(this.initialApiKey);
    }
  }

  getCliBinaryInfo(): CliBinaryInfo | undefined {
    return this.cliBinaryInfo;
  }

  async createCliExecutor(): Promise<CliExecutor> {
    if (this.cliExecutor) {
      return this.cliExecutor;
    }

    await this.initialize();

    const binaryPath = this.cliBinaryInfo?.binaryPath ?? "mediause";
    const transport = new LocalCliTransport({
      binaryPath,
      ...(this.cliTransportOptions ?? {}),
    });
    this.cliExecutor = new CliExecutor(transport);
    return this.cliExecutor;
  }

  async setApiKey(apiKey: string): Promise<void> {
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new Error("apiKey cannot be empty");
    }

    const cli = await this.createCliExecutor();
    await cli.manageKeySet(normalized);
    this.currentApiKey = normalized;
  }

  async getApiKey(): Promise<string | undefined> {
    if (this.currentApiKey) {
      return this.currentApiKey;
    }

    const cli = await this.createCliExecutor();
    const value = await cli.manageKeyGet();
    const extracted = this.extractApiKey(value);
    this.currentApiKey = extracted;
    return extracted;
  }

  async post(platform: string, input: PostInput): Promise<TaskResult> {
    const task: ExecutionTask = {
      id: generateId("post"),
      platform,
      action: "post",
      payload: input as Record<string, unknown>,
    };

    return this.run(task);
  }

  async run(task: ExecutionTask): Promise<TaskResult> {
    await this.initialize();
    return this.orchestrator.run(task);
  }

  schedule(spec: Omit<ScheduleSpec, "task"> & { task: ExecutionTask }): {
    id: string;
    cancel: () => void;
  } {
    return this.orchestrator.schedule(spec);
  }

  useAccount(target: AccountIdentity, options?: {
    policy?: string;
    idleTimeoutSeconds?: number;
  }): void {
    this.orchestrator.stateStore.setContext({
      account: target,
      policy: options?.policy,
      idleTimeoutSeconds: options?.idleTimeoutSeconds,
    });
  }

  clearContext(): void {
    this.orchestrator.stateStore.clearContext();
  }

  getContext(): ReturnType<typeof this.orchestrator.stateStore.getContext> {
    return this.orchestrator.stateStore.getContext();
  }

  addAccount(record: Omit<AccountRecord, "updatedAt">): AccountRecord {
    return this.accounts.upsert(record);
  }

  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.register(definition);
  }

  async runWorkflow(workflowId: string): Promise<WorkflowRunResult> {
    await this.initialize();
    return this.workflows.run(workflowId);
  }

  getTaskState(taskId: string) {
    return this.orchestrator.stateStore.getTaskState(taskId);
  }

  listTaskStates() {
    return this.orchestrator.stateStore.listTaskStates();
  }

  private extractApiKey(result: unknown): string | undefined {
    if (typeof result === "string") {
      const trimmed = result.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof result === "object" && result !== null) {
      const candidates = result as Record<string, unknown>;
      const keys = ["key", "api_key", "apiKey", "value"];
      for (const key of keys) {
        const raw = candidates[key];
        if (typeof raw === "string" && raw.trim().length > 0) {
          return raw.trim();
        }
      }
    }

    return undefined;
  }
}

export function mediause(apiKey?: string, options: MediaUseFactoryOptions = {}): MediaUseToolkit {
  return new MediaUseToolkit({
    ...options,
    apiKey,
  });
}
