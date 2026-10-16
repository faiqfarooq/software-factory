# Low-cost Provider Software Factory

Generate a Python-based factory using the configured DeepSeek, Qwen and Kimi providers. The design has ten roles, including a Qwen documentation writer, followed by five independent reviews and human approval.

[Choose another edition](../README.md) · [Detailed guide](docs/GUIDE.md)

## Requirements

- A coding assistant to generate the setup in your application project.
- Python, Git and any dependencies identified by the generated guide.
- Your own API credentials and model access for DeepSeek, Alibaba Cloud Model Studio/Qwen and Moonshot/Kimi.
- A reviewed application Git base before feature worktrees, with scoped local tool and network permissions.

Store credentials using the generated secure configuration instructions. Never paste real keys into prompts or commit them.

## Start in three steps

1. Open your application project in your coding assistant.
2. Copy the complete [GENERATION.md](GENERATION.md), paste it into that session, and let it generate the factory and provider adapters.
3. Follow the generated factory/README.md for provider configuration, local and authorized live checks, dashboard startup and first-feature commands.

The assistant generates the files; the configured DeepSeek orchestrator runs the resulting workflow. The generated runner must verify provider identities and implement real file/test/Git tools, rather than only return text.

## What this edition requests

Specification and documentation plan → implementation → developer documentation and end-user manual → checkpoint → five independent reviews → approver → human approval → merge.

The Qwen3.8 Max documentation writer maintains complete developer documentation so another developer can understand, run and maintain the app, plus a plain-language end-user manual with step-by-step usage instructions. Both are planned before implementation, linked from the app README and reviewed on the final combined commit. Missing or stale required content in either blocks approval. The dashboard shows separate guide statuses and links.

## Costs and capabilities

Verify current provider model IDs, account access, prices and tool-calling support during setup. The edition name does not promise a particular saving or equivalent quality. Compare total cost per accepted feature, including retries and reviews, using actual recorded evidence.

The [detailed guide](docs/GUIDE.md) preserves a dated illustrative price comparison between earlier nine-role editions. It excludes the documentation writer now required in both ten-role designs and is not a current quote or measured saving.

## Help

- [Models, workflow, provider configuration and historical comparison](docs/GUIDE.md)
- [Shared environment/dashboard troubleshooting](../codex-claude/maintenance/docs/TROUBLESHOOTING.md)

The Claude connection checker is for Claude runtimes. Use the generated provider-specific checks for this edition. This prompt is self-contained; cloning this folder alone does not install or run a factory.
