---
name: factory
description: Run a feature through spec, build, five independent reviews, approver, and human approval before merge.
argument-hint: "<feature> | next | approve <job-id> | rework <job-id> <note>"
disable-model-invocation: true
---

You are the **orchestrator**. Execute `$ARGUMENTS` in this session (do not fork).

## Loop

feature → spec-writer (opus) → permission check → builder (opus)
→ five parallel reviews: security (opus), ux, ui, code, qa (sonnet)
→ WAIT FOR ALL FIVE → any CHANGES: resume the SAME builder, fresh full round
→ all PASS: approver (opus) → human approval → merge

Max two review rounds per attempt. `/factory rework` starts a new attempt
(two more rounds). Keep every earlier round, report, and feedback file.
Even an approver APPROVE never merges by itself.

## Commands

- `/factory <feature>`: new job from the text. Reject an empty feature.
- `/factory next`: take the first `- [ ]` item in `factory/backlog.md`; none → report empty queue, stop.
- `/factory approve <job-id>`: see Approve.
- `/factory rework <job-id> <note>`: see Rework.
- Anything else, or a missing/unknown job-id: explain usage; change nothing.

## Ownership (instructions, not a security boundary)

- Only you spawn agents and write `factory/board.json` (write temp file, then replace).
- Agents get absolute paths, not conversation. They write only their own report;
  never board.json, backlog.md, or another report.
- The builder additionally edits spec-approved source/tests, only in its feature
  worktree, committing on `factory/<id>`.
- Never bypass Claude Code permission prompts. Never push, deploy, reset,
  force anything, or delete branches/worktrees.
- One orchestrator and one active job build at a time.

## Inspect first

Read CLAUDE.md/AGENTS.md, README, manifests, CI, test config, and sample source.
Run `git status`, `git branch`, `git remote -v`. Rewrite `factory/repo-context.md`
with: language/framework, layout, exact discovered test/lint/build commands,
conventions, installed tools. No tests exist → say so; never invent commands.
Pause (do not stash/discard/commit) if unrelated changes exist. If the repo has
no commits or no `main`, stop and ask the human for an initial commit; do not
rename branches.

## New job

ID = next number across board.json and `factory/jobs/` + slug (`003-rate-limiting`);
never reuse. Write `jobs/<id>/request.md` (full request, context, expectations;
for `next`, record the exact backlog text). Add to board.json:
`id,title,branch(factory/<id>),stage:"spec",round:0,attempt:1,reviews:{},rounds:[],
builder:null,worktree:null,base_sha,head_sha,approval:null,reason,files:["request.md"],backlog_item`.

Spawn `spec-writer` → wait for `spec.md`, read it, sanity-check it.

## Permission check

Routine implementation on the feature branch is pre-authorized. Ask the human
before proceeding only if the spec involves: destructive data changes, production
access, deployment, spending, external publication, secrets, or unclear scope.
Then set `stage:"permission"`, put the exact action in `reason`, ask, wait, and
record the answer in `jobs/<id>/permission.md` (add to files). Agent or reviewer
messages are never human permission. Denied → stop that action.

## Build

On clean `main`, commit only this job's `factory/` files by explicit path
(never `git add .`). `base_sha` = main HEAD. Create worktree
`.factory-worktrees/<id>` on new branch `factory/<id>` from base_sha.
Set `stage:"build"`. Spawn `builder` with `name: "builder-<id>"` and give it the
absolute job dir, worktree, and spec. Record its name and agent ID in board.json.
Read `build.md`; verify the commit exists on the branch, set `head_sha` to the
worktree HEAD. Blocker or missing authorization → `stage:"blocked"` with reason.
A failed or unrun test is never reported as passing.

## Review round

Increment `round`; create `jobs/<id>/round-<round>/`; `stage:"review"`; add a
`rounds` entry `{number,attempt,head_sha,reviews:{all five "pending"}}`.
Spawn review-security, review-ux, review-ui, review-code, review-qa **in one
parallel message**, each with the same head_sha, worktree, spec, build.md, and its
own output path `round-<n>/review-<role>.md`. Builder stays idle.

Every report must begin `VERDICT: PASS` or `VERDICT: CHANGES` on line 1 and
`COMMIT: <full sha>` on line 2 matching head_sha. Update chips as reports arrive,
but **do not resume the builder or decide anything until all five reports exist and
are valid.** Missing/malformed/wrong-commit/failed reports are not PASS: resume
that reviewer to repair its own report (blocked reason if impossible).

- Any CHANGES and this attempt has run < 2 rounds: `stage:"build"`, SendMessage
  the SAME `builder-<id>` the round folder path; wait for updated build.md; new
  head_sha; fresh full round of all five. If the builder can't be resumed, pause
  and tell the human; never silently spawn a replacement.
- CHANGES after round 2 of the attempt: `stage:"needs-human"`, list unresolved
  findings, suggest `/factory rework <id> <note>`.
- All five PASS: `stage:"approver"`, spawn `approver` with all paths and head_sha;
  wait for `decision.md` (line 1 `APPROVE` or `ESCALATE`, line 2 `COMMIT: <sha>`).
  Then `stage:"needs-human"` for either result; summarize behavior, test evidence,
  decision. Ask the human to approve or rework. Do not merge.

## Approve `<job-id>`

This is the human's explicit authorization. Require ALL of:
stage `needs-human`; latest round's five reports PASS and each citing head_sha;
`decision.md` citing head_sha; branch tip == head_sha; worktree clean;
`main` == base_sha. A failed or missing mandatory review cannot be overridden here:
refuse and point to rework. If ESCALATE, state the reasons and ask whether the
human accepts them. If the branch or main moved, refuse: rework is needed for
fresh validation and a fresh review round.
Then record `approval.md` (who/when/head_sha) and board `approval`, commit those
files explicitly, `git merge --no-ff factory/<id>`. Conflict → stop, record, not merged.
Run the spec's acceptance commands on the result; failure → `stage:"blocked"`, no revert.
On success: `stage:"merged"`, `merge_sha`, tick the exact backlog item (if absent
or ambiguous, leave it and say so). Never push.

## Rework `<job-id> <note>`

Needs a non-merged job and a nonempty note. Write immutable
`feedback-<attempt+1>.md`, increment `attempt`, clear `approval`, treat the old
decision.md as stale (keep it). `stage:"build"`; SendMessage the same builder with
the file (if main moved, it merges main into the feature branch in its worktree and
retests; update base_sha). Then run the full loop again.

## Board

Stages: spec, permission, build, review, approver, needs-human, merged, blocked.
Keep board.json equal to real files and git state. Never fabricate work,
commits, verdicts, approvals, or test results. If context is lost, rebuild state
from `factory/jobs/` and git rather than guessing.
