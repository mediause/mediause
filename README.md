# MediaUse SDK

TypeScript toolkit for building MediaUse automations on top of the existing MediaUse CLI Rust core.

This repository now defines a fresh SDK-oriented architecture with five layers:

1. SDK (TS API) for developers and agents
2. Control Plane (orchestration, workflow, policy, state)
3. Runtime Layer (site runtime, account/session, normalization)
4. Scheduler (queue, retry, cron-like recurring jobs)
5. CLI Adapter boundary to the closed Rust core

## Current Scope

- TypeScript SDK skeleton (`src/sdk`)
- Control plane foundation (`src/control-plane`)
- Runtime and site plugin management (`src/runtime`)
- Task scheduling primitives (`src/scheduler`)
- Account and workflow modules (`src/accounts`, `src/workflow`)
- CLI execution adapter contracts (`src/adapters/cli`)

## Installation

```bash
npm install
```

During `npm install`, the package runs a `postinstall` bootstrap that prepares MediaUse CLI automatically.
This behavior is similar to binary-assisted packages such as sqlite toolchains.

See detailed postinstall behavior in `docs/POSTINSTALL.md`.

You can also trigger it manually:

```bash
npm run bootstrap:cli
```

Environment variables for install-time bootstrap:

- `MEDIAUSE_SKIP_POSTINSTALL=1`: skip binary bootstrap
- `MEDIAUSE_CLI_VERSION=3.2.1`: pin target CLI version
- `MEDIAUSE_CLI_MANIFEST_URL=https://releases.mediause.dev/cli`: set manifest base URL
- `MEDIAUSE_CLI_LATEST_VERSION_URL=...`: override latest resolver URL
- `MEDIAUSE_CLI_CACHE_DIR=...`: override binary cache directory
- `MEDIAUSE_CLI_BINARY_NAME=mediause`: override binary command name
- `MEDIAUSE_CLI_POSTINSTALL_STRICT=0`: do not fail install when bootstrap fails

## Build

```bash
npm run typecheck
npm run build
```

## Quick Start

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
	cli: {
		manifestUrl: "https://releases.mediause.dev/cli",
		autoInstall: true,
	},
});

// Register site plugin(s) before running tasks.
sdk.sites.register({
	id: "twitter-runtime",
	platform: "twitter",
	supports: (task) => task.action === "post",
	async execute(task) {
		return {
			taskId: task.id,
			status: "succeeded",
			startedAt: Date.now(),
			endedAt: Date.now(),
			attempt: 1,
			data: { accepted: true },
		};
	},
});

await sdk.post("twitter", {
	text: "Hello from MediaUse SDK Toolkit",
	media: [{ url: "https://example.com/a.png", type: "image" }],
});
```

## API Key Input (Tavily-Style)

MediaUse SDK supports Tavily-like key input at initialization:

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
	cli: {
		manifestUrl: "https://releases.mediause.dev/cli",
	},
});
```

Equivalent compatibility field is also supported:

```ts
const sdk = mediause(undefined, { api_key: "mu-YOUR_API_KEY", cli: { manifestUrl: "https://releases.mediause.dev/cli" } });
```

At runtime, key management is backed by CLI `manage key`:

```ts
await sdk.setApiKey("mu-NEW_KEY");
const currentKey = await sdk.getApiKey();
```

## CLI Auto Install and Version Management

The SDK treats MediaUse CLI as a required local runtime.

When `cli` options are provided, the SDK will:

1. Detect OS and architecture (`windows|linux|macos` + `x64|arm64`)
2. Resolve target CLI version:
	- use `expectedVersion` when provided
	- otherwise fetch `latest.json` from manifest endpoint and use latest
3. Probe existing CLI (`mediause version --json`)
4. Reuse an existing binary when version already matches target
5. Auto-download the correct binary if missing or mismatched
6. Verify checksum (`sha256`) from release manifest
7. Activate cached binary and block execution if no compatible artifact exists

If there is no artifact for the current system/version, initialization fails and task execution is blocked.

### Runtime Manifest Shape

The SDK supports both release layouts:

1. Preferred: `${manifestUrl}/latest.json` is a full manifest (`version` + `assets`)
2. Backward compatible: `${manifestUrl}/latest.json` returns only version pointer, then SDK fetches `${manifestUrl}/${resolvedVersion}.json`

Manifest shape:

```json
{
	"version": "3.2.1",
	"assets": {
		"windows-x64": {
			"url": "https://releases.mediause.dev/cli/3.2.1/mediause-windows-x64.exe",
			"sha256": "..."
		},
		"linux-x64": {
			"url": "https://releases.mediause.dev/cli/3.2.1/mediause-linux-x64",
			"sha256": "..."
		},
		"macos-arm64": {
			"url": "https://releases.mediause.dev/cli/3.2.1/mediause-macos-arm64",
			"sha256": "..."
		}
	}
}
```

Latest version discovery payload (`${manifestUrl}/latest.json`) also accepts pointer-only formats:

```json
{ "version": "3.2.1" }
```

or

```json
{ "latest": "3.2.1" }
```

### Cache Location

- Windows: `%LOCALAPPDATA%/mediause/cli-cache`
- macOS: `~/Library/Caches/mediause/cli-cache`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/mediause/cli-cache`

Use `sdk.getCliBinaryInfo()` to inspect the activated binary path and source.

## End-to-End CLI Execution from SDK

After bootstrap, create a CLI executor directly from the toolkit:

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
	cli: {
		manifestUrl: "https://releases.mediause.dev/cli",
		autoInstall: true,
	},
});

const cli = await sdk.createCliExecutor();

await cli.sitesList();
await cli.sitesAdd("xiaohongshu"); // reserved no-op in current CLI
await cli.executeCore(["auth", "list"]);
await cli.executeSite({
	mode: "active-context",
	capability: "content",
	action: "publish",
	args: ["--text", "hello from sdk"],
});
```

`createCliExecutor()` uses the bootstrap-activated binary path automatically.

## Scheduling Example

```ts
mediause.schedule({
	cron: "*/30 * * * * *",
	task: {
		id: "sync-timeline-1",
		platform: "twitter",
		action: "get",
		payload: { type: "feed", limit: 20 },
		maxRetries: 5,
		priority: "normal",
	},
});
```

## Workflow Example

```ts
mediause.registerWorkflow({
	id: "post-and-engage",
	name: "Post and then like a target",
	steps: [
		{
			id: "step-post",
			platform: "twitter",
			action: "post",
			payload: { text: "new post" },
		},
		{
			id: "step-like",
			platform: "twitter",
			action: "engage",
			payload: { type: "like", id: "target-post-id" },
			continueOnError: true,
		},
	],
});

const workflowResult = await mediause.runWorkflow("post-and-engage");
```

## CLI Command Boundary

The SDK is aligned with the latest CLI boundary model in `docs/CLI_COMMAND_TREE.md`:

- Core commands own runtime/auth/context/service lifecycle operations only.
- All website capability actions are dynamic and resolved from site plugin command manifests.
- Old static top-level core verbs (`post`, `get`, `user`, `reply`, `search`, `engage`) are not core entries.

The CLI adapter supports both command families:

- Core: `sites`, `auth`, `use`, `manage`, `trace`, `task`, `rpc`, plus `help/version/close`
- Site dynamic invocation modes:
	- `mediause <site> <capability> <action> [args]`
	- `mediause <capability> <action> [args]` (site from active context)
	- `mediause.<capability>.<action> [args]`
	- `mediause.<site>.<capability>.<action> [args]`

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/SDK_TOOLKIT.md`
- `docs/ROADMAP.md`

