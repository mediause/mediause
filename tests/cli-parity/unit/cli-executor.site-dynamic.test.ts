import { describe, expect, it } from "vitest";

import { CliExecutor, type CliTransport } from "../../../src/adapters/cli/cli-executor.js";

class CaptureTransport implements CliTransport {
  readonly commands: string[][] = [];

  async execute(command: string[]): Promise<unknown> {
    this.commands.push(command);
    return { ok: true };
  }
}

describe("CliExecutor site dynamic command modes", () => {
  it("uses explicit site mode", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.executeSite({
      mode: "explicit-site",
      site: "xiaohongshu",
      capability: "content",
      action: "publish",
      args: ["--text", "hello"],
    });

    expect(transport.commands[0]).toEqual([
      "xiaohongshu",
      "content",
      "publish",
      "--text",
      "hello",
    ]);
  });

  it("uses active-context mode", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.executeSite({
      mode: "active-context",
      capability: "content",
      action: "publish",
      args: ["--text", "hello"],
    });

    expect(transport.commands[0]).toEqual(["content", "publish", "--text", "hello"]);
  });

  it("uses dotted explicit site mode", async () => {
    const transport = new CaptureTransport();
    const executor = new CliExecutor(transport);

    await executor.executeSite({
      mode: "dotted-explicit-site",
      site: "xiaohongshu",
      capability: "content",
      action: "publish",
    });

    expect(transport.commands[0]).toEqual(["mediause.xiaohongshu.content.publish"]);
  });
});
