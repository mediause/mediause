# MediaUse SDK Toolkit Architecture

## Layer Model

```text
Developer / Agent
  -> SDK (TypeScript API)
  -> Control Plane (orchestration, workflow, policy, state)
  -> Runtime Layer (site runtime, account/session, normalization)
  -> MediaUse CLI Rust Core (closed)
```

## Module Map

- `src/sdk`
  - Public API entrypoint (`MediaUseToolkit`)
- `src/control-plane`
  - `orchestrator.ts`: task lifecycle, retries, policy selection, state updates
  - `workflow-engine.ts`: sequential workflow execution and fail/continue behavior
  - `state-store.ts`: task/workflow/context state snapshots
  - `policy-engine.ts`: policy selection logic
- `src/runtime`
  - `site-runtime.ts`: site plugin contract
  - `runtime-manager.ts`: plugin registry and execution dispatch
  - `account-session.ts`: in-memory account/session store
  - `normalization.ts`: result normalization boundary
  - `site-manager.ts`: site plugin management facade
- `src/scheduler`
  - `queue.ts`: priority queue primitive
  - `retry.ts`: retry policy and backoff helpers
  - `cron.ts`: minimal cron-to-interval parser
  - `scheduler.ts`: run/schedule/cancel queue integration
- `src/accounts`
  - `account-manager.ts`: account inventory and health snapshots
- `src/workflow`
  - `workflow-manager.ts`: workflow registry and runner facade
- `src/adapters/cli`
  - `cli-executor.ts`: transport contract for MediaUse CLI boundary

## Core Flow

1. Developer calls `MediaUseToolkit` API (`post`, `run`, `schedule`, `runWorkflow`).
2. Control plane resolves context + policy and writes task state.
3. Runtime manager dispatches to a site plugin by `platform`.
4. Site plugin executes task and returns normalized result.
5. Scheduler can run once, at interval, or via cron-like recurrence.
6. Workflow engine chains tasks and aggregates run output.

## CLI Ownership Boundary

- Core CLI commands own only auth/context/diagnostics/task/rpc lifecycle operations.
- Website capability commands are resolved dynamically from site plugin manifests.
- Dynamic site parser precedence is above core clap parser for website operations.
- SDK adapter must treat site commands as dynamic routes, not static top-level core verbs.

## Non-Goals (for current skeleton)

- Production persistence (DB-backed state)
- Distributed queue workers
- Advanced cron parser compatibility
- Remote scheduler leader election

These are planned for iterative delivery after API contracts stabilize.
