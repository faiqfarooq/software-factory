Build and validate a small visual software factory in this repository. Create the actual files, not just a plan.

First, inspect the current working directory, Git root, nested folders, existing instructions, languages, manifests, test commands, and conventions. Build the factory in the user's current project. Discover its existing Git remote rather than assuming a particular folder, username, or repository. Preserve existing work and avoid creating unnecessary nested project folders.

Create:

- .claude/skills/factory/SKILL.md
- .claude/agents/spec-writer.md
- .claude/agents/builder.md
- .claude/agents/documentation-writer.md
- .claude/agents/review-security.md
- .claude/agents/review-ux.md
- .claude/agents/review-ui.md
- .claude/agents/review-code.md
- .claude/agents/review-qa.md
- .claude/agents/approver.md
- factory/board.json
- factory/dashboard.html
- factory/backlog.md
- factory/repo-context.md
- factory/pricing.json
- factory/usage.jsonl
- factory/README.md
- factory/jobs/ as needed

Each job includes spec.md, spec-contract.json, build.md and documentation.md alongside its review, decision, approval and usage reports. Keep private job history and session evidence excluded from Git and public serving.

Keep the entire setup understandable in a few minutes. Prefer small standard-library helpers over a framework.

Workflow:
feature → specification and documentation plan → builder → developer documentation and end-user manual → checkpoint → five independent reviews → approver → human approval → merge.

Use exactly ten roles: one orchestrator and nine specialists, including a documentation writer. For Claude Code, use Opus for spec-writer, builder, security, and approver; Sonnet for documentation-writer, UX, UI, code review, and QA. Use valid Claude Code agent frontmatter and verify configured and actual models through supported runtime evidence.

The session running /factory is the orchestrator. Only it spawns agents and writes board.json. Agents read context from files and write only their own reports. The builder may additionally edit application source and tests in an isolated feature worktree; the documentation writer may edit and commit only assigned application documentation on that same feature branch while the builder is idle.

Before implementation, the spec writer freezes scope, acceptance criteria, permissions, exact validation commands and a documentation_plan in spec.md and spec-contract.json. The plan has two mandatory entries, developer_documentation and end_user_manual. For each, record audience, entry page, assigned pages/write paths, required topics and workflows, existing coverage/gaps, feature impact and exact commands or manual verification steps. Both guides are required; justified not-applicable individual topics do not waive either deliverable. Scope changes require an explicit contract update and affected revalidation.

The builder works and commits on factory/<job-id>. Name it builder-<job-id>. Resume that SAME builder with SendMessage for revisions; do not spawn replacements silently.

Run the five reviews independently against the same immutable combined code-and-documentation commit. Each report starts with VERDICT: PASS or VERDICT: CHANGES and identifies the reviewed commit. QA independently verifies acceptance criteria, documentation coverage and tests.

WAIT FOR ALL FIVE report files and valid verdicts before resuming the builder. Maximum two review rounds per attempt. Preserve all previous reports. Explicit human rework starts another attempt.

decision.md starts with APPROVE or ESCALATE. Every completed feature waits for human approval before merging, including APPROVE recommendations. Failed mandatory reviews cannot be bypassed by a merge command.

The approver runs only after all five current-round reviews PASS and both documentation deliverables are complete and current for that commit. Immediately before merge, revalidate the reviewed commit, spec/contract, both guides' completion evidence, reviews, checks and human consent. Missing, incomplete or stale required content in either guide blocks approval and merge.

Ask before implementation when necessary for destructive actions, production access, spending, publication, or unclear scope. Routine feature implementation is already authorized.

Implement:
- /factory <feature>
- /factory next
- /factory approve <job-id>
- /factory rework <job-id> <note>

Verify that approval matches the exact reviewed commit. Changes to the feature or main require fresh validation and reviews.

APPLICATION DOCUMENTATION AFTER IMPLEMENTATION

