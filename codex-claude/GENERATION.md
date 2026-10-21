Set up the Codex + Claude software factory inside my application using this repository's shared factory package. Complete the authorized setup with minimal files and the existing dashboard.

Codex owns coordination. Use the configured gpt-6.1-sol owner, gpt-6-astra security and gpt-6.1-sol code/QA native reviewers. Claude handles specification, builder, documentation, UX/UI and approver with the exact configured models. Verify actual installed support and account/model access. Native Codex agents are required; standalone Codex subprocesses are not substitutes. The .agents/skills/factory launcher owns the workflow; the .claude/skills/factory launcher forwards to the same Codex owner. Never create another orchestrator or assume a universal SendMessage bridge.

## Shared package setup

Use the reusable package in factory/ from a trusted checkout of this repository. It includes the versioned dashboard, loopback control service, installer and edition profiles. Do not regenerate the dashboard, create another framework, or copy this full prompt into the app.

1. Inspect the application folder, existing instructions, Git state and installed tools. Preserve existing source, README, settings and user changes. If the target is ambiguous, resolve it before writes.
2. Preview node <trusted-checkout>/factory/setup.mjs --project <app> --edition codex-claude. Present its exact local changes and obtain only permissions not already authorized by the user's setup request. The installer performs no account changes, dependency installs or paid checks. Node.js 22+ is required; missing prerequisites stay visible.
3. Complete the approved setup in one pass. --yes may be used for already-authorized local setup. Use --no-serve when the host needs a separate long-running terminal for node factory/runtime/cli.mjs start. Otherwise setup starts and opens the same shared dashboard. Keep its private pairing link local.
4. Read factory/runtime/WORKFLOW.md. Connect the actual edition owner using its real session identity and start its command listener as part of this setup when supported. Verify the actual listener and round trip; do not claim autonomous dashboard control for an idle/closed chat. If unsupported, show the precise reconnect/capability blocker.
5. Show one dashboard link and a short readiness result. Continue through local checks; never turn installation into a feature build, live test, merge, push or deployment. Live checks require explicit dashboard consent and can consume usage.

For an existing managed factory, re-run the installer after stopping and reconciling its owner/server. Checksums must match the package; upgrades preserve config, jobs, sessions, receipts and usage. Modified/unmanaged legacy factories require an explicit reviewed migration, never silent overwrite or owner replacement.

## Minimal application files

Only factory/README.md, factory/config.json, factory/runtime/, factory/dashboard/ and the edition's necessary native launcher belong in the reusable setup. Private state, jobs, contracts, reports, worktrees, logs and usage go under ignored factory/.local/, created when needed. Do not generate empty boards, ledgers, sample jobs/backlogs, duplicate prompts or separate SETUP/PRODUCT/DESIGN/DASHBOARD/EFFICIENCY guides in the app. Keep real application guides in the app's existing documentation structure; create only missing necessary pages. Keep the original app README and add a short factory link if appropriate.

## Workflow and evidence

Offer Build a complete app (mode=product) or Add or change a feature (mode=feature), with a readable title and exact target branch. Every request uses the staged lifecycle in factory/runtime/WORKFLOW.md; do not use the former two-gate automatic flow.

Product preparation follows feasibility, requirements analysis, specification/roadmap and system/UI design. The human approves EACH stage before the next. The roadmap maps every mandatory requirement to ordered features and acceptance checks, rejects duplicate/dangling dependencies and dependency cycles, and includes permissions, budgets, both guides and design snapshots.

Create a fresh product branch and a fresh named branch for EVERY feature through owner workspace prepare. Use the user's application folder, normal source paths and one active feature checkout by default. Each feature starts from the current accepted product head. Preserve unrelated changes; no blanket staging, resets or hidden default worktrees. Show folder/branch/HEAD/files/diff and a local app preview with its actual served commit.

After approved product design, WAIT for Start next feature. Each feature follows requirements, specification, design, implementation, formal testing/QA and separate integration review. Feature mode begins with feasibility too. Reuse approved product material without duplicate files, but never infer a stage approval. Each checkpoint requires Approve & continue or explicit merge code / Approve merge. No generic go ahead can bypass a current bound offer. Routine in-scope build checks are allowed during implementation; scope/budget/permission/reference changes return to the relevant earlier approval.

