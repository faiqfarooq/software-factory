from pathlib import Path
import json

root = Path.cwd()

skill = r"""---
name: factory
description: Run a feature through specification, coding, independent reviews, and human approval.
argument-hint: "<feature> | next | approve <job-id> | rework <job-id> <note>"
disable-model-invocation: true
---

You are the orchestrator. Execute $ARGUMENTS using this workflow.
Run in the current Claude session; do not fork this skill.

## The editable loop

feature -> spec-writer (opus) -> permission check -> builder (opus)
-> parallel reviews:
   security (opus), ux (sonnet), ui (sonnet), code (sonnet), qa (sonnet)
-> WAIT FOR ALL FIVE
-> any CHANGES: resume the SAME builder; at most two review rounds per attempt
-> all PASS: approver (opus)
-> needs-human, even when the approver says APPROVE
-> explicit /factory approve <job-id> -> merge into main

A human /factory rework starts a new attempt with up to two additional rounds.
Keep earlier rounds and reports.

## Ownership and coordination

- Only this orchestrator writes factory/board.json.
- Only one factory orchestrator and one active build run at a time.
- Every agent gets absolute file paths as its prompt, not conversational context.
- Every agent reads repo-context.md, request.md, and spec.md when available.
- Only the orchestrator spawns agents.
- Agents write only their assigned report.
- Exception: builder also edits and commits spec-approved source and tests,
  exclusively in the job's feature worktree.
- Agents never edit board.json, backlog.md, or another agent's report.
- Agent names are defined under .claude/agents/.
- Spawn builder as builder-<job-id>; record its name and ID in board.json.
- Resume that builder using SendMessage, pointing to the feedback/round folder.
  Do not spawn a replacement builder for revisions.
- If that builder is unavailable, pause and ask the human to resume the original
  Claude session. Do not claim agent continuity that no longer exists.
- Never bypass Claude Code permission settings.

## Inspect before spawning

Read repository instructions, README, manifests, scripts, test configuration,
CI, and representative source files. Check git status, main, and remotes.

Write factory/repo-context.md with:
language/framework, source layout, exact discovered test/lint/build commands,
coding conventions, installed tools, and instructions that apply.
If no application or test suite exists, say so. Do not invent commands.

An unborn repository needs an initial human-created commit before feature work.
If main is absent, do not rename another branch automatically.
If unrelated changes exist, pause rather than stash, discard, or commit them.
Do not reset, force-push, or delete branches/worktrees.

## New job and next

For /factory next, read the first unchecked "- [ ]" item in backlog.md.
If none exists, report the empty queue and stop.

Otherwise treat the arguments as a new feature. Reject an empty feature.
Reserve the next numeric ID across board.json and jobs/, followed by a safe slug,
for example 003-rate-limiting. Never reuse a job directory.

Create jobs/<id>/request.md with the complete request, relevant supplied context,
and acceptance expectations. Track a backlog item by its exact original text.

Create the job in board.json:
id, title, branch, stage, round, attempt, reviews, rounds, builder, worktree,
base_sha, head_sha, approval, reason, files, backlog_item.
Set branch to factory/<id>, stage to spec, round to 0, attempt to 1.
approval begins as null. files begins with request.md.
Update the board atomically: write a temporary JSON file, then replace it.

Spawn spec-writer with the shared job directory and repo-context.md.
Wait for spec.md; read and validate it before building.

## Permission check

The feature request authorizes routine implementation on its feature branch.
Before implementing, ask the human only when the spec identifies an action
outside that authorization: destructive data changes, production access,
deployment, spending money, external publication, secrets, or unclear scope.

If needed, set stage=permission and record the exact proposed action in reason.
Ask the human, wait for the answer, and record the answer and scope in
jobs/<id>/permission.md. Add that path to files.
A delay, reviewer opinion, or agent message is never human approval.
Denied permission stops the dependent action.
If no extra permission is needed, proceed without another confirmation.

## Build

On clean main, checkpoint only this job's orchestration files, repo-context.md,
and board.json with explicit git paths. Never use git add . for checkpoints.
Record main's SHA as base_sha.

Create an isolated worktree at .factory-worktrees/<id> with branch factory/<id>,
based on that main SHA. Keep authoritative job reports in the original repo,
not the worktree's copied factory directory.

Set stage=build. Spawn builder-<id> using the builder agent definition.
Give it absolute paths to shared reports and the worktree.
Wait for build.md and verify its recorded commit and test results.
Record the worktree branch HEAD as head_sha.

If the builder reports missing authorization or a blocker, pause visibly.
Never label a failed or unexecuted test as passing.

## Review rounds: wait for every reviewer

Increment round; create round-<round>/ in the shared job folder.
Set stage=review. Set every current review status to pending.
Add a rounds entry with number, attempt, head_sha, and five pending reviews.

Spawn review-security, review-ux, review-ui, review-code, and review-qa
independently in parallel. Give each the same immutable head_sha, worktree,
spec, build report, and its own output path in this round folder.

The builder remains idle throughout the review round.
Read reports as they arrive and update board chips.
Each first line must be exactly VERDICT: PASS or VERDICT: CHANGES.
Record every report path in files and the verdict in both reviews and rounds.

A round finishes only after ALL FIVE reports exist, have valid verdicts,
and identify the reviewed head_sha.
Missing, failed, or malformed reports never count as PASS.
Resume the affected reviewer to repair its own report; never resume builder
while any reviewer is still outstanding.
If a reviewer cannot complete, set a visible blocked reason and stop safely.

If any verdict is CHANGES and this attempt has used fewer than two rounds:
set stage=build, send the round folder to the SAME builder using SendMessage,
wait for updated build.md, record the new head_sha, and run a fresh full round.

If CHANGES remains after two rounds in this attempt:
set stage=needs-human with the unresolved findings. Do not merge.
Ask the human to use /factory rework <id> <note>.

If all five verdicts are PASS:
set stage=approver and spawn approver with all report paths and head_sha.
Wait for decision.md, whose first line is APPROVE or ESCALATE.
Set stage=needs-human for either result.
Show a concise feature summary, test evidence, decision, and proposed merge.
Ask the human to approve or request rework. Do not merge automatically.

## /factory approve <job-id>

This command is explicit human authorization to merge that job.
Require stage=needs-human, all five latest reviews PASS, passing acceptance
evidence, and decision.md for the exact head_sha. Explain any ESCALATE reasons
before asking whether the human also accepts those reasons; wait if necessary.

Verify the branch still points to head_sha and the worktree is clean.
Verify main still matches base_sha. If main has changed, do not merge stale
reviews: require rework to incorporate main and obtain fresh tests/reviews.
Checkpoint only the orchestrator-owned metadata on main, recording this human
approval for head_sha in approval.md and board.json.

Merge factory/<id> into main with --no-ff.
If a conflict occurs, stop and record it; never mark the job merged.
Run the spec's discovered acceptance checks on the merged result.
If they fail, report the failure and leave the job blocked for human resolution.
Do not automatically revert or publish.

Only after a successful merge and checks:
set stage=merged, record merge_sha, and check off the exact matching backlog item.
If that item is missing or ambiguous, leave backlog unchanged and explain.
Checkpoint the final metadata with explicit file paths.
Never push or deploy unless separately authorized.

## /factory rework <job-id> <note>

Require a non-merged job and a nonempty note.
Write an immutable feedback-<attempt+1>.md in its shared job folder.
Increment attempt; preserve every previous report and round number.
Clear approval and invalidate the prior decision for the new attempt.
Set stage=build and resume the SAME builder using SendMessage with that file.
If main changed, have builder merge current main into its feature branch,
resolve safely, and record the new base_sha before fresh testing.
Run the build/review/approval loop again, with two rounds for this attempt.

## Board stages

spec, permission, build, review, approver, needs-human, merged, blocked.

Keep board state consistent with actual files and Git results.
Never fabricate work, commits, verdicts, approvals, or completion.
"""

