# SDK Simple API Refactor Plan

Status: Draft v1
Scope: @mediause/core SDK API layer only (CLI contracts unchanged)

## Goal

Provide a more intuitive SDK surface so users can start with:

```ts
const sdk = mediause("mu-YOUR_API_KEY");
await sdk.auth.list();
await sdk.auth.login("weibo");
await sdk.site("weibo").post.feed({
  title: "...",
  content: "...",
  media: ["..."],
});
```

while preserving existing low-level control and keeping `setApiKey` behavior unchanged.

## Current Problem

Current usage is technically correct but not ergonomic:

1. User must call `createCliExecutor()` first.
2. User must know and assemble command arrays (`executeCore`) or dynamic command objects (`executeSite`).
3. Dynamic site capability/action invocation is powerful but not discoverable.

This creates a high cognitive load for common tasks.

## Design Principles

1. Keep CLI as canonical runtime. SDK only adds ergonomic wrappers.
2. Keep backward compatibility for existing API surfaces.
3. Keep command routing aligned with CLI docs and parser boundaries.
4. Keep explicit escape hatches for advanced users.
5. Generate command args deterministically from typed/object inputs.

## Target Public API

Current implementation status:

- `sdk.xxx.yyy()` is the primary chain-style surface for all CLI-facing commands.
- Examples: `sdk.auth.list()`, `sdk.use.account(...)`, `sdk.manage.context.open()`.
- `sdk.chain.*` remains compatibility surface and is no longer the primary style.

## Initialization

```ts
const sdk = mediause("mu-YOUR_API_KEY");
```

No required change for users who already pass options.

## Auth Namespace

```ts
await sdk.auth.list();
await sdk.auth.login("weibo");
await sdk.auth.login("xiaohongshu/creator");
await sdk.auth.health();
await sdk.auth.health({ alias: "weibo:default" });
await sdk.auth.logout("weibo:default");
```

## Sites Namespace

```ts
await sdk.sites.list();
await sdk.sites.add("weibo");
```

Note:

- Runtime plugin manager remains on `sdk.sites` (existing API).
- Chain-style CLI site management is `sdk.chain.sites.list/add`.

## Context and Key Namespace

```ts
await sdk.manage.context.show();
await sdk.manage.context.open();
await sdk.manage.context.close();
await sdk.manage.context.clear();

await sdk.setApiKey("mu-NEW_KEY"); // unchanged
const key = await sdk.getApiKey();
```

Unified chain equivalents:

```ts
await sdk.use.account("xiaohongshu:main", {
  policy: "balanced",
  idleTimeoutSeconds: 120,
  json: true,
});

await sdk.manage.context.show(true);
await sdk.manage.context.open(true);
await sdk.manage.context.close(true);
await sdk.manage.context.clear(true);

await sdk.manage.task({ id: "task-id", json: true });
await sdk.task.status("task-id");
await sdk.task.trace("task-id");
await sdk.trace.last();
```

## Dynamic Site Chain

```ts
await sdk.site("weibo").post.feed({
  title: "Title",
  content: "Body",
  media: ["/tmp/a.jpg"],
});
```

Also support active-context form:

```ts
await sdk.site().post.feed({ title: "...", content: "..." });
```

Equivalent unified chain entry:

```ts
await sdk.site("weibo").post.feed({ title: "...", content: "..." });
```

Rules:

1. `sdk.site("weibo")` maps to explicit-site mode.
2. `sdk.site()` maps to active-context mode.
3. Chain segments map to `<capability>.<action>`.
4. Final call accepts structured args and optional payload.

## CLI Mapping Contract

All simple APIs map to existing `CliExecutor` methods and command shapes.

Examples:

1. `sdk.auth.list()` -> `auth list`
2. `sdk.auth.login("weibo")` -> `auth login weibo`
3. `sdk.site("weibo").post.feed({...})` -> `weibo post feed <args...>`
4. `sdk.site().post.feed({...})` -> `post feed <args...>` (active-context)

No new CLI command contracts are introduced.

## Dynamic Argument Parsing Pipeline

For `sdk.site(...).<capability>.<action>(input, payload?)`:

1. Capture site, capability, action from chain.
2. Normalize input into CLI args:
   - object input -> deterministic `--key value` pairs
   - array input -> passthrough args
   - string/number/boolean -> positional arg
3. Support media/object special cases:
   - `media: string[]` -> repeated `--media <value>`
   - boolean `true` -> flag only (`--flag`)
   - boolean `false`/`undefined` -> omit flag
4. Build `SiteDynamicCommand` with mode:
   - explicit-site or active-context
5. Execute through `CliExecutor.executeSite(command, payload)`.

## Proposed Input-to-Args Rules (Deterministic)

Given:

```ts
{
  title: "A",
  content: "B",
  media: ["a.jpg", "b.jpg"],
  draft: true,
  dryRun: false,
}
```

Generated args:

```text
--title A --content B --media a.jpg --media b.jpg --draft
```

Rule details:

