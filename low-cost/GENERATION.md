Build and validate a small, visual Software Factory Budget Edition in the current project. Create actual working files, not just a plan.

First inspect the repository, its instructions, Git root, existing factory files, language, test commands, and conventions. Preserve existing work and the original factory edition. Keep this edition small and understandable.

## Agent assignments

Use exactly ten roles: one orchestrator and nine specialist workers.

| Role | Required model | Provider model ID |
|---|---|---|
| Orchestrator | DeepSeek V4.1 Flash | deepseek-flash |
| Spec writer | Qwen3.8 Max | qwen3.8-max |
| Builder | Kimi K3 | kimi-k3 |
| Documentation writer | Qwen3.8 Max | qwen3.8-max |
| Security reviewer | DeepSeek V4.1 Flash | deepseek-flash |
| UX reviewer | Qwen3.8 Max | qwen3.8-max |
| UI reviewer | Kimi K2.7 Code | kimi-k2.7-code |
| Code reviewer | Kimi K2.7 Code | kimi-k2.7-code |
| QA reviewer | DeepSeek V4.1 Flash | deepseek-flash |
| Approver | Qwen3.8 Max | qwen3.8-max |

Verify identifiers, account access, tool-calling capabilities, provider endpoints, and current configuration requirements against official documentation.

DeepSeek's deepseek-flash identifier currently resolves to V4.1 Flash. Verify the resolved version at startup and record it. Do not silently accept a future different model.

Record requested and reported models for all runs. Resolve mismatches before accepting results. Never silently substitute another model.

## Runtime design

Implement a small Python runner with provider adapters for:

- DeepSeek.
- Alibaba Cloud Model Studio/Qwen.
- Moonshot/Kimi.

Use the providers' supported APIs or an existing compatible agent runtime. OpenAI-compatible APIs may share a client library, but each must use its own endpoint, credentials, model configuration, and billing rules.

The actual runtime orchestrator must be DeepSeek V4.1 Flash. Codex or Claude Code may generate the project or launch the runner, but they must not secretly perform the orchestrator role using their default models.

Implement a real tool-calling agent loop. A bare text-generation API call is insufficient for coding, testing, or reviewing a repository.

Provide narrowly scoped tools for reading files, searching, writing assigned artifacts, running tests, inspecting Git, and making authorized source changes.

Only the orchestrator can dispatch workers and update factory state. Deterministic helpers must enforce workflow gates and file ownership.

Use provider-supported reasoning parameters. Kimi K3 and Kimi K2.7 Code require appropriate handling of thinking output and complete tool-call history. Preserve the fields required for valid continuation.

Keep dependencies minimal. Preserve current runtime and permission settings.

## Startup checks and connection recovery

Generate a small `factory check` operation: local configuration by default, explicit `--live` provider calls only when authorized. Document exact commands. Verify the Git root and committed base, installed runner, credentials presence, configured endpoints, requested/resolved model IDs, tool calling and SAME builder continuation before feature dispatch.

Check each unique provider/model/endpoint/environment once, one at a time, through the SAME adapter, working directory, and permissions used by workers. An external terminal/API success does not prove the coding assistant's child process has access. Prove an initial builder result before continuing that SAME session; preserve uncertain state for explicit recovery.

Bound timeouts and retries. Stop dependent work after a failure. Record timestamp, environment, exit/terminal status, requested/reported model, observed HTTP status or sanitized error category, and usage when exposed. Distinguish DNS/TLS/connection, authentication, rate limits, model access and permission failures only with evidence; otherwise say unknown. Never log secrets, credential values, full URLs containing tokens, or raw private transcripts.

If only the factory fails, compare child-process permissions, executable, cwd, authentication mode, endpoint and inherited proxy/CA settings. Request narrowly scoped required access through the host's supported controls; never disable the sandbox, silently change providers/models, or repeatedly relaunch all workers.

Only the existing orchestrator publishes readiness, ledger and board. Standalone checks return evidence and explain that they do not update the dashboard. Store current per-provider/model readiness separately from historical invocations; show Ready/Blocked/Unchecked, last-check time, environment and sanitized reason. Successful rechecks preserve old failures and unavailable usage, never turn them into zero-cost successes.

Separate offline validation, local readiness, live provider access, and complete feature validation. A doctor must not call models by default. Add offline tests for failure categories, unknown retries, bounded timeouts, model mismatch, secret-safe diagnostics, external success with factory failure, and successful recheck with preserved history. Live tests require authorization and real usage accounting.

## Files

Create a reusable structure such as:

