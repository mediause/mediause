import { describe, expect, it } from "vitest";

import { MediaUseToolkit } from "../../../src/sdk/mediause.js";

describe("workflow manager", () => {
  it("fails when workflow is not registered", async () => {
    const sdk = new MediaUseToolkit();

    await expect(sdk.runWorkflow("missing-workflow")).rejects.toThrow(
      "Workflow 'missing-workflow' is not registered",
    );
  });
});
