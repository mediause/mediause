import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const entryUrl = new URL("../dist/adapters/cli/postinstall.js", import.meta.url);
const entryPath = fileURLToPath(entryUrl);

if (!existsSync(entryPath)) {
  console.log("[mediause-core] dist entry missing; skipping CLI bootstrap in source checkout.");
  process.exit(0);
}

try {
  const mod = await import(entryUrl.href);
  if (typeof mod.runPostinstall !== "function") {
    throw new Error("runPostinstall export not found");
  }

  await mod.runPostinstall();
} catch (error) {
  const strict = process.env.MEDIAUSE_CLI_POSTINSTALL_STRICT !== "0";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mediause-core] CLI bootstrap failed during postinstall: ${message}`);

  if (strict) {
    process.exit(1);
  }

  console.warn("[mediause-core] Continuing install because MEDIAUSE_CLI_POSTINSTALL_STRICT=0");
}