```text
factory/
  run.py
  providers.py
  accounting.py
  models.json
  pricing.json
  board.json
  usage.jsonl
  dashboard.html
  backlog.md
  repo-context.md
  README.md
  agents/
    orchestrator.md
    spec-writer.md
    builder.md
    documentation-writer.md
    security-reviewer.md
    ux-reviewer.md
    ui-reviewer.md
    code-reviewer.md
    qa-reviewer.md
    approver.md
  jobs/<job-id>/
    request.md
    spec.md
    spec-contract.json
    build.md
    documentation.md
    round-1/
      review-security.md
      review-ux.md
      review-ui.md
      review-code.md
      review-qa.md
    decision.md
    approval.md
    usage.md

low-cost-software-factory/
  generation.md
  README.md

.env.example
.gitignore
requirements.txt
```

If a factory already exists, integrate a separate budget profile or use a separate runtime directory rather than overwriting the original configuration, jobs, or ledger. Document the chosen structure and commands accurately.

Optional Codex/Claude skills named factory-budget may launch this runner. They must preserve the actual DeepSeek orchestrator and avoid conflicting with an existing /factory skill.

Keep prompts and public documentation in separate files.

## Inspection and permissions

Before starting workers, write repo-context.md with:

- Repository language and framework.
- Source layout and conventions.
- Applicable project instructions.
- Exact discovered test, lint, and build commands.
- Provider configuration and available model access.

If no application or tests exist, say so rather than inventing commands.

The feature request authorizes routine implementation on its feature branch. Ask before actions requiring additional authorization, including destructive changes, production access, deployment, external publication, or spending beyond the authorized model usage.

Use environment variables or a supported secrets mechanism for credentials. Provide placeholders in .env.example. Do not commit secrets, personal session transcripts, or private job data.

## Workflow

Feature → specification and documentation plan → permission check → builder → developer documentation and end-user manual → checkpoint → five independent reviewers → approver → human approval → merge.

The spec writer freezes scope, testable acceptance criteria, permission requirements, exact validation commands and a documentation_plan in spec.md and spec-contract.json before implementation. The plan has two required entries: developer_documentation and end_user_manual. Each records audience, entry page, assigned pages/write paths, required topics and workflows, existing coverage/gaps, feature impact and exact verification commands or manual checks. Both guides are mandatory; justified not-applicable individual topics do not waive either. Scope changes require an explicit contract update and affected revalidation.

The builder uses an isolated worktree on branch factory/<job-id>, implements the specification, runs meaningful acceptance tests, and commits explicit changed paths.

Only one factory orchestrator and one build may be active at a time. Review workers can run independently in parallel.

Workers receive context from files. They write only their own reports. The builder may additionally edit application source and tests in its feature worktree; the documentation writer may edit and commit only assigned application documentation on that same feature branch while the builder is idle.

Only the orchestrator writes board.json and normalized usage aggregates. Save state atomically and prevent concurrent orchestrators from modifying the same board.

## Builder continuity

Name the builder builder-<job-id>.

Persist its session identity and complete provider-required conversation/tool history in private runtime storage. Resume that same logical builder for revisions, passing the review-folder or feedback-file path.

Use a supported native session-resume mechanism if available. Otherwise restore the persisted API agent history. Record every resumed invocation separately for accounting.

Do not claim a native SendMessage capability unless the chosen runtime supports it. Implement and document the provider-adapter equivalent.

Never silently replace the builder or discard its history. If recovery fails, pause for an explicit recovery decision.

## Application documentation after implementation

Run documentation-writer using Qwen3.8 Max (qwen3.8-max) through the Qwen provider adapter after the builder's implementation commit and before checkpointing, with the builder idle. Verify real writer identity/completion, not just configured model or shared access-probe success. Supply the implementation commit/diff, frozen spec/contract and documentation_plan, build evidence, relevant source/config/tests and existing docs. Produce two separately navigable documentation sets for the actual app:

1. **Developer documentation**: complete guidance for another developer to understand, set up, extend, test and maintain the app. Cover product purpose and supported features, architecture/data flow, source/module map and design decisions, data model/storage, authentication/authorization and integrations where present, reproducible setup with prerequisites/expected outputs, safe configuration types/defaults/requirements, conventions, exact test/lint/build commands, maintenance, technical troubleshooting and limitations. Include API routes/auth/requests/responses/errors/pagination/rate limits where implemented. Describe existing deployment/operations only when in scope and verified.
2. **End-user manual**: plain-language instructions for using the app without reading code. Cover intended users/roles, access/account setup where present, first-use onboarding, navigation and screens or equivalent CLI/API entry points, all supported workflows, relevant administrator tasks and settings. Each task states prerequisites/permissions, actual labels or commands, steps, expected results, common errors and recovery. Include FAQ, troubleshooting, limitations and available help where implemented. Use real examples and verified screenshots where available; include developer internals only when users need them to use the product.

