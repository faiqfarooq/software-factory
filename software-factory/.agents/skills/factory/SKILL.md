---
name: factory
description: Run a feature through spec, build, five independent reviews, approver, and human approval before merge. Use only when the user explicitly invokes $factory.
---

Run the software factory from Codex. Invoke explicitly:

- `$factory <feature>`
- `$factory next`
- `$factory approve <job-id>`
- `$factory rework <job-id> <note>`

## Protocol

The workflow, board schema, job files, report formats, round/attempt limits, approval
checks and git rules are defined once in `.claude/skills/factory/SKILL.md`.
**Read that file now and follow it exactly**, with these Codex substitutions:

| Protocol says | In Codex |
|---|---|
| spawn agent `X` | Ask Codex to spawn the project custom agent `X` from `.codex/agents/X.toml`, passing absolute paths. Spawn the five reviewers together and wait for all five. |
| `builder-<id>` + SendMessage | Spawn custom agent `builder` for the job and record the thread/agent identifier Codex gives you in board.json (`builder`). For revisions, send follow-up instructions to that **same** thread (steer it, or `/agent` to select it). If it can no longer be continued, pause and tell the human; never silently spawn a replacement. |
| opus / sonnet | Not applicable. Codex agents inherit your configured Codex model (`model` in `~/.codex/config.toml`). Do not claim Claude models are used. |
| permission prompts | Respect Codex approval and sandbox settings; never bypass them. |

Ownership is unchanged: only this session spawns agents and writes
`factory/board.json`; agents write only their own report; the builder also edits
source and tests only in `.factory-worktrees/<id>`.
If subagents are unavailable in this Codex build, stop and say so rather than doing
the reviews yourself.
