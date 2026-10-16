# Factory setup troubleshooting

Start with [SETUP.md](SETUP.md). Match the observed failure to a section below; do not relaunch every worker to guess the cause. Preserve historical failures and show the result of the latest check separately.

## A command fails before PowerShell or Claude starts

Symptom: `helper_unknown_error: setup refresh had errors`, or another native process-creation failure.

This is native execution startup evidence, not proof of an invalid Claude model or password. Stop dependent provider checks. Test a harmless native command from the owning session and inspect the installed runtime's supported diagnostics from normal PowerShell.

Record the selected Windows sandbox implementation and effective managed policy. Consult the current [official Windows sandbox guidance](https://learn.chatgpt.com/docs/windows/windows-sandbox); modern and legacy implementations have different requirements. Use the supported repair path for the installed version. Do not keep recommending one old administrator setup command for every machine.

After repair, restart/resume the same registered owner and verify command startup again. Do not delete its locks or change account ACLs, firewall rules or sandbox mode automatically. A managed restriction may require an administrator; the prompt cannot remove it.

## PowerShell refuses a .ps1 launcher

Resolve native runtime applications as shown in SETUP.md. The generated Node runner should be callable directly:

~~~powershell
node factory/scripts/factory.mjs check
~~~

A direct Node entry point removes dependence on an optional PowerShell wrapper. It does not grant access denied to the underlying operation. Do not change execution policy or reroute an explicitly denied action through another runner.

## Codex, Claude or an optional Windows package is missing

Check which executable and Node/npm installation are active before reinstalling. Inspect `Get-Command codex, claude, node, npm` in normal PowerShell and use the provider's official installation guidance. A repair in another Node installation does not repair the active executable.

For a missing platform-specific Codex package, verify the main package version, Windows architecture and optional-dependency installation. Use a matching official release; do not download an arbitrary platform binary. Restart the terminal after PATH changes and repeat the version check before model calls.

## Signed in, but a model check fails

Installation, authentication and account access to an exact model are separate checks. Preserve the actual exit status, sanitized error category, requested/reported model, session match and terminal response status.

A missing terminal response with retries does not establish whether the cause is DNS, TLS, authentication, a rate limit or model access. Report unknown until supported by evidence. Do not silently change models, repeatedly reauthenticate or claim an unavailable token count is zero.

Run one bounded check per unique model and environment. Check the other model and same-session diagnostic resume only after the prerequisite succeeds. An access probe does not prove report writes, source edits or a whole feature work.

## Claude works in external PowerShell but fails in the factory

Compare the same adapter, resolved executable, working directory, authentication mode and effective host permissions. Inspect inherited proxy/CA settings without publishing secrets. External success proves only that external execution environment.

Use the host's supported scoped approval controls for the specific provider connection or command. Preserve the original failures. After access is granted, the existing owner should run one authorized recheck and publish current readiness and observable usage. Do not disable sandboxing or use another launcher to evade a denied operation.

## The worker cannot read spec.md or a review report

Factory job inputs can live outside the application worktree. Before launch, provide the exact absolute context, spec, contract and report paths and prepare narrowly scoped read access. Read access must not imply write access to the parent directory or credentials.

Feedback must list all five canonical report filenames. If discovery is necessary, allow only a nonrecursive listing of the assigned review directory. Correct a mistaken filename without granting a general parent-directory search. The builder must read the actual reports before declaring their findings resolved.

A non-interactive provider may deny a tool when no permission recipient exists. Use a supported scoped authorization interface, preserving deny rules. If authorized job grants use session-only hooks, verify their real decision protocol. [Claude's hooks reference](https://code.claude.com/docs/en/hooks) describes the interface; host network permissions remain independent.

## The app is nested or Git reports the wrong root

Confirm the application Git root, source manifests and current target branch. The factory workspace may be a parent of the actual application. The generated project selection must use a validated relative path while keeping the original factory owner and ledger.

A feature needs a reviewed committed base. Present an exact baseline proposal when work is uncommitted; do not run blanket staging, discard changes, invent a remote or create another nested repository. Use the real branch name. Never rewrite a recorded baseline after workers or reviews exist.

## /factory is not visible

Codex uses `$factory`; Claude Code uses `/factory` as a forwarder to Codex. Verify both project skill paths and the installed runtime's discovery mechanism. The generated factory guide must explain refresh or restart requirements.

If an owner already exists, resume it rather than starting a competing session. A skill file on disk, an autocomplete entry or an ordinary chat reply alone is not proof that the factory workflow executed.

## Claude role definitions disappear inside a feature worktree

Do not assume a worktree inherits the parent Git repository's .claude discovery. Supply validated role definitions using the installed CLI's supported explicit agent-definition interface. Preserve their exact model and tool restrictions and reject drift from models.json.

See the [Claude CLI reference](https://code.claude.com/docs/en/cli-reference), then verify installed help. Do not invent flags or pass a definition-file form unsupported by that version.

## Validation commands are denied or fail unexpectedly

Validate command support before implementation. Store exact file/args/cwd arrays in the frozen acceptance contract. Identify local dependency entry points, database binaries and required loopback/network access early. Use the actual project's runners; another application's Node paths are examples, not universal defaults.

Run commands individually. Shell chaining, exit-code echoes, redirects and multiline/co-author commit decorations can fall outside an otherwise valid grant. Collect exit codes in the adapter and keep commit commands simple. A necessary diagnostic variant needs its own precise permitted command/output path.

Do not bypass a denial, accept unsupported evidence, weaken lint rules or use production data. A baseline failure must be addressed in scope or documented before a feature can meet acceptance.

## A builder times out or the owner looks stale

Preserve the session UUID, invocation evidence and lock. A timeout does not prove a process stopped. Use supported process/session evidence to determine whether it is still running before any resume. Do not start a replacement builder, fork the session or silently steal ownership.

If continuation is uncertain, present the exact recovery decision. If existing explicit authorization already covers the proven safe continuation, do not ask for the same permission again. Record the resumed turn separately and keep unknown usage for the interrupted invocation.

## A second native review spawn is rejected

Some runtimes retain completed task names. Create a new native task if supported; otherwise dispatch a fresh follow-up turn to the verified existing role session. Bind the current round's invocation, commit, spec, checkpoint time and child turn to the new result.

Do not reuse the old verdict or the whole session's cumulative usage. Wait for all five current-round reports and valid execution evidence before builder rework. If native identity or dispatch evidence is unavailable, report the blocker rather than replacing native reviewers with CLI sessions.

## A valid human approval is rejected, or a vague approval is accepted

`factory approve <job-id>` opens the review only. Merging needs `factory approve <job-id> --commit <full-reviewed-SHA>` from the actual human message in the owning current session/turn. The generated parser must support ordinary spaces/tabs and the installed skill prefix.

Skill attachments are instructions, not the human approval text. They must not hide a genuine command. Reject attachment-only, stale, quoted, negated, incomplete or wrong-commit commands, and honor a later human refusal.

Fixing the parser must not weaken commit, report, validation or provenance checks. Review changed approval infrastructure independently, preserve the failed attempt and ask the human to review the concrete eligible commit when fresh consent is required.

## Dashboard still shows old failures or no jobs

The dashboard polls saved state. It cannot run providers or publish a successful check. The owner must publish a timestamped current result while retaining historical failed invocations.

Prepare and serve `factory/.local/public`, not the empty publishable starter board or the workspace root. Verify the server's directory and URL. `python` and `py -3` are alternatives when installed; if neither exists, install Python for serving. If the port is busy, select another and change the URL too.

Keep a human-owned server terminal open when the host terminates detached child processes. Serve only sanitized state and report copies. Private logs, credentials and receipts must remain outside the server directory.

## The home link lists files, or jobs need separate links

Open the generated server's root URL, such as http://127.0.0.1:8765/. The prepare-dashboard operation must publish index.html as the same application as dashboard.html. A directory listing usually means the index was not prepared or the wrong folder is being served. Serve only factory/.local/public.

The app must provide its own Overview, Jobs, Activity, Documentation, Usage and Readiness navigation. Jobs and report links use hash routes inside that application, which a static Python server can refresh without a custom backend. A guessed filesystem path or a separate local-file link is not the intended navigation.

For a missing job or report, inspect the current sanitized publication manifest, the approved document kind and the selected attempt/round. Display unavailable when absent. Do not expose a private directory, loosen path validation or serve raw logs to make a report open.

## Latest activity, pagination or limits look wrong

Latest activity belongs at the top of Overview and sorts real records newest first with a stable ID tie-breaker. A terminal update changes the existing invocation rather than creating a second charge. Workflow events have not-applicable usage; provider costs remain labelled estimates or unavailable as appropriate.

Activity and Jobs support 10, 25, 50 or 100 items, defaulting to 10. Validate the selected limit, page bounds, full-history filters, count/range and disabled Previous/Next controls. Empty results must show an empty state rather than an invalid page. Global usage totals must not become totals for only the visible page.

If new activity causes skipped or duplicated older rows, keep later pages on their existing publication snapshot and offer an explicit New activity available action. Fetch indexes, page chunks and counts from one publication generation; do not mix files from different refreshes. Avoid fetching the entire growing ledger and slicing it in the browser. Show stale/error state when polling fails while retaining the last usable snapshot.

Keep each view's filter/page state when opening a job and returning. Do not silently reset the page on every poll or replace the reader's focused control. Generated offline fixtures should exercise multiple pages and new arrivals without model calls or fake personal spending records.

## Tokens or costs are unavailable, duplicated or delayed

Missing terminal usage is unavailable, not $0. Report API-equivalent estimates separately from additional subscription charges. Keep historical price snapshots and unknown billing modifiers.

Reconcile completed historical turns after delayed telemetry arrives. Preserve a turn's original baseline across compaction and bind resumed review usage to the new turn. Do not count parent-covered children, repeated polls or cumulative session counters twice. A successful recheck updates current readiness; it does not rewrite a failed run.

## No browser is available

State which checks actually ran. HTTP responses, synthetic DOM fixtures, code review and measured contrast do not establish rendered layout, keyboard/focus behavior or screen-reader results.

Use an already accepted alternative evidence rule when it applies. If the frozen specification requires real browser verification and no alternative was agreed, identify that unmet requirement. Do not repeatedly request a waiver already present in the specification or claim unperformed browser checks.

## Documentation is missing, stale or written after approval

The documentation-writer role runs after implementation and before checkpointing. Confirm it exists in central routing and explicit agent loading, has only the assigned application documentation write paths, and completed with the actual Sonnet model. The factory has ten roles and five independent reviewers.

A factory documentation.md report is not a substitute for the application's README and guides. Check the final combined commit, allowed doc-only diff, required page coverage, recorded standards sources/dates and executed documentation checks. A no-impact result needs concrete existing coverage. Do not mark a missing required section complete merely because the report says so.

Source rework invalidates the documentation completion evidence until the writer reassesses affected content. Documentation-only corrections require a new commit, checkpoint and five reviews. Never modify the frozen tree during review or add docs after the approved commit.

If a claimed newest standard cannot be verified, report its currency as unverified. Preserve compatible existing API/doc tooling instead of changing schema versions or installing a site generator automatically. Follow the accepted scope and distinguish checked commands/examples from unexecuted ones.

## The factory repeatedly reads the project or spends too many tokens

Check the loaded runtime instructions and role task packets, not just the visible task message. The full generation prompt and setup guides belong to setup/audit; common rules and a worker's relevant paths should be concise. Verify the project map's source/config/instruction fingerprint before reuse, updating affected areas. Workers must retain access to additional evidence when needed.

Inspect the local efficiency summary or dashboard Usage view for actual per-role input/output/cache categories, retries and durations. Missing usage remains unavailable. Prompt byte size is not a token measurement. Stable instructions can help supported caching, but a resumed session alone does not prove a cache hit.

For long tool outputs, retain full private evidence and return the bounded useful excerpt with truncation/log pointer. Required errors, finding details and provenance must stay visible or directly retrievable. Avoid copying full logs into every report. Do not reduce usage by hiding findings, skipping required tests/reviews or replacing the recorded builder.

## Cached readiness or check results are stale

Readiness cache entries need a valid age and matching executable/version, model, project/cwd and effective auth/permission/network fingerprint, plus relevant role-tool capability. Failure, expiry, changed conditions or unknown binding invalidates reuse. A model-access probe does not prove role file permissions or feature correctness.

Acceptance evidence is tied to the final code/docs commit, spec/contract, commands and required tooling/environment. Reuse only as permitted by the contract. Source/docs/target/spec or relevant environment changes require affected revalidation. QA still independently verifies required acceptance; do not use a shared cache to remove that independence.

## Retries multiply or a token budget blocks work

Separate controller attempts from the provider's observable internal retries. Default outer diagnostic retries are zero. A known safe failed diagnostic may be retried only under the validated bounded policy and valid authorization. Uncertain/time-out runs must be reconciled first; do not relaunch or clear locks to make progress appear faster.

Budget policy defaults to no invented token/USD limit. When configured, evaluate it before new model dispatch, showing measured/estimated/unknown amounts and current completeness. Unknown cost must not be converted to zero to authorize more calls. Exhaustion blocks new dispatch while preserving sessions, artifacts and spend history. Collecting existing receipts must remain possible without a new model call.

A real human-authorized budget increase is recorded without resetting spend, retry count or history. A local dispatch threshold cannot guarantee an exact total-spend ceiling for in-flight requests or delayed metadata. Do not claim hard dollar enforcement unless a provider/runtime mechanism was verified. Host permissions, documentation/review requirements and exact-commit merge approval still apply.

## A reusable starter would overwrite files or includes private state

Verify the selected trusted starter's version and checksum manifest, then inspect its installation preview. Stop for conflicting files rather than replace existing configuration or application docs. Reject absolute/traversing paths, symlinks and mismatched contents. Hash integrity alone does not establish publisher trust.

Starter exports must contain only an explicit sanitized allowlist of reusable files. Exclude .local data, personal jobs, sessions, grants, usage, worktrees, credentials and project-specific context/settings. Source files under a generated factory are not automatically safe to redistribute. Preserve the destination's work and use its own new owner/context when setting up another application.

## Share a useful issue report

Provide runtime versions, the failing stage, timestamp/environment, requested/reported model, exit status, session-match status, sanitized error category and whether the same adapter succeeds externally. For a native startup failure, include the sandbox implementation and a redacted relevant diagnostic summary.

Exclude keys, account identity, authorization headers, raw transcripts, private .local files and database connection strings. Preserve evidence locally; share the smallest redacted explanation needed.
