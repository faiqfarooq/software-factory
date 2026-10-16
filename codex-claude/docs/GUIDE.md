# Software Factory

A reusable generation prompt for building a small, visual software factory using local Codex and Claude Code together.

A GPT-6.1 Sol orchestrator coordinates nine specialist agents. Features move through specification, implementation, documentation, independent reviews, and human approval. One dashboard link opens jobs, reports, documentation and usage, with the latest activity at the top and paginated history.

## Get started

This folder contains a reusable prompt, not an installed factory. Copy [GENERATION.md](../GENERATION.md) into Codex opened in your application project. The prompt is self-contained: the generated factory must include its own helpers, tests and setup instructions.

1. Install a current Node.js LTS, Git, Codex and Claude Code; install Python 3 for the dashboard. Sign in using your own provider accounts.
2. Open the actual application folder in PowerShell, verify the programs, then start Codex with the pinned orchestrator model. See [SETUP.md](SETUP.md) for exact commands and expected results.
3. Paste the complete generation prompt. It inspects the project, generates the factory and runs offline checks before launching workers.
4. Follow the generated readiness checklist. Local installation, live model access, builder resume and full feature validation are separate results. Explicit live checks consume provider usage.
5. In Codex, start a feature with `$factory <feature>`. In Claude Code, `/factory <feature>` forwards to Codex. An existing factory resumes its registered owner.

The generated quick-start commands are:

~~~powershell
node factory/scripts/factory.mjs check
node factory/scripts/factory.mjs validate
node factory/scripts/factory.mjs efficiency
node --test factory/scripts/*.test.mjs
node factory/scripts/factory.mjs prepare-dashboard
~~~

Run these from the generated factory workspace, after generation. They must not dispatch paid model checks. The generated instructions also show the detected Python server command and exact live-check workflow.

## What setup now handles

The prompt includes early native-command and permission checks, Windows executable resolution, nested Git projects, scoped worker input/report access, worktree role loading, exact acceptance commands, timeout recovery, same-session rework, round-two reviewer evidence, and human approval parsing. It keeps current dashboard readiness separate from historical failures and preserves real usage evidence.

[SETUP.md](SETUP.md) is the beginner walkthrough. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) maps known symptoms to recovery steps. Account/model availability and managed computer restrictions can still require human action; the factory must explain those requirements rather than claim success.

## Reduce repeated work and token usage

Read [EFFICIENCY.md](EFFICIENCY.md) for a short feature-request template and the daily workflow. The generated factory must load the full generation prompt only for setup/audit, then dispatch focused role tasks using one current project map and relevant source paths. Workers can still investigate additional in-scope evidence.

The policy requires concise reports, bounded inline logs with complete private evidence, deduplicated fresh access checks, zero automatic outer diagnostic retries by default, and configurable job/stage budgets. Required acceptance, QA independence and all five reviews remain intact. The local efficiency operation and dashboard expose actual usage, retries, durations and budget completeness without another model call.

Future installations can reuse a trusted versioned starter exported from a validated generated factory, with integrity checks and conflict-aware installation. This prompt package does not ship a complete prebuilt runtime. Existing factories receive focused upgrades rather than regeneration. Token/cost savings must be measured; shorter input and session reuse alone do not prove them.

## Check connections before features

Local checks do not prove account access to a model. After generation, ask the owning Codex orchestrator to check one unique Claude model at a time through the actual adapter, then verify the SAME recorded diagnostic builder session can resume. Preserve failed invocation history and record real usage.

An external PowerShell success does not prove a Codex child process can connect. A direct adapter test does not update the dashboard; the owner must publish a fresh check with its timestamp and execution environment.

The optional checker in the [maintainer reference](../maintenance/docs/REPOSITORY-GUIDE.md) can help diagnose connections. It belongs to the prompt repository, not to a newly generated application. The pasted prompt must generate equivalent checks without requiring that repository to be present.

## Requirements

- A current Node.js LTS, Git, local Codex and Claude Code.
- Python 3 available as `python` or `py` for the dashboard server.
- Your own accounts with access to the four exact assigned models.
- A selected application Git repository and a reviewed clean committed base before feature workers run. A remote is optional for local work.
- Effective host and provider permissions for the required file, process, network and local test operations.

Preserve existing application files and account settings. Configure only the access actually needed by the job.

## Ten agent roles

**One orchestrator and nine specialist agents:**

| # | Agent | Model | Responsibility |
|---|---|---|---|
| 1 | Orchestrator | GPT-6.1 Sol | Coordinates workers and maintains factory state |
| 2 | Spec writer | Claude Opus 5.5 | Defines scope and acceptance criteria |
| 3 | Builder | Claude Opus 5.5 | Implements, tests, and revises code |
| 4 | Security reviewer | GPT-6 Astra | Checks security risks |
| 5 | UX reviewer | Claude Sonnet 5.5 | Checks usability and user flows |
| 6 | UI reviewer | Claude Sonnet 5.5 | Checks visual design and accessibility |
| 7 | Code reviewer | GPT-6.1 Sol | Checks correctness and maintainability |
| 8 | QA reviewer | GPT-6.1 Sol | Independently verifies tests and acceptance criteria |
| 9 | Documentation writer | Claude Sonnet 5.5 | Maintains complete developer documentation and an end-user manual after implementation |
| 10 | Approver | Claude Opus 5.5 | Recommends approval or escalation |

The human provides the final approval before merging.

## Professional application documentation

The documentation writer runs after implementation and before all five independent reviews. It reads the actual code, tests and accepted specification, then maintains two separately navigable documentation sets for the app:

| Deliverable | Audience and required coverage |
| --- | --- |
| Developer documentation | Another developer who needs to understand, run, extend and maintain the app: product overview, architecture/data flow, source/module map, design decisions, data model, auth and integrations, local setup, safe configuration, development conventions, exact test/lint/build commands, API reference where implemented, maintenance, technical troubleshooting and limitations. |
| End-user manual | People using the app: access and onboarding, roles/permissions, navigation, step-by-step supported workflows with prerequisites, actual labels or commands and expected results, common errors/recovery, relevant admin tasks, settings, FAQ, troubleshooting, limitations and available help. Use plain language and verified examples or screenshots where available. |

Before implementation, the spec writer includes a documentation_plan in the specification and contract. It assigns an entry page, permitted pages/write paths, existing coverage/gaps, feature impact and verification steps to each deliverable. Both guides are required, including for CLI/API products whose users need task instructions. Individual inapplicable topics need reasons; they do not waive either guide.

Preserve the app's existing documentation framework and audience-specific locations. If none exist, use docs/developer/README.md and docs/user-manual/README.md with additional pages as needed. Link both from the application README and docs navigation. Reuse shared references without duplicating them. These paths are generated application outputs, not files shipped in this prompt repository.

On the first feature, assess baseline coverage in both guides; later features update affected pages and verify unchanged coverage remains accurate. Preserve existing conventions and avoid invented capabilities, secrets and unverified deployment instructions. The end-user manual focuses on using the product; developer internals belong in the developer guide unless users need them.

The authoring policy uses [Diataxis](https://diataxis.fr/start-here/) for documentation structure and [Google's developer style guidance](https://developers.google.com/style) for writing. For HTTP API schemas, it checks the current [OpenAPI specification](https://spec.openapis.org/oas/latest.html) and uses a published version compatible with the app's tools. The writer records reference dates and versions rather than claiming universal latest-standard compliance.

Documentation changes are committed on the feature branch before checkpointing. The private documentation.md report records entry pages, coverage, checks and COMPLETE/CHANGES status separately for developer_documentation and end_user_manual. Overall completion requires both to be complete and current; the report cannot substitute for either guide.

The five reviewers check the combined code-and-documentation commit. Code/QA verify developer onboarding and technical accuracy; UX/UI verify user instructions, navigation and accessibility; security checks safe configuration, permissions, examples and disclosure in both. Missing, incomplete or outdated required content in either deliverable blocks merge approval. Documentation updates after rework get a new checkpoint and complete review round; nothing is appended after human merge approval.

## Two approvals per feature

The factory pauses for approval at two stages:

| Stage | What you review | What you type |
| --- | --- | --- |
| Specification | Scope, acceptance criteria, both documentation plans, actual target branch, any baseline proposal, permissions and proposed costs/budget policy. Request edits until it is right. | go ahead |
| Merge | Completed work, both guides, validation, five passing reviews, approver recommendation, target branch and full reviewed commit. | merge code |

Type the phrase as your entire message in the owning chat or the generated runner's supported human-interactive session. These phrases are not standalone PowerShell commands. You do not need to type a job ID or commit SHA: the factory internally binds consent to the current displayed job/offer. Viewing evidence or typing a legacy approve command does not authorize implementation or merge.

Between these gates, implementation, documentation, tests and in-scope review fixes run automatically. A changed specification, extra spending or new authorized scope returns to the first gate; routine corrections do not. Host, sandbox and provider tool permissions remain separate and cannot be bypassed by factory consent. Unresolved checks/recovery or exhausted review rounds show a blocker rather than another generic approval prompt; explicit in-scope rework is an instruction to continue that job.

Only APPROVE plus all required valid evidence permits a merge offer; ESCALATE, failed reviews or incomplete docs stay blocked. A changed source/docs/target/evidence invalidates the displayed offer; affected checks/reviews and a fresh merge code are required at the same second gate. Refusal, wrong-stage, quoted, stale or agent-generated messages cannot approve anything. The factory asks once per unchanged offer, including across polling/resume, and consumes each human event once.

After merging into the recorded target branch, show its latest commit, changed files/code diff, both guide links and actual post-merge checks, plus an existing authorized local preview when available. Preserve failures accurately. Merge consent alone does not authorize push or deployment.

Existing generated factories need their owner to migrate gate states, spec/merge receipts, commands, human-input validation and dashboard views together, preserving jobs/sessions/history. Old consent is historical evidence and cannot approve a new offer.

## Feature workflow

The orchestrator prepares the specification and proposed permissions/costs, then pauses for your go ahead before implementation. Host/tool permission checks are separate from the two factory approval gates.

```mermaid
flowchart TD
    Feature["Feature request"] --> Inspect["Inspect repository"]
    Inspect --> Spec["Specification and plan for both guides"]
    Spec --> SpecApproval["Gate 1: go ahead"]
    SpecApproval -->|Request spec changes| Spec
    SpecApproval -->|Approved scope| Build["Implement and test"]
    Build --> Docs["Write and verify developer docs and end-user manual"]
    Docs --> Reviews["Five independent reviews"]
    Reviews --> Wait["Wait for all five reports"]
    Wait --> Approver["Approver recommendation"]
    Approver -->|APPROVE and valid evidence| Human["Gate 2: merge code"]
    Approver -->|ESCALATE| Blocked["Blocked: resolve findings"]
    Human --> Merge["Merge into recorded target branch"]
    Merge --> Latest["Show latest commit, diff, guides and post-merge checks"]

    classDef human fill:#fff3cd,stroke:#b7791f,color:#422006;
    class SpecApproval,Human human;
```

Requested changes follow the rework loop below.

## Reviews and rework

The documentation writer finishes before the review checkpoint. The builder and documentation writer remain idle while reviewers check the same committed result. Every review must finish before revisions begin.

```mermaid
flowchart TD
    Builder["Builder: Claude Opus 5.5"]

    Builder --> Docs["Documentation writer: developer docs and end-user manual"]
    Docs --> Security["Security"]
    Docs --> UX["UX"]
    Docs --> UI["UI design"]
    Docs --> Code["Code quality"]
    Docs --> QA["QA and acceptance tests"]

    Security --> Wait["WAIT FOR ALL FIVE"]
    UX --> Wait
    UI --> Wait
    Code --> Wait
    QA --> Wait

    Wait --> Verdict{"All reviews PASS?"}

    Verdict -->|Yes| Approver["Approver: Claude Opus 5.5"]
    Approver -->|APPROVE and valid evidence| Human["Gate 2: merge code"]
    Approver -->|ESCALATE| Feedback["Blocked: resolve findings"]
    Human -->|merge code| Merge["Merge into target branch and show latest code"]
    Human -->|Request rework| Rework["Same builder or docs writer as appropriate"]

    Verdict -->|No| Budget{"Another round available?"}
    Budget -->|Yes| Rework
    Budget -->|No: two rounds used| Feedback
    Feedback -->|Explicit in-scope rework: new attempt| Rework
    Rework -->|Source changes| Builder
    Rework -->|Docs only| Docs

    classDef human fill:#fff3cd,stroke:#b7791f,color:#422006;
    class Human,Feedback human;
    classDef gate fill:#e3edff,stroke:#4169b1,color:#172554;
    class Wait,Verdict gate;
```

Each attempt allows two review rounds. Explicit human rework begins another attempt and preserves previous reports. Source revisions refresh affected documentation before the next checkpoint; documentation-only corrections also require a fresh complete review round.

Failed mandatory reviews must be resolved before merging. An agent’s `APPROVE` is a recommendation, not human authorization.

## How Codex and Claude work together

Codex coordinates the factory. A provider adapter launches Claude workers and resumes the original Claude builder session for revisions.

```mermaid
flowchart TD
    Orchestrator["Orchestrator: GPT-6.1 Sol"]

    subgraph CodexWorkers["Native Codex workers"]
        Security["Security: GPT-6 Astra"]
        Code["Code review: GPT-6.1 Sol"]
        QA["QA: GPT-6.1 Sol"]
    end

    subgraph ClaudeWorkers["Claude Code sessions"]
        Spec["Spec writer: Claude Opus 5.5"]
        Builder["Builder: Claude Opus 5.5"]
        Docs["Documentation writer: Claude Sonnet 5.5"]
        UX["UX: Claude Sonnet 5.5"]
        UI["UI: Claude Sonnet 5.5"]
        Approver["Approver: Claude Opus 5.5"]
    end

    Orchestrator --> Security
    Orchestrator --> Code
    Orchestrator --> QA
    Orchestrator --> Adapter["Claude session adapter"]
    Adapter --> Spec
    Adapter --> Builder
    Adapter --> Docs
    Adapter --> UX
    Adapter --> UI
    Adapter --> Approver
```

Every invocation records its requested and actual model. Model mismatches and unavailable models must be surfaced rather than silently substituted.

## Token usage and costs

The factory records observable usage after each agent invocation, including documentation runs, retries, reviews, and builder revisions.

```mermaid
flowchart TD
    Codex["Codex usage evidence"] --> Accounting["Orchestrator normalizes and deduplicates"]
    Claude["Claude usage evidence"] --> Accounting
    Pricing["Verified model pricing"] --> Accounting

    Accounting --> Ledger["usage.jsonl: historical records"]
    Accounting --> Summary["usage.md: feature summary"]
    Accounting --> Board["board.json: display totals"]

    Board --> Dashboard["Dashboard"]
    Dashboard --> Models["Tokens and USD by model"]
    Dashboard --> Agents["Tokens and USD by agent"]
    Dashboard --> Jobs["Feature and factory totals"]
```

The dashboard distinguishes:

| Status | Meaning |
|---|---|
| Measured usage | Token counts reported by the runtime |
| Estimated cost | API-equivalent cost calculated from recorded rates |
| Reported charges | Authoritative billing data, when available |
| Partial or unavailable | Missing telemetry, pricing, or billing information |

Unknown usage is never treated as zero. Subscription usage does not necessarily create an additional dollar charge.

Historical records retain the pricing used when their cost was calculated.

## One dashboard link for everything

After generation, prepare the sanitized public folder from the factory workspace:

~~~powershell
node factory/scripts/factory.mjs prepare-dashboard
python -m http.server 8765 --bind 127.0.0.1 --directory factory/.local/public
~~~

Use `py -3` instead of `python` if that is the detected Python 3 command. Keep that terminal open and open one link: **http://127.0.0.1:8765/**. If the port is occupied, select another free port and use that port in the link. The legacy /dashboard.html entry remains compatible.

The same application provides navigation to Overview, Jobs, Activity, Documentation, Usage and Readiness. Open a job to view its specification, build report, documentation report, review rounds, approval and usage without leaving the dashboard. Documentation and job views show separate Developer documentation and End-user manual entries with their status, reviewed commit and safe entry-page links. The writer's report is labelled separately. Internal links support refresh and browser Back/Forward.

**Latest activity appears at the top**, newest first. These transactions are factory invocations, usage records and labelled workflow events. They show time, job, role/action, model, status and token/cost evidence where available. They do not represent business orders or actual provider charges.

Latest activity, the full Activity view and Jobs have pagination: **10 items by default**, with selectable limits of **10, 25, 50 or 100**. Controls show the current range/count and Previous/Next. Filters apply across the selected history before pagination. Global totals stay independent of the page size. New activity does not silently shift an older page while you read it.

The generated publisher must provide bounded sanitized chunks and counts instead of downloading the entire growing history on every poll. Jobs and reports load when opened. Current readiness remains separate from historical failures, and unknown usage stays unavailable.

Serve only the prepared public folder. The empty publishable starter board is not live state. The HTTP server serves saved state; it does not start models or publish readiness. See [troubleshooting](TROUBLESHOOTING.md) for stale views, missing routes and pagination issues.

Only the orchestrator publishes state. The dashboard is read-only; viewing approval evidence does not merge anything. Approval still uses the verified factory commands.

## Factory operations

| Operation | Purpose |
|---|---|
| `factory <feature>` | Start a feature |
| `factory next` | Run the next backlog item |
| `factory review <job-id>` | Select job and show evidence/current gate offer; no approval or merge |
| `go ahead` | Approve the displayed specification at gate 1 |
| `merge code` | Approve only the displayed eligible merge offer at gate 2 |
| `factory rework <job-id> <note>` | Resume the builder with feedback |

Use the two approval phrases as your whole message in the owning Codex chat, optionally with its supported `$factory` prefix. Claude Code `/factory` forwards to that owner without manufacturing human provenance. Legacy approve commands are evidence-only/deprecated. Generated instructions explain skill discovery and supported forwarding.

## Files

Before generation, this edition contains:

```text
README.md
GENERATION.md
docs/
  GUIDE.md
  SETUP.md
  TROUBLESHOOTING.md
  EFFICIENCY.md
maintenance/
```

After generation, the project also contains:

```text
.agents/skills/factory/   # Codex orchestrator skill
.codex/agents/           # Native Codex reviewers
.claude/                 # Claude launcher and worker definitions
  agents/documentation-writer.md
factory/
  project.json           # optional nested application selection
  models.json
  pricing.json
  efficiency.json
  board.json
  usage.jsonl
  dashboard.html         # published as index.html and dashboard.html
  backlog.md
  repo-context.md
  README.md
  SETUP.md
  TROUBLESHOOTING.md
  VALIDATION.md
  EFFICIENCY.md
  scripts/
  .local/                # ignored private state and sanitized public projection
  .worktrees/            # ignored feature worktrees
  jobs/
```

## Contributing

Open an issue to suggest improvements or submit a pull request updating the prompt and documentation.

## License

MIT. See [LICENSE](../../LICENSE).