Preserve existing documentation framework, language, terminology and audience-specific locations. If none exist, use docs/developer/README.md and docs/user-manual/README.md as entry pages, with additional pages as needed. Link both from the app README and docs navigation. Reuse shared references without duplication; API/CLI consumers still need a manual. No new site generator or publication without authorization.

Assess agreed baseline gaps in both guides on the first feature; later update affected pages and verify unchanged coverage remains accurate. Do not invent features, configuration, endpoints, screenshots, releases, test results or deployment readiness. Mark unchanged, inapplicable or unverified individual topics with reasons; no-impact claims cannot waive required gaps or either guide. Follow project documentation conventions; otherwise use Diataxis structure and Google's developer writing/accessibility guidance. Verify relevant current official guidance, record source URLs, versions/observation dates and application in the report, and mark currency unverified when unavailable. Preserve authoritative API schemas and compatible published OpenAPI tooling rather than automatically upgrading it.

Grant only contract-assigned README/docs/API-reference writes, explicit documentation commits and the private job report. No implementation, dependency, settings or production-schema changes unless explicitly scoped and reviewed. Commit docs on the same feature branch after implementation; verify ancestry and the allowed doc-only diff. The private documentation.md report starts DOCUMENTATION: COMPLETE or DOCUMENTATION: CHANGES then Commit: <full-final-SHA>. Record input implementation commit, changed paths, standards and developer_documentation/end_user_manual separately, each with entry page, COMPLETE/CHANGES status, planned coverage mapped to pages and actual checks/limitations. Overall COMPLETE requires both guides complete and current for the final combined commit. Keep the report outside the worktree to avoid circular commit references; no-change outcomes cite concrete coverage in both and the unchanged commit without an empty commit. Bind actual writer identity/completion, content/spec/contract hashes and check evidence to that commit, preserving report history by attempt/round. The report cannot substitute for either guide.

Run applicable acceptance/documentation checks on the final clean combined commit. Verify required coverage, README/navigation links to both entries, case-correct links/anchors, examples and safe placeholders. Compare APIs with source/schema and user steps with actual screens/commands, permissions and behavior. Label executed walkthroughs separately from source-only checks. Execute examples only in authorized isolated environments; required unverified checks remain unresolved. Code/QA review developer onboarding and technical accuracy; UX/UI review manual usability, navigation, task steps and accessibility; security checks safe configuration, permissions, examples and disclosure in both. The author is not a sixth independent reviewer.

Keep the builder and documentation writer idle during reviews. Wait for all five valid reports before rework, then send source findings to the SAME builder and documentation findings to their author through the supported provider adapter. Reassess both guides after source changes, checkpoint the final result and run all five reviews again, including after documentation-only fixes. Preserve the two-round limit. No frozen-tree edits during review or after approval. Record documentation invocations and revisions separately in usage; preserve supported writer history when safely resuming and never infer completion from a shared Qwen access check.

For an existing budget factory, upgrade role routing/loading, documentation-plan contracts, scoped tools/permissions, stage transitions, per-deliverable evidence, accounting, dashboard publication and review/approval gates together. Preserve jobs, sessions and history. Legacy completion alone does not prove both guides exist. Active frozen contracts need an explicit scope update and fresh validation/reviews; do not silently rewrite contracts or past approvals.

## Reviews

Run five independent reviews against the same immutable combined code-and-documentation commit:

1. Security — DeepSeek V4.1 Flash.
2. UX — Qwen3.8 Max.
3. UI — Kimi K2.7 Code.
4. Code — Kimi K2.7 Code.
5. QA — DeepSeek V4.1 Flash.

QA independently runs applicable tests and checks every acceptance criterion, including both documentation deliverables.

Each report begins with exactly VERDICT: PASS or VERDICT: CHANGES and identifies the reviewed commit.

WAIT FOR ALL FIVE valid reports before resuming the builder. Missing, malformed, failed, or wrong-commit reports never count as PASS.

If any reviewer requests CHANGES, route findings to the same builder or documentation writer as appropriate, reassess affected docs, then checkpoint and run a fresh complete review round.

Allow two review rounds per attempt. Unresolved changes then move the job to needs-human. Explicit human rework starts a new attempt while preserving prior reports.

## Approval and merge

After all five reviewers PASS and both documentation deliverables are complete and current for the combined commit, Qwen3.8 Max writes decision.md beginning with APPROVE or ESCALATE.

Both decisions lead to human review. Agent approval alone never authorizes merging.

Require explicit human approval for the exact reviewed commit. A changed feature branch or main branch requires fresh validation and reviews.

Immediately before merge, revalidate the reviewed commit, spec/contract, both guides' completion evidence, reviews, checks and human consent. Missing, incomplete or stale required content in either guide blocks approval and merge.

Merge only eligible jobs after human approval and required checks. Report conflicts or failed post-merge checks accurately. Do not automatically push, deploy, reset, or discard changes.

