# MediaUse Core

Language: [English](README.md) | [中文](README.zh-CN.md)

MediaUse is an AI infrastructure project for Web media operations.
Website: https://mediause.dev/

This repository publishes the TypeScript SDK package @mediause/core.

## What Is MediaUse

MediaUse standardizes website operations into a CLI + SDK model that can be used by developers, AI agents, and automation systems.

Unlike tools focused only on social media, MediaUse is designed for broad Web media categories, including:

- social platforms (for example: Twitter)
- content and publishing sites
- e-commerce data workflows
- stock and market information workflows

These capabilities are delivered through site plugins.

## Why MediaUse

- Fast native Rust CLI, not a Node.js wrapper, startup in milliseconds
- Works with any AI agent (Cursor, Claude Code, Codex, Continue, Windsurf, and more)
- Chrome/Chromium automation via CDP, with no Playwright or Puppeteer dependency
- Supports OAuth, webhooks, bridge mode, and automation mode
- Sessions, authentication vault, and state persistence built in
- Supports native Web APIs

## MediaUse CLI and SDK

MediaUse CLI is the canonical execution layer.
The SDK in this repository provides a developer-friendly API on top of that layer.

In practice:

- CLI defines command contracts and runtime behavior
- SDK provides orchestration and integration ergonomics
- SDK keeps local CLI binaries ready and version-aligned for execution

## Core Value for Customers

- One SDK surface for multiple website domains
- Plugin-based site expansion instead of one-off integrations
- Built-in local CLI bootstrap and version management
- Compatible with agent frameworks through structured command flows

## Install

```bash
npm install @mediause/core
```

Or, when working directly from source:

```bash
npm install
```

## Quick Start

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY");

await sdk.auth.login("weibo");
await sdk.use.account("weibo:main");

await sdk.site("weibo").post.feed({
  title: "Hello from MediaUse",
  content: "Simple SDK flow",
  media: ["./cover.jpg"],
});
```

## Simple SDK API

The SDK provides a direct and readable command style:

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY");

await sdk.auth.list();
await sdk.auth.login("weibo");

await sdk.site("weibo").post.feed({
  title: "Title",
  content: "Body",
  media: ["./a.jpg", "./b.jpg"],
  draft: true,
});
```

All CLI-facing operations can be executed in chain style:

```ts
await sdk.auth.list();
await sdk.auth.login("weibo");

await sdk.registry.list({ json: true });
await sdk.registry.add("weibo", { json: true });

await sdk.use.account("weibo:main", {
  policy: "balanced",
  idleTimeoutSeconds: 120,
  json: true,
});

await sdk.manage.context.open(true);
await sdk.manage.key.get();
await sdk.manage.key.set("mu-NEW_KEY");
await sdk.manage.task({ id: "task-id", json: true });
await sdk.task.status("task-id");
await sdk.trace.last();

await sdk.help.root(true);
await sdk.version.get(true);
await sdk.close.run(true);
```

For dynamic site commands:

- `sdk.site("<site>").<capability>.<action>(input, payload?)`
- `sdk.site().<capability>.<action>(input, payload?)` (active context)
- `sdk.flow("<site>", "<account>").<capability>.<action>(input, payload?)` (flow-scoped shorthand)

`input` supports object, string array, or primitive values.
Object input is converted to CLI args with deterministic rules:

- camelCase keys become kebab-case flags
- array values become repeated flags
- `true` becomes a flag-only switch
- `false`, `null`, and `undefined` are omitted

## Flow Constraints (Skill-Aligned)

For workflows such as Xiaohongshu, the recommended order is:

1. discover site commands
2. bind account context (`use account`)
3. run auth health
4. execute dynamic site actions

You can enforce this order with the built-in flow chain:

```ts
const flow = sdk.flow("xiaohongshu", "main");

await flow.discover();
await flow.useAccount({ policy: "balanced" });
await flow.authHealth();

await flow.search.hot();
await flow.post.feed({
  title: "今日推荐",
  text: "草稿内容",
  media: ["c:/tmp/a.png"],
});

await sdk.trace.last();
```

Or one-shot preparation:

```ts
const flow = sdk.flow("xiaohongshu", "main");
await flow.ready({ useAccount: { policy: "balanced" } });
await flow.post.feed({ title: "hello", text: "world" });
```

## API Key Usage

Initialization is supported:

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
  },
});
```

Compatibility input is also supported:

```ts
const sdk = mediause(undefined, {
  api_key: "mu-YOUR_API_KEY",
  cli: { manifestUrl: "https://releases.mediause.dev/cli" },
});
```

Runtime key operations:

```ts
await sdk.setApiKey("mu-NEW_KEY");
const currentKey = await sdk.getApiKey();
```

## Advanced CLI Control

Low-level command control is still available when you need direct command routing:

```ts
const cli = await sdk.createCliExecutor();

await cli.sitesList();
await cli.executeCore(["auth", "list"]);
await cli.executeSite({
  mode: "active-context",
  capability: "content",
  action: "publish",
  args: ["--text", "Hello from MediaUse"],
});
```

## CLI Binary Bootstrap

The SDK supports install-time and runtime bootstrap of MediaUse CLI binaries.

Behavior summary:

1. detect OS and architecture
2. resolve target CLI version (pinned or latest)
3. reuse compatible local binary when available
4. download and verify checksum when needed
5. fail fast when no compatible artifact exists

Useful environment variables:

- MEDIAUSE_SKIP_POSTINSTALL=1
- MEDIAUSE_CLI_VERSION=3.2.1
- MEDIAUSE_CLI_MANIFEST_URL=https://releases.mediause.dev/cli
- MEDIAUSE_CLI_LATEST_VERSION_URL=...
- MEDIAUSE_CLI_CACHE_DIR=...
- MEDIAUSE_CLI_BINARY_NAME=mediause
- MEDIAUSE_CLI_POSTINSTALL_STRICT=0

## Command Model

MediaUse uses a Core + Sites model:

- Core commands: sites, auth, use, manage, trace, task, rpc, help/version/close
- Site dynamic commands: capability/action exposed by site plugin manifests

Dynamic invocation forms:

- mediause <site> <capability> <action> [args]
- mediause <capability> <action> [args]
- mediause.<capability>.<action> [args]
- mediause.<site>.<capability>.<action> [args]

Core command notes:

- `auth login <platform[/entry]>` is supported for multi-login systems on one site (example: `mediause auth login xiaohongshu/creator`).
- `manage context --open` opens/focuses current context webview; `manage context --close` closes current webview session.

## Customer-Facing Scenarios

- manage and automate multi-site media operations from one SDK
- run structured content workflows (publish/fetch/audit)
- integrate site-level data pipelines (e-commerce and market information)
- plug MediaUse into AI agent systems with predictable command contracts

## More Documentation

- docs/CLI_COMMAND_TREE.md
- docs/ARCHITECTURE.md
- docs/SDK_USAGE_GUIDE.md
- docs/SDK_TOOLKIT.md
- docs/ROADMAP.md

