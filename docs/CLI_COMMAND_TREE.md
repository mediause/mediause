# MediaUse CLI Command Tree (Current)

Status: aligned with current implementation in crates/cli.

## Architecture

CLI now uses two layers:

1. Core commands
Core keeps only runtime/auth/context/service lifecycle operations.

2. Site dynamic commands
All site capability operations are dynamic and loaded from site command manifest.
This includes content, user, interaction, search, and other site-specific actions.

Important: old static top-level verbs such as post/get/user/reply/search/engage are no longer core command entries.

## Core Command Tree

mediause
- help [site] [capability] [--json]
- close [--json]
- version [--json]
- sites
  - list [--json]
  - add <site> [--json]
    - note: currently a no-op reserved command
- auth
  - login <platform> [--json]
  - list [--json]
  - health [--alias <platform:account>] [--json]
  - logout <platform:account> [--json]
- use
  - account <platform:account> [--policy <value>] [--idle-timeout-seconds <n>] [--json]
- manage
  - task [--id <task_id>] [--json]
  - context [--show | --close | --clear] [--json]
  - key [key] [--json]
- trace
  - last
- task
  - status --task-id <id>
  - trace --task-id <id>
- rpc
  - serve [--protocol jsonrpc-stdio|jsonrpc-tcp]

## Site Dynamic Command Modes

Dynamic parser is evaluated before clap core parser.

Supported invocation forms:

1. Explicit site form
mediause <site> <capability> <action> [args]

2. Active-context site form
mediause <capability> <action> [args]
Site is inferred from current active context.

3. Dotted form (active-context)
mediause.<capability>.<action> [args]

4. Dotted form (explicit site)
mediause.<site>.<capability>.<action> [args]

## Site Help

Supported:

- mediause <site>
- mediause <site> -h
- mediause <site> <capability>
- mediause <site> <capability> -h

Removed:

- mediause help <site>

If a site has no command manifest, CLI reports core_only mode for that site.

## Conflict Rule

To avoid ambiguity, dotted two-segment input using core resource names is rejected.

Example rejected style:

- mediause.auth.login
- mediause.use.account
- mediause.sites.list

Use explicit core style instead:

- mediause auth login <site>
- mediause use account <platform:account>
- mediause sites list

## Routing Boundary

Core owns only:

- auth and auth store operations
- active context selection and local state lifecycle
- key management and diagnostics
- rpc daemon lifecycle

Site dynamic owns:

- all website capability actions defined in site command manifest
- argument schema validation and normalization via manifest
- action dispatch with site provenance (source=site)

## Agent Guidance

When an operation is website-related, always route to site dynamic command shape first.
Only use core commands for authentication, context, diagnostics, and rpc service operations.
