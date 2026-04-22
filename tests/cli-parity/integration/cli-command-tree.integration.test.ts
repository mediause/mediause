import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

describe("CLI command tree snapshot", () => {
  it("contains core sites section", () => {
    const filePath = path.resolve(process.cwd(), "docs/CLI_COMMAND_TREE.md");
    const text = readFileSync(filePath, "utf8");

    expect(text).toContain("- sites");
    expect(text).toContain("- list [--json]");
    expect(text).toContain("- add <site> [--json]");
  });
});
