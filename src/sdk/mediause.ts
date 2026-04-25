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

export type SiteActionInput =
  | Record<string, unknown>
  | string[]
  | string
  | number
  | boolean
  | null
  | undefined;

export type SiteActionInvoker = (
  input?: SiteActionInput,
  payload?: Record<string, unknown>,
) => Promise<unknown>;

export type SiteCapabilityInvoker = {
  [action: string]: SiteActionInvoker;
};

export type SiteChainInvoker = {
  [capability: string]: SiteCapabilityInvoker;
};

export type UseAccountChainOptions = {
  policy?: string;
  idleTimeoutSeconds?: number;
  json?: boolean;
  payload?: Record<string, unknown>;
};

export type FlowConstraintState = {
  discovered: boolean;
  contextBound: boolean;
  healthChecked: boolean;
};

export type MediaUseFlowChain = {
  discover: () => Promise<void>;
  useAccount: (options?: UseAccountChainOptions) => Promise<unknown>;
  authHealth: (options?: { alias?: string; json?: boolean }) => Promise<unknown>;
  ready: (options?: {
    discover?: boolean;
    useAccount?: UseAccountChainOptions;
    authHealth?: { alias?: string; json?: boolean };
  }) => Promise<void>;
  state: () => Readonly<FlowConstraintState>;
  site: () => SiteChainInvoker;
} & SiteChainInvoker;

export type MediaUseCommandChain = {
  help: {
    root: (json?: boolean) => Promise<unknown>;
  };
  version: {
    get: (json?: boolean) => Promise<unknown>;
  };
  close: {
    run: (json?: boolean) => Promise<unknown>;
  };
  auth: {
    login: (platform: string, payload?: Record<string, unknown>) => Promise<unknown>;
    list: (payload?: Record<string, unknown>) => Promise<unknown>;
    health: (options?: { alias?: string; json?: boolean }) => Promise<unknown>;
    logout: (alias: string, payload?: Record<string, unknown>) => Promise<unknown>;
  };
  sites: {
    list: (options?: { json?: boolean }, payload?: Record<string, unknown>) => Promise<unknown>;
    add: (site: string, options?: { json?: boolean }, payload?: Record<string, unknown>) => Promise<unknown>;
  };
  use: {
    account: (target: string, options?: UseAccountChainOptions) => Promise<unknown>;
  };
  manage: {
    context: {
      show: (json?: boolean) => Promise<unknown>;
      open: (json?: boolean) => Promise<unknown>;
      close: (json?: boolean) => Promise<unknown>;
      clear: (json?: boolean) => Promise<unknown>;
    };
    key: {
      get: () => Promise<unknown>;
      set: (key: string) => Promise<unknown>;
    };
    task: (options?: { id?: string; json?: boolean }) => Promise<unknown>;
  };
  trace: {
    last: () => Promise<unknown>;
  };
  task: {
    status: (taskId: string) => Promise<unknown>;
    trace: (taskId: string) => Promise<unknown>;
  };
  rpc: {
    serve: (options?: { protocol?: "jsonrpc-stdio" | "jsonrpc-tcp" }) => Promise<unknown>;
  };
  site: (siteId?: string) => SiteChainInvoker;
  flow: (siteId: string, accountId: string) => MediaUseFlowChain;
};

export class MediaUseToolkit {
  readonly accounts: AccountManager;
  readonly runtime: RuntimeManager;
  readonly sites: SiteManager;
  readonly orchestrator: Orchestrator;
  readonly workflows: WorkflowManager;
  readonly registry: MediaUseCommandChain["sites"];
  readonly use: MediaUseCommandChain["use"];
  readonly manage: MediaUseCommandChain["manage"];
  readonly trace: MediaUseCommandChain["trace"];
  readonly task: MediaUseCommandChain["task"];
  readonly rpc: MediaUseCommandChain["rpc"];
  readonly help: MediaUseCommandChain["help"];
  readonly version: MediaUseCommandChain["version"];
  readonly close: MediaUseCommandChain["close"];
  readonly chain: MediaUseCommandChain;
  readonly auth: MediaUseCommandChain["auth"];
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
    this.chain = this.buildCommandChain();
    this.auth = this.chain.auth;
    this.registry = this.chain.sites;
    this.use = this.chain.use;
    this.manage = this.chain.manage;
    this.trace = this.chain.trace;
    this.task = this.chain.task;
    this.rpc = this.chain.rpc;
    this.help = this.chain.help;
    this.version = this.chain.version;
    this.close = this.chain.close;
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

