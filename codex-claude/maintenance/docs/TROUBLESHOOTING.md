# Setup and connection troubleshooting

Check installation, authentication, and actual provider responses separately. A dashboard's assigned model is configuration; its actual model and measured usage require runtime evidence.

## Claude says OK in PowerShell but the factory says blocked

If the exact generated `launchClaude` adapter returns `complete`, the expected model, exit code 0, and a matching session in normal PowerShell, that adapter works in that environment. The earlier failure may have been transient or specific to the original execution environment. It does not prove every Claude model or builder resume works.

1. Run the same adapter check from the factory's execution tools, using the same executable, project directory, authentication mode, and requested model. Use `codex-claude/maintenance/scripts/check-claude.mjs --live --adapter <provider.mjs> --cwd <project> --model <model>` from this prompt repository, or the generated equivalent.
2. If only the factory check fails, inspect its child-process network and filesystem permissions and proxy/CA configuration. A child process inherits its launch environment. Request the scoped provider connection or runtime access needed by that operation through the host's supported permission mechanism. Do not disable the sandbox or silently reroute to another model.
3. If both fail, inspect the provider's actual error. DNS, TLS, connection failure, authentication rejection, rate limit, and invalid model are different problems. Unknown retries without a terminal response do not identify the cause; preserve `unknown` until evidence resolves it.
4. Have the existing orchestrator rerun one authorized check and publish its timestamp, environment, actual model, status, and observable usage. Test the other unique model and the SAME builder session's resume only after the first check succeeds.

Live checks can consume usage. Stop after an unsuccessful bounded check; do not repeatedly launch all workers. Preserve unfinished builder identity and require explicit recovery when its result is uncertain.

Official references: [Claude CLI](https://code.claude.com/docs/en/cli-reference) and [authentication](https://code.claude.com/docs/en/authentication).

## Dashboard still shows old failures

A direct adapter check returns evidence but does not update `board.json`. The dashboard polls saved state, not the provider. Its HTTP server cannot make Claude ready.

The orchestrator should publish current readiness separately from historical invocation records, with a last-check timestamp and execution-environment label. Keep historical failed runs and their unknown usage; do not reset them to PASS or $0. Show **No usage reported** instead of a measured zero when telemetry is missing.

Serve the directory named by your generated instructions. If it uses `factory/.local/public`, serving the starter `factory/board.json` displays the wrong state. Bind the server to localhost and expose only sanitized dashboard data and reports, never private transcripts or credentials.

## Codex fails before commands start

`helper_unknown_error: setup refresh had errors` is a local execution/sandbox failure, not a factory feature error. Check the installation from normal PowerShell:

```powershell
codex --version
codex doctor --summary
```

Run `codex doctor` without `--summary` for detailed, redacted diagnostics. Follow the installed runtime's supported repair/update process and reopen the application when required. Separate provider reachability failures from sandbox provisioning failures. Preserve repository files and permission settings while diagnosing.

## Codex reports a missing Windows optional dependency

Confirm which Node/npm installation is active:

```powershell
Get-Command codex, node, npm | Select-Object Name, Source
npm config get omit
npm install --global @openai/codex@latest --include=optional
codex --version
```

If it still cannot find `@openai/codex-win32-x64`, inspect the active global installation and npm registry/proxy access. The Windows binary must match the main package release and architecture. Reinstalling another Node version's global package does not repair the active installation. Avoid an unverified binary or an arbitrary platform version.

## Project directory and Git base

Use quoted paths in PowerShell and open the coding assistant in the actual application folder. For Codex, use `codex -C '<application path>'` or run plain `codex` inside that folder. `codex .` can be interpreted as a prompt rather than a directory selector.

A generated feature needs a real Git root and committed base for isolated worktrees. Detect a missing base before dispatching workers and explain how to create it while preserving existing changes. Do not create commits or change remotes silently.

Include an exact-path/content baseline proposal in specification gate 1 when needed, and commit only that unchanged proposal after go ahead. All three editions have two factory approval gates: go ahead for the displayed specification and merge code for the displayed eligible result. Routine in-scope work reuses authorization; host/provider tool permission prompts remain independent. The factory binds merge consent internally to the shown commit/branch/evidence rather than requiring a typed SHA, then shows the latest merged code and actual post-merge checks. Preserve pending offers/receipts across polling/resume so unchanged state does not repeatedly ask for approval.

## Reporting an issue

Include runtime versions, the check's timestamp and environment label, requested/reported model, exit status, session-match status, sanitized error category or HTTP status, and whether the same adapter succeeds outside the factory. Exclude account identities, keys, authorization headers, raw transcripts, and `.local` files. Paste a redacted summary rather than uploading all diagnostics.
