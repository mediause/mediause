# MediaUse SDK Usage Guide

This guide is a practical, end-to-end reference for developers integrating `@mediause/core`.

It focuses on the current recommended calling style:

- root command chain: `sdk.auth.list()`, `sdk.use.account(...)`, `sdk.manage.context.open()`
- dynamic site chain: `sdk.site("weibo").post.feed(...)`
- flow-scoped shorthand: `sdk.flow("xiaohongshu", "main").search.hot()`

## 1. Install and Initialize

Install package:

```bash
npm install @mediause/core
```

Create SDK instance:

```ts
import { mediause } from "@mediause/core";

const sdk = mediause("mu-YOUR_API_KEY", {
  cli: {
    manifestUrl: "https://releases.mediause.dev/cli",
    autoInstall: true,
  },
});
```

Notes:

- `mediause("mu-...")` is the preferred initialization style.
- `api_key` in options is still supported for compatibility.
- CLI bootstrap is lazy and happens before first command execution.

## 2. API Surface Overview

The SDK has three major usage styles.

1. Root command chain (recommended for CLI-facing operations)
2. Dynamic site chain (`sdk.site(...)`)
3. Flow chain (`sdk.flow(...)`) with enforced sequence and shorthand calls

### 2.1 Root Command Chain

```ts
await sdk.auth.list();
await sdk.auth.login("weibo");
await sdk.auth.login("xiaohongshu/creator");

await sdk.registry.list({ json: true });
await sdk.registry.add("xiaohongshu", { json: true });

await sdk.use.account("xiaohongshu:main", {
  policy: "balanced",
  idleTimeoutSeconds: 120,
  json: true,
});

await sdk.manage.context.show(true);
await sdk.manage.context.open(true);
await sdk.manage.context.close(true);
await sdk.manage.context.clear(true);

await sdk.manage.key.get();
await sdk.manage.key.set("mu-NEW_KEY");

await sdk.manage.task({ id: "task-id", json: true });
await sdk.task.status("task-id");
await sdk.task.trace("task-id");

await sdk.trace.last();
await sdk.rpc.serve({ protocol: "jsonrpc-stdio" });

await sdk.help.root(true);
await sdk.version.get(true);
await sdk.close.run(true);
```

### 2.2 Dynamic Site Chain

Explicit site:

```ts
await sdk.site("weibo").post.feed({
  title: "Title",
  text: "Body",
  media: ["./a.jpg", "./b.jpg"],
  draft: true,
});
```

Active context:

```ts
await sdk.site().search.hot();
```

### 2.3 Flow Chain (Skill-Aligned)

Flow chain enforces operation order and can be used with shorthand dynamic calls.

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

One-shot preparation:

```ts
const flow = sdk.flow("xiaohongshu", "main");
await flow.ready({ useAccount: { policy: "balanced" } });
await flow.post.feed({ title: "hello", text: "world" });
```

## 3. Command Mapping to MediaUse CLI

The SDK is a wrapper over CLI contracts. It does not invent new backend command semantics.

Examples:

- `sdk.auth.login("weibo")` -> `mediause auth login weibo`
- `sdk.auth.login("xiaohongshu/creator")` -> `mediause auth login xiaohongshu/creator`
- `sdk.use.account("xiaohongshu:main")` -> `mediause use account xiaohongshu:main`
- `sdk.site("xiaohongshu").search.hot()` -> `mediause xiaohongshu search hot`
- `sdk.site().post.feed(...)` -> `mediause post feed ...` (active context)

`auth login` supports two forms:

1. `platform` (for example `weibo`)
2. `platform/entry` (for example `xiaohongshu/creator`)

Use `platform/entry` when a single platform provides multiple login entry systems.

## 4. Dynamic Input Serialization Rules

Dynamic actions accept:

- object input
- argv array input
- primitive input (`string | number | boolean`)

Object input is serialized deterministically:

1. key order is lexicographic
2. camelCase converts to kebab-case flag names
3. arrays become repeated flags
4. `true` becomes flag-only switch
5. `false`, `null`, and `undefined` are omitted
6. plain object values are JSON-stringified

Example:

Input:

```ts
{
  title: "A",
  text: "B",
  media: ["a.jpg", "b.jpg"],
  dryRun: false,
  draft: true,
  meta: { source: "guide" },
}
```

Generated argv:

```text
--draft --media a.jpg --media b.jpg --meta {"source":"guide"} --text B --title A
```

## 5. Flow Constraints and Safety

Flow API follows the sequence used in operational skill docs:

1. discover site command metadata
2. bind account context
3. check auth health
4. execute dynamic actions

If you attempt dynamic actions before `useAccount()` or `authHealth()`, flow throws explicit errors.

This behavior helps avoid unsafe execution order and account-context mistakes.

## 6. API Key Management

Set key at runtime:

```ts
await sdk.setApiKey("mu-NEW_KEY");
```

Read current key:

```ts
const key = await sdk.getApiKey();
```

Compatibility input:

```ts
const sdk = mediause(undefined, {
  api_key: "mu-YOUR_API_KEY",
  cli: { manifestUrl: "https://releases.mediause.dev/cli" },
});
```

## 7. Error Handling Patterns

Recommended pattern:

```ts
try {
  await sdk.use.account("xiaohongshu:main", { json: true });
  await sdk.auth.health({ json: true });
  await sdk.site("xiaohongshu").post.feed({ title: "hello", text: "world" });
} catch (error) {
  console.error("MediaUse SDK execution failed", error);
  // Optional: fallback diagnostics
  await sdk.trace.last().catch(() => undefined);
}
```

For flow constraints:

- call order violations throw synchronously when resolving capability on flow
- execution errors from CLI calls reject asynchronously

## 8. Xiaohongshu Example (Full Path)

```ts
const flow = sdk.flow("xiaohongshu", "main");

await flow.ready({
  useAccount: {
    policy: "balanced",
    json: true,
  },
  authHealth: { json: true },
});

await flow.search.hot();

await flow.post.feed({
  title: "2026穿搭",
  text: "今日分享",
  media: ["c:/tmp/a.mp4"],
  cover: "c:/tmp/cover.png",
});

await sdk.trace.last();
```

## 9. Advanced Mode (Direct Executor)

For low-level control, use executor directly:

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

Use advanced mode only when root/flow chains cannot express your command strategy.

## 10. Migration Cheatsheet

Old style:

```ts
const cli = await sdk.createCliExecutor();
await cli.executeCore(["auth", "list"]);
await cli.executeSite({
  mode: "explicit-site",
  site: "weibo",
  capability: "post",
  action: "feed",
  args: ["--text", "hello"],
});
```

Recommended style:

```ts
await sdk.auth.list();
await sdk.site("weibo").post.feed({ text: "hello" });
```

Flow-constrained style:

```ts
const flow = sdk.flow("weibo", "main");
await flow.ready();
await flow.post.feed({ text: "hello" });
```

## 11. Best Practices

1. Prefer root command chain for all core commands.
2. Prefer `flow(...)` for account-sensitive publish/engage workflows.
3. Keep `json: true` on machine workflows for stable parsing.
4. Use `trace.last()` for diagnostics after failures.
5. Keep direct executor usage only for advanced/edge cases.

## 12. Quick Reference

- Login: `sdk.auth.login("xiaohongshu")`
- Context bind: `sdk.use.account("xiaohongshu:main", { json: true })`
- Health check: `sdk.auth.health({ json: true })`
- Discover: `sdk.registry.list({ json: true })`
- Dynamic read: `sdk.site("xiaohongshu").search.hot()`
- Flow shorthand: `sdk.flow("xiaohongshu", "main").search.hot()`
- Publish: `sdk.site("xiaohongshu").post.feed({ title, text, media })`
- Last trace: `sdk.trace.last()`
