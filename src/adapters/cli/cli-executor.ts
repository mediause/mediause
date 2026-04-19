export type CliTransport = {
  execute(command: string[], payload?: Record<string, unknown>): Promise<unknown>;
};

export type CoreCommand =
  | ["help"]
  | ["help", string]
  | ["version"]
  | ["close"]
  | ["auth", "login", string]
  | ["auth", "list"]
  | ["auth", "health"]
  | ["auth", "logout", string]
  | ["use", "account", string]
  | ["manage", "task"]
  | ["manage", "context"]
  | ["manage", "key"]
  | ["manage", "key", string]
  | ["trace", "last"]
  | ["task", "status", "--task-id", string]
  | ["task", "trace", "--task-id", string]
  | ["rpc", "serve"];

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

  async authHealth(payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["auth", "health"], payload);
  }

  async authLogout(alias: string, payload?: Record<string, unknown>): Promise<unknown> {
    return this.transport.execute(["auth", "logout", alias], payload);
  }

  async manageKeySet(key: string): Promise<unknown> {
    return this.transport.execute(["manage", "key", key]);
  }

  async manageKeyGet(): Promise<unknown> {
    return this.transport.execute(["manage", "key"]);
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
