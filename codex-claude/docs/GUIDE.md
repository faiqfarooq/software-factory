# Codex + Claude edition guide

Start with the [edition setup](../README.md), [shared package guide](../../factory/README.md) and [product/feature workflow](PRODUCT.md). The shared package supplies the same dashboard and control service in all editions; only provider routing and the required native launcher differ.

## Ten roles

| Role | Runtime/model |
| --- | --- |
| Owner | Codex gpt-6.1-sol |
| Security | Native Codex gpt-6-astra |
| Code, QA | Native Codex gpt-6.1-sol |
| Specification, builder, approver | Claude Opus |
| Documentation, UX, UI | Claude Sonnet |

Exact identifiers live in factory/config.json. Verify configured and actual identities, account access and installed native/tool-calling support before paid dispatch. A configuration file is not proof of access. No automatic model substitution or unsupported accounting claims.

The native Codex owner dispatches security/code/QA through supported native agents. Claude runs the remaining roles. The Claude launcher is a forwarder to the registered Codex owner, not another orchestrator. Preserve exact worker identities and continuation. Do not use standalone Codex subprocesses as replacements for native reviewers.

## Documentation and review

The spec writer agrees coverage for two app deliverables before implementation. Developer documentation explains purpose/features, architecture, module/data/API map, setup, configuration, conventions, commands, testing, maintenance and technical troubleshooting. The end-user manual explains actual roles/screens, onboarding, task steps, expected results, errors/recovery, relevant admin settings and limitations. Preserve the app's current structure and link both entry pages from its README. Assess baseline gaps once; subsequently update affected pages. Do not generate repeated factory manuals inside the app.

After implementation the documentation writer edits assigned app docs on the same feature branch while the builder is idle. Both guides must be Microsoft Word .docx files, complete/current with every rendered page inspected before the final combined commit is reviewed by all five independent reviewers plus approver. Writer reports are evidence, not substitutes for the actual guides. Missing or stale source/docs evidence blocks the merge offer. Use the same builder for rework and preserve the two-round bound.

## Controls, usage and recovery

Use the dashboard for request, plan approval, progress, checks/reviews, reviewed Word downloads, usage, revisions and exact final-merge approval. Routine approved work needs no extra factory prompts. Native host permissions/login remain native. Unknown usage is unavailable, never zero; estimated API-equivalent cost is distinct from actual subscription billing. Budgets need explicit approved terms and real enforceable observations, not invented hard caps.

The [owner protocol](../../factory/runtime/WORKFLOW.md) defines payloads, listening/lease behavior, stage and commit bindings, pause/cancel confirmation and recovery. If the session cannot maintain a listener, show the actual limitation. Reconnect the same owner, reconcile uncertain work and preserve all history. The bridge does not itself authenticate provider responses or independently prove review quality; those require real owner/adapter evidence.

## Daily steps and commands

Use the [complete step-by-step guide](../../factory/README.md) for installation, starting/reopening the dashboard, connecting the owner, stage decisions, all 23 runtime operations and recovery. Approve each exact stage once through chat OR the dashboard; routine scoped work continues without extra confirmations. Optional Full Access is a separate explicit host choice and never part of ordinary setup. Respect the configured existing-branch workspace policy when present. A disconnected idle owner can be released only through the explicit guarded maintenance procedure in the owner protocol.

## Help at any time

Click Help in the dashboard header, use $factory help in Codex or /factory help in Claude, or run node factory/runtime/cli.mjs help. The complete shared reference groups everyday commands, workflow decisions and advanced owner operations, with purposes, requirements and examples. Search for next, pause or any action. Help does not connect an owner or execute actions. The API edition uses terminal/dashboard help. A persistent dashboard hint and short hint on each Factory reply keep the shortcuts visible. See the [command guide](../../factory/README.md#13-command-reference-all-23-runtime-operations).
