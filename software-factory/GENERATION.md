Build and validate a small, visual software factory in this repository. Create the actual files and working integrations, not just a plan.

First inspect the current working directory, Git root, nested folders, repository instructions, languages, manifests, test commands, and conventions. Work in the user's current project, discover its existing Git remote, and preserve existing work. Keep the setup understandable in a few minutes.

## Setup contract

This prompt is self-contained. Generate all referenced helpers, tests and setup instructions inside the selected project; do not depend on this prompt repository, its shared checker, a previous chat or a personal machine path. Creating the files is setup work. A real feature still follows the review and human merge gates below.

Preserve the application's existing README and configuration. Add a short factory section or link rather than replacing application documentation. Merge compatible configuration and ignore entries; do not overwrite existing agent instructions or account settings. Keep exact model assignments unless the human explicitly changes the design.

Finish setup with one short checklist showing Generated, Offline validated, Local prerequisites, Live models, Builder resume, and Full feature validation separately. Each item is PASS, BLOCKED or UNCHECKED, with evidence and the next action. Do not repeatedly ask for consent already supplied for routine implementation. Extra provider usage beyond the authorized task and required host permissions remain separate decisions.

Before any provider calls, inspect effective native execution and permission capabilities. Run one harmless native command in the selected workspace. Classify failure before process creation separately from provider/network failure. Do not spend model usage probing Claude while the required command runner cannot start.

## Required agents and models

Use exactly ten roles: one orchestrator and nine specialist agents.

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
| Documentation writer | Claude Sonnet 5.5 | claude-sonnet-5-5 | Claude Code |
| Approver | Claude Opus 5.5 | claude-opus-5-5 | Claude Code |

Verify model identifiers, installed runtime versions, account access, and configuration syntax against current official documentation.

Pin the explicit model identifiers. Do not silently substitute models or use rolling aliases such as “opus” or “sonnet.”

Record the requested and actual reported model for every invocation. Resolve model mismatches before accepting results.

## Runtime integration

The GPT-6.1 Sol Codex session is the orchestrator.

Use native Codex agents for security, code review, and QA. Implement a small provider adapter to launch and resume Claude Code sessions for specification, building, application documentation, UX, UI, and approval.

Use supported CLI or SDK interfaces, structured output where available, explicit model selection, and persistent session identifiers. Verify installed capabilities before implementing integrations.

Do not assume native Codex agent tools can directly spawn Claude models.

The Claude Code /factory skill is a launcher that forwards operations to the GPT-6.1 Sol orchestrator. It does not become the orchestrator itself.

Verify the actual orchestrator model before starting a job.

Preserve permission settings. If a non-interactive worker needs additional permission, return that requirement to the orchestrator and wait for human authorization. Do not bypass approval controls.

If a required runtime, model, authentication method, or session-resume capability is unavailable, identify the requirement and leave affected execution visibly blocked. Continue independent setup work without fabricating success.

## Windows runtime and permission preflight

Record resolved Node, Git, Codex and Claude executable paths and versions. Select native application executables rather than relying on a PowerShell script shim. Quote paths with spaces, pass process arguments as arrays, and avoid shell evaluation, command chaining and interpolation of feature text. Explain whether each command belongs in normal PowerShell, Codex chat or Claude chat.

Use installed help and current official documentation to verify commands before recommending repairs. Treat missing CLI/platform packages, PowerShell script execution restrictions, Windows sandbox provisioning, authentication, tool permissions and provider reachability as different failures. A project config change does not prove the running host adopted it. Never change execution policy, weaken sandboxing, add blanket tool permissions or edit global account settings as an automatic repair.

For native startup errors such as helper_unknown_error: setup refresh had errors, stop dependent launches, preserve a sanitized diagnostic, and explain the supported host repair/resume path. Inspect the actual Windows sandbox implementation and managed requirements. Current Windows guidance distinguishes MXC and legacy sandbox implementations; never assume every machine needs elevated provisioning or that an old setup command exists. Verify a harmless native command after repair. Restarting or resuming alone is not proof of recovery.

Check python and py before offering a Python dashboard command. Show one working detected command; if neither exists, list Python as a dashboard prerequisite while continuing independent factory generation and offline validation. A missing dashboard server must not be misreported as failed model access.

Keep three authorization layers clear: the human's task scope, the host's filesystem/network execution permissions, and Claude's tool decisions. A factory authorize message records task consent; it does not grant operating-system or provider-tool access. Use approval-aware native execution for required access. If it is denied, do not route the operation through a different launcher to evade that denial.

## Startup checks and connection recovery

Generate a small `factory check` operation with two modes: local installation/authentication checks by default, and explicit `--live` model checks that can consume usage. Document the exact command for the generated runner. Readiness must be checked before dispatching a feature.

