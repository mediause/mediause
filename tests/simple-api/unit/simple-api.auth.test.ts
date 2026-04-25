import { describe, expect, it, vi } from "vitest";

import { mediause } from "../../../src/sdk/mediause.js";

describe("simple api auth namespace", () => {
  it("routes auth list/login/logout to cli executor", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      authList: vi.fn().mockResolvedValue({ ok: true }),
      authLogin: vi.fn().mockResolvedValue({ ok: true }),
      authHealth: vi.fn().mockResolvedValue({ ok: true }),
      authLogout: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    await sdk.auth.list({ trace: true });
    await sdk.auth.login("weibo", { interactive: true });
    await sdk.auth.health({ alias: "weibo:main", json: true });
    await sdk.auth.logout("weibo:main");

    expect(fakeCli.authList).toHaveBeenCalledWith({ trace: true });
    expect(fakeCli.authLogin).toHaveBeenCalledWith("weibo", { interactive: true });
    expect(fakeCli.authHealth).toHaveBeenCalledWith({ alias: "weibo:main", json: true });
    expect(fakeCli.authLogout).toHaveBeenCalledWith("weibo:main", undefined);
  });

  it("rejects empty login platform", async () => {
    const sdk = mediause(undefined);

    await expect(sdk.auth.login("   ")).rejects.toThrow("platform cannot be empty");
  });

  it("rejects empty logout alias", async () => {
    const sdk = mediause(undefined);

    await expect(sdk.auth.logout("   ")).rejects.toThrow("alias cannot be empty");
  });
});
