import { describe, expect, it, vi } from "vitest";

import { mediause } from "../../../src/sdk/mediause.js";

describe("simple api chain core routing", () => {
  it("exposes root namespace aliases without sdk.chain prefix", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      authList: vi.fn().mockResolvedValue({ ok: true }),
      sitesList: vi.fn().mockResolvedValue({ ok: true }),
      useAccount: vi.fn().mockResolvedValue({ ok: true }),
      manageContext: vi.fn().mockResolvedValue({ ok: true }),
      traceLast: vi.fn().mockResolvedValue({ ok: true }),
      rpcServe: vi.fn().mockResolvedValue({ ok: true }),
      executeCore: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    await sdk.auth.list();
    await sdk.registry.list();
    await sdk.use.account("weibo:main");
    await sdk.manage.context.show();
    await sdk.trace.last();
    await sdk.rpc.serve();
    await sdk.help.root();

    expect(fakeCli.authList).toHaveBeenCalledTimes(1);
    expect(fakeCli.sitesList).toHaveBeenCalledTimes(1);
    expect(fakeCli.useAccount).toHaveBeenCalledWith("weibo:main", {
      policy: undefined,
      idleTimeoutSeconds: undefined,
      json: undefined,
    }, undefined);
    expect(fakeCli.manageContext).toHaveBeenCalledWith({ show: true, json: false });
    expect(fakeCli.traceLast).toHaveBeenCalledTimes(1);
    expect(fakeCli.rpcServe).toHaveBeenCalledWith(undefined);
    expect(fakeCli.executeCore).toHaveBeenCalledWith(["help"]);
  });

  it("routes core commands through sdk.chain", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      executeCore: vi.fn().mockResolvedValue({ ok: true }),
      sitesList: vi.fn().mockResolvedValue({ ok: true }),
      sitesAdd: vi.fn().mockResolvedValue({ ok: true }),
      useAccount: vi.fn().mockResolvedValue({ ok: true }),
      manageContext: vi.fn().mockResolvedValue({ ok: true }),
      manageKeyGet: vi.fn().mockResolvedValue("mu-demo"),
      manageKeySet: vi.fn().mockResolvedValue({ ok: true }),
      manageTask: vi.fn().mockResolvedValue({ ok: true }),
      taskStatus: vi.fn().mockResolvedValue({ ok: true }),
      taskTrace: vi.fn().mockResolvedValue({ ok: true }),
      traceLast: vi.fn().mockResolvedValue({ ok: true }),
      rpcServe: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    await sdk.chain.help.root(true);
    await sdk.chain.version.get(true);
    await sdk.chain.close.run(true);
    await sdk.chain.sites.list({ json: true }, { source: "test" });
    await sdk.chain.sites.add("xiaohongshu", { json: true });
    await sdk.chain.use.account("xiaohongshu:main", {
      policy: "balanced",
      idleTimeoutSeconds: 120,
      json: true,
      payload: { source: "flow" },
    });
    await sdk.chain.manage.context.open(true);
    await sdk.chain.manage.key.get();
    await sdk.chain.manage.key.set("mu-next");
    await sdk.chain.manage.task({ id: "task-1", json: true });
    await sdk.chain.task.status("task-1");
    await sdk.chain.task.trace("task-1");
    await sdk.chain.trace.last();
    await sdk.chain.rpc.serve({ protocol: "jsonrpc-stdio" });

    expect(fakeCli.executeCore).toHaveBeenNthCalledWith(1, ["help", "--json"]);
    expect(fakeCli.executeCore).toHaveBeenNthCalledWith(2, ["version", "--json"]);
    expect(fakeCli.executeCore).toHaveBeenNthCalledWith(3, ["close", "--json"]);
    expect(fakeCli.sitesList).toHaveBeenCalledWith({ json: true }, { source: "test" });
    expect(fakeCli.sitesAdd).toHaveBeenCalledWith("xiaohongshu", { json: true }, undefined);
    expect(fakeCli.useAccount).toHaveBeenCalledWith(
      "xiaohongshu:main",
      { policy: "balanced", idleTimeoutSeconds: 120, json: true },
      { source: "flow" },
    );
    expect(fakeCli.manageContext).toHaveBeenCalledWith({ open: true, json: true });
    expect(fakeCli.manageKeyGet).toHaveBeenCalledTimes(1);
    expect(fakeCli.manageKeySet).toHaveBeenCalledWith("mu-next");
    expect(fakeCli.manageTask).toHaveBeenCalledWith({ id: "task-1", json: true });
    expect(fakeCli.taskStatus).toHaveBeenCalledWith("task-1");
    expect(fakeCli.taskTrace).toHaveBeenCalledWith("task-1");
    expect(fakeCli.traceLast).toHaveBeenCalledTimes(1);
    expect(fakeCli.rpcServe).toHaveBeenCalledWith({ protocol: "jsonrpc-stdio" });
  });
});