- Inspect the Git root and committed base, runtime executable paths and versions, authentication state, supported CLI flags, and available session-resume capability. Do not treat installation or login as proof of model access.
- Run authorized live checks through the SAME provider adapter, working directory, and permission/network environment used by real workers. An interactive Claude reply in external PowerShell does not prove a Codex child process can connect.
- Check one role/model at a time, deduplicating identical runtime/model/environment checks. First prove Opus access, then Sonnet; prove initial builder access before testing resume of that SAME recorded session. Do not launch all Claude roles or resume a session whose initial result is uncertain.
- Use bounded timeouts and a small documented retry budget. On failure stop dependent work, persist the observed failure, and provide a concrete recovery instruction. Do not repeatedly relaunch workers, change models, reauthenticate, or reinstall without evidence.
- Collect exit status, terminal success/error, sanitized stderr category or HTTP status, requested/reported model, session match, retries, and timestamp. Record DNS/TLS/authentication/rate-limit/model/permission errors when supported by evidence; otherwise report unknown. An init/configured model alone is not a successful model response.
- If external PowerShell succeeds but the factory fails, compare executable, working directory, credentials mode, inherited proxy/CA settings, and the host's child-process network permissions. Ask for the specific required access using supported permission controls. Never disable the sandbox or bypass approvals.
- Collectors return evidence and usage; only the existing orchestrator writes the readiness state, ledger, and board. Standalone tests must explicitly say they do not update the dashboard, and explain how the orchestrator publishes a fresh check.
- Store current per-runtime/model readiness separately from historical invocations. Dashboard: show Ready, Blocked, or Unchecked, last check time, execution environment, and sanitized reason. Preserve failed-run history and unknown usage; a successful recheck does not rewrite previous failures or imply zero cost.
- A `doctor` must not dispatch all live workers. Separate offline PASS, local installation/authentication readiness, live provider access, and full feature validation. Never label the entire factory ready from a successful synthetic fixture.

Include offline tests for timeout, model mismatch, missing terminal response, permission denial, secret-safe diagnostics, external success with factory failure, and successful recheck with preserved failure history. No test may require credentials or incur model usage by default.

## Project binding and application baseline

Discover the actual application Git root, including nested applications. If selection is ambiguous, show the candidates and ask which application to use while continuing independent inspection. Do not mistake a prompt checkout or its parent directory for the application. Do not invent a remote, require a remote for local work, or assume the integration branch is named main; record the existing target branch and base.

Generate factory/project.json when the factory workspace and application roots differ. Store a validated relative path inside the workspace; reject absolute paths, traversal and symlink escapes. Factory owner, board, jobs and accounting stay at the factory workspace root while source, acceptance commands and feature worktrees refer to the selected application.

Before launching a spec writer, detect a missing committed base, staged changes and pre-existing application changes. Present exact paths needing review. Do not discard, stash or automatically commit them. A human-approved baseline must use an explicit reviewed file list, exclude secrets, preserve unrelated staging, and be verified clean before a feature build. Do not require a repeated baseline approval if valid consent for the exact files already exists.

Bind every job to its selected repository, base and target branch. Rebinding is allowed only before a base, builder or review history is recorded. Later configuration changes must never silently retarget a running job or rewrite its baseline to pass a gate.

## Skill discovery and worktree-independent role loading

Generate the project Codex skill at .agents/skills/factory/SKILL.md and the Claude launcher at .claude/skills/factory/SKILL.md. Document $factory for Codex and /factory for Claude separately. Verify discovery using the installed runtime; a missing autocomplete entry alone does not prove the files were loaded or rejected. If a refresh or fresh session is required, resume the registered owner when one exists instead of creating another orchestrator. Plain feature chat must not be advertised as automatically invoking the skill unless explicitly implemented and verified.

The external launcher starts the pinned Codex orchestrator or resumes its recorded owner. Use the installed version's supported start/resume interface. Native Codex reviewer spawning must use the actual supported agent API with explicit role/model selection and runtime evidence; a standalone Codex subprocess is not a substitute for a native reviewer.

Claude roles must load from application feature worktrees too. Do not assume ancestor .claude discovery crosses a Git root. Validate central role definitions, then supply explicit supported CLI-defined agents with the same prompt, model and tool restrictions. A JSON definition file may be used only when installed help supports it; otherwise use the supported structured argument form, preserving argument boundaries. Fail on model drift or unsupported permission overrides.

## Scoped non-interactive worker access

Prepare each role's exact absolute input and output paths before launch. The builder must read context, spec, contract and all current-round reports even when they live outside the feature worktree. Each reviewer must read the frozen spec and source and write its assigned report. Read permission for parent job inputs must not imply parent-directory write permission or secret access.