## Commands

Implement and document:

- new <feature>
- next
- approve <job-id>
- rework <job-id> <note>

Use a concrete runner interface such as python factory/run.py <operation>. Document any directory or profile options actually implemented.

The dashboard displays state; human approval occurs through the runner or its documented interactive interface.

## Token and cost accounting

Capture real provider usage after every observable request and worker invocation, including orchestrator work, documentation runs/revisions, retries, reviews, failed runs, and builder revisions.

Record:

- Stable event/request ID.
- Job, stage, attempt, round, role, and invocation.
- Provider, endpoint/region, session, and timestamp.
- Requested and resolved/reported model.
- Input, output, cached input, cache writes, and reasoning tokens where exposed.
- Total tokens without overlapping-category double counting.
- USD cost, pricing version, billing mode, and calculation source.
- Complete, partial, or unavailable usage.
- Estimated cost versus authoritative reported charge.

Handle each provider's billing correctly:

- DeepSeek peak/off-peak schedules and cache-hit rates.
- Qwen region-specific rates and cache categories.
- Kimi cache-write tiers and reasoning/output accounting.

Verify current rates from official sources and store them with source URLs and effective dates in pricing.json.

Do not estimate exact tokens from character counts. Missing telemetry or pricing means partial/unavailable, not zero.

Deduplicate streamed events, cumulative counters, resumed sessions, restarts, and parent/child totals. Preserve historical pricing and costs.

After every worker invocation, print its role, actual model, tokens, USD cost, and reporting status. Update the board and preserve a separate invocation record.

At feature completion, write usage.md with per-agent, per-model, per-round, and feature totals. Include delayed-telemetry and completeness notes.

The dashboard reports this edition's usage. Keep all comparisons with the original edition exclusively in the public README.

## Dashboard

Create one self-contained HTML dashboard that polls board.json.

Show:

- Jobs across workflow stages.
- Ten roles with configured and actual models, including the documentation stage.
- Separate Developer documentation and End-user manual statuses, reviewed commits and safe entry-page links in job details; label the writer's report separately.
- Five reviewer chips for every round.
- Permission, blocked, and human-approval states.
- Tokens and USD cost per agent, model, invocation, and feature.
- Factory-wide recorded totals.
- Estimated, reported, partial, and unavailable labels.

Use enough precision for small nonzero amounts. Show unknown values as unavailable and incomplete totals as known subtotals.

Clicking a job opens its markdown reports and usage summary. Handle empty states, missing files, network failures, keyboard access, and responsive layouts.

Render content safely. Serve the dashboard using Python's standard HTTP server.

Serve only sanitized approved state, report and documentation copies from a separate public directory. Resolve entry-page links through an explicit safe publication manifest; reject route-derived filesystem paths. Never expose source, credentials, raw logs or private job/session evidence. Include linked documentation assets/pages only after sanitization; missing/unapproved items show unavailable.

## Documentation and validation

Write a beginner-friendly README with:

- The ten-role model table, including the Qwen documentation writer.
- Mermaid workflow, review/rework, and accounting diagrams.
- Provider authentication requirements.
- Setup, dashboard, and first-feature commands.
- Permission and human-approval behavior.
- Accounting limitations and pricing-update instructions.
- The documentation plan, developer documentation and end-user manual, their entry links, separate completion evidence and review/approval requirements.

Keep the original factory comparison only in that README. Use sourced pricing, explicit token assumptions, and reproducible arithmetic. Distinguish token-rate estimates from actual bills and successful-feature costs. Never invent a savings percentage or claim equivalent quality without evidence.

Validate model routing, tool execution, persisted builder continuation, file ownership, all-five review gates, two-round limits, human approval, JSON, dashboard behavior, and relevant repository checks.

Generate offline fixture tests for ten-role routing and writer permissions, documentation_plan coverage for both deliverables, docs-before-checkpoint ordering, allowed doc-only diff/ancestry, per-deliverable completion binding and missing/incomplete/stale content blocking approval/merge. Cover no-change evidence for both, README/navigation links, technical onboarding and user-task verification, source-change invalidation, documentation-only rework with five fresh reviews, separate documentation usage/dashboard entries and upgrades rejecting unsupported legacy completion. These generated-runtime requirements are distinct from this prompt repository's tests.

Test accounting deduplication, counter resets, cache/reasoning overlap, peak/off-peak rates, region selection, missing pricing, historical rates, and total reconciliation.

Clearly label synthetic fixtures. Separate offline tests from authorized live provider checks and record usage incurred by live checks.

Ship an empty public board and ledger. Keep private session history and credentials excluded from Git.

Finish with created files, actual validation results, unresolved requirements, and exact startup commands. Ask before pushing or merging.
