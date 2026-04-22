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

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
    autoInstall: true,
  },
});

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

## API Key Usage

Tavily-style initialization is supported:

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

## Customer-Facing Scenarios

- manage and automate multi-site media operations from one SDK
- run structured content workflows (publish/fetch/audit)
- integrate site-level data pipelines (e-commerce and market information)
- plug MediaUse into AI agent systems with predictable command contracts

## More Documentation

- docs/CLI_COMMAND_TREE.md
- docs/ARCHITECTURE.md
- docs/SDK_TOOLKIT.md
- docs/ROADMAP.md