1. Key order is stable (lexicographic) unless command metadata defines order.
2. camelCase keys convert to kebab-case flags.
3. `null` and `undefined` values are ignored.
4. Arrays produce repeated flags.
5. Nested objects are JSON-stringified only when explicitly allowed by metadata.

## API Shape Proposal (TypeScript)

```ts
type SimpleSiteInvoker = {
  [capability: string]: {
    [action: string]: (
      input?: Record<string, unknown> | string[] | string | number | boolean,
      payload?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
};

interface MediaUseToolkit {
  auth: {
    list(): Promise<unknown>;
    login(platform: string, payload?: Record<string, unknown>): Promise<unknown>;
    health(options?: { alias?: string; json?: boolean }): Promise<unknown>;
    logout(alias: string, payload?: Record<string, unknown>): Promise<unknown>;
  };
  sites: {
    list(options?: { json?: boolean }, payload?: Record<string, unknown>): Promise<unknown>;
    add(site: string, options?: { json?: boolean }, payload?: Record<string, unknown>): Promise<unknown>;
  };
  manage: {
    context: {
      show(): Promise<unknown>;
      open(): Promise<unknown>;
      close(): Promise<unknown>;
      clear(): Promise<unknown>;
    };
  };
  site(siteId?: string): SimpleSiteInvoker;
}
```

Implementation note:
Use a Proxy-based chain builder for dynamic capability/action while preserving a non-Proxy fallback helper.

## Compatibility and Migration

1. Keep existing APIs:
   - `createCliExecutor()`
   - `post(platform, input)`
   - `run(task)`
   - `executeCore/executeSite` via executor
2. Add simple namespaces as additive APIs.
3. Keep `setApiKey` and `getApiKey` behavior unchanged.
4. Mark low-level direct examples as advanced usage in README, not primary quick start.

## Error Model

1. Missing action call:
   - Accessing `sdk.site("weibo").post` without final method call should throw a clear "action is missing" error when executed.
2. Invalid input type:
   - Throw typed validation error before command execution.
3. Empty site in explicit mode:
   - Existing explicit-site validation remains.
4. CLI execution errors:
   - Bubble up with command context for debugging.

5. Flow constraint violation (skill-aligned guard):
  - `flow.site()` throws until `useAccount()` and `authHealth()` are completed.

## Security and Escaping

1. Do not interpolate shell strings manually.
2. Always pass normalized argv tokens to transport.
3. JSON-stringify only explicit object params.
4. Redact key-like fields from logs.

## Rollout Plan

Implemented:

1. `auth`, `site`, and `sdk.chain.*` command wrappers
2. deterministic input-to-args converter for dynamic site chain
3. flow constraint helper: `sdk.chain.flow(siteId, accountId)`
4. README quick-start update with chain and flow examples

Phase 1: API Skeleton

1. Add `auth`, `sites`, and `manage.context` namespaces.
2. Implement wrappers over `CliExecutor` methods.

Phase 2: Dynamic Site Chain

1. Add `site(siteId?)` chain builder.
2. Add deterministic input-to-args transformer.
3. Map to `executeSite` modes.

Phase 3: Docs + Tests

1. Update README quick start to simple API first.
2. Move low-level executor usage into advanced section.
3. Add tests:
   - `tests/simple-api/unit/*`
   - `tests/simple-api/integration/*`

Phase 4: Optional Typed Enhancements

1. Introduce optional generated site command typings from CLI/site manifest.
2. Preserve untyped dynamic fallback for unknown plugins.

## Test Plan

Unit tests:

1. auth wrapper command mapping
2. site() chain routing mode
3. input-to-args deterministic conversion
4. edge cases: booleans, arrays, null/undefined, key ordering

Integration tests:

1. login/list workflow through local transport mock/stub
2. explicit-site and active-context dynamic invocation
3. error propagation with command context

Regression tests:

1. `setApiKey` unchanged behavior
2. `createCliExecutor` and existing low-level APIs still work

## README Update Plan (After Implementation)

1. Primary quick start uses:
   - `mediause("mu-YOUR_API_KEY")`
   - `sdk.auth.*`
   - `sdk.site(...).<capability>.<action>(...)`
2. Add an "Advanced CLI Control" section for `createCliExecutor` and raw command execution.
3. Add migration examples from old style to new style.

## Non-Goals

1. No CLI contract changes.
2. No new core command groups.
3. No hidden behavior diverging from MediaUse CLI parser.

## Open Questions

1. Should object-to-args ordering follow lexicographic keys or manifest-defined argument order when available?
2. Should `sdk.site().capability.action()` auto-attach `--json` by default?
3. Should we expose both `sdk.site("weibo")` and `sdk.weibo` styles, or keep only one explicit style?

## Recommended Decision (Current)

1. Keep only `sdk.site("site")` + `sdk.site()` for clarity.
2. Keep default output behavior consistent with current executor methods.
3. Add manifest-aware ordering later as an enhancement, not required for v1 simple API.
