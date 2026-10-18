# Codex + Claude Software Factory

Codex coordinates the factory; Claude plans, builds and documents the app. This edition specifies ten roles, five independent reviews, a documentation stage after implementation, and human approval of the exact reviewed commit.

## Build a product or change a feature

Choose **Build a complete app** for requirements-to-roadmap-to-sequential-features, or **Add or change a feature** for one scoped job. The updated generation contract includes optional design references, whole-product acceptance, guided setup and owner-backed dashboard controls. Product mode approves the parent plan once, integrates reviewed children into a product branch, then requires a separate approval of the final target merge. Feature mode retains its own two approvals per job.

Read the [beginner product, design and dashboard guide](docs/PRODUCT.md). Controls require a verified authenticated bridge to the existing owner; otherwise the generated dashboard must say Read-only or Owner disconnected with reconnect/chat instructions. This repository does not ship a running dashboard service or prebuilt runtime installer.

The feature walkthrough below remains valid for feature mode. Product mode follows the linked guide; it automatically advances eligible approved children without another next command.

[Choose another edition](../README.md) · [Detailed guide](docs/GUIDE.md)

## Requirements

- Local Codex and Claude Code, your own authenticated accounts, and access to the exact models in the prompt.
- A current Node.js LTS and Git.
- Python 3 available as python or py for dashboard serving.
- Your application project, a reviewed clean Git base before workers, and the required scoped host/provider permissions.

## Start in three steps

1. Open your application in **Codex using gpt-6.1-sol**.
2. Copy the complete [GENERATION.md](GENERATION.md) and paste it into that session. Let Codex generate and validate the factory.
3. Follow the generated factory/README.md to finish readiness checks, open the dashboard and start your first feature.

For a full Windows walkthrough and expected results, use [SETUP.md](docs/SETUP.md). Commands under factory/scripts exist only after generation.

In the owning Codex chat, a first feature request looks like:

~~~text
$factory Add an accessible settings screen
~~~

The generated Claude /factory launcher forwards to the Codex owner. It does not start a second orchestrator.

## What this edition requests

Specification and documentation plan → your go ahead → implementation → developer documentation and end-user manual → checkpoint → five reviews → approver → your merge code → merge and show latest code.

There are two factory approval gates. Review/edit the specification, branch, permissions and proposed costs, then type **go ahead**. After the completed work, documentation and passing reviews are shown, type **merge code**. The factory binds that phrase to the displayed commit internally; you do not need to enter its SHA. Routine in-scope edits, tests and review fixes need no further factory approval. Host/tool permissions remain separate. See the [two-approval workflow](docs/GUIDE.md#two-approvals-per-feature).

The documentation writer maintains two deliverables: complete developer documentation so another developer can understand, run and maintain the app, and an end-user manual with step-by-step instructions for using it. The specification plans coverage and checks for both before implementation. Both must be complete and current before merge approval.

One dashboard home link opens jobs, reports, documentation, usage and readiness. Latest activity appears at the top, with pagination and selectable limits. Focused agent context, bounded logs, safe reuse and configurable budgets help control repeated work; real savings still need measurement.

## Help

- [Step-by-step setup](docs/SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Efficient daily use and a feature-request template](docs/EFFICIENCY.md)
- [Role assignments, workflow diagrams and detailed guide](docs/GUIDE.md)
- [Shared maintainer tools and tests](maintenance/README.md)

The generation prompt is self-contained. This package does not include a complete prebuilt runtime; an existing generated factory needs an appropriate upgrade rather than another owner or overwritten history.