  site(siteId?: string): SiteChainInvoker {
    const normalizedSite = siteId?.trim();
    if (siteId !== undefined && !normalizedSite) {
      throw new Error("siteId cannot be empty when provided");
    }

    return this.buildSiteCapabilityInvoker(normalizedSite);
  }

  flow(siteId: string, accountId: string): MediaUseFlowChain {
    return this.buildFlowChain(siteId, accountId);
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

  private buildSiteCapabilityInvoker(siteId?: string): SiteChainInvoker {
    return new Proxy(
      {},
      {
        get: (_target, capability): SiteCapabilityInvoker => {
          if (typeof capability !== "string") {
            throw new Error("capability must be a string");
          }

          const normalizedCapability = capability.trim();
          if (!normalizedCapability) {
            throw new Error("capability cannot be empty");
          }

          return this.buildSiteActionInvoker(siteId, normalizedCapability);
        },
      },
    ) as SiteChainInvoker;
  }

  private buildCommandChain(): MediaUseCommandChain {
    return {
      help: {
        root: async (json = false): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.executeCore(json ? ["help", "--json"] : ["help"]);
        },
      },

      version: {
        get: async (json = false): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.executeCore(json ? ["version", "--json"] : ["version"]);
        },
      },

      close: {
        run: async (json = false): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.executeCore(json ? ["close", "--json"] : ["close"]);
        },
      },

      auth: {
        login: async (platform: string, payload?: Record<string, unknown>): Promise<unknown> => {
          if (!platform.trim()) {
            throw new Error("platform cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.authLogin(platform.trim(), payload ?? {});
        },

        list: async (payload?: Record<string, unknown>): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.authList(payload);
        },

        health: async (options?: { alias?: string; json?: boolean }): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.authHealth(options);
        },

        logout: async (alias: string, payload?: Record<string, unknown>): Promise<unknown> => {
          if (!alias.trim()) {
            throw new Error("alias cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.authLogout(alias.trim(), payload);
        },
      },

      sites: {
        list: async (options?: { json?: boolean }, payload?: Record<string, unknown>): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.sitesList(options, payload);
        },

        add: async (
          site: string,
          options?: { json?: boolean },
          payload?: Record<string, unknown>,
        ): Promise<unknown> => {
          if (!site.trim()) {
            throw new Error("site cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.sitesAdd(site.trim(), options, payload);
        },
      },

      use: {
        account: async (target: string, options?: UseAccountChainOptions): Promise<unknown> => {
          if (!target.trim()) {
            throw new Error("target cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.useAccount(target.trim(), {
            policy: options?.policy,
            idleTimeoutSeconds: options?.idleTimeoutSeconds,
            json: options?.json,
          }, options?.payload);
        },
      },

      manage: {
        context: {
          show: async (json = false): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            return cli.manageContext({ show: true, json });
          },

          open: async (json = false): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            return cli.manageContext({ open: true, json });
          },

          close: async (json = false): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            return cli.manageContext({ close: true, json });
          },

          clear: async (json = false): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            return cli.manageContext({ clear: true, json });
          },
        },

        key: {
          get: async (): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            return cli.manageKeyGet();
          },