Run documentation-writer using Sonnet after the builder's implementation commit and before checkpointing, with the builder idle. Supply that commit/diff, the frozen specification/contract and documentation_plan, build evidence, relevant source/config/tests and existing documentation. It writes two separately navigable documentation sets for the actual app:

1. **Developer documentation**: complete guidance for another developer to understand, set up, extend, test and maintain the app. Cover product purpose and supported features, architecture/data flow, source/module map and decisions, data model/storage, authentication/authorization and integrations where present, reproducible setup with prerequisites/expected outputs, safe configuration types/defaults/requirements, conventions, exact test/lint/build commands, maintenance, technical troubleshooting and limitations. Include API routes/auth/requests/responses/errors/pagination/rate limits where implemented. Describe existing deployment/operations only when in scope and verified.
2. **End-user manual**: plain-language guidance for using the app without reading code. Cover intended users/roles, access/account setup where present, first-use onboarding, navigation and screens or equivalent CLI/API entry points, all supported workflows, relevant administrator tasks and settings. Each task states prerequisites/permissions, actual labels or commands, steps, expected results, common errors and recovery. Include FAQ, troubleshooting, limitations and available help where implemented. Use real examples and verified screenshots when available; include developer internals only when users need them to use the product.

Preserve existing documentation framework, language, terminology and audience-specific locations. If none exist, use docs/developer/README.md and docs/user-manual/README.md as entry pages with additional pages as needed. Link both from the app README and docs navigation. Reuse shared references without duplicating them. CLI/API products still need a manual for their consumers. No new site generator or publication without authorization.

Assess agreed baseline gaps in both guides on the first feature; later update affected pages and verify unchanged coverage remains accurate. Do not invent features, configuration, endpoints, screenshots, releases, test results or deployment readiness. Record unchanged, inapplicable or unverified individual topics with reasons; a no-impact claim cannot waive required gaps or either guide. Follow project documentation conventions; otherwise use Diataxis structure and Google's developer writing/accessibility guidance. Check current official guidance when relevant, record source URLs, versions/observation dates and application in the report, and mark currency unverified when unavailable. Preserve authoritative API schemas and compatible published OpenAPI tooling rather than automatically upgrading it.

Grant only contract-assigned README/docs/API-reference writes, explicit documentation commits and the private report. Do not change implementation, dependencies, settings or production schemas unless explicitly scoped and reviewed. Commit docs after the implementation commit on the same feature branch; verify ancestry and the permitted doc-only diff. The private documentation.md report starts DOCUMENTATION: COMPLETE or DOCUMENTATION: CHANGES then Commit: <full-final-SHA>. Record input implementation commit, changed paths, standards and developer_documentation/end_user_manual separately, each with entry page, COMPLETE/CHANGES status, planned coverage mapped to pages and actual checks/limitations. Overall COMPLETE requires both guides complete and current. Keep the report outside the worktree to avoid circular commit references; no-change outcomes cite concrete coverage in both and the unchanged commit without an empty commit. Bind real writer identity/completion, content/spec/contract hashes and check evidence to the final commit, preserving report history by attempt/round. The report cannot substitute for either guide.

Run applicable acceptance/documentation checks on the final clean combined commit. Verify required coverage, README/navigation entry links, case-correct links/anchors, examples and safe placeholders; compare API reference with source/schema and user steps with actual screens/commands, roles and behavior. Label executed walkthroughs separately from source-only checks. Execute examples only in authorized isolated environments; required unverified checks remain unresolved. Code/QA review developer onboarding and technical accuracy; UX/UI review manual usability, navigation, task steps and accessibility; security checks safe configuration, permissions, examples and disclosure in both. The author is not a sixth independent reviewer.

Builder and documentation writer remain idle during reviews. Wait for all five valid reports before rework; route source findings to the SAME builder and documentation findings to their author. Reassess both guides after source changes, checkpoint the final result and run all five reviews again, including after documentation-only fixes. Preserve the two-round limit. No edits to the frozen tree during review or after approval. Record documentation invocations and revisions separately in usage without double counting shared model-access checks; a shared Sonnet probe does not prove writer execution or assigned file access.

