# Claude-only Software Factory

Generate and run a software factory through Claude Code. The configured design has ten roles: the orchestrator, spec writer, builder, documentation writer, five independent reviewers and approver.

## Build a product or change a feature

Choose **Build a complete app** for requirements-to-roadmap-to-sequential-features, or **Add or change a feature** for one scoped job. The updated generation contract includes optional design references, whole-product acceptance, guided setup and owner-backed dashboard controls. Product mode approves the parent plan once, integrates reviewed children into a product branch, then requires a separate approval of the final target merge. Feature mode retains its own two approvals per job.

Read the [beginner product, design and dashboard guide](docs/PRODUCT.md). Controls require a verified authenticated bridge to the existing owner; otherwise the generated dashboard must say Read-only or Owner disconnected with reconnect/chat instructions. This repository does not ship a running dashboard service or prebuilt runtime installer.

The feature walkthrough below remains valid for feature mode. Product mode follows the linked guide; it automatically advances eligible approved children without another next command.

[Choose another edition](../README.md) · [Detailed guide](docs/GUIDE.md)

## Requirements

- Claude Code, your own authenticated account and access to the configured Claude models.
- Git and an application project with a reviewed committed base before feature worktrees are used.
- Python 3 for the generated dashboard server. The generated guide lists any other project dependencies.

Node.js is needed only if you use the optional shared connection checker. Verify installed capabilities and account access during setup.

## Start in three steps

1. Open your application project in **Claude Code**.
2. Copy the complete [GENERATION.md](GENERATION.md), paste it into that session, and let it inspect the project and generate the factory.
3. Follow the generated factory/README.md for local checks, authorized live checks, dashboard startup and your first feature.

After generation, a first request in Claude Code looks like:

~~~text
/factory Add an accessible settings screen
~~~

This command is available after the generated project skill is installed and discovered. Keep using the same registered owner and builder for rework.

## What this edition requests

Specification and documentation plan → your go ahead → implementation → developer documentation and end-user manual → checkpoint → five independent reviews → approver recommendation → your merge code → merge and show latest code.

There are two factory approval gates. Review/edit the specification, branch, permissions and proposed costs, then type **go ahead**. After the completed work, documentation and passing reviews are shown, type **merge code**. The factory binds that phrase to the displayed commit internally; you do not need to enter its SHA. Routine in-scope edits, tests and review fixes need no further factory approval. Host/tool permissions remain separate. See the [two-approval workflow](docs/GUIDE.md#two-approvals-per-feature).

The Sonnet documentation writer maintains complete developer documentation so another developer can understand, run and maintain the app, plus a plain-language end-user manual with step-by-step usage instructions. Both are planned before implementation, linked from the app README and reviewed on the final combined commit. Missing or stale required content in either blocks merge approval.

The design includes a progress dashboard with separate guide statuses/links, specifications/build/documentation/review reports, measured usage where exposed and labelled cost estimates. The detailed guide contains the role/model assignments and rework rules. Setup must report unavailable tools, telemetry or model access accurately.

## Help

- [Detailed workflow and usage guide](docs/GUIDE.md)
- [Shared connection/environment troubleshooting](../codex-claude/maintenance/docs/TROUBLESHOOTING.md)
- [Optional connection checker](../codex-claude/maintenance/README.md)

The prompt is self-contained. Shared tools are optional diagnostics and must not become a dependency of the generated application. This folder contains generation instructions, not an already running factory.
