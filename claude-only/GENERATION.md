Build and validate a small visual software factory in this repository. Create the actual files, not just a plan.

First, inspect the current working directory, Git root, nested folders, existing instructions, languages, manifests, test commands, and conventions. Build the factory in the user's current project. Discover its existing Git remote rather than assuming a particular folder, username, or repository. Preserve existing work and avoid creating unnecessary nested project folders.

Create:

- .claude/skills/factory/SKILL.md
- .claude/agents/spec-writer.md
- .claude/agents/builder.md
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

Keep the entire setup understandable in a few minutes. Prefer small standard-library helpers over a framework.

Workflow:
feature → spec-writer → builder → five independent reviews → approver → human approval → merge.

For Claude Code, use Opus for spec-writer, builder, security, and approver; Sonnet for UX, UI, code review, and QA. Use valid Claude Code agent frontmatter.

The session running /factory is the orchestrator. Only it spawns agents and writes board.json. Agents read context from files and write only their own reports. The builder may additionally edit application source and tests in an isolated feature worktree.

The builder works and commits on factory/<job-id>. Name it builder-<job-id>. Resume that SAME builder with SendMessage for revisions; do not spawn replacements silently.

Run the five reviews independently. Each report starts with VERDICT: PASS or VERDICT: CHANGES and identifies the reviewed commit. QA independently verifies acceptance criteria and tests.

WAIT FOR ALL FIVE report files and valid verdicts before resuming the builder. Maximum two review rounds per attempt. Preserve all previous reports. Explicit human rework starts another attempt.

decision.md starts with APPROVE or ESCALATE. Every completed feature waits for human approval before merging, including APPROVE recommendations. Failed mandatory reviews cannot be bypassed by a merge command.

Ask before implementation when necessary for destructive actions, production access, spending, publication, or unclear scope. Routine feature implementation is already authorized.

Implement:
- /factory <feature>
- /factory next
- /factory approve <job-id>
- /factory rework <job-id> <note>

Verify that approval matches the exact reviewed commit. Changes to the feature or main require fresh validation and reviews.

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

Use enough decimal precision that small nonzero costs do not appear as $0.00. Show unknown values as unavailable. Keep incomplete totals visibly marked as known subtotals.

Clicking a card must also read its markdown files. Handle empty states, missing files, keyboard access, and fetch errors. Render file content safely. Serve the dashboard with Python’s standard HTTP server. Keep tokens, credentials, and raw private transcripts out of dashboard data and committed files.

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

Add meaningful accounting tests covering duplicate events, cumulative-counter resets, overlapping cache/reasoning tokens, multiple models, missing prices, partial telemetry, resumed builders, historical rates, and total reconciliation. Use clearly labeled synthetic fixtures; never present them as actual spending.

Report what was actually tested. Include concise Windows setup instructions, a sample backlog, and instructions for updating pricing.

Finish by showing the created files, validation results, accounting capabilities and limitations, and exact commands to start the dashboard and run the first feature. Ask before pushing or merging.
