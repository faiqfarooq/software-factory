Build and validate a small, visual software factory in this repository. Create the actual files and working integrations, not just a plan.

First inspect the current working directory, Git root, nested folders, repository instructions, languages, manifests, test commands, and conventions. Work in the user's current project, discover its existing Git remote, and preserve existing work. Keep the setup understandable in a few minutes.

## Required agents and models

Use exactly nine roles: one orchestrator and eight specialist agents.

| Role | Required model | Model identifier | Runtime |
|---|---|---|---|
| Orchestrator | GPT-6.1 Sol | gpt-6.1-sol | Codex |
| Spec writer | Claude Opus 5.5 | claude-opus-5-5 | Claude Code |
| Builder | Claude Opus 5.5 | claude-opus-5-5 | Claude Code |
| Security reviewer | GPT-6 Astra | gpt-6-astra | Codex |
| UX reviewer | Claude Sonnet 5.5 | claude-sonnet-5-5 | Claude Code |
| UI reviewer | Claude Sonnet 5.5 | claude-sonnet-5-5 | Claude Code |
| Code reviewer | GPT-6.1 Sol | gpt-6.1-sol | Codex |
| QA reviewer | GPT-6.1 Sol | gpt-6.1-sol | Codex |
| Approver | Claude Opus 5.5 | claude-opus-5-5 | Claude Code |

Verify model identifiers, installed runtime versions, account access, and configuration syntax against current official documentation.

Pin the explicit model identifiers. Do not silently substitute models or use rolling aliases such as “opus” or “sonnet.”

Record the requested and actual reported model for every invocation. Resolve model mismatches before accepting results.

## Runtime integration

The GPT-6.1 Sol Codex session is the orchestrator.

Use native Codex agents for security, code review, and QA. Implement a small provider adapter to launch and resume Claude Code sessions for specification, building, UX, UI, and approval.

Use supported CLI or SDK interfaces, structured output where available, explicit model selection, and persistent session identifiers. Verify installed capabilities before implementing integrations.

Do not assume native Codex agent tools can directly spawn Claude models.

The Claude Code /factory skill is a launcher that forwards operations to the GPT-6.1 Sol orchestrator. It does not become the orchestrator itself.

Verify the actual orchestrator model before starting a job.

Preserve permission settings. If a non-interactive worker needs additional permission, return that requirement to the orchestrator and wait for human authorization. Do not bypass approval controls.

If a required runtime, model, authentication method, or session-resume capability is unavailable, identify the requirement and leave affected execution visibly blocked. Continue independent setup work without fabricating success.

## Files

Create this structure, preserving existing compatible files:

```text
.agents/
  skills/factory/SKILL.md

.codex/
  config.toml
  agents/
    security-reviewer.toml
    code-reviewer.toml
    qa-reviewer.toml

.claude/
  skills/factory/SKILL.md
  agents/
    spec-writer.md
    builder.md
    ux-reviewer.md
    ui-reviewer.md
    approver.md

factory/
  models.json
  pricing.json
  board.json
  usage.jsonl
  dashboard.html
  backlog.md
  repo-context.md
  README.md
  scripts/
  jobs/<job-id>/
    request.md
    spec.md
    build.md
    round-1/
      review-security.md
      review-ux.md
      review-ui.md
      review-code.md
      review-qa.md
    decision.md
    approval.md
    usage.md

prompts/
  software-factory.md

README.md
.gitignore
```

Use valid configuration formats for each runtime. Make models.json the central routing configuration and validate that runtime definitions agree with it.

Prefer small helpers and existing dependencies over introducing a framework.

## Workflow

Feature → specification → permission check → implementation → five independent reviews → approver → human approval → merge.

Before spawning workers, the orchestrator writes factory/repo-context.md with:

- Language and framework.
- Source layout.
- Exact discovered test, lint, and build commands.
- Coding conventions and applicable instructions.
- Available runtimes and model access.

If no application or test suite exists, state that explicitly.

The spec writer defines scope, acceptance criteria, validation commands, and additional permission requirements.

The feature request authorizes routine implementation. Ask before implementation when necessary for destructive actions, production access, spending beyond authorized model usage, deployment, publication, or unclear scope.

The builder implements the specification and runs meaningful acceptance tests in an isolated feature worktree using branch factory/<job-id>. It commits explicit changed paths to that branch.

Preserve unrelated changes. Never automatically discard, stash, or commit them.

## Ownership and continuity

Only the orchestrator spawns workers, writes board.json, and publishes normalized usage aggregates.

Workers receive authoritative context through file paths and write only their own reports. The builder may additionally edit application source and tests in its feature worktree.

Keep one active factory orchestrator and one active build at a time. Review workers may run independently in parallel.

Name the builder builder-<job-id>. Record its provider session ID, name, model, and worktree in durable state.

Resume that SAME Claude builder session for revisions, supplying the round-folder or feedback-file path.

Implement builder messaging through the provider adapter:
- Use native SendMessage only where the runtime supports that connection.
- Otherwise use Claude Code's supported session-resume mechanism with the recorded session ID.
- Document this adaptation.
- Do not silently replace the builder or fork its session.

If the session cannot be resumed, pause and require an explicit recovery decision.

## Reviews and approval

Run five independent reviews:

1. Security: GPT-6 Astra checks concrete security risks.
2. UX: Claude Sonnet 5.5 checks usability and user flows.
3. UI: Claude Sonnet 5.5 checks visual design and accessibility.
4. Code: GPT-6.1 Sol checks correctness and maintainability.
5. QA: GPT-6.1 Sol independently runs applicable tests and verifies acceptance criteria.

