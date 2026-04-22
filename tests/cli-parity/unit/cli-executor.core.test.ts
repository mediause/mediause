import { describe, expect, it } from "vitest";

import { CliExecutor, type CliTransport } from "../../../src/adapters/cli/cli-executor.js";

type Captured = {
  command: string[];
  payload?: Record<string, unknown>;
};

class CaptureTransport implements CliTransport {
  readonly calls: Captured[] = [];

  async execute(command: string[], payload?: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ command, payload });
    return { ok: true };
  }
}

describe("CliExecutor core command routing", () => {
  it("routes sites list with json flag", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.sitesList({ json: true });

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.command).toEqual(["sites", "list", "--json"]);
  });

  it("routes sites add with json flag", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.sitesAdd("xiaohongshu", { json: true });

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.command).toEqual(["sites", "add", "xiaohongshu", "--json"]);
  });

  it("routes auth health alias form", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.authHealth({ alias: "xiaohongshu:main", json: true });

    expect(transport.calls[0]?.command).toEqual([
      "auth",
      "health",
      "--alias",
      "xiaohongshu:main",
      "--json",
    ]);
  });

  it("routes manage context close form", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.manageContext({ close: true, json: true });

    expect(transport.calls[0]?.command).toEqual(["manage", "context", "--close", "--json"]);
  });

  it("routes rpc serve protocol form", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.rpcServe({ protocol: "jsonrpc-tcp" });

    expect(transport.calls[0]?.command).toEqual(["rpc", "serve", "--protocol", "jsonrpc-tcp"]);
  });
});
