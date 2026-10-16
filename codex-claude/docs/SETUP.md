# Set up the Codex + Claude factory

Use this guide when generating a new factory from [GENERATION.md](../GENERATION.md). The prompt package does not contain an installed factory. Commands under factory/scripts become available only after generation.

## 1. Check the programs in normal PowerShell

Install a current Node.js LTS, Git, Codex, Claude Code and Python 3 using their official installers. Open a new terminal after PATH changes. Use your own accounts; never paste credentials into a prompt or report.

~~~powershell
node --version
git --version
$factoryCodex = (Get-Command codex -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$factoryClaude = (Get-Command claude -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
& $factoryCodex --version
& $factoryClaude --version
& $factoryCodex login status
& $factoryClaude auth status
~~~

Expected: Node and Git versions, resolved native runtime commands and signed-in status. If signed out, use `& $factoryCodex login` or `& $factoryClaude auth login`. Login alone does not prove access to an assigned model.

Check `python --version`; if unavailable, try `py -3 --version`. Record the working Python 3 command. Missing Python affects dashboard serving; it should not prevent generation or offline factory checks.

If a command fails, follow the matching entry in [TROUBLESHOOTING.md](TROUBLESHOOTING.md) before launching model checks. A runtime repair may need an administrator on a managed machine.

## 2. Open your application project

Replace the example path with your application's real location:

~~~powershell
Set-Location -LiteralPath 'C:\projects\my-app'
Get-Location
git rev-parse --show-toplevel
git status --short
& $factoryCodex --model gpt-6.1-sol
~~~

Expected: the intended application folder, its Git root and its existing changes. Do not use `codex .` as a directory selector. If the app is nested inside a larger workspace, the generator must select the application Git root and keep factory ownership in the workspace.

A feature needs a committed base. If the app has none or contains uncommitted work, have the generator prepare an explicit baseline proposal for your review. Do not blanket-stage, discard or stash existing work. Git remotes are not required for local features, and the generator must discover the actual target branch instead of assuming main.

If this application already has a factory, use its recorded owner and upgrade instructions. Do not overwrite jobs, replace its owner or generate a second active builder.

## 3. Paste the complete prompt

Paste the entire [GENERATION.md](../GENERATION.md) into Codex. The generator must:

- Inspect project instructions, source, Git state and exact validation commands.
- Prove a harmless native command can start before spending usage on provider checks.
- Generate all runtime helpers, skills, agent definitions, offline tests and local setup documentation.
- Preserve the application README, existing configuration and unrelated edits.
- Present a readiness checklist with evidence and next actions.

This prompt intentionally retains the assigned exact models. If your account cannot use one, setup must identify that requirement rather than silently substitute another model.

## 4. Run the generated offline checks

From the generated factory workspace in normal PowerShell:

~~~powershell
node factory/scripts/factory.mjs check
node factory/scripts/factory.mjs validate
node factory/scripts/factory.mjs efficiency
node --test factory/scripts/*.test.mjs
~~~

Expected: local prerequisite results, valid ten-role routing and real offline test results. Missing prerequisites should produce a specific blocker. These commands must not invoke live models by default. Do not copy a previous machine's passing test count into the new validation record.

The generated owner must also check its effective runtime permissions and actual model. Configuration files and command-line requests alone do not prove the running host adopted them.

## 5. Verify live access through the owner

In the owning Codex chat, request a live check explicitly:

~~~text
$factory check --live --model claude-opus-5-5
~~~

Only after success, request:

~~~text
$factory check --live --model claude-sonnet-5-5
~~~

These operations can consume provider usage. Each must use the actual factory adapter and execution environment, have bounded timeouts, and return the reported model, session match, exit status, terminal result, timestamp and usage completeness. An init/configured model is insufficient. Stop dependent checks after failure; use the observed error to choose recovery.

Then ask the same owner:

~~~text
$factory Verify initial no-tool builder access and then resume that SAME recorded diagnostic session once. Preserve session identity, publish real usage, and stop if the initial result is uncertain. Do not start a feature or create a replacement feature builder.
~~~

A diagnostic resume proves that interface only. A real feature revision must still preserve the actual feature builder session. Native Codex reviewer access is verified through native agents at the appropriate stage; do not substitute standalone CLI workers.

If external PowerShell succeeds but the owner fails, compare the actual executable, working directory and effective host permissions. Request the specific required native access. A task approval cannot override a host denial or a Claude tool denial.

## 6. Open everything from one dashboard link

From the factory workspace:

~~~powershell
node factory/scripts/factory.mjs prepare-dashboard
python -m http.server 8765 --bind 127.0.0.1 --directory factory/.local/public
~~~

If `py -3` is your working Python command, use it in place of `python`. Keep that terminal open. Open `http://127.0.0.1:8765/`. If the port is occupied, select another free port and use the same port in the URL.

Expected: Overview opens with Latest activity at the top, sorted newest first. Use the same navigation for Jobs, Activity, Documentation, Usage and Readiness. Opening a job shows its reports and review rounds inside the dashboard; no separate server or local file link is needed.

Activity and Jobs default to 10 items per page, with 25, 50 and 100 also available. Verify the count/range, disabled controls on empty or single-page results, filtering, job detail and Back/Forward. With enough real records, check a later page and its New activity available behavior; do not create fake spending records to fill pages. Offline generated fixtures cover multi-page cases.

Refresh a job/report deep link to confirm it still opens in the same application. The root link and legacy /dashboard.html entry must both work. A port change must update the displayed home link. Current readiness, last update time, historical failures and partial/unavailable costs remain distinct.

Only sanitized files belong in this server directory. The server does not start the factory or change provider readiness.

## 7. Start your first feature

In the owning Codex chat:

~~~text
$factory Add an accessible settings screen
~~~

In Claude Code, `/factory Add an accessible settings screen` forwards to Codex. Do not open another active orchestrator while the owner is running. If the skill is not discovered, follow the generated refresh/resume instructions; typing ordinary feature chat is not guaranteed to invoke it.

The workflow uses all ten roles in stages: specification and documentation plan, implementation, developer documentation and end-user manual, five independent reviews, approver recommendation, then human review. The builder works on an isolated feature branch. Before implementation, the specification plans coverage, paths and verification for both guides. After implementation, the Sonnet documentation writer completes them and links both from the app README before checkpointing. Source revisions preserve the builder session and refresh affected docs; the combined commit receives a new complete review round.

Review the evidence first:

~~~text
$factory approve <job-id>
~~~

That command does not merge. Only after reviewing the reports and full commit, send:

~~~text
$factory approve <job-id> --commit <full-reviewed-SHA>
~~~

Use the actual job and full reviewed commit. Changes to the feature, target branch, spec or required evidence invalidate the old approval. Rework uses `$factory rework <job-id> <note>`. Push and deployment require separate authorization.

## Documentation produced for your app

After the builder completes implementation, documentation-writer (Claude Sonnet 5.5) updates two documentation sets before the review checkpoint:

1. **Developer documentation** so another developer can understand, set up, extend, test and maintain the app. Include architecture, source map, data/configuration, integrations/auth, exact development/test commands, APIs where present, maintenance and technical troubleshooting.
2. **End-user manual** explaining how to use the app: access/onboarding, navigation, roles, step-by-step tasks with expected results, common errors/recovery, settings, relevant admin tasks and help. Use actual product labels or commands and plain language.

The first run assesses baseline gaps in both guides; later runs update affected pages and verify unchanged coverage remains accurate. Preserve existing docs locations; when none exist, use docs/developer/README.md and docs/user-manual/README.md. The application README and docs navigation must link to both. The specification and contract's documentation_plan defines each guide's coverage, paths and verification before implementation.

Review the generated documentation report with the source changes. It lists the implementation input commit, final combined commit, changed pages, standards references with observation dates, actual validation results and remaining limitations. It records entry pages, coverage and COMPLETE/CHANGES status separately for developer_documentation and end_user_manual. The Documentation dashboard and job detail expose both guides with separate statuses and safe links. The factory must verify a real writer invocation and require both guides to be complete and current before approval.

No extra unique model check is required just because this role also uses Sonnet. Scoped file access, execution and documentation accuracy still need evidence. When applying this change to an existing factory, its owner must migrate documentation-plan contracts, writer instructions, permissions, per-deliverable evidence, review/approval gates and dashboard publication together while preserving existing jobs and history. Legacy completion alone is insufficient. Frozen active contracts need an explicit scope update and fresh validation/reviews; past approvals must not be rewritten.

## What ready means

| Check | Required evidence |
| --- | --- |
| Generated | Actual files exist; current application work is preserved. |
| Offline validated | Recorded local tests/checks pass for these file contents. |
| Local prerequisites | Required programs, baseline and effective permissions are available. |
| Live models | Real responses report the assigned exact models in the factory environment. |
| Builder resume | The initial diagnostic succeeded and its same session resumed. |
| Full feature validation | Real implementation, complete current developer documentation and end-user manual, acceptance checks, five same-commit reviews, approver and exact human approval; post-merge results recorded. |

Rendered UI and keyboard checks need real browser evidence where required. HTTP 200, source inspection and synthetic DOM tests must be labelled accurately. Setup alone cannot claim a fully validated feature.

## Efficient daily use

Use [EFFICIENCY.md](EFFICIENCY.md) for a compact feature brief. Specify the intended behavior, constraints and verification, and reference relevant files instead of pasting large logs or old chats. Send related corrections together. Keep the existing owner and builder session.

After generation, efficiency prints a local policy/usage summary without model calls. The owner uses one current project map and focused role task packets, bounds inline logs while retaining full evidence, and refreshes documentation after implementation. It keeps all ten roles and five independent reviews.

Readiness reuse is conditional on freshness and matching environment fingerprints. Automatic outer diagnostic retries default to zero. Optional job/stage budgets must be explicitly configured; exhaustion blocks new model dispatch while preserving partial work and accounting. Existing in-flight requests and delayed telemetry prevent claiming a precise hard spending cap without verified provider enforcement.

A reusable starter is exported only from validated, sanitized generated files. Verify its version/manifest and preview conflicts for future projects; exclude all private state and project-specific settings. If none is available, generate once. Do not assume this prompt repository contains a full runtime installer.

## Updating an existing factory

Updating this prompt package does not patch a previously generated runtime. Ask its existing owner to apply the updated setup, efficiency and recovery requirements to that runtime while preserving job history, approvals, sessions and usage. Recheck changed behavior and publish current readiness without rewriting historical failures.
