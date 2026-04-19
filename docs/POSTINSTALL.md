# Postinstall Bootstrap Guide

This document explains how the SDK postinstall flow initializes the MediaUse CLI runtime.

## Overview

The package defines:

- package script: `postinstall` -> `node ./scripts/postinstall.mjs`
- source entrypoint: `src/adapters/cli/postinstall.ts`
- runtime manager: `src/adapters/cli/bootstrap.ts`

At install time, the SDK tries to ensure a compatible local MediaUse CLI binary is available.

## Execution Flow

1. `npm install` triggers the package `postinstall` script.
2. `scripts/postinstall.mjs` checks whether compiled dist files exist.
3. If dist exists, it imports and runs `runPostinstall()`.
4. `runPostinstall()` builds `CliBootstrapManager` options from environment variables.
5. `CliBootstrapManager.ensureInstalled()` resolves target version, locates or installs the binary, verifies checksum, and writes active metadata.

## Environment Variables

Install-time behavior can be controlled using these variables:

- `MEDIAUSE_SKIP_POSTINSTALL=1`
  - Skip postinstall bootstrap entirely.
- `MEDIAUSE_CLI_VERSION=3.2.1`
  - Force an expected CLI version.
- `MEDIAUSE_CLI_MANIFEST_URL=https://releases.mediause.dev/cli`
  - Base URL for release metadata and binaries.
- `MEDIAUSE_CLI_LATEST_VERSION_URL=...`
  - Override URL used to resolve latest version.
- `MEDIAUSE_CLI_CACHE_DIR=...`
  - Override cache location.
- `MEDIAUSE_CLI_BINARY_NAME=mediause`
  - Override binary command name.
- `MEDIAUSE_CLI_POSTINSTALL_STRICT=0`
  - Do not fail install when bootstrap fails.

## Manifest Compatibility

The bootstrap logic supports two release layouts:

1. Preferred layout:
   - `latest.json` contains a full manifest (`version` + `assets`).
2. Backward-compatible layout:
   - `latest.json` only contains version pointer data, then SDK fetches `${manifestUrl}/${resolvedVersion}.json`.

Asset entries must provide:

- `url`
- `sha256`

## Cache and Activation

The SDK cache stores:

- downloaded binaries under version/platform subdirectories
- current active binary metadata in `current.json`
- install lock file `.install.lock` to prevent concurrent install races

Default cache roots:

- Windows: `%LOCALAPPDATA%/mediause/cli-cache`
- macOS: `~/Library/Caches/mediause/cli-cache`
- Linux: `${XDG_CACHE_HOME:-~/.cache}/mediause/cli-cache`

## Failure Behavior

When strict mode is enabled (default):

- postinstall errors fail package installation.

When `MEDIAUSE_CLI_POSTINSTALL_STRICT=0`:

- postinstall logs the error and continues installation.

## Manual Re-run

You can rerun bootstrap without reinstalling dependencies:

```bash
npm run bootstrap:cli
```

## Troubleshooting

- Binary not found:
  - verify manifest URL and platform asset coverage.
- Checksum mismatch:
  - verify release manifest `sha256` and uploaded artifact.
- Version mismatch:
  - confirm `MEDIAUSE_CLI_VERSION` and release metadata consistency.
- Network failures:
  - retry with stable network or internal mirror.