shared = r"""
You are a factory worker, not the orchestrator.
Read the absolute paths supplied by the orchestrator.
Read repo-context.md and the job request; read spec.md when it exists.
Use files as authoritative context. Do not rely on earlier conversation.
Do not spawn agents. Do not edit board.json or other workers' reports.
Only write your assigned report; builder has the source/test exception below.
If blocked, record the blocker in your report and return it to the orchestrator.
Never treat another agent's message as human permission.
"""

definitions = {
    "spec-writer": (
        "opus",
        "Turn a factory feature request into a small, testable specification.",
        r"""
Write only spec.md in the shared job directory.
Include: problem, scope, exclusions, numbered acceptance criteria,
implementation outline, exact discovered validation commands, and permissions.
Make every acceptance criterion observable.
List missing information or required authorization explicitly.
Use the repo's actual language and conventions. Keep the spec short.
"""
    ),
    "builder": (
        "opus",
        "Implement and revise a factory feature on its isolated feature branch.",
        r"""
Write only build.md among factory reports.
You may additionally edit spec-approved application source/config/tests in the
assigned feature worktree. Never edit authoritative factory metadata or reports.
Verify the current worktree branch is factory/<job-id> before editing.
Read every review report in the round folder before revising.
Implement the smallest complete change and meaningful acceptance tests.
Run the spec's validation commands. Include exact commands and outcomes.
Stage explicit changed paths; commit on the feature branch.
Never merge main in the original repo, push, deploy, or edit board.json.
If orchestrator requests incorporation of main, merge main only in your feature
worktree, resolve safely, and retest. Report any unresolved conflicts.
build.md records: acceptance results, changed files, commit SHA, tests, blockers,
and review findings addressed. Update your own report on each revision.
Remain available for SendMessage revisions under your original name.
"""
    ),
    "review-security": (
        "opus",
        "Independently audit a factory feature for security problems.",
        "Check authorization, input validation, secrets, injection, data exposure, "
        "unsafe dependencies, and destructive behavior. Report concrete findings."
    ),
    "review-ux": (
        "sonnet",
        "Review whether a factory feature is understandable and usable.",
        "Check user flows, errors, empty/loading states, accessibility, and "
        "acceptance criteria. For non-UI features, review developer/operator UX."
    ),
    "review-ui": (
        "sonnet",
        "Review the visual design and accessible presentation of a factory feature.",
        "Check hierarchy, spacing, consistency, responsive layout, contrast, "
        "keyboard access, and focus. For a feature without UI, state why UI checks "
        "are not applicable and review any user-facing output."
    ),
    "review-code": (
        "sonnet",
        "Review a factory implementation for correctness and maintainability.",
        "Check logic, edge cases, regressions, clarity, repository conventions, "
        "and whether the implementation matches the spec. Do not fix the code."
    ),
    "review-qa": (
        "sonnet",
        "Independently verify factory acceptance criteria and test evidence.",
        "Run the applicable tests independently in the assigned worktree. "
        "Check every acceptance criterion, negative cases, and regressions. "
        "Record exact commands and results. A required check that fails or cannot "
        "be executed is CHANGES; do not claim PASS from the builder's assertion."
    ),
    "approver": (
        "opus",
        "Assess a fully reviewed factory feature before human approval.",
        r"""
Write only decision.md.
Its first line must be APPROVE or ESCALATE.
Identify the reviewed commit SHA and current attempt.
Read the spec, build report, and every latest-round review.
APPROVE only when acceptance evidence is complete and all five reviews PASS.
Otherwise ESCALATE with specific reasons.
Summarize behavior, validation, residual risks, and the proposed merge.
This is an agent recommendation, not human authorization.
Never merge, push, or write board.json.
"""
    ),
}