Keep ten roles and five independent security/UX/UI/code/QA reviews. Only the existing verified owner dispatches workers and writes normalized state through the bridge. Preserve the same builder for rework. Report actual worker id/role/provider/model/task/stage/status/timestamps/usage/result; raw sessions and transcripts remain private. Verify identities/capabilities in the SAME worker environment. Do not substitute models, bypass host denials or relaunch uncertain workers. Local registration is not verified execution.

Complete both real app guides before offering the implementation commit. Human implementation approval permits formal QA. Each acceptance criterion maps to a passing check. Source/docs, required tests, five independent reviewers and technical approver bind to the same immutable commit. The technical approver cannot replace human consent. Keep writers idle during review; source fixes return to the same builder with refreshed affected approvals/evidence. Two failed review rounds require needs-human.

Feature integration needs its own human approval, followed by exact Git target verification and real post-merge checks. Child integration is not a target-branch merge of the whole product. Mark the feature accepted only after its integration checks; then WAIT for explicit Start next feature. No automatic next-feature dispatch. Failed dependencies, stale evidence or unknown/exhausted enforcing budgets stop work.

After all accepted features, WAIT for Start product acceptance. Test whole-product journeys, design comparisons and guides; run five fresh independent final-product reviews plus approver. Child verdicts alone cannot approve the aggregate. Human acceptance approval permits preparing the final merge offer; another human approval permits the exact product-to-target merge. No push/deployment/branch deletion is implicit.

Design stages show actual architecture/data/API/screens and a local prototype where supported within approved scope. Supplied references require real access or exports and actual screenshot comparison for fidelity claims. Missing evidence remains Not checked or Blocked. Reference changes invalidate affected descendants and approvals.

The dashboard validates owner, stage/scope/offer, CSRF/Origin/Host, expiry and once-only receipts. Queued is Pending, not Running. Owner disconnected disables dependent controls. Host permission/login dialogs remain native. Pause requested and Cancellation requested stay pending until actual workers/tools stop. Resume uses the same owner/workers. Restart expires pending work, marks running activity uncertain and never replays paid work or a merge.

The authenticated dashboard may display bounded intended source diffs only on explicit request, excluding private/common credential paths; never expose arbitrary route-derived files, secrets, raw logs or private jobs. Budget/usage counters remain actual and non-overlapping; unknown is null, not zero or claimed savings. Legacy active jobs require explicit staged migration with preserved history and no fabricated approval.

## Optional role-specific integrations

Use role-context to load only the assigned shared planning/building/reviewing skill. The Integrations dashboard selects Context7 documentation, local code-only Graphify context, 21st.dev catalog/explicitly approved UI generation, and scoped Strix scanning. All external tools default off. Enabling updates the existing config only; it does not install software, authenticate accounts, submit source or spend usage. Planning Context7 requests require explicit bounded request consent; subsequent tool operations require frozen plan.integrations scopes. Only the authenticated existing owner invokes adapters, with stable once-only receipts, role restrictions and private results. Scanner targets, model and per-scan USD/turn limits must be displayed before plan approval; no writable source targets or automatic component install/publish endpoints exist. Uncertain tools block confirmed pause/cancel/final merge until reconciled. Never count tool completion as an independent review. Measure observed job time/tokens/rework and tool requests/cache hits before claiming savings.

## Validation and handoff

Run the package's offline tests from the trusted checkout. Verify fresh setup, repeat setup, upgrades/conflicts, edition isolation, path protection, owner disconnect/reconnect, expired/stale/replayed approval rejection, concurrent controls and actual gate/evidence behavior. Separately report Offline validated, Local prerequisites, Live models, Builder continuation, Owner listening, Browser verified and Full product acceptance. Fixtures use zero live providers and cannot become real acceptance evidence. Finish with only the dashboard link, selected edition, concrete blockers and next action.