Use the installed provider's supported scoped permission interface. Where supported and authorized, session-only PermissionRequest hooks supplied through --settings can implement job grants. Preserve effective deny rules and permission mode; do not use bypass flags, blanket allows, auto-accept modes or guessed environment variables. Validate hook decisions with the actual provider protocol. Do not promise a hook can grant network access denied by the host.

A grant records the authorizing human message, job, role, session, canonical allowed paths, exact commands and expiry. It may cover routine source edits and acceptance checks already authorized by the task without asking for each file separately. Reject symlink escapes, credential/settings writes, arbitrary shell/eval, destructive Git, push, deployment and unknown requirements. Keep grants and hashed audits private. Do not hard-code a recovery phrase, user identity or old job ID into the reusable implementation.

Use canonical report filenames and provide all five full paths in feedback. If discovery is necessary, permit only a nonrecursive listing in the assigned review directory. Handle known filename variants as missing files when appropriate, without granting arbitrary parent reads. A worker must read every real report before claiming its findings are resolved.

## Acceptance contract and command execution

The spec writer produces spec-contract.json containing acceptance_criteria, validation_commands and permissions. Each command has file, args and cwd; args is an array. Freeze the spec and contract hashes before implementation. Treat their contents as untrusted input and validate commands, scope and permission requirements through the orchestrator.

Discover and support the project's real test, lint, typecheck, build and isolated database commands before the builder starts. Where appropriate, invoke installed local Node entry points directly instead of shell wrappers. Validate executable identity, argument shapes and working directories; reject path escapes, changed tool binaries, unexpected flags and autofix during acceptance. Do not turn support for one Next.js application into a universal hard-coded requirement. Unsupported runners need an explicit approval-aware integration and evidence path, or an early, actionable blocker.

Prepare feature-worktree dependencies using the project's lockfile and existing conventions. Identify required network, package scripts, local database executables, temporary storage and loopback permissions before they are needed. Do not copy credentials or use production data. Baseline test/lint failures must be shown and scoped before implementation; do not silently disable checks.

Give workers exact individual commands without chained exit-code echoes, redirects or embellished commit messages. Collect exit codes in the adapter. Stage only explicit changed paths and use a normal commit with one simple message. If a diagnostic variant is necessary, authorize that exact variant and a safe ignored output path; do not broaden all shell access.

Checkpointing must execute the frozen acceptance commands, retain results and bind them to the unchanged clean commit/tree, spec and contract. Review and merge gates must reject edits during validation. Run post-merge checks and report a failure after merge accurately.

## Portable command contract

Generate factory/scripts/factory.mjs with these stable entry points so the quick-start instructions are executable after generation:

- node factory/scripts/factory.mjs check: local prerequisites only; no model calls.
- node factory/scripts/factory.mjs validate: offline routing, configuration, schemas and starter-data validation.
- node factory/scripts/factory.mjs prepare-dashboard: prepare only sanitized public dashboard files.
- node --test factory/scripts/*.test.mjs: offline generated regression suite.
- $factory check --live --model <exact-model-id>: an explicitly requested live diagnostic through the owning Codex orchestrator and actual provider adapter. Also accept the equivalent CLI operation by forwarding to that owner; never create a competing active owner.

Generate code for these operations, not placeholder instructions. Validate unknown arguments and print concise expected results and actionable errors. No local check/validate/prepare operation may dispatch live workers. Keep the internal controller restricted to the verified owner; external launchers forward workflow operations instead of writing boards or evidence directly. A live builder diagnostic must preserve its own session without creating/replacing a feature builder.

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
    documentation-writer.md
    ux-reviewer.md
    ui-reviewer.md
    approver.md

factory/
  project.json                # optional validated relative application selection
  models.json
  pricing.json
  board.json
  usage.jsonl
  dashboard.html
  # prepare-dashboard publishes the same app as .local/public/index.html
  backlog.md
  repo-context.md
  README.md
  SETUP.md
  TROUBLESHOOTING.md
  VALIDATION.md
  scripts/
  .local/                    # ignored owner, checks, receipts, ledger and public projection
  .worktrees/                # ignored isolated feature checkouts
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

prompts/
  software-factory.md

README.md
.gitignore
```

Use valid configuration formats for each runtime. Make models.json the central routing configuration and validate that runtime definitions agree with it.

Prefer small helpers and existing dependencies over introducing a framework.

## Workflow

Feature → specification → permission check → implementation → application documentation → checkpoint → five independent reviews → approver → human approval → merge.

Before spawning workers, the orchestrator writes factory/repo-context.md with:

- Language and framework.
- Source layout.
- Exact discovered test, lint, and build commands.
- Coding conventions and applicable instructions.
- Available runtimes and model access.

If no application or test suite exists, state that explicitly.

The spec writer defines scope, acceptance criteria, validation commands, additional permission requirements, and the application documentation scope and allowed output paths. Documentation requirements are part of the frozen acceptance contract, including a justified no-impact case when appropriate.

The feature request authorizes routine implementation. Ask before implementation when necessary for destructive actions, production access, spending beyond authorized model usage, deployment, publication, or unclear scope.

The builder implements the specification and runs meaningful acceptance tests in an isolated feature worktree using branch factory/<job-id>. It commits explicit changed paths to that branch.

Preserve unrelated changes. Never automatically discard, stash, or commit them.

## Application documentation after implementation

Add exactly one new specialist: documentation-writer, using claude-sonnet-5-5 through the existing Claude adapter. The factory now has ten roles: one orchestrator and nine specialists. This role authors application documentation; it is separate from the spec writer and the five independent reviewers.

Run the documentation writer after the builder finishes and commits the implementation, before the review checkpoint. Do not run source and documentation writers concurrently in the same worktree. Give the writer the implemented commit, baseline diff, frozen spec/contract, build evidence, existing docs and only the required source/config/test files. Never expose live credentials or private session logs as documentation input.

The documentation writer updates the actual application's existing README and documentation tree, rather than merely producing a factory report. Preserve the project's existing docs framework, language, navigation, terminology and useful content. Discover the intended audiences and documentation root; default to Markdown in docs/ only when no convention exists. Do not install a new documentation framework or publish a docs site without authorization.

Cover the following where relevant to the implemented app, proportionate to its size:

- A concise product overview, capabilities and limitations, with a navigable documentation index.
- A reproducible getting-started tutorial with prerequisites, safe example configuration, exact commands and expected results.
- Task guides for actual user/admin flows, with meaningful error and recovery guidance.
- Architecture and data-flow explanation, key components, integrations and justified design decisions. Diagrams must reflect the implemented system and have accompanying text.
- Configuration/environment reference describing purpose, type, defaults, required values and safe placeholders, without secrets or invented settings.
- Developer instructions for local testing, contributions and supported maintenance workflows; operational or deployment guidance only for mechanisms actually present.
- API reference when an API exists, covering actual routes, authentication, requests/responses, validation, errors and pagination/rate limits where implemented. Preserve an existing authoritative schema and generator; do not invent endpoints or migrate schema versions solely to claim the newest standard.
- Troubleshooting and known limitations. Update existing unreleased change notes when the project uses them, without inventing a release version or date.

On the first feature using this role, assess documentation of the whole existing application and fill the agreed baseline gaps; on later features, update affected guides and references instead of regenerating everything. Record documented, unchanged, not-applicable and unverified areas with reasons. A required documentation gap cannot be waived by a writer's no-impact claim.

### Current guidance and accuracy

Use the project's documented style first. When it is silent, organize content using Diataxis (tutorials, task guides, reference and explanation) and apply Google's developer documentation style guidance for clear, consistent language. These are frameworks and guidance, not a universal compliance certification. Use descriptive headings and links, accessible text alternatives, fenced runnable examples and a coherent navigation structure.

For HTTP API schemas, use a published OpenAPI version compatible with the application's existing tools. Check the current official specification and record the version actually used; do not use an unreleased draft or silently upgrade a functioning schema. Apply other domain standards only when relevant and supported by implementation evidence.

Recheck official guidance when making a standards/version claim and record each source URL, observed version or revision where available, observation date and its application in documentation.md. If browsing is unavailable, retain a supported known convention, mark currency unverified and avoid claiming latest-version compliance. References:

- Diataxis: https://diataxis.fr/start-here/
- Developer writing style: https://developers.google.com/style
- Accessible documentation: https://developers.google.com/style/accessibility
- OpenAPI specification: https://spec.openapis.org/oas/latest.html

Derive facts from the actual code, configuration, tests and observed runtime evidence. Distinguish implemented behavior, optional integrations, examples and planned features. Never invent commands, test results, deployment readiness, screenshots or compliance claims. Use safe fictional examples and redact credentials, internal account data and production connection strings.

### Ownership, evidence and completion gate

Generate .claude/agents/documentation-writer.md with this exact role name/model, clear authoring instructions, scoped tools and no permission bypass. Add it to models.json, explicit worktree-independent agent loading, routing validation, worker permissions, dashboard state and token/cost accounting. No additional unique model-access probe is needed solely because another role uses Sonnet; actual writer execution and its scoped writes must still be verified.

Assign the precise application README/docs/API-reference paths in the contract and grant only those documentation writes, normal explicit-path documentation commits and the private job report. Generated artifacts used by application execution, source files, dependencies, settings and production schemas are outside this role's write scope unless explicitly included and separately reviewed. Preserve unrelated edits. Keep the original builder session available for source rework.

The writer works on the same feature branch after the builder, commits only its approved documentation changes, then writes the private job documentation.md report. The report starts with DOCUMENTATION: COMPLETE or DOCUMENTATION: CHANGES, followed by Commit: <full-final-SHA>. Include the implementation input commit, final combined commit, changed paths, audience/scope coverage, standards sources and dates, executed checks, limitations and unresolved discrepancies. If no documentation change is needed, cite concrete current coverage and the unchanged feature commit; do not create an empty commit. The orchestrator verifies real execution, actual model, allowed diffs and report provenance rather than trusting self-asserted success.

Keep report history for each attempt/round, including the pre-review documentation run. Bind completion to the final combined commit, documentation content hashes, frozen spec/contract and required check evidence. Verify the writer did not alter implementation files and that its commit descends from the builder's recorded commit. Run applicable acceptance and documentation checks against that final commit before spawning reviewers. All five reviewers receive that same immutable code-and-documentation commit plus the documentation report. The report stays outside the worktree so recording its final SHA does not require a circular commit.

Code review checks factual consistency with source; QA checks navigation, links/anchors, examples and applicable schema/docs validation; security checks secret disclosure and unsafe instructions; UX/UI check reader journeys and readability/accessibility where applicable. The author does not supply an independent sixth review. Documentation gaps or broken required checks produce CHANGES and block the normal approver/merge gates.

After source rework, run the documentation writer again for affected content before the new checkpoint. Documentation-only fixes also produce a new final commit and require fresh validation and all five reviews. Neither writer may mutate the frozen tree after checkpoint, even for a typo. Failures/timeouts use the same bounded invocation and recovery rules, and each documentation invocation has its own usage record. Never add documentation after approval without invalidating the reviewed commit.

### Documentation checks

Reuse existing local documentation checks when available. Check required pages and navigation, relative links with exact case and anchors, fenced example syntax and safe secret placeholders, using installed tools or small standard-library helpers. Validate API reference against source and any existing schema; schema syntax alone does not prove route accuracy. Run documented examples only in authorized isolated environments, never production. Required unexecutable examples and unsupported tooling must be explicitly unresolved; do not claim a passing end-to-end tutorial.

Include meaningful offline regression tests in the generated factory for documentation-before-checkpoint ordering, ten-role routing, scope/permission enforcement, implementation-file mutation rejection, missing/stale/mismatched documentation reports, source-change invalidation, documentation-only rework, no-impact coverage evidence and separate documentation usage. These tests use isolated fixtures and make no live model calls.

## Ownership and continuity

Only the orchestrator spawns workers, writes board.json, and publishes normalized usage aggregates.

Workers receive authoritative context through file paths and write only their own reports. The builder may additionally edit application source and tests in its feature worktree. The documentation writer may edit and commit only the assigned application documentation paths in that same isolated worktree, while the builder is idle.

Keep one active factory orchestrator and one active build at a time. Review workers may run independently in parallel.

Name the builder builder-<job-id>. Record its provider session ID, name, model, and worktree in durable state.

Resume that SAME Claude builder session for revisions, supplying the round-folder or feedback-file path.

Implement builder messaging through the provider adapter:
- Use native SendMessage only where the runtime supports that connection.
- Otherwise use Claude Code's supported session-resume mechanism with the recorded session ID.
- Document this adaptation.
- Do not silently replace the builder or fork its session.

If the session cannot be resumed, pause and require an explicit recovery decision.

## Interrupted runs and durable recovery

Record ownership, the provider session UUID, invocation identity and launch state before dispatch. Keep one active owner and one build. Distinguish a launch rejected before process creation, a completed failure, a still-running process, a timeout and an uncertain result. A timeout does not prove the child stopped or that usage was zero.

On interruption, preserve the lock and original evidence. Inspect supported process/session evidence before resuming. Request a concrete recovery decision only when continuation is uncertain or a required new permission is missing; apply existing explicit authorization when sufficient. Never delete a lock, switch owners, start another builder or fork a session as an automatic repair. Resume the same builder only after confirming the earlier invocation is no longer active. Give each resumed turn its own invocation record and retain unavailable terminal usage for the interrupted run.

A recovery operation must validate the actual current human instruction, owner, job, session and permitted action. It must be reusable for any job; generic assent, quoted commands or an old recovery receipt must not grant new permissions. Recovery never substitutes for exact-commit merge approval.

## Native review rounds and telemetry binding

Every round receives new invocation IDs, frozen commit/spec/contract hashes, exact report paths and a checkpoint timestamp. Bind native review evidence to the real parent and child sessions, role, model, task and that round. An agent's own statement of its model or tokens is not proof.

Use a new native task for each round when the runtime permits it. If the runtime reserves completed role task names, use a fresh followup_task turn on the verified existing role session instead of repeatedly trying the same rejected spawn. Require the original verified role/model spawn plus a current-round dispatch and completed child turn after the checkpoint. Never reuse the previous verdict or cumulative token total as the new round's result. Workers must not spawn other workers.

Some runtimes store task text as opaque payloads. Do not decrypt it, invent missing provenance or accept a worker-authored identity claim. Where trustworthy runtime data permits it, bind the exact parent dispatch payload hash to the child message alongside session/role/turn checks. Otherwise mark the evidence unavailable and block acceptance.

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

If any reviewer requests CHANGES, wait for all five reports, then route source findings to the same builder and documentation findings to the documentation writer. After any source revision, refresh affected documentation. Commit the final combined result, checkpoint it, and run a fresh complete five-review round, including for documentation-only corrections.

Allow at most two review rounds per attempt. If changes remain, set the job to needs-human and request feedback. Explicit human rework starts another attempt while preserving previous rounds.

When all five reviews PASS and current documentation evidence is complete, Claude Opus 5.5 acts as approver. Its decision.md starts with APPROVE or ESCALATE.

Both decisions lead to human review. An agent's APPROVE is a recommendation, not authorization to merge.

Human approval must identify the exact reviewed commit. Changed feature code or a changed target branch requires fresh validation and reviews.

Merge only after required checks and human approval. Report conflicts or failed post-merge checks accurately. Do not push or deploy without authorization.

## Human approval parsing

Implement factory approve <job-id> as opening the evidence for review only. Merging requires the actual human command factory approve <job-id> --commit <full-reviewed-SHA>. Accept the installed skill prefix, ordinary spaces and tabs, but require the exact job, full commit and affirmative command. Reject extra prose, negation, quoted/code-block commands and multiple commands.

Read the original current human text from authoritative runtime message provenance, not arbitrary user-role attachments, generated skill bodies or the latest user-shaped record. Bind consent to the owning session and current turn. Attached skill instructions must not replace or invalidate the genuine command; a later actual refusal must invalidate it. Missing provenance or a stale authorization must fail closed.

Before a fast-forward merge, revalidate target and feature commits, clean trees, frozen spec/contract, command evidence, all five same-round reports, current complete documentation evidence, completed approver, infrastructure evidence where applicable, and required permissions. Detect changes in the factory's own validation/approval code as well as application source; require review of changed infrastructure instead of trusting a changed gate to approve itself.

## Commands

Implement these operations:

- factory <feature>: start a feature.
- factory next: run the first unchecked backlog item.
- factory approve <job-id>: open the evidence for human review; do not merge.
- factory approve <job-id> --commit <full-reviewed-SHA>: authorize merging only that eligible reviewed commit.
- factory rework <job-id> <note>: resume its builder with feedback.

Expose them through Claude Code /factory and the supported Codex skill invocation mechanism. Document exact invocation syntax for installed versions.

## Token and cost accounting

Track every observable invocation, including orchestrator work, builder revisions, documentation writing and refreshes, reviews, approvals, retries, failed runs, and rework.

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

Create one self-contained HTML application served with Python's standard HTTP server. Its canonical entry point is http://127.0.0.1:<port>/. Generate public/index.html from the same HTML as dashboard.html, so both the root link and the legacy /dashboard.html link open the full application. All normal factory views are available through navigation within that one app; users must not discover JSON filenames, open local files or start separate servers for jobs and reports.

### Navigation from one home link

Provide persistent navigation for Overview, Jobs, Activity, Documentation, Usage and Readiness. Use hash routes such as #/dashboard, #/jobs, #/jobs/<job-id>, #/activity and #/documentation so refresh and deep links work with a static server. Job detail routes include specification, build evidence, documentation report, every review round, approver decision, human approval and usage summary. Preserve attempt/round selection and provide a clear back-to-jobs control, breadcrumbs and browser Back/Forward support.

Display reports and approved application documentation inside the same application with useful titles and loading/missing/error states. Resolve document IDs only through an explicit sanitized publication manifest; never construct filesystem paths from route text. Permit only approved report/document kinds, job IDs, attempts and rounds. Do not serve raw runtime logs, authorization grants, execution receipts or credentials. A missing report must be labelled unavailable rather than an empty success. External app previews may be separately labelled links; the factory views remain within the dashboard.

Internal navigation uses semantic links with accessible names and active-page state. Manage focus after route changes, preserve keyboard access, and make navigation usable on narrow screens. Render content safely using text or a vetted sanitizer; disallow executable markup and unsafe link schemes. Unknown or malformed hash routes show a recovery view with a link home, not a blank page or guessed path.

### Latest transactions at the top

Put a prominent Latest activity section at the top of Overview, before the job board, and provide the full paginated Activity view. In this factory, transactions are actual worker/owner invocation and usage records plus separately labelled workflow events, not the application's business orders or billing charges. Never fabricate activity just to populate the table.

Order records newest first by recorded timestamp with a stable unique-ID tie-breaker. Display event time and timezone, job link or Setup label, role/action, actual model where verified, status, token usage and USD cost/completeness where applicable. Show running, failed, blocked and completed records accurately. Unknown usage stays unavailable; estimated API-equivalent costs must not look like real charges. Workflow-only events have not-applicable usage and are excluded from usage totals. Expand a record inside the app for its sanitized invocation details and report links.

Use stable event/invocation IDs. A later terminal update revises the same invocation row and retains the original invocation ordering timestamp; show an updated-at time separately. Retain retries as invocation details or explicitly identified retry events without counting the same usage twice. Preserve historical failures. Job/role/model/status and time-range filters must work before pagination, and the displayed count must match those filters. A dedicated transaction search must not expose private evidence.

### Pagination, page-size limits and refresh

Paginate Latest activity, Activity and Jobs instead of rendering an unbounded history. Default to 10 rows/cards per page; offer 10, 25, 50 and 100. Validate persisted/query values against that allowlist, cap the limit at 100, reset malformed values safely and never offer an unlimited All option. Show Previous/Next, current page and total pages, filtered record count, and a range such as 1–10 of 42. Disable unavailable controls, label them accessibly and make empty or single-page results clear.

Sort and filter the full selected dataset before paginating. Reset to page one when filters or page size change. Clamp out-of-range pages after data changes. Give Overview activity, full Activity and Jobs independent route/query state so navigating a job and returning preserves the correct view, filters and position. Invalid page parameters must not cause negative indexes or blank results.

Poll current safe publication metadata, showing last updated time and stale/error status. On page one, update the newest records without moving focus or interrupting an expanded row; offer an explicit refresh when an interaction would be disrupted. On later pages, keep the selected publication snapshot stable and show a New activity available action instead of silently shifting rows. Applying that action moves to the latest snapshot with deliberate pagination behavior. Avoid duplicate or missing rows as new events arrive.

A display limit must also bound retrieval and DOM work. Do not fetch an ever-growing full invocation ledger or every job/report on each poll and merely slice it in the browser. The orchestrator publishes sanitized versioned page/chunk indexes for jobs and activity, with bounded summaries and counts, while the HTML loads only required chunks and the selected report. Use static files compatible with the existing Python server; do not introduce a framework, credentials-bearing API or extra service solely for pagination. Freeze a publication generation while fetching its manifest/pages, publish its root manifest last, and never mix indexes or counts from different generations. Reuse cached chunks for the same generation; global totals remain authoritative aggregates across the complete recorded history, not the current page.

### Overview and details

In addition to newest activity and navigation, display:

- Job cards across workflow stages, with paginated Jobs and total stage counts.
- All ten roles and their configured models.
- Documentation stage, writer execution status, exact commit and documentation report link.
- Assigned and actual models when they differ.
- Five reviewer chips for every review round.
- Permission, blocked, and human-approval states.
- Token and USD totals on each job.
- Factory-wide totals and breakdowns by actual model.
- Per-agent and per-invocation details.
- Input, output, cache categories, total tokens, and costs.
- Clearly labeled estimated, reported, partial, and unavailable values.

Use sufficient precision for small nonzero costs. Unknown amounts remain unavailable; incomplete totals are labeled as known subtotals. Only the orchestrator publishes state, sanitized pages and reports. The dashboard remains read-only: browsing an approval report or clicking a job is not permission to merge. Approvals continue through the verified factory commands.

### Generated dashboard regression coverage

Use isolated offline fixtures to test newest-first ordering and equal-time ties, no fabricated events, invocation updates without duplicates, retry/usage accounting, page-size allowlisting/cap, full-dataset filtering, exact counts/ranges, page bounds, empty/single-page states, independent view state and stable refresh on later pages. Include enough records to exercise at least three pages and make sure global totals do not collapse to page totals.

Test root and legacy entry-point publication, hash-route parsing, direct deep-link refresh, Back/Forward and return-to-jobs state, all permitted report/document kinds, unknown IDs/routes, missing files, unsafe links/markup, publication-generation consistency, bounded chunk loading and stale/failing polling. Verify controls and focus in a real browser when available; label synthetic DOM checks accurately. These tests make no live model calls and must not publish personal history.

## Private state, dashboard startup and evidence limits

Keep publishable factory/board.json and factory/usage.jsonl empty. Real owner/check/invocation/ledger data belongs under ignored factory/.local, and personal job history and feature worktrees must be ignored too. Only the orchestrator normalizes records and publishes sanitized state. Put index.html, the matching legacy dashboard.html, safe board/manifest, versioned page chunks and approved report/document copies in factory/.local/public; never serve the workspace, private receipts or raw runtime transcripts.

Generate a prepare-dashboard operation and document its exact Node command. Detect python or py, bind serving to 127.0.0.1, check port availability and display one canonical root URL ending in /. Explain that the server only serves saved state; it does not start providers or refresh readiness. Keep it in a human-owned terminal when the native host terminates detached children. A changed port must be reflected in the displayed URL.

Expose latest readiness and last successful check separately from failed invocation history. Label setup checks separately from feature worker usage. Reconcile delayed terminal metadata once available, including historical turns, without adding polling or parent-covered child totals. Repeated context records after compaction must preserve the same turn baseline; the next distinct turn ends it. Unknown usage, tiers, tool charges and cost stay partial/unavailable.

Discover available browser capabilities before promising visual verification. Distinguish HTTP responses, synthetic DOM checks, code/contrast inspection and real rendered browser interaction. State limitations before accepting UI criteria. Apply an already agreed alternative evidence rule without requesting the same waiver again; if no such rule exists and browser evidence is required, identify the unmet criterion. Never fabricate browser results or silently weaken the specification.

## Public documentation

Write a beginner-friendly root README containing:

- A table of all ten roles and exact model assignments.
- Application documentation writer timing, outputs, standards sources and quality checks.
- GitHub-compatible Mermaid diagrams for workflow, review/rework, provider routing, and usage accounting.
- Windows setup instructions.
- Required runtime authentication and model access.
- Exact dashboard and first-feature commands, with one root URL for all factory views.
- Newest-first activity, supported page sizes, filters, stable refresh and in-app job/report navigation.
- Permission and human-approval behavior.
- Accounting limitations and pricing-update instructions.

Keep the generation prompt separate in prompts/software-factory.md. Make it reusable without a fixed username, local drive, or GitHub repository.

Publishable starter data must contain an empty board and usage ledger. Exclude personal job history and secrets.

## Required generated regression coverage

Generate meaningful offline behavior tests using isolated, clearly labelled fixtures. They must not need credentials or spend provider usage by default. Cover the concrete failure paths below, preserving existing application tests:

- Nested application selection, missing/dirty baseline, repository changes after job binding, path and symlink escapes, and role loading from a feature worktree.
- Failure before process creation versus provider failure; bounded timeout, missing terminal event, nonzero exit despite a response, denied permission, model/session mismatch, sanitized diagnostics and successful recheck without rewriting historical failures.
- Scoped report/input reads, assigned report/source writes, hook protocol, command argument validation, rejection of arbitrary shell/destructive Git, and canonical report discovery.
- Interrupted builder continuity, no concurrent replacement, five complete reviews before rework, fresh round invocation/turn binding and resumed native reviewer turns.
- Actual human command provenance with attached skills, spaces/tabs, stale turns, full-SHA checks, quoted/negated commands and later refusal. Include changed infrastructure and validation-to-commit race rejection.
- Compaction baselines, historical-turn boundaries, delayed terminal telemetry, exclusive parent/child usage, interrupted-run unknown usage, current readiness and safe dashboard publication.

Run generated checks and existing repository checks once appropriate to the changes. Report real counts and commands, not historical counts copied from another setup. Unsupported checks remain clearly unverified. Do not start a feature, create a paid diagnostic sweep or merge anything merely to make setup status appear complete.

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

Finish with the created files, actual validation results, unresolved requirements, and exact startup and first-feature commands. Merge only after the exact-commit human approval and all required checks; pushing and deployment need separate authorization.
## Documentation sources

Verify installed capabilities against current official documentation before implementing version-specific behavior. Use these authoritative entry points, and record the observation date in the generated guide:

- Codex Windows runtime: https://learn.chatgpt.com/docs/windows/windows-sandbox
- Codex CLI: https://learn.chatgpt.com/docs/cli/reference
- Claude CLI: https://code.claude.com/docs/en/cli-reference
- Claude scoped hook decisions: https://code.claude.com/docs/en/hooks

Do not hard-code versions, test counts, permission policies, exact recovery phrases, or successful access from an older machine as new evidence.
