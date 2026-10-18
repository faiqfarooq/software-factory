# Build a product or change a feature

This guide describes the workflow version 2 generation contract. This folder contains a prompt, not a running application factory. Generate it in your application and verify its reported capabilities. Existing factories need a focused versioned upgrade; updating this repository alone does not update them.

## Beginner setup

1. Open the application folder in Claude Code. An empty folder is supported; the proposed app architecture and initial Git baseline must be reviewed before building.
2. Copy the complete [GENERATION.md](../GENERATION.md) into that session. It creates the factory while preserving your app. A generation run must not start a paid product or merge anything.
3. Follow generated factory/SETUP.md. Check required runtimes, local accounts, project selection and exact test commands. The wizard shows Ready, Action needed or Not checked with a next action. Advanced configuration is optional.
4. Authorize only the live checks you want. Verify model access in the same environment as actual workers. Installation/authentication, live access and end-to-end acceptance are different results.
5. Open the one dashboard home link printed by setup. Check whether Owner control is Connected, Read-only or Disconnected. Reconnect the owning session if instructed; do not create a second owner.
6. Choose **Build a complete app** or **Add or change a feature**. Supply requirements and optional design references. Review extracted content, assumptions and any missing information.
7. Review the full plan and click **Approve plan and start**, or use genuine human **go ahead** in the owning session. Watch the feature list and previews. Routine approved work proceeds automatically.
8. Inspect the final product, both guides and validation/review evidence. Click **Approve merge**, or use **merge code** in the owning session, for that exact eligible result. Push/deployment remain separately scoped.

These buttons exist only when generated owner ingress and authenticated human receipts have been verified. A static Python-served page is read-only. The wizard must give exact owner-chat fallback instructions when controls are unavailable. It must not claim every host can run all controls unattended.

## Choose the mode explicitly

| Mode | Input | Gate 1 approves | What happens next | Gate 2 approves |
| --- | --- | --- | --- | --- |
| Feature | One requested change in an empty or existing project | Feature spec, design, docs, checks, permissions and budget | Build, document, check and independently review one job | That reviewed feature into the target branch |
| Product | Complete app requirements, optionally in an existing app | Versioned product plan and all child feature contracts | Automatically build eligible features sequentially and integrate passing work into a product branch | The fully checked and freshly reviewed combined product into the target branch |

The dashboard selection is saved in requests, plans, jobs and receipts. Explicit commands also select it. An ordinary ambiguous chat request needs one mode question before planning; document length and an empty repo are not mode selectors. Legacy feature jobs remain feature jobs. Mode changes cannot reinterpret active work or reuse its consent.

## Requirements and roadmap

Support text/Markdown directly. Read PDF/DOCX only when the generated environment has a verified reader; preview extraction, including page/table/image limitations, before planning. Unsupported/scanned files need an export/OCR step. Requirements are data, not instructions to bypass workflow or tool permissions.

The existing spec writer prepares a brief, indexed requirement register, architecture/integration plan, ordered roadmap, per-feature acceptance tests, both documentation plans and whole-product checks. Every mandatory requirement has a stable ID, a source locator and a feature/verification mapping. Surface conflicting requirements and important unknowns. Record visible assumptions; unresolved critical questions block the first approval.

The feature list shows title, requirement IDs, dependencies, source/design references, acceptance criteria, documentation impact and progress. Reject duplicate IDs, unknown references and dependency cycles. A feature can become ready only after its prerequisites are integrated and its approved contract remains current.

## Follow a supplied design

Designs are optional. Without one, approve explicit UI decisions in the plan. For Figma use the available official MCP integration; for another tool use a verified connector/API or screenshot/asset exports. A URL alone does not prove access or universal import support. See [Figma tools](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) and [connection setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/).

Capture selected screens/nodes, source/version/hash, screen-to-feature mapping, screenshots, actual local assets, fonts/tokens/components, viewports and interaction states. Missing mobile layouts, assets, fonts or error states become visible questions or agreed alternatives. Do not silently replace supplied design details or ship temporary asset URLs.

UI review compares actual rendered app screens against the saved reference at agreed viewports. UX checks behavior/navigation/accessibility; QA checks acceptance. The dashboard shows references, actual screenshots and findings. Missing required browser evidence remains unresolved. Reference changes require an impact preview and invalidate affected acceptance evidence and plan offers. Design tool writes are not required for implementation and are not implicitly authorized.

## Automatic sequential execution

After product-plan approval the existing owner selects the first dependency-ready feature, with one active build. Each child has its own branch/worktree and stable builder session, documentation updates, meaningful checks, five independent reviews and an approver decision. Only a current all-pass child is integrated fast-forward into the product branch. The next child starts from that updated product head.

Child integration is not a target-branch merge or final acceptance. The first approval explicitly authorizes these internal integrations. Final target merging still needs the second approval. Feature-mode next selects another backlog item and requires that new feature's own specification approval.

