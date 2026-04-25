import { describe, expect, it, vi } from "vitest";

import { mediause } from "../../../src/sdk/mediause.js";

describe("simple api dynamic site chain", () => {
  it("routes explicit-site mode and converts object input to args", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      executeSite: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    await sdk.site("weibo").post.feed(
      {
        title: "Hello",
        content: "World",
        media: ["a.jpg", "b.jpg"],
        draft: true,
        dryRun: false,
        meta: { origin: "test" },
      },
      { traceId: "t-1" },
    );

    expect(fakeCli.executeSite).toHaveBeenCalledWith(
      {
        mode: "explicit-site",
        site: "weibo",
        capability: "post",
        action: "feed",
        args: [
          "--content",
          "World",
          "--draft",
          "--media",
          "a.jpg",
          "--media",
          "b.jpg",
          "--meta",
          '{"origin":"test"}',
          "--title",
          "Hello",
        ],
      },
      { traceId: "t-1" },
    );
  });

  it("routes active-context mode and passes array input", async () => {
    const sdk = mediause(undefined);

    const fakeCli = {
      executeSite: vi.fn().mockResolvedValue({ ok: true }),
    };

    vi.spyOn(sdk, "createCliExecutor").mockResolvedValue(fakeCli as never);

    await sdk.site().post.feed(["--title", "T", "--content", "C"]);

    expect(fakeCli.executeSite).toHaveBeenCalledWith(
      {
        mode: "active-context",
        site: undefined,
        capability: "post",
        action: "feed",
        args: ["--title", "T", "--content", "C"],
      },
      undefined,
    );
  });

  it("rejects empty explicit site", () => {
    const sdk = mediause(undefined);

    expect(() => sdk.site("   ")).toThrow("siteId cannot be empty when provided");
  });
});
