# MediaUse CLI Specification

This document defines the normative CLI contract for the mediause project.

## Scope

The CLI in this repository targets standards operations, not app-specific logic.

## Command Groups

- `mediause spec` validate and inspect schema/spec resources
- `mediause skill` load, validate, and execute skill bundles
- `mediause mcp` run the MCP server adapter
- `mediause sdk` generate or verify SDK bindings

## Baseline Behavior

- Commands must be deterministic and script-friendly
- Machine-readable output must be available through `--json`
- Error output must include non-zero exit codes and stable error codes
- CLI must support `--help` and `--version` globally

## Proposed Initial Commands

- `mediause spec validate --file <path>`
- `mediause skill validate --file <path>`
- `mediause skill run --file <path> --action <id> --input <json>`
- `mediause mcp serve --port <port>`

## Versioning

CLI breaking changes must be introduced only in a new major version.