          set: async (key: string): Promise<unknown> => {
            const normalized = key.trim();
            if (!normalized) {
              throw new Error("key cannot be empty");
            }

            const cli = await this.createCliExecutor();
            return cli.manageKeySet(normalized);
          },
        },

        task: async (options?: { id?: string; json?: boolean }): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.manageTask(options);
        },
      },

      trace: {
        last: async (): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.traceLast();
        },
      },

      task: {
        status: async (taskId: string): Promise<unknown> => {
          if (!taskId.trim()) {
            throw new Error("taskId cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.taskStatus(taskId.trim());
        },

        trace: async (taskId: string): Promise<unknown> => {
          if (!taskId.trim()) {
            throw new Error("taskId cannot be empty");
          }

          const cli = await this.createCliExecutor();
          return cli.taskTrace(taskId.trim());
        },
      },

      rpc: {
        serve: async (options?: { protocol?: "jsonrpc-stdio" | "jsonrpc-tcp" }): Promise<unknown> => {
          const cli = await this.createCliExecutor();
          return cli.rpcServe(options);
        },
      },

      site: (siteId?: string): SiteChainInvoker => this.site(siteId),
      flow: (siteId: string, accountId: string): MediaUseFlowChain => this.buildFlowChain(siteId, accountId),
    };
  }

  private buildFlowChain(siteId: string, accountId: string): MediaUseFlowChain {
    const normalizedSite = siteId.trim();
    const normalizedAccount = accountId.trim();

    if (!normalizedSite) {
      throw new Error("siteId cannot be empty");
    }

    if (!normalizedAccount) {
      throw new Error("accountId cannot be empty");
    }

    const state: FlowConstraintState = {
      discovered: false,
      contextBound: false,
      healthChecked: false,
    };

    const target = `${normalizedSite}:${normalizedAccount}`;

    const getGuardedSiteInvoker = (): SiteChainInvoker => {
      if (!state.contextBound) {
        throw new Error("Flow constraint violation: call useAccount() before dynamic site actions");
      }

      if (!state.healthChecked) {
        throw new Error("Flow constraint violation: call authHealth() before dynamic site actions");
      }

      return this.site(normalizedSite);
    };

    const flowMethods = {
      discover: async (): Promise<void> => {
        await this.chain.sites.list({ json: true });
        await this.chain.sites.add(normalizedSite, { json: true });
        state.discovered = true;
      },

      useAccount: async (options?: UseAccountChainOptions): Promise<unknown> => {
        const result = await this.chain.use.account(target, {
          policy: options?.policy,
          idleTimeoutSeconds: options?.idleTimeoutSeconds,
          json: options?.json ?? true,
          payload: options?.payload,
        });

        state.contextBound = true;
        state.healthChecked = false;
        return result;
      },

      authHealth: async (options?: { alias?: string; json?: boolean }): Promise<unknown> => {
        if (!state.contextBound) {
          throw new Error("Flow constraint violation: call useAccount() before authHealth()");
        }

        const result = await this.chain.auth.health({
          alias: options?.alias,
          json: options?.json ?? true,
        });

        state.healthChecked = true;
        return result;
      },

      ready: async (options?: {
        discover?: boolean;
        useAccount?: UseAccountChainOptions;
        authHealth?: { alias?: string; json?: boolean };
      }): Promise<void> => {
        if (options?.discover !== false) {
          await flowMethods.discover();
        }

        await flowMethods.useAccount(options?.useAccount);
        await flowMethods.authHealth(options?.authHealth);
      },

      state: (): Readonly<FlowConstraintState> => ({ ...state }),

      site: (): SiteChainInvoker => {
        return getGuardedSiteInvoker();
      },
    };

    return new Proxy(flowMethods, {
      get: (target, prop, receiver): unknown => {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        if (typeof prop === "string") {
          const siteInvoker = getGuardedSiteInvoker();
          return siteInvoker[prop];
        }

        return Reflect.get(target, prop, receiver);
      },
    }) as MediaUseFlowChain;
  }

  private buildSiteActionInvoker(siteId: string | undefined, capability: string): SiteCapabilityInvoker {
    return new Proxy(
      {},
      {
        get: (_target, action): SiteActionInvoker => {
          if (typeof action !== "string") {
            throw new Error("action must be a string");
          }

          const normalizedAction = action.trim();
          if (!normalizedAction) {
            throw new Error("action cannot be empty");
          }

          return async (input?: SiteActionInput, payload?: Record<string, unknown>): Promise<unknown> => {
            const cli = await this.createCliExecutor();
            const mode = siteId ? "explicit-site" : "active-context";
            const args = this.normalizeSiteActionInput(input);

            return cli.executeSite(
              {
                mode,
                site: siteId,
                capability,
                action: normalizedAction,
                args,
              },
              payload,
            );
          };
        },
      },
    ) as SiteCapabilityInvoker;
  }

  private normalizeSiteActionInput(input?: SiteActionInput): string[] {
    if (input === undefined || input === null) {
      return [];
    }

    if (Array.isArray(input)) {
      return input.map((item) => String(item));
    }

    if (typeof input === "object") {
      return this.objectToArgs(input);
    }

    return [String(input)];
  }

  private objectToArgs(input: Record<string, unknown>): string[] {
    const args: string[] = [];
    const keys = Object.keys(input).sort((a, b) => a.localeCompare(b));

    for (const key of keys) {
      const value = input[key];
      if (value === undefined || value === null) {
        continue;
      }

      const flag = `--${this.toKebabCase(key)}`;

      if (typeof value === "boolean") {
        if (value) {
          args.push(flag);
        }
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === undefined || item === null) {
            continue;
          }

          args.push(flag, this.toArgumentString(item));
        }
        continue;
      }

      args.push(flag, this.toArgumentString(value));
    }

    return args;
  }

  private toKebabCase(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }

  private toArgumentString(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value);
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