For existing factories, upgrade role loading/routing, documentation-plan contracts, scoped permissions, stage transitions, per-deliverable evidence, accounting, dashboard publication and review/approval gates together. Preserve jobs, sessions and history. Legacy completion alone does not prove both guides exist. Active frozen contracts require an explicit scope update and fresh validation/reviews; do not silently rewrite contracts or past approvals.

STARTUP CHECKS AND CONNECTION RECOVERY

Generate a small factory check operation: local installation/authentication by default, and explicit --live checks that can consume usage. Document exact commands. Check Git root and committed base, runtime executable paths and versions, supported flags, authentication, and builder continuation before feature dispatch.

Check providers through the SAME adapter, directory, and permission/network environment as actual workers. External PowerShell success is not factory-environment success. Check each unique runtime/model/environment once, one at a time; prove the initial builder response before resuming that SAME session. A Codex launcher must check its own provider environment, not infer access from Claude.

Bound timeouts and retries. Stop dependent work after a failed check. Preserve sanitized exit status, terminal result, reported model, session match, observed error category/HTTP status, retry count, timestamp, and environment. Distinguish installation, authentication, DNS/TLS/connection, rate limit, model access, and permission failures only when evidence supports it; otherwise say unknown.

If the external adapter succeeds but the factory fails, compare child-process executable, cwd, authentication mode, proxy/CA settings, and scoped network permissions. Request the specific access through supported controls; never disable the sandbox or silently substitute a model. Do not reinstall or reauthenticate without evidence, loop through all roles, or replace an uncertain builder session.

Only the existing orchestrator publishes check evidence and observable usage. A standalone test does not update board.json. Keep current readiness separate from historical invocations. Show Ready/Blocked/Unchecked, last check time, environment and sanitized reason in the dashboard. Preserve old failures and unavailable usage after a successful recheck. Missing usage is not a measured zero.

Separate offline validation, local readiness, live model access, and full feature completion. A doctor must not make model calls by default. Include offline tests for missing/failed responses, timeouts, model mismatch, secret-safe errors, environment differences, and recheck/history preservation. Live tests require explicit authorization and real usage accounting.

TOKEN AND COST TRACKING

Track usage for every agent invocation, builder revision, review round, feature, and factory orchestrator where runtime telemetry permits.

First inspect the installed Claude Code and Codex versions and supported usage events, response metadata, or local session logs. Use real reported counters. Do not estimate token counts from character counts, ask agents to guess their usage, or invent unsupported hooks.

Each usage record should include:
- Stable event/request identifier for deduplication.
- Runtime/provider, session ID, agent identity, and invocation ID.
- Job ID, stage, attempt, review round, and timestamp.
- Actual model ID used, including fallback or mid-run model changes.
- Reported input, output, cached-input, cache-write, and reasoning tokens where available.
- Normalized total tokens without counting overlapping categories twice.
- Cost in USD, its calculation source, and whether it is reported or estimated.
- Usage completeness: complete, partial, or unavailable.

Keep provider-specific accounting correct. For example, cached input may be a subset of total input, and reasoning tokens may already be included in output. Preserve cache-write tiers when exposed. Do not add overlapping counts together.

Keep editable model rates in factory/pricing.json. Verify initial rates against official provider pricing, and record the source URL, effective date, provider, currency, units, and applicable token categories. Use actual model IDs rather than only aliases such as “opus.”

Calculate estimated USD cost from non-overlapping token categories and their applicable rates. Account for exposed provider discounts, service tiers, or additional charges where relevant. Missing rates or unsupported billing information mean unavailable or partial cost—not $0.

Distinguish:
- Measured token usage.
- Estimated API-equivalent cost.
- Actual reported charges, when authoritative billing data exists.

For subscription-based usage, do not present estimated API-equivalent cost as money actually deducted or charged.

Only the orchestrator writes the normalized factory/usage.jsonl ledger and publishes aggregates into board.json. Runtime collectors may return usage evidence to it, but agents and hooks must never independently modify board.json.

