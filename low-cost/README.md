# Low-cost Provider Software Factory

Generate a Python-based factory using the configured DeepSeek, Qwen and Kimi providers. The design has ten roles, including a Qwen documentation writer, followed by five independent reviews and human approval.

## Build a product or change a feature

Choose **Build a complete app** for requirements-to-roadmap-to-sequential-features, or **Add or change a feature** for one scoped job. The updated generation contract includes optional design references, whole-product acceptance, guided setup and owner-backed dashboard controls. Product mode approves the parent plan once, integrates reviewed children into a product branch, then requires a separate approval of the final target merge. Feature mode retains its own two approvals per job.

Read the [beginner product, design and dashboard guide](docs/PRODUCT.md). Controls require a verified authenticated bridge to the existing owner; otherwise the generated dashboard must say Read-only or Owner disconnected with reconnect/chat instructions. This repository does not ship a running dashboard service or prebuilt runtime installer.

The feature walkthrough below remains valid for feature mode. Product mode follows the linked guide; it automatically advances eligible approved children without another next command.

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

Specification and documentation plan → your go ahead → implementation → developer documentation and end-user manual → checkpoint → five independent reviews → approver → your merge code → merge and show latest code.

There are two factory approval gates. Review/edit the specification, branch, permissions and proposed costs, then type **go ahead** in the runner's supported human-interactive session. After the completed work, documentation and passing reviews are shown, type **merge code** there. The factory binds it to the displayed commit internally; no typed SHA is needed. Routine in-scope work needs no further factory approval. Host/tool permissions remain separate. See the [two-approval workflow](docs/GUIDE.md#two-approvals-per-feature).

The Qwen3.8 Max documentation writer maintains complete developer documentation so another developer can understand, run and maintain the app, plus a plain-language end-user manual with step-by-step usage instructions. Both are planned before implementation, linked from the app README and reviewed on the final combined commit. Missing or stale required content in either blocks merge approval. The dashboard shows separate guide statuses and links.

## Costs and capabilities

Verify current provider model IDs, account access, prices and tool-calling support during setup. The edition name does not promise a particular saving or equivalent quality. Compare total cost per accepted feature, including retries and reviews, using actual recorded evidence.

The [detailed guide](docs/GUIDE.md) preserves a dated illustrative price comparison between earlier nine-role editions. It excludes the documentation writer now required in both ten-role designs and is not a current quote or measured saving.

## Help

- [Models, workflow, provider configuration and historical comparison](docs/GUIDE.md)
- [Shared environment/dashboard troubleshooting](../codex-claude/maintenance/docs/TROUBLESHOOTING.md)

The Claude connection checker is for Claude runtimes. Use the generated provider-specific checks for this edition. This prompt is self-contained; cloning this folder alone does not install or run a factory.
