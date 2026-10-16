# Low-cost Provider Software Factory

Generate a Python-based factory using the configured DeepSeek, Qwen and Kimi providers. The design has nine roles and the same core sequence of implementation, five independent reviews and human approval.

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

## Costs and capabilities

Verify current provider model IDs, account access, prices and tool-calling support during setup. The edition name does not promise a particular saving or equivalent quality. Compare total cost per accepted feature, including retries and reviews, using actual recorded evidence.

The [detailed guide](docs/GUIDE.md) preserves a dated illustrative price comparison. It uses an earlier nine-role hybrid baseline and is not a current quote against the ten-role Codex + Claude edition.

## Help

- [Models, workflow, provider configuration and historical comparison](docs/GUIDE.md)
- [Shared environment/dashboard troubleshooting](../codex-claude/maintenance/docs/TROUBLESHOOTING.md)

The Claude connection checker is for Claude runtimes. Use the generated provider-specific checks for this edition. This prompt is self-contained; cloning this folder alone does not install or run a factory.
