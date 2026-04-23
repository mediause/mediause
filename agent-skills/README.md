# MediaUse Agent Skills

This folder contains site-specific skills for MediaUse CLI automation.

These skills are designed to be compatible with:

- Claude Code
- Codex
- OpenClaw
- Cursor

## Source of Truth

Use this standard document when creating or updating any skill:

- SKILL_STANDARD_DEFINITION_ZH.md

All skills must follow the same structure, command flow, and safety constraints from that standard.

## Folder Layout

- agent-skills/install.ps1: helper script for skill installation paths
- agent-skills/SKILL_STANDARD_DEFINITION_ZH.md: canonical skill standard
- agent-skills/<site>/SKILL.md: site skill document

Examples:

- agent-skills/weibo/SKILL.md
- agent-skills/xiaohongshu/SKILL.md

## Compatibility Contract

Every site skill must be executable in the same way across Claude Code, Codex, and OpenClaw:

1. Same CLI command syntax
2. Same context/auth preconditions
3. Same guardrails and rate limits
4. Same error handling expectations

Do not add agent-specific command variants in one skill file.

## How To Add a New Site Skill

When a new site plugin is added, you must add a matching skill in the same change set.

Required steps:

1. Read agent-skills/SKILL_STANDARD_DEFINITION_ZH.md.
2. Read the site command manifest from MediaUse CLI:
   - ../plugins/<site>/commands.json
3. Create skill file:
   - agent-skills/<site>/SKILL.md
4. Fill command map from commands.json only.
5. Include standard sections:
   - install
   - key setup
   - core flow (use account before auth health)
   - dynamic command map
   - workflow examples
   - guardrails and timing limits
6. Validate no command in skill exceeds actual CLI capability.

## Mandatory Rule: Plugin + Skill Together

For every newly introduced site plugin:

- You must commit the site skill in the same PR/commit scope.
- A plugin-only contribution is incomplete and should not be merged.

Checklist:

- New plugin path exists in CLI repo
- Matching skill file exists in this repo
- Command map is aligned with commands.json

## Signature Requirement (Attribution)

Each new or majorly updated site skill must include a maintainer attribution block at the end of SKILL.md.

Required fields:

- Maintainer: <name or handle>
- Last-Updated: <YYYY-MM-DD>
- Version: <skill version, for example v1>

Recommended block format:

```text
Skill Metadata
Maintainer: @your-handle
Last-Updated: 2026-04-23
Version: v1
```

If attribution is missing, the skill is considered incomplete.

## Update Policy

When commands.json changes for a site:

1. Update the corresponding agent-skills/<site>/SKILL.md.
2. Update workflow examples if new capabilities are added.
3. Keep guardrails and operation spacing constraints intact.

## Review Quick Checks

Before merge, verify:

- The skill follows the standard definition doc
- use account and auth health order is correct
- guest mode behavior is clearly declared (supported or not)
- examples use --json where automation is expected
- attribution block is present
