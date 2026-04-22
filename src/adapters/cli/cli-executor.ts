export type CliTransport = {
  execute(command: string[], payload?: Record<string, unknown>): Promise<unknown>;
};

type JsonFlag = "--json";
type RpcProtocol = "jsonrpc-stdio" | "jsonrpc-tcp";

type HelpCoreCommand =
  | ["help"]
  | ["help", JsonFlag]
  | ["help", string]
  | ["help", string, JsonFlag]
  | ["help", string, string]
  | ["help", string, string, JsonFlag];

type VersionCoreCommand = ["version"] | ["version", JsonFlag];
type CloseCoreCommand = ["close"] | ["close", JsonFlag];

type SitesCoreCommand =
  | ["sites", "list"]
  | ["sites", "list", JsonFlag]
  | ["sites", "add", string]
  | ["sites", "add", string, JsonFlag];

type AuthCoreCommand =
  | ["auth", "login", string]
  | ["auth", "login", string, JsonFlag]
  | ["auth", "list"]
  | ["auth", "list", JsonFlag]
  | ["auth", "health"]
  | ["auth", "health", JsonFlag]
  | ["auth", "health", "--alias", string]
  | ["auth", "health", "--alias", string, JsonFlag]
  | ["auth", "logout", string]
  | ["auth", "logout", string, JsonFlag];

type UseCoreCommand =
  | ["use", "account", string]
  | ["use", "account", string, JsonFlag];

type ManageCoreCommand =
  | ["manage", "task"]
  | ["manage", "task", JsonFlag]
  | ["manage", "task", "--id", string]
  | ["manage", "task", "--id", string, JsonFlag]
  | ["manage", "context"]
  | ["manage", "context", JsonFlag]
  | ["manage", "context", "--show"]
  | ["manage", "context", "--show", JsonFlag]
  | ["manage", "context", "--close"]
  | ["manage", "context", "--close", JsonFlag]
  | ["manage", "context", "--clear"]
  | ["manage", "context", "--clear", JsonFlag]
  | ["manage", "key"]
  | ["manage", "key", JsonFlag]
  | ["manage", "key", string]
  | ["manage", "key", string, JsonFlag];

type TraceCoreCommand = ["trace", "last"];

type TaskCoreCommand =
  | ["task", "status", "--task-id", string]
  | ["task", "trace", "--task-id", string];

type RpcCoreCommand =
  | ["rpc", "serve"]
  | ["rpc", "serve", "--protocol", RpcProtocol];

export type CoreCommand =
  | HelpCoreCommand
  | VersionCoreCommand
  | CloseCoreCommand
  | SitesCoreCommand
  | AuthCoreCommand
  | UseCoreCommand
  | ManageCoreCommand
  | TraceCoreCommand
  | TaskCoreCommand
  | RpcCoreCommand;

export type SiteInvocationMode =
  | "explicit-site"
  | "active-context"
  | "dotted-active-context"
  | "dotted-explicit-site";

export type SiteDynamicCommand = {
  mode: SiteInvocationMode;
  capability: string;
  action: string;
  args?: string[];
  site?: string;
};

export class CliExecutor {
  constructor(private readonly transport: CliTransport) {}

  async executeCore(command: CoreCommand, payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(command, payload);
  }

  async authLogin(platform: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["auth", "login", platform], payload);
  }

  async useAccount(target: string, payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["use", "account", target], payload);
  }

  async authList(payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["auth", "list"], payload);
  }

  async authHealth(options?: { alias?: string; json?: boolean }): Promise<unknown> {
    const command: string[] = ["auth", "health"];
    if (options?.alias) {
      command.push("--alias", options.alias);
    }
    if (options?.json) {
      command.push("--json");
    }
    return this.transport.execute(command);
  }

  async authLogout(alias: string, payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["auth", "logout", alias], payload);
  }

  async sitesList(options?: { json?: boolean }, payload?: Record<string, unknown>): Promise<unknown> {
    const command: string[] = ["sites", "list"];
    if (options?.json) {
      command.push("--json");
    }
    return this.transport.execute(command, payload);
  }

  async sitesAdd(site: string, options?: { json?: boolean }, payload?: Record<string, unknown>): Promise<unknown> {
    const command: string[] = ["sites", "add", site];
    if (options?.json) {
      command.push("--json");
    }
    return this.transport.execute(command, payload);
  }

  async manageTask(options?: { id?: string; json?: boolean }): Promise<unknown> {
    const command: string[] = ["manage", "task"];
    if (options?.id) {
      command.push("--id", options.id);
    }
    if (options?.json) {
      command.push("--json");
    }
    return this.transport.execute(command);
  }

  async manageContext(options?: {
    show?: boolean;
    close?: boolean;
    clear?: boolean;
    json?: boolean;
  }): Promise<unknown> {
    const command: string[] = ["manage", "context"];
    if (options?.show) {
      command.push("--show");
    } else if (options?.close) {
      command.push("--close");
    } else if (options?.clear) {
      command.push("--clear");
    }
    if (options?.json) {
      command.push("--json");
    }
    return this.transport.execute(command);
  }

  async manageKeySet(key: string): Promise<unknown> {
    return this.transport.execute(["manage", "key", key]);
  }

  async manageKeyGet(): Promise<unknown> {
    return this.transport.execute(["manage", "key"]);
  }

  async rpcServe(options?: { protocol?: RpcProtocol }): Promise<unknown> {
    const command: string[] = ["rpc", "serve"];
    if (options?.protocol) {
      command.push("--protocol", options.protocol);
    }
    return this.transport.execute(command);
  }

  async executeSite(command: SiteDynamicCommand, payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(this.buildSiteCommand(command), payload);
  }

  async taskStatus(taskId: string): Promise<unknown> {
    return this.transport.execute(["task", "status", "--task-id", taskId]);
  }

  async taskTrace(taskId: string): Promise<unknown> {
    return this.transport.execute(["task", "trace", "--task-id", taskId]);
  }

  private buildSiteCommand(command: SiteDynamicCommand): string[] {
    const extraArgs = command.args ?? [];

    if (command.mode === "explicit-site") {
      if (!command.site) {
        throw new Error("'site' is required for explicit-site mode");
      }
      return [command.site, command.capability, command.action, ...extraArgs];
    }

    if (command.mode === "active-context") {
      return [command.capability, command.action, ...extraArgs];
    }

    if (command.mode === "dotted-active-context") {
      const dotted = `mediause.${command.capability}.${command.action}`;
      return [dotted, ...extraArgs];
    }

    if (!command.site) {
      throw new Error("'site' is required for dotted-explicit-site mode");
    }

    const dotted = `mediause.${command.site}.${command.capability}.${command.action}`;
    return [dotted, ...extraArgs];
  }
}
