# Software Factory

Generate an AI development workflow inside your application. Choose **Build a complete app** to turn requirements into an ordered roadmap and implement its features sequentially, or **Add or change a feature** for one scoped change. Optional design references guide implementation; the generated dashboard shows plans, requirements, features, designs, reviews, documentation and usage.

This repository contains **self-contained generation prompts, guides and offline reference tools**. Cloning it does not install or start a running factory. The workflow version 2 contract below must be generated and validated in your application; a prompt update is not an already tested runtime or an upgrade to an existing factory.

## Choose your edition

| Edition | Runtime and accounts | Beginner guide |
| --- | --- | --- |
| **Claude only** | Claude Code and your Claude account | [Product, feature, design and dashboard setup](claude-only/docs/PRODUCT.md) |
| **Codex + Claude** | Both tools and accounts; Codex owns coordination | [Product, feature, design and dashboard setup](codex-claude/docs/PRODUCT.md) |
| **Low-cost providers** | Generated Python runner and DeepSeek, Qwen and Kimi API credentials | [Product, feature, design and dashboard setup](low-cost/docs/PRODUCT.md) |

All editions retain ten roles: orchestrator, spec writer, builder, documentation writer, five independent reviewers and approver. The existing spec writer prepares product plans; the existing owner schedules work. Provider/model access, design connectors and supported control bridges must be verified in the actual environment. The low-cost name does not guarantee a saving.

## Start in five steps

1. **Choose an edition** and open your own application folder in its indicated coding assistant. An empty folder or an existing app can be selected.
2. **Copy its complete GENERATION.md** into that session: [Claude only](claude-only/GENERATION.md), [Codex + Claude](codex-claude/GENERATION.md), or [Low-cost providers](low-cost/GENERATION.md).
3. **Follow generated factory/SETUP.md and factory/README.md.** Check local tools/accounts, explicitly authorized live access and the single dashboard link. Setup does not start a feature, merge or deploy.
4. **Choose a mode**, supply requirements and optional designs, review extraction/questions and approve the displayed plan.
5. **Follow progress in the dashboard**, inspect the final app, both guides and passing evidence, then approve the exact target merge.

There is no runtime installer or trusted prebuilt starter bundled here. Generated export/verify/install operations must use real versioned manifests, preserve existing files and exclude private state; setup must accurately report whether such a starter exists.

## Two modes, two approvals

| Mode | First approval: go ahead / Approve plan and start | Work between approvals | Final approval: merge code / Approve merge |
| --- | --- | --- | --- |
| Feature | One feature spec, design/docs/checks, scope and budget | Implement, document, test, five reviews and approver | Exact reviewed feature into the recorded target branch |
| Product | Complete versioned product plan and child contracts | Automatically select dependency-ready features; build, document, test, review and integrate into a product branch; then test and freshly review the complete app | Exact reviewed complete product into the recorded target branch |

Mode is explicit and persisted. Ambiguous ordinary chat needs clarification; document length is not a selector. Existing jobs stay in feature mode unless a new product request is planned and approved. Routine approved work proceeds automatically; changed scope/design contracts, permissions or budgets return to a revised first gate. Host/provider permissions remain separate. A merge does not itself authorize push or deployment.

Product children are Integrated, not finally Accepted, until final product acceptance, authorized target merge and required post-merge checks succeed. Child reviews never replace final whole-product checks or five fresh final reviews. Unresolved failures pause affected work rather than silently skipping requirements.

Both modes maintain complete developer documentation and an end-user manual, with separately linked entry pages, coverage and current completion evidence. Neither guide may be missing or stale at final merge approval.

## Designs and dashboard controls

The generation contract requires verified access to selected Figma frames through supported official tools, or another verified connector/export. Designs are optional; supplied references are versioned and mapped to screens/features. Actual rendered comparisons, responsive states and local assets are checked against agreed references. An inaccessible URL, missing required export or absent required browser evidence remains visible; there is no universal URL-copy promise.

The dashboard includes requirements coverage, feature/dependency lists, designs/comparisons, activity, previews, reviews/tests, both guides, usage/budgets and readiness. Verified controls can submit requests, request changes/rework, approve plans, pause/resume/cancel and approve final merges. A separate authenticated loopback service forwards typed commands to the same registered owner; the static publisher remains read-only. Buttons are disabled with reconnect/chat instructions when owner ingress or human provenance cannot be verified. Dashboard requests do not override host/tool permissions.

## Repository layout

~~~text
claude-only/     Claude Code generation prompt and guides
codex-claude/    Codex + Claude prompt, guides and shared offline tools
low-cost/        API-provider generation prompt and guides
~~~

Each edition's prompt is self-contained. Optional maintainer tools are not dependencies of a generated app. Updates to this repository do not patch existing factories; apply a versioned upgrade through their existing owner, preserving jobs, sessions, approvals and usage.

## Offline examples and checks

See [shared tools](codex-claude/maintenance/README.md) and [synthetic reference plans](codex-claude/maintenance/examples/README.md). The offline checker validates plan metadata and dependency/coverage invariants; it does not generate an app or approve work.

~~~powershell
node codex-claude/maintenance/scripts/check-plan.mjs codex-claude/maintenance/examples/product-plan.json
node --test codex-claude/maintenance/scripts/check-claude.test.mjs codex-claude/maintenance/scripts/docs.test.mjs codex-claude/maintenance/scripts/product-workflow.test.mjs
~~~

These tests use no live providers. Passing them does not prove model/design access, dashboard authentication, a working owner bridge, browser fidelity or a complete generated product. Generated-runtime tests and a fresh-user end-to-end walkthrough are required separately and must be reported accurately.

## More help

- [Claude-only requirements and existing feature guide](claude-only/README.md)
- [Codex + Claude requirements](codex-claude/README.md), [Windows setup](codex-claude/docs/SETUP.md), [troubleshooting](codex-claude/docs/TROUBLESHOOTING.md) and [efficient use](codex-claude/docs/EFFICIENCY.md)
- [Low-cost provider requirements and historical pricing example](low-cost/README.md)
- [Shared maintainer tools and checks](codex-claude/maintenance/README.md)

Keep credentials out of prompts, Git, dashboard data and URLs. MIT licensed. See [LICENSE](LICENSE).