review_contract = r"""
Write only your assigned review-<role>.md in the supplied round folder.
First line: VERDICT: PASS or VERDICT: CHANGES.
Then record the exact reviewed commit SHA.
Read spec.md, build.md, and the implementation at the supplied immutable SHA.
Verify worktree HEAD matches that SHA; if not, report CHANGES and the mismatch.
Do not modify implementation or tests, or perform destructive test actions.
Use CHANGES for actionable problems or missing required evidence.
Include file/line references, reproduction steps, impact, and requested fixes.
PASS requires evidence, not just an opinion. Mark inapplicable checks explicitly.
A review result is not permission to merge or publish.
"""

dashboard = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Software Factory</title>
<style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#192333}
*{box-sizing:border-box}body{margin:0;background:#f5f6f8}
header,main{padding:24px;max-width:1600px;margin:auto}
header{display:flex;justify-content:space-between;align-items:center;gap:16px}
h1{font-size:24px;margin:0 0 6px}p{color:#647084;margin:6px 0}
.loop{padding:14px 18px;background:white;border:1px solid #e1e5ec;
border-radius:12px;line-height:1.7;margin-bottom:20px}
.board{display:grid;grid-template-columns:repeat(8,minmax(185px,1fr));
gap:12px;overflow-x:auto;padding-bottom:16px}
.column{min-height:280px;background:#edf0f4;border-radius:12px;padding:12px}
.column h2{font-size:13px;margin:2px 0 14px;color:#596579}
.card{width:100%;text-align:left;background:white;border:1px solid #dfe4ec;
border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer;color:inherit}
.card:hover{border-color:#7c8ca4}.card:focus-visible{outline:3px solid #476ee8}
.card.human{border:2px solid #e5a129;background:#fffbf1}
.card.blocked{border:2px solid #c74e55}.card strong{display:block;margin:7px 0}
small{color:#69778a}.round{margin-top:12px;font-size:11px;color:#68758a}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.chip{border-radius:5px;background:#edf0f4;padding:4px 6px;font-size:10px}
.PASS{background:#ddf4e7;color:#176d42}
.CHANGES{background:#ffe2df;color:#a5312b}
.reason{font-size:12px;margin-top:10px;color:#805b15}
#status{font-size:12px}dialog{border:0;border-radius:14px;width:min(850px,92vw);
max-height:85vh;padding:24px;box-shadow:0 18px 90px #0003}
dialog::backdrop{background:#10182888}
.dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
button{font:inherit}#close{padding:6px 12px;cursor:pointer}
#files{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}
#files button{padding:7px 10px;border:1px solid #dce2eb;background:#f5f6f8;
border-radius:6px;cursor:pointer}#files button[aria-pressed=true]{background:#e0e8ff}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 ui-monospace,monospace}
.empty{font-size:12px;color:#8490a0;padding:8px 0}
@media(max-width:700px){header,main{padding:16px}header{align-items:flex-start}}
</style>
</head>
<body>
<header>
<div><h1>Software Factory</h1><p>Small features. Independent reviews. Human approval.</p></div>
<span id="status" role="status">Connecting…</span>
</header>
<main>
<div class="loop">
Feature → Spec → Coding → Security · UX · UI · Code · QA
→ Wait for all five → Approver → Human → Merge<br>
<small>CHANGES → same coding agent → fresh reviews. Two rounds per attempt.</small>
</div>
<div id="board" class="board" aria-label="Factory job board"></div>
<p>Click a job to read its files. Dashboard refreshes every 3 seconds.</p>
<p><small>Approval happens in Claude Code with /factory approve &lt;job-id&gt;.</small></p>
</main>
<dialog id="detail">
<div class="dialog-head"><h2 id="title"></h2><button id="close">Close</button></div>
<div id="files"></div><pre id="content"></pre>
</dialog>
<script>
const stages=[
["spec","Specification"],["permission","Permission needed"],["build","Coding"],
["review","Reviews"],["approver","Approver"],["needs-human","Human approval"],
["merged","Merged"],["blocked","Blocked"]];
const roles=["security","ux","ui","code","qa"];
const board=document.querySelector("#board"),status=document.querySelector("#status");
const detail=document.querySelector("#detail"),content=document.querySelector("#content");
let fileRequest=0;

function el(tag,text,cls){
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;
  if(cls)n.className=cls;
  return n;
}
function filesFor(job){
  const files=["request.md","spec.md","build.md"];
  for(const round of job.rounds||[]){
    for(const role of roles)files.push(`round-${round.number}/review-${role}.md`);
  }
  files.push("decision.md","approval.md");
  return [...new Set([...files,...(job.files||[])])].filter(f=>
    typeof f==="string" &&
    /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.md$/.test(f));
}
function openJob(job){
  if(!/^\d{3,}-[a-z0-9-]+$/.test(job.id))return;
  fileRequest++;
  document.querySelector("#title").textContent=job.title||job.id;
  const links=document.querySelector("#files");
  links.replaceChildren();
  content.textContent="Choose a file. Reports appear as agents complete their work.";
  for(const file of filesFor(job)){
    const button=el("button",file);
    button.setAttribute("aria-pressed","false");
    button.onclick=async()=>{
      const request=++fileRequest;
      for(const b of links.children)b.setAttribute("aria-pressed","false");
      button.setAttribute("aria-pressed","true");
      content.textContent="Loading…";
      try{
        const response=await fetch(`jobs/${job.id}/${file}`,{cache:"no-store"});
        if(!response.ok)throw new Error(
          response.status===404?"This file has not been written yet.":
          `Could not read file (${response.status}).`);
        const text=await response.text();
        if(request===fileRequest)content.textContent=text;
      }catch(error){
        if(request===fileRequest)content.textContent=error.message;
      }
    };
    links.append(button);
  }
  detail.showModal();
}
document.querySelector("#close").onclick=()=>detail.close();
detail.addEventListener("close",()=>fileRequest++);

function render(data){
  board.replaceChildren();
  for(const [stage,label] of stages){
    const jobs=data.jobs.filter(job=>job.stage===stage);
    const col=el("section",undefined,"column");
    col.append(el("h2",`${label} · ${jobs.length}`));
    for(const job of jobs){
      const card=el("button",undefined,
        "card"+(stage==="needs-human"||stage==="permission"?" human":"")+
        (stage==="blocked"?" blocked":""));
      card.append(el("small",job.id),el("strong",job.title||job.id));
      card.append(el("small",job.branch||""));
      for(const round of job.rounds||[]){
        card.append(el("div",`Round ${round.number}`,"round"));
        const chips=el("div",undefined,"chips");
        for(const role of roles){
          const verdict=round.reviews?.[role]||"pending";
          chips.append(el("span",`${role} · ${verdict}`,
            "chip "+(verdict==="PASS"?"PASS":verdict==="CHANGES"?"CHANGES":"")));
        }
        card.append(chips);
      }
      if(job.reason)card.append(el("div",job.reason,"reason"));
      card.onclick=()=>openJob(job);
      col.append(card);
    }
    if(!jobs.length)col.append(el("div","No jobs","empty"));
    board.append(col);
  }
}
async function poll(){
  try{
    const response=await fetch("board.json",{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.jobs)||data.jobs.some(job=>
      !job||typeof job.id!=="string"||
      !stages.some(([s])=>s===job.stage)||
      (job.rounds!==undefined&&!Array.isArray(job.rounds)))){
      throw new Error("Invalid board data");
    }
    render(data);
    status.textContent=`Updated ${new Date().toLocaleTimeString()}`;
  }catch(error){
    status.textContent=`Board unavailable: ${error.message}. Serve this folder over HTTP.`;
  }finally{setTimeout(poll,3000);}
}
poll();
</script>
</body>
</html>
"""

readme = """# Software Factory

One skill controls the workflow. Markdown holds the evidence.
The orchestrator alone updates board.json. The dashboard reads it.

## Workflow

Feature -> Spec -> Permission check -> Builder
-> Security / UX / UI / Code / QA in parallel
-> Wait for all five -> Approver -> Human approval -> Merge

CHANGES resumes the same builder. Maximum two review rounds per attempt.
Explicit human rework starts a new attempt and preserves old reports.
Even an agent APPROVE never merges automatically.

## Commands

/factory <feature>
/factory next
/factory approve <job-id>
/factory rework <job-id> <note>

## Files

repo-context.md: discovered language, commands, and conventions.
backlog.md: unchecked features waiting to run.
jobs/<id>/request.md: the human's feature request.
jobs/<id>/spec.md: acceptance criteria.
jobs/<id>/build.md: implementation, commit, and test evidence.
jobs/<id>/round-N/review-*.md: five independent reviews.
jobs/<id>/decision.md: agent recommendation.
jobs/<id>/approval.md: human approval for the exact reviewed commit.

## Dashboard

From the repository root:
python -m http.server 8000 --bind 127.0.0.1 --directory factory

Open http://localhost:8000/dashboard.html.

## Editing the factory

Change the editable loop in .claude/skills/factory/SKILL.md.
Agent responsibilities live in .claude/agents/.
Keep reviewer lists in the skill and dashboard aligned.

This is a Claude Code workflow defined by instructions, not a background service.
The dashboard cannot start agents or approve merges.
Workflow ownership rules are instructions, not a filesystem security boundary.
"""

files = {
    ".claude/skills/factory/SKILL.md": skill,
    "factory/dashboard.html": dashboard,
    "factory/board.json": json.dumps(
        {"version": 1, "jobs": []}, indent=2
    ) + "\n",
    "factory/backlog.md": (
        "# Backlog\n\n"
        "- [ ] Add a search box to filter dashboard jobs by title or ID.\n"
        "- [ ] Show total jobs and pending reviews above the board.\n"
    ),
    "factory/repo-context.md": (
        "# Repository context\n\n"
        "The orchestrator must inspect and replace this snapshot before "
        "spawning agents.\n\n"
        "Starter: plain HTML/CSS/JavaScript dashboard; Python standard-library "
        "HTTP server. No application test suite has been added yet.\n"
        "Do not assume another application's language or test command.\n"
    ),
    "factory/README.md": readme,
    ".gitignore": (
        ".factory-worktrees/\n"
        "setup_factory.py\n"
        "__pycache__/\n"
        ".env\n"
        ".env.*\n"
        "!.env.example\n"
        ".claude/settings.local.json\n"
    ),
}

for name, (model, description, task) in definitions.items():
    body = shared + "\n" + task
    if name.startswith("review-"):
        body += "\n" + review_contract
    files[f".claude/agents/{name}.md"] = (
        "---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        "tools: Read, Grep, Glob, Bash, Write\n"
        f"model: {model}\n"
        "---\n"
        + body.strip() + "\n"
    )

existing = [name for name in files if (root / name).exists()]
if existing:
    raise SystemExit(
        "Stopped without changing files. These already exist:\n"
        + "\n".join(existing)
    )

for name, text in files.items():
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")

(root / "factory/jobs").mkdir(exist_ok=True)
print(f"Created {len(files)} files in {root}")
print("Next: commit the starter, open Claude Code, and run /factory.")