Prevent duplicate accounting when polling, resuming, restarting, or reprocessing events. Handle cumulative counters, resets, parent totals that already include child usage, and repeated streamed events. Preserve historical rates and costs; changing pricing.json must not silently reprice previous jobs.

Include retries, failed reviews, rework, and cancelled runs when their usage is observable. Keep unattributed orchestrator/session usage separate instead of assigning it to a feature without evidence. Factory totals cover this factory’s recorded usage, not the entire account.

After each agent invocation finishes:
- Print its model, tokens, USD cost, and reporting status.
- Update the job and dashboard aggregates.
- Preserve separate invocation records when the same builder resumes.

At the end of each feature, create an orchestrator-owned jobs/<job-id>/usage.md showing totals by agent, model, and review round, plus the feature total. If telemetry arrives later, reconcile it and indicate reporting lag. Do not claim complete final usage while some counters remain unavailable.

DASHBOARD

Build one self-contained HTML dashboard that polls board.json and shows:
- Stage columns and job cards.
- Reviewer chips for every round.
- Prominent permission and human-approval states.
- Factory-wide token and USD totals with completeness labels.
- Tokens and cost on each job card.
- A breakdown by actual model.
- Expanded per-agent and per-invocation usage when clicking a job.
- Input, output, cache categories, total tokens, and USD cost.
- Clear labels for estimated, reported, partial, and unavailable values.
- All ten roles, including the documentation stage; separate Developer documentation and End-user manual statuses, reviewed commits and safe entry-page links in job details. Label the writer's report separately.

Use enough decimal precision that small nonzero costs do not appear as $0.00. Show unknown values as unavailable. Keep incomplete totals visibly marked as known subtotals.

Clicking a card must also read its markdown files. Handle empty states, missing files, keyboard access, and fetch errors. Render file content safely. Serve the dashboard with Python’s standard HTTP server. Keep tokens, credentials, and raw private transcripts out of dashboard data and committed files.

Serve only sanitized approved state, report and documentation copies from a separate public directory. Resolve entry-page links through an explicit safe publication manifest; never accept route-derived filesystem paths or expose source, credentials, raw logs or private job/session evidence. Include linked documentation assets/pages only after sanitization; missing/unapproved items show unavailable.

LOCAL CODEX SUPPORT

Also support my local Codex:
- Add a project skill under .agents/skills/factory/.
- Add native project agent definitions under .codex/agents/ if supported by the installed version.
- Use supported Codex delegation and continuation tools, with the same workflow, accounting, and board ownership.
- Inherit my configured Codex models; do not claim Codex runs Claude’s Opus/Sonnet agents.
- Document the exact invocation for each runtime.
- Document accounting limitations separately for each runtime.

Inspect installed tools and current official documentation before configuring runtime-specific features.

VALIDATION AND DELIVERY

Validate JSON, skills, agent definitions, dashboard behavior, and applicable repo checks.

Generate offline fixture tests for ten-role routing and writer permissions, documentation_plan coverage for both deliverables, docs-before-checkpoint ordering, allowed doc-only diff/ancestry, per-deliverable completion binding and missing/incomplete/stale content blocking approval/merge. Cover no-change evidence for both, README/navigation links, technical onboarding and user-task verification, source-change invalidation, documentation-only rework with five fresh reviews, separate documentation usage/dashboard entries and upgrades rejecting unsupported legacy completion. These generated-runtime requirements are distinct from this prompt repository's tests.

Add meaningful accounting tests covering duplicate events, cumulative-counter resets, overlapping cache/reasoning tokens, multiple models, missing prices, partial telemetry, resumed builders, historical rates, and total reconciliation. Use clearly labeled synthetic fixtures; never present them as actual spending.

Report what was actually tested. Include concise Windows setup instructions, a sample backlog, and instructions for updating pricing.

Finish by showing the created files, validation results, accounting capabilities and limitations, and exact commands to start the dashboard and run the first feature. Ask before pushing or merging.