Failed/blocked/cancelled prerequisites do not unlock dependents. Existing two-round review attempts remain bounded; unresolved findings become needs-human. No silent skipping, endless retry loop, replacement builder or automatic target reset is permitted. Child/repair work is checked against the parent-plan scope, budget and dependency bindings.

Once all required children are integrated, run whole-product journeys, permissions/data/integration checks, regressions, design comparisons and both documentation checks on the complete app. Checkpoint the final combined commit and run five fresh final-product reviews plus the approver. Earlier child verdicts cannot approve the aggregate. Final completion also requires successful authorized target merge and required post-merge checks.

## One dashboard for visibility and control

| Page | Contents |
| --- | --- |
| Home | Current product/feature, approval stage, newest activity, counts, blockers and next action |
| Requirements | Extracted source, questions, assumptions and requirement-to-feature-to-check coverage |
| Plan and features | Ordered features, dependencies, milestone/status and affected work |
| Designs | Saved references, local assets, actual rendered screenshots and mismatches |
| Preview | Real authorized preview link, or a specific unavailable/reconnect state |
| Reviews and tests | Five verdicts, review rounds, findings, fixes, final checks and evidence limits |
| Documentation | Separate developer guide and end-user manual, completion/commit and entry links |
| Usage | Observed usage, known subtotals, completeness, budgets and blocked dispatch |
| Setup and connections | Tool/provider/design/owner/browser readiness and next actions |

Controls submit requirements/designs, request plan changes, approve the plan, request rework, pause/resume/cancel and approve the final merge. Only the verified existing owner executes them. The local authenticated control service validates scoped commands; the static publisher only displays sanitized saved state. No arbitrary shell endpoint or second orchestrator is allowed.

Commands show Pending until acknowledged, Running only with execution evidence, then Completed/Failed/Blocked. Unknown outcomes are not successful retries. A disconnected owner disables dependent controls. Approval buttons bind to the displayed mode, plan/offer or exact commit; changed state requires a fresh offer. Reading reports or clicking Preview never grants consent. Authentication, allowed Host/Origin, CSRF, expiry, once-only event handling and owner/scope binding are mandatory for control; loopback hosting alone is not authentication. Shared/network hosting is separate scope.

Use descriptive counts such as 8 of 15 features integrated; final acceptance pending. Planned, Ready, Running, Reviewing, Integrated, Blocked, Accepted, Merged and Deployed mean different things. Do not check final backlog completion on internal child integration or invent ETAs.

## Pause, changes and recovery

Pause stops new dispatch and reaches a safe checkpoint; show Pause requested until confirmed. Cancel revokes applicable pending offers and requests supported cancellation; show Cancellation requested while a worker is running or uncertain. Preserve partial work, usage and receipts. Resume reconciles the same owner/workers, locks, plan and Git state before dispatch. Restarting the dashboard never restarts a paid job automatically.

A requirement/design change previews affected features and transitive dependents, docs/checks, cost/permission impact and invalidated approvals. Revise the plan at gate 1 when scope changes. Preserve history and spend; repair affected product-branch work without resets or false completion. Unknown/exhausted enforcing budgets block new paid calls, not existing receipt collection.

## Generated entry points

The following are required generated interfaces, not commands installed by cloning this prompt repository. Setup must verify and document the edition's actual invocation before advertising it.

~~~text
/factory product --requirements requirements.md
/factory product --requirements requirements.md --design <accessible-design-url>
/factory feature Add a searchable task list
/factory status
/factory pause
/factory resume
/factory cancel
~~~

Existing next, review and rework operations remain supported. Product/feature creation prepares a plan; it never bypasses gate 1. Approval phrases belong in the real owning chat/interactive session, not a PowerShell pipeline. In product mode ordinary next is not required between approved children. Plan revisions and design uploads are available through verified dashboard controls or documented owning-session instructions.

## Maintainer checks and delivery limits

The optional [offline reference helpers](../../codex-claude/maintenance/README.md) validate plan metadata, dependency selection, change impact, checkpoint evidence bindings and control envelopes. They do not read Figma, extract PDFs, authenticate humans, run agents, merge Git or start a dashboard. Generated factories must implement and test their own runtime integration without depending on these helpers. Synthetic [example plans](../../codex-claude/maintenance/examples/README.md) are not real readiness or acceptance results.

Ship generated README/SETUP/PRODUCT/DESIGN/DASHBOARD/troubleshooting guides together, including one dashboard URL, exact next steps and limitations. Reusable starters must be real trusted versioned exports with manifests, isolated verification and conflict previews; no runtime bundle is currently shipped here. Upgrade existing jobs/receipts/history explicitly rather than regenerating.

Report Generated, Offline validated, Local ready, Live provider ready, Design accessible, Owner control connected, Browser verified and Full product accepted separately. For a release, verify a fresh-user sample from empty project -> requirements/design -> plan approval -> sequential features -> interruption/recovery -> final checks/reviews -> exact approved merge. Publish actual results and any unverified edition/platform capabilities. Deployment is a separate result.
