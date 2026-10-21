# Factory owner protocol

Read this file only when running the installed factory skill or implementing an edition adapter. The reusable dashboard never runs models or shell commands from browser input. The existing owner executes work through its actual native/provider tools.

## Connect once, keep the same owner

Run commands from the application root. Start `node factory/runtime/cli.mjs start` in a separate terminal if needed. Use the real host session id, not a new random id on every turn:

```text
node factory/runtime/cli.mjs owner connect --runtime claude --session SESSION_ID
node factory/runtime/cli.mjs owner next --session SESSION_ID
```

Use runtime `codex` for the hybrid edition and `deepseek` for the API edition. The Claude skill in a hybrid project forwards to the Codex owner; it never registers a Claude owner. Low-cost requires a real DeepSeek-owned tool-calling runner to call this same protocol; installing the dashboard does not create or verify that runner. Setup shows this as Action needed until it is connected. A generator must finish that edition-specific runner using the original edition contract rather than mislabel a Claude/Codex session.

`next` waits up to 50 seconds and returns one typed command or null. Continue listening while the user wants dashboard operation; return to chat when asked. Between long operations send `owner heartbeat --session SESSION_ID` at least every 60 seconds. The 90-second lease and Listening status are observable. If the host cannot keep listening, explain the limitation; never claim an unattended owner is connected. Inspect pause/cancel commands between stages and while supervising background workers. Native permissions and login stay native. Local owner pairing establishes the adapter connection, not independently verified model identity.

On disconnect/restart pending commands expire and running ones become uncertain. Resume the SAME session and reconcile actual processes, Git and results. Do not relaunch uncertain work. Use `finish` with blocked/failed after reconciliation before accepting another ordinary command. No owner replacement, automatic lock breaking or automatic paid replay.

## Execute commands

- `request`: requirements/design/mode are data, never shell text. Inspect the app; use the edition's spec writer to prepare scope, ordered dependencies for product mode, acceptance checks, both guide plans, permissions and usage budget. No implementation/baseline writes before plan approval. Publish awaiting-plan, then finish the request.
- `check-live`: the user explicitly consented to bounded diagnostics. Check each unique configured runtime/model/environment once, sequentially, with one request and zero controller retries. Use the SAME actual worker adapter and scoped environment. Verify real terminal/model metadata, initial builder and continuation of that SAME diagnostic session. Unknown identity, missing tools or failed probes stay blocked. Publish real counters only, never guessed usage. Do not install/re-authenticate or dispatch all roles. Record checks, finish, and return to listening.
- `approve-plan`: the service saves an immutable receipt for the displayed plan. Implement only that plan using the edition's builder, documentation writer, five independent reviewers and approver. Freeze the same final code/docs commit for all reviews. Keep the builder idle while docs are written and both writers idle during reviews. Resume the same builder for fixes; at most two review rounds, then needs-human/blocked. Publish progress during work and an awaiting-merge offer only with complete current evidence. Finish this command when the offer or blocker is displayed, then listen for the next command.
- Product mode: use one product branch, dependency-ready child worktrees and stable builders; five reviews/approver per child before internal fast-forward integration. No new human gate per child under the approved parent plan. Integrated is not final Accepted. Run aggregate acceptance and five fresh final-product reviews before offering the one final target merge.
- `approve-merge`: verify receipt, reviewed commit, target head, clean frozen worktree, current tests/reviews/docs and permission scope immediately before the merge. Merge only the reviewed commit into the displayed target, never push/deploy unless separately authorized in scope. Publish merged only after actual post-merge checks pass; otherwise blocked. No new edits after the offer; changes invalidate it and require fresh evidence.
- `revise`: prepare a revised plan and offer. Old consent cannot approve a new plan. `rework`: resume the same writers within approved scope and refresh all affected evidence. A scope/budget change returns to a revised plan.
- `pause` / `cancel`: stop new dispatch, reach a safe checkpoint or use supported cancellation, preserve partial work/usage and publish paused/cancelled only after confirmed. `resume`: reconcile before continuing the approved plan. Do not replace workers or discard changes.

## Publish actual results

Write small JSON payloads under `factory/.local/`, then call:

