# mediause

Open source standards and capabilities for the MediaUse ecosystem.

This repository is **not** the MediaUse application itself.
It defines reusable contracts, specs, SDK surfaces, and execution adapters that other projects can adopt.

## Goals

- Define stable, versioned standards for skills and actions
- Provide reference SDKs for JavaScript and Python
- Offer a CLI and MCP adapter for interoperability
- Include examples to help integrators adopt the standards quickly

## Project Layout

- `cli/` CLI implementation (TypeScript or Rust wrapper)
- `sdk/js/` JavaScript SDK
- `sdk/python/` Python SDK
- `mcp-server/` Claude MCP adapter
- `skill/` Skill loader and executor
- `specs/` Canonical standards and schemas
- `examples/` Minimal integration examples
