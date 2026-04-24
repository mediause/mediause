# SDK Toolkit Design

## Public API

`MediaUseToolkit` currently exposes:

- `post(platform, input)`
- `run(task)`
- `schedule(spec)`
- `useAccount(target, options)`
- `clearContext()` / `getContext()`
- `addAccount(record)`
- `registerWorkflow(definition)`
- `runWorkflow(workflowId)`
- `getTaskState(taskId)` / `listTaskStates()`

## Scheduling Capabilities

- Queue: in-memory priority queue (`low`, `normal`, `high`)
- Retry: configurable retry policy with exponential backoff + jitter
- Cron: lightweight support for:
  - `*/N * * * * *` (seconds)
  - `*/N * * * *` (minutes)
- State: task states tracked in control plane store

## Account Management

`AccountManager` provides:

- upsert account records
- list/filter by platform
- alias-based health checks
- remove account entries

Context binding:

- `useAccount({ platform, accountId }, { policy, idleTimeoutSeconds })`
- context is stored in `StateStore` and consumed by orchestration

## Workflow Management

Workflow definitions are composed of ordered steps.

Each step controls:

- target platform
- action type
- payload
- `continueOnError` behavior

`WorkflowEngine` executes step-by-step and writes workflow state transitions (`running`, `succeeded`, `failed`).

## Site Management

A site runtime plugin must implement:

- `id`
- `platform`
- `supports(task)`
- `execute(task, context)`

This enables loading/unloading multiple site runtimes for query, publish, and download actions.

## CLI Boundary

`CliExecutor` is a thin adapter with injectable transport.

Core command surface now maps to:

- sites
- auth
- use
- manage
- trace
- task
- rpc
- help/version/close

Notable core command details:

- `auth login` accepts `<platform[/entry]>` (for example `xiaohongshu/creator`) so one site can expose multiple login systems from plugin config.
- `manage context --open` opens/focuses the current webview session; `manage context --close` closes the current session window.

Site capability actions are not static core verbs anymore.
They are routed through dynamic site command parsing with four invocation modes:

- explicit site form
- active-context site form
- dotted active-context form
- dotted explicit-site form

This keeps website operations owned by site plugin manifests and keeps core focused on auth/context/runtime operations.

The Rust core remains closed; the adapter focuses on deterministic command shape.

## CLI Bootstrap and Version Control

The SDK now supports managed local CLI runtime bootstrap via `CliBootstrapManager`.

Behavior:

- Detect current OS/arch and resolve asset key (`windows-x64`, `linux-arm64`, etc.)
- Resolve target CLI version from `expectedVersion` or default latest resolver
- Auto-download when missing or mismatched
- Verify SHA-256 checksum before activation
- Persist active binary selection in cache metadata (`current.json`)
- Fail fast when no artifact exists for current platform/arch

`MediaUse(apiKey, options)` uses lazy bootstrap before execution, and `run/post/runWorkflow` enforce initialization.