Every reviewer receives the same immutable commit and specification.

Each report starts with exactly VERDICT: PASS or VERDICT: CHANGES, identifies the reviewed commit, and provides evidence.

WAIT FOR ALL FIVE report files and valid verdicts before resuming the builder. Missing or malformed reports never count as PASS.

If any reviewer requests CHANGES, resume the same builder. After its revision, run a fresh complete review round.

Allow at most two review rounds per attempt. If changes remain, set the job to needs-human and request feedback. Explicit human rework starts another attempt while preserving previous rounds.

When all five reviews PASS, Claude Opus 5.5 acts as approver. Its decision.md starts with APPROVE or ESCALATE.

Both decisions lead to human review. An agent's APPROVE is a recommendation, not authorization to merge.

Human approval must identify the exact reviewed commit. Changed feature code or a changed main branch requires fresh validation and reviews.

Merge only after required checks and human approval. Report conflicts or failed post-merge checks accurately. Do not push or deploy without authorization.

## Commands

Implement these operations:

- factory <feature>: start a feature.
- factory next: run the first unchecked backlog item.
- factory approve <job-id>: approve and merge an eligible reviewed job.
- factory rework <job-id> <note>: resume its builder with feedback.

Expose them through Claude Code /factory and the supported Codex skill invocation mechanism. Document exact invocation syntax for installed versions.

## Token and cost accounting

Track every observable invocation, including orchestrator work, builder revisions, reviews, approvals, retries, failed runs, and rework.

Use real supported runtime telemetry, structured response metadata, or session logs. Never ask agents to guess token counts or infer exact usage from text length.

Each normalized record includes:

- Stable request/event ID for deduplication.
- Provider, runtime, session, agent role, and invocation ID.
- Job, stage, attempt, round, and timestamp.
- Requested and actual reported model.
- Input, output, cached-input, cache-write, and reasoning tokens where exposed.
- Total tokens without double-counting overlapping categories.
- USD cost, calculation source, and pricing version.
- Complete, partial, or unavailable usage status.
- Estimated cost or authoritative reported-charge status.

Handle provider-specific accounting. Cached input may already be included in input totals; reasoning may already be included in output. Preserve relevant cache-write tiers.

Keep verified rates in pricing.json with official source URLs, effective dates, provider, model, units, currency, and billing categories.

Calculate estimated costs using non-overlapping token categories and applicable rates. Include exposed service-tier adjustments and additional charges where relevant.

If verified pricing or billing data is missing, show unavailable or partial cost. Never borrow another model's rates or treat missing data as $0.

For subscriptions, distinguish estimated API-equivalent cost from actual additional charges. Record billing mode when known.

Only the orchestrator writes the normalized usage ledger and board aggregates. Collectors return evidence without independently changing board.json.

Prevent duplicate accounting across parent/child totals, streamed events, cumulative counters, resets, polling, restarts, and resumed sessions.

Preserve historical rates and costs. Changing current pricing must not silently reprice previous jobs.

Keep unattributed session usage separate. Factory totals represent recorded factory usage, not the entire account.

After every worker invocation:
- Print its role, actual model, tokens, cost, and completeness status.
- Update job and dashboard aggregates.
- Preserve separate records for each builder revision.

At feature completion, write jobs/<job-id>/usage.md with totals by agent, model, and review round, plus the feature total. Reconcile delayed telemetry and identify reporting lag.

## Dashboard

Create one self-contained HTML file served with Python's standard HTTP server. Poll board.json and display:

- Job cards across workflow stages.
- All nine roles and their configured models.
- Assigned and actual models when they differ.
- Five reviewer chips for every review round.
- Permission, blocked, and human-approval states.
- Token and USD totals on each job.
- Factory-wide totals and breakdowns by actual model.
- Per-agent and per-invocation details.
- Input, output, cache categories, total tokens, and costs.
- Clearly labeled estimated, reported, partial, and unavailable values.

Use sufficient precision for small nonzero costs. Unknown amounts remain unavailable; incomplete totals are labeled as known subtotals.

Clicking a job opens its markdown reports and usage summary. Support keyboard navigation, responsive layout, empty states, missing files, and fetch errors. Render content safely.

Keep credentials and raw private transcripts out of dashboard data and committed files.

## Public documentation

Write a beginner-friendly root README containing:

- A table of all nine roles and exact model assignments.
- GitHub-compatible Mermaid diagrams for workflow, review/rework, provider routing, and usage accounting.
- Windows setup instructions.
- Required runtime authentication and model access.
- Exact dashboard and first-feature commands.
- Permission and human-approval behavior.
- Accounting limitations and pricing-update instructions.

Keep the generation prompt separate in prompts/software-factory.md. Make it reusable without a fixed username, local drive, or GitHub repository.

Publishable starter data must contain an empty board and usage ledger. Exclude personal job history and secrets.

## Validation and delivery

Validate:

- Model routing and reported-model checks.
- Runtime configurations and resumable Claude builder integration.
- All five reviews being required before rework.
- Two-round limits and human merge gates.
- JSON, dashboard behavior, and applicable repository checks.
- Usage deduplication, counter resets, overlapping token categories, missing rates, resumed runs, historical pricing, and total reconciliation.

Use clearly labeled synthetic accounting fixtures, never fake spending records.

Separate offline validation from live model checks. Record actual usage incurred during authorized live checks. Do not claim end-to-end success if required models or authentication are unavailable.

Finish with the created files, actual validation results, unresolved requirements, and exact startup and first-feature commands. Ask before pushing or merging.
