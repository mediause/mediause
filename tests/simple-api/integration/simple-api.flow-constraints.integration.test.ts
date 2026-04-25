import { describe, expect, it, vi } from "vitest";

import { mediause } from "../../../src/sdk/mediause.js";

describe("simple api flow constraints", () => {
  it("enforces useAccount and authHealth before dynamic site actions", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      sitesList: vi.fn().mockResolvedValue({ ok: true }),
      sitesAdd: vi.fn().mockResolvedValue({ ok: true }),
      useAccount: vi.fn().mockResolvedValue({ ok: true }),
      authHealth: vi.fn().mockResolvedValue({ ok: true }),
      executeSite: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    const flow = sdk.chain.flow("xiaohongshu", "main");

    expect(() => flow.site()).toThrow("call useAccount() before dynamic site actions");
    expect(() => flow.search.hot()).toThrow("call useAccount() before dynamic site actions");

    await flow.useAccount();
    expect(() => flow.site()).toThrow("call authHealth() before dynamic site actions");
    expect(() => flow.search.hot()).toThrow("call authHealth() before dynamic site actions");

    await flow.authHealth();
    await flow.search.hot();
    await flow.site().post.feed({ title: "t", text: "c" });

    expect(fakeCli.executeSite).toHaveBeenNthCalledWith(
      1,
      {
        mode: "explicit-site",
        site: "xiaohongshu",
        capability: "search",
        action: "hot",
        args: [],
      },
      undefined,
    );
    expect(fakeCli.executeSite).toHaveBeenNthCalledWith(
      2,
      {
        mode: "explicit-site",
        site: "xiaohongshu",
        capability: "post",
        action: "feed",
        args: ["--text", "c", "--title", "t"],
      },
      undefined,
    );
  });

  it("supports one-shot ready flow based on skill order", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      sitesList: vi.fn().mockResolvedValue({ ok: true }),
      sitesAdd: vi.fn().mockResolvedValue({ ok: true }),
      useAccount: vi.fn().mockResolvedValue({ ok: true }),
      authHealth: vi.fn().mockResolvedValue({ ok: true }),
      executeSite: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    const flow = sdk.chain.flow("xiaohongshu", "main");
    await flow.ready({ useAccount: { policy: "balanced" } });
    await flow.search.hot();

    expect(fakeCli.sitesList).toHaveBeenCalledWith({ json: true }, undefined);
    expect(fakeCli.sitesAdd).toHaveBeenCalledWith("xiaohongshu", { json: true }, undefined);
    expect(fakeCli.useAccount).toHaveBeenCalledWith(
      "xiaohongshu:main",
      { policy: "balanced", idleTimeoutSeconds: undefined, json: true },
      undefined,
    );
    expect(fakeCli.authHealth).toHaveBeenCalledWith({ alias: undefined, json: true });
    expect(fakeCli.executeSite).toHaveBeenCalledWith(
      {
        mode: "explicit-site",
        site: "xiaohongshu",
        capability: "search",
        action: "hot",
        args: [],
      },
      undefined,
    );
  });
});
