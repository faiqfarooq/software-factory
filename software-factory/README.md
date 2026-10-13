# Software Factory

A reusable generation prompt for building a small, visual software factory using local Codex and Claude Code together.

A GPT-6.1 Sol orchestrator coordinates eight specialist agents. Features move through specification, implementation, independent reviews, and human approval. A dashboard shows progress, token usage, and USD costs.

## Get started

1. Open [the generation prompt](prompts/software-factory.md).
2. Copy its complete contents.
3. Open your target project in local Codex using GPT-6.1 Sol.
4. Paste the prompt.
5. Let Codex inspect the project and generate the factory.
6. Follow the generated `factory/README.md` to configure the runtimes and run your first feature.

The diagrams below describe the factory the prompt requests.

## Requirements

- Git and Python.
- Local Codex and Claude Code.
- Authentication and account access to the four selected models.
- A project where the generated factory can operate.

Use your own provider accounts. Model availability and usage reporting depend on your account and installed runtime versions.

## Nine agent roles

**One orchestrator and eight specialist agents:**

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
| 9 | Approver | Claude Opus 5.5 | Recommends approval or escalation |

The human provides the final approval before merging.

## Feature workflow

The orchestrator inspects the repository before workers start. Additional permission is requested before implementation when necessary.

```mermaid
flowchart TD
    Feature["Feature request"] --> Inspect["Inspect repository"]
    Inspect --> Spec["Specification"]
    Spec --> Permission["Permission check"]
    Permission --> Build["Implement and test"]
    Build --> Reviews["Five independent reviews"]
    Reviews --> Wait["Wait for all five reports"]
    Wait --> Approver["Approver recommendation"]
    Approver --> Human["Human approval required"]
    Human --> Merge["Merge reviewed code into main"]

    classDef human fill:#fff3cd,stroke:#b7791f,color:#422006;
    class Permission,Human human;
```

Requested changes follow the rework loop below.

## Reviews and rework

The builder waits while reviewers work. Every review must finish before revisions begin.

```mermaid
flowchart TD
    Builder["Builder: Claude Opus 5.5"]

    Builder --> Security["Security"]
    Builder --> UX["UX"]
    Builder --> UI["UI design"]
    Builder --> Code["Code quality"]
    Builder --> QA["QA and acceptance tests"]

    Security --> Wait["WAIT FOR ALL FIVE"]
    UX --> Wait
    UI --> Wait
    Code --> Wait
    QA --> Wait

    Wait --> Verdict{"All reviews PASS?"}

    Verdict -->|Yes| Approver["Approver: Claude Opus 5.5"]
    Approver --> Human["Human reviews recommendation"]
    Human -->|Approve eligible job| Merge["Merge into main"]
    Human -->|Request rework| Builder

    Verdict -->|No| Budget{"Another round available?"}
    Budget -->|Yes: resume same builder| Builder
    Budget -->|No: two rounds used| Feedback["Human feedback required"]
    Feedback -->|Explicit rework: new attempt| Builder

    classDef human fill:#fff3cd,stroke:#b7791f,color:#422006;
    class Human,Feedback human;
    classDef gate fill:#e3edff,stroke:#4169b1,color:#172554;
    class Wait,Verdict gate;
```

Each attempt allows two review rounds. Explicit human rework begins another attempt and preserves previous reports.

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
    Adapter --> UX
    Adapter --> UI
    Adapter --> Approver
```

Every invocation records its requested and actual model. Model mismatches and unavailable models must be surfaced rather than silently substituted.

## Token usage and costs

The factory records observable usage after each agent invocation, including retries, reviews, and builder revisions.

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

## Dashboard

After generation, start the dashboard from the project root:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory factory
```

Open `http://localhost:8000/dashboard.html`.

The dashboard displays job stages, reviewer verdicts, human approval states, and token/cost breakdowns. Clicking a job opens its reports.

Only the orchestrator updates `board.json`. The dashboard displays state; approvals happen through the factory commands.

## Factory operations

| Operation | Purpose |
|---|---|
| `factory <feature>` | Start a feature |
| `factory next` | Run the next backlog item |
| `factory approve <job-id>` | Approve and merge an eligible job |
| `factory rework <job-id> <note>` | Resume the builder with feedback |

The generated instructions explain the supported Codex invocation and Claude Code `/factory` launcher.

## Files

Before generation, the reusable package contains:

```text
README.md
LICENSE
prompts/
  software-factory.md
```

After generation, the project also contains:

```text
.agents/skills/factory/   # Codex orchestrator skill
.codex/agents/           # Native Codex reviewers
.claude/                 # Claude launcher and worker definitions
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
  jobs/
```

## Contributing

Open an issue to suggest improvements or submit a pull request updating the prompt and documentation.

## License

MIT. See [LICENSE](LICENSE).