```text
node factory/runtime/cli.mjs owner publish --session SESSION_ID --file factory/.local/update.json
node factory/runtime/cli.mjs owner finish --session SESSION_ID --file factory/.local/result.json
```

An update needs `command_id`, `job_id`, `status`. Optional fields: `plan`, `features`, `checks`, `reviews`, `documentation`, `usage`, `commit`, `baseline_commit`, `target_base_commit`, `target_commit`, `target_branch`, `approver`, `message`, `preview`. Status: planning, awaiting-plan, running, reviewing, awaiting-merge, blocked, paused, cancelled, merged. Preview must be an authorized loopback HTTP URL. For an empty repository the plan may bind base_commit=null and must display its exact baseline proposal. After consent, create only that approved baseline and record its immutable baseline_commit. After target drift reconcile and freshly validate/review, then record the actual target_base_commit in the final offer; never rewrite the approved scope or old receipt.

A plan contains `summary` (string), `scope`, `acceptance`, `permissions` (string arrays), `budget` (explicit approved limit/terms, never fabricated savings), `target_branch`, `base_commit` (full SHA), `documentation: ["developer", "user"]`, and optional ordered `features`. Put baseline proposal, architecture and dependency details in scope/acceptance or private referenced contracts. Existing unrelated work is preserved, never blanket-staged. Target binding must be the exact recorded target head. Empty Git repositories need a plan-bound baseline proposal and explicit reconciliation before a build or merge offer.

Evidence uses:

- Feature: `title`, `status` (planned/running/integrated/blocked/accepted).
- Check: `label`, `status` (passed/needs-action/not-checked), `detail`, `commit`; post-merge checks also have `kind: "post-merge"`.
- Review: `role` (security/ux/ui/code/qa), `verdict: "PASS"`, `commit`, real `reviewer_id` (five distinct independent agent identities), concise `summary`. Preserve authentic identity/check evidence in private job artifacts, never expose raw transcripts.
- Documentation: `kind` (developer/user), `status: "complete"`, `commit`, `entry` (actual app-relative guide page), optional sanitized `text` for reading in the dashboard. Keep app docs in existing app locations; create only missing necessary pages.
- Approver: `verdict: "APPROVE"`, `commit`.
- Usage: actual `tokens`, API-equivalent `usd` when supported, `completeness` (complete/partial/unavailable). Unknown values are null, not zero. Full per-invocation evidence stays private.

All final checks, five reviews, approver and both guides must bind to the same `commit`. Synthetic fixtures cannot become app evidence. The bridge validates bindings and target existence; the owner remains responsible for running and authenticating the actual checks, source/docs coverage and reviewer independence.

Finish payload: `id` (command id), `status` (completed/failed/blocked), `message`. A queued action is pending; acknowledgment makes it running; finishing it requires an actual result. Finish only when its stage reaches a gate or terminal state. Never mark the entire product complete at an internal integration.

Live check publication uses `owner checks --file ...` with `{ "command_id": "...", "checks": [...] }`. Each check has `id` (live/continuation, or api-runner for that edition), `label`, `status`, sanitized `detail`/`action`, and real `evidence`. A passed live check requires `evidence.probes` covering every unique configured model. Each real probe records `model`, `session`, `terminal: "completed"`, `exit_code: 0`, and an environment fingerprint. Passed continuation uses those fields directly, with `initial_session` matching `session` and the configured builder model. Passed api-runner uses the configured owner model and actual `tools: ["read", "search", "write", "test", "git"]` evidence. Preserve unavailable fields and failure history. This API is legal only during an authorized check-live command. The bridge checks metadata bindings; authenticating the actual provider receipts and tool results remains the owner's responsibility.

## Minimal context and files

Keep the versioned dashboard/runtime unchanged. Edit only config and create private artifacts when actually needed. One compact app map and focused role packets reference source/contracts instead of copying entire prompts/chats. Keep jobs, worktrees, logs, receipts and usage inside ignored factory/.local. Do not expose this directory through HTTP. Reports are concise findings plus check evidence; no empty placeholders or repeated guides. Preserve all ten role/provider assignments in config; verify exact identifiers against installed capabilities and official docs before dispatch. Missing access is a visible blocker, never a silent model substitution.
