# Product and feature workflow

Use the shared package from a trusted checkout. Updating the checkout does not patch installed apps until their versioned setup is run. Existing unmanaged factories need a reviewed migration.

## Beginner setup

1. Open your application in the selected edition's owner, or select its folder in the terminal setup wizard.
2. Run node factory/setup.mjs --project <app> from this checkout and choose the edition. The assistant may perform this already-authorized local setup for you.
3. Review the exact local changes once. Setup installs the same versioned dashboard/runtime, preserves your app and records the checklist; it does not install AI products or make paid calls.
4. Open the private dashboard link; setup attempts to open it automatically. Keep its server terminal running. If necessary, start node factory/runtime/cli.mjs start from the installed app.
5. Connect the original owning session using its installed factory skill. Setup performed by the assistant should complete this connection in the same pass when the host supports it. An idle or closed chat cannot receive commands automatically. Verify Owner listening instead of assuming background access.
6. Review Setup & connections. Fix missing tools or native login/permissions using the displayed next action; authorize Check live access if wanted. Unverified checks stay Not checked.
7. Choose complete app or feature, submit requirements and optional design reference, then review the plan, scope, acceptance checks, permissions and budget.
8. Approve plan and start. Follow real progress, reviews and both app guides, then inspect and approve the eligible final merge.

## Choose the mode explicitly

Product mode builds a complete app through an ordered feature roadmap. Feature mode handles one scoped change. Both support an empty or existing application. The selected mode is persisted; unclear ordinary chat needs clarification. Document length cannot choose a mode. Existing active jobs are never silently reclassified.

## Requirements and roadmap

The spec writer extracts mandatory requirements, sources, questions, assumptions and acceptance criteria. Every mandatory requirement must map to a feature and a verification step. Validate unique identifiers, references, dependency cycles and deterministic next-ready ordering. Freeze the plan with repository/base/target, documentation coverage, design snapshots, permissions and budget before approval. Missing architecture, Git baseline or app access must be resolved in the proposal; never overwrite or blanket-stage unrelated work.

## Follow a supplied design

References are optional. Verify actual connector or export access; a URL alone proves neither access nor rendered fidelity. Record chosen screens, versions/hashes, assets/fonts/tokens, responsive states, viewport dimensions and feature mapping. Compare real rendered app screenshots against the agreed reference. Missing required assets/access/browser evidence remains blocked or unverified. Design changes invalidate affected descendants, checks and consent. See the provider's official design-tool documentation for actual connector capabilities.

## Automatic sequential execution

One existing owner schedules one active builder. Product children branch from the current product head, retain stable builders, update both app guides, pass actual checks and all five independent reviews plus approver, then integrate internally into the product branch. The next dependency-ready child starts automatically under the approved parent plan. Integrated is not final Accepted, and child integration is not a target-branch merge.

Whole-product acceptance runs complete journeys/regressions, design comparisons and both documentation checks, followed by five fresh final reviews and approver of the same immutable combined commit. A child verdict cannot approve the whole app. Final acceptance requires the separately approved target merge and passing required post-merge checks. Failed/blocked dependencies, stale evidence or unknown/exhausted enforcing budgets stop new affected work. Rework is bounded to two review rounds before needs-human.

## One dashboard for visibility and control

| View | Contents |
| --- | --- |
| Overview | Current work, stage, preview when available, readiness and latest activity |
| Setup & connections | Package/local prerequisites, owner connection, model/continuation/acceptance status and next actions |
| Integrations | Opt-in role tools, local versus verified status, scoped receipts, usage/cache counts and observed performance |
| Plan & features | Requirements, design reference, scope, permissions, budget, acceptance checks and feature progress |
| Tests & reviews | Real check outcomes and security/UX/UI/code/QA verdicts bound to the final commit |
| Documentation | Separate developer and end-user guide status, app paths and approved published text |
| Usage | Observed counters, completeness, API-equivalent known costs and approved budget terms |
| Activity | Pending/Running/Completed/Blocked receipts and latest activity |

Submit a request, approve the displayed plan, request revisions/rework, pause/resume/cancel and approve the reviewed final merge here. The authenticated loopback service forwards typed commands to the same owner; it never executes browser-supplied shell text. Host/Origin/CSRF checks, scoped offers, expiry, persistent replay handling and owner identity bind each action. Owner disconnected disables dependent controls. Local pairing does not itself prove model access. Never advertise a native background bridge that has not actually been verified.

The two workflow approvals are Approve plan and start, then Approve merge. Setup's local installation approval is separate. Native tool permission/login dialogs stay native; setup cannot preapprove them. In-scope routine work proceeds automatically. Scope/budget/permission changes need a revised plan. Merge does not authorize push/deployment.

## Pause, changes and recovery

A pause/cancel request remains pending until acknowledged and confirmed by the owner. Stop new dispatch safely and preserve partial changes, receipts, worker identities and usage. Resume reconciles the same processes/owner/Git state. Restart expires pending commands and marks running commands uncertain; never automatically restart paid work. Revised scope invalidates old offers and preserves prior plans/evidence as history. Unrelated target changes require reconciliation and fresh final validation.

## Installed entry points

From the installed application use node factory/runtime/cli.mjs start, check or status. The owner uses the versioned [bridge protocol](../../factory/runtime/WORKFLOW.md). Native factory skills connect/listen; workflow requests and approvals are submitted in the dashboard. No static Python server or manually edited JSON board is required.

## Maintainer checks and delivery limits

Run node factory/setup.mjs --verify and the shared package/offline reference tests from the checkout. The [metadata helpers](../../codex-claude/maintenance/README.md) remain optional; runtime installers cannot depend on them. A successful fixture is not live provider access, authentic reviewer execution, browser fidelity or an accepted application. Report these results separately. Upgrades preserve existing config, jobs, sessions, approvals and history; conflicting or legacy files need an explicit migration. Only necessary reusable files are copied; reports and jobs are created lazily under ignored factory/.local.
