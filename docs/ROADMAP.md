# Roadmap

## Phase 1 (Current)

- Rebuild toolkit skeleton from scratch
- Define layer boundaries
- Implement minimum orchestrator/runtime/scheduler/account/workflow modules
- Provide TypeScript package build + docs

## Phase 2

- Add persistent task and workflow state storage
- Add richer cron and calendar scheduling
- Add dead-letter queue and failure classification
- Add built-in runtime metrics and trace snapshots

## Phase 3

- Add distributed worker mode for scheduler execution
- Add policy plugins (rate limit, content safety, account routing)
- Add site plugin packaging and dynamic loading
- Add CLI transport implementations (process, RPC, service mode)

## Phase 4

- Add first-party production plugins for major sites
- Add workflow visual definition format
- Add SDK-level observability hooks and OpenTelemetry integration
- Add conformance test kit for third-party site plugins
