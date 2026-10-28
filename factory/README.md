# Factory: step-by-step guide

Use this guide to install Factory, open its dashboard and deliver work with your assistant. Daily use happens in the dashboard; the advanced command reference is for the owner/runner.

**Need help at any step?** Click **Help** in the dashboard header, type **$factory help** in Codex or **/factory help** in Claude, or run **node factory/runtime/cli.mjs help** in a terminal. The dashboard keeps a shortcut hint visible; Factory replies end with the edition's short help hint. Help lists purposes, when to use each action, requirements and examples without executing them.

## 1. Prepare and choose an edition

You need Node.js **22 or newer**, Git, an existing application folder and the tools/accounts for your chosen edition. The dashboard needs no npm install, framework build or Python server.

| Edition flag | Owner | Workers |
| --- | --- | --- |
| claude-only | Existing Claude Code session | Claude |
| codex-claude | Existing Codex session | Codex technical reviewers and Claude specialists |
| low-cost | DeepSeek tool-calling runner | DeepSeek, Qwen and Kimi |

Models and ten role assignments are recorded in the app's factory/config.json. Configuration alone does not verify model availability. The API edition requires an existing or separately implemented provider runner with real read/search/write/test/Git tools. The package supplies its control interface, not that runner.

Keep your current app source, guides and settings. Review existing edits before branch preparation. An empty project needs a scoped, approved Git baseline before specification; setup does not create an app baseline.

## 2. Install from the trusted package checkout

In a terminal **at the software-factory repository root**:

~~~powershell
node factory/setup.mjs --project "D:\my-app" --edition codex-claude
~~~

Replace the folder and edition. Omit --edition to select it interactively. Review the local file proposal and approve setup once. The installer verifies its package, preserves existing work, records local checks and opens a private dashboard link. Keep its terminal running.

Setup authorizes local factory files only. Provider login, paid checks, dependency installs, app coding and publishing have their own scope. An assistant given an edition setup prompt can complete already-authorized setup and connect the owner in the same pass.

Useful setup options, used **from the package checkout**:

| Option | Use |
| --- | --- |
| --no-open | Print the link without opening a browser |
| --no-serve | Install only; start the dashboard later |
| --yes | Accept already-authorized local setup in automation; provide project and edition too |
| --purpose web-to-mobile | Make mobile conversion the default request purpose |
| --integrations context7,graphify | Enable selected optional integrations; no installs or remote calls |
| --workspace current-branches --repositories frontend,backend | Coordinate selected existing repositories |
| --migrate-launcher | Explicitly archive/replace an unmanaged hybrid Claude forwarder; other conflicts still stop |

For the full list, run:

~~~powershell
node factory/setup.mjs --help
~~~

## 3. Open or reopen the dashboard

Setup opens it the first time. Later, open a terminal **in your installed application folder**:

~~~powershell
cd D:\my-app
node factory/runtime/cli.mjs start
~~~

Open the private http://127.0.0.1:PORT/#KEY link printed in that terminal. Keep it running. The port is normally selected automatically; --port 56057 requests a specific port. Add --no-open to print the link without opening it.

The dashboard serves only on your local computer. Keep its pairing link private. After a server restart, use the newly printed link; old pairing keys stop working.

To stop the dashboard, first pause/finish active work and reconcile workers/tools. Then press **Ctrl+C** in its terminal. Do not start another server over an existing server lock.

## 4. Connect the owner and check readiness

Open the **application folder** in your assistant and invoke:

| Edition | Chat instruction |
| --- | --- |
| Claude only | **/factory** in Claude Code |
| Codex + Claude | **$factory** in Codex; Claude **/factory** forwards to this owner |
| API providers | Connect the actual DeepSeek runner through the owner API |

Look for **Owner listening**. **Owner paired** means its lease is connected, but it may be between polls. **Owner disconnected** means dependent controls cannot run. An idle or closed chat cannot receive commands automatically. If skill discovery fails, ask the assistant to read factory/runtime/WORKFLOW.md from the application root.

In **Setup & connections**, resolve the displayed missing tools, login and permissions. **Recheck local setup** makes no model calls. **Check live access** separately authorizes bounded paid probes and builder continuation checks in the real worker environment. Failed or unavailable checks stay visible; local pairing does not verify a model.

## 5. Create a request

Click **New request** and choose each of these:

| Choice | Options |
| --- | --- |
| Workflow | Streamlined (default) or Strict |
| Scope | Complete product, or one feature/change |
| Purpose | Software development, or web app to mobile app |
| Repository policy | Separate branches in one app, or configured existing branches across repositories |

**Streamlined** asks for one decision up front: a complete master plan with requirements, design, feature scope and budget, prepared from your current code. You approve it once, then explicitly start each feature. **Strict** keeps a separate approval at every stage. Jobs created before this version stay Strict until you switch them; the choice is recorded per request and cannot be changed by editing a plan document.

Enter a clear title, requirements and optional design-reference URL. With the normal policy, enter the target branch. With a configured multi-repository workspace, select the exact repositories this request may change. **Start feasibility** authorizes analysis, not implementation.

Example requirements: “Customers can sign in, update their profile and recover a forgotten password. Explain any missing backend support before implementation.”

## 6. Follow the stages

### Streamlined

| Checkpoint | What you review | What approval permits |
| --- | --- | --- |
| Master plan | Requirements, scope, design, feature roadmap, code analysis, permissions and budget | Starting features |
| Start next feature | The inherited brief and its recorded readiness checks | Implementation, guides, tests, QA and five reviews for that feature |
| Feature integration | The exact reviewed commit or repository snapshot | Integration and verification checks |
| Product acceptance | Whole-product journeys, guides and fresh aggregate reviews | The final integration offer |

Implementation, documentation, testing, QA and reviewer work run inside the Start-feature consent and do not stop for separate approvals. Features still run one at a time, and **Start next feature** is always explicit. A numeric master budget caps the sum of reported feature costs; exceeding it blocks the job until you revise the approved budget.

### Strict

| Stage | What you review | What approval permits |
| --- | --- | --- |
| Feasibility | Dependencies, risks and blockers | Requirements analysis |
| Requirements | Intended behavior and acceptance criteria | Specification and plan |
| Specification | Scope, permissions, budget, baseline, features and guide coverage | System/UI design |
| Design | Architecture, data/API contracts, screens and available prototype | Implementation, or the product's next-feature checkpoint |
| Implementation | Committed code, both Word guides and local preview/limitations | Formal QA |
| QA | Checks, criterion coverage, five reviews and technical approver | Prepare the integration offer |
| Integration | Exact reviewed commit or repository snapshot | Integration and verification checks |

Click **Approve & continue** once after reading the displayed stage. It submits directly. An exact approval in chat or the dashboard is sufficient; the owner records it through the same bridge. Duplicate submissions are guarded. Routine fixes, builds, guide rendering, reviewer work and evidence-only reruns within the authorized stage continue without extra questions. Source changes discovered during QA return to the actual implementation revision checkpoint.

Use **Request changes** to return to the current or an earlier stage. Previous work remains in history; affected downstream evidence and approvals are refreshed. Material changes to scope, permissions or budget require the corresponding revision.

An approval is **Pending** until received, **Running** after acknowledgment, and **Completed** after the owner reaches the next checkpoint. A technical approver's recommendation does not replace your integration approval.

## 7. Inspect the app and finish a product

**Workspace & changes** shows the actual folder, branch, HEAD and changed paths. Load its diff when you want to inspect tracked changes. Open that application folder in your editor. Preserve unrelated edits and deliberately commit intended files; setup never blanket-stages your app.

**App & design** links to the app server reported by the owner and shows its served version. Starting the factory dashboard does not start your app server. Use your app's actual development command or the run instructions supplied by the owner; each app can differ. Missing browser/prototype support must be reported as a limitation.

For products, preparation covers feasibility, requirements, specification and design. Then choose **Start next feature**. Each feature goes through requirements, specification, design, implementation, QA and integration. Features run one at a time and wait after accepted integration. Failed verification stops progress and preserves Git.

After every feature is accepted, choose **Start product acceptance**. The owner runs whole-product journeys, checks the guides and obtains five fresh independent reviews plus the approver. Approve acceptance, then separately review the final product integration offer. Push, deployment, signing/publishing and branch deletion need their actual scope.

## 8. Find results in the dashboard

| View | What it shows |
| --- | --- |
| Overview | Current work, readiness and recent activity |
| Setup & connections | Local prerequisites, owner status and live checks |
| Integrations | Enabled tools, private credential forms and tool receipts |
| Workflow & features | Current deliverable, dependencies and approval history |
| Web to mobile | Source analysis, route mapping, proposed roadmap and device evidence |
| Workspace & changes | Local repos, files, branches and requested diff |
| App & design | App preview, served version and design |
| Agents | Ten configured roles and actual owner-reported worker runs |
| Tests & reviews | Commit-bound checks and five independent review results |
| Plan | The approved master plan, editable drafts, change impact and version history |
| Design | Sample screens and a clickable local prototype |
| Features | Per-feature briefs, readiness and progress |
| Files | Word exports of the master plan and feature briefs |
| Documentation | Downloadable developer guide and end-user manual |
| Usage | Known tokens/cost, budget and reporting completeness |
| Activity | Queued commands, receipts and project events |
| Help (header button) | Search every action, purpose, requirements and reference example; works with a disconnected owner |

### Edit the plan, review the design, export to Word

**Plan → Edit plan** saves a draft without touching the approved version. **Compare changes** shows which features a draft affects, which it removes and which stay shared. **Submit revision** promotes the draft to a new version and asks for approval again; the previous version stays readable, and removed features keep their recorded evidence. **Regenerate** reanalyses the current code without discarding accepted scope. Repository selection, target branch and baseline cannot be changed by editing a plan document — those need an explicit workspace reconciliation. A plan you no longer want goes to **Plan trash** and can be restored; trashing never discards workspace metadata.

**Design** shows generated sample screens for the planned app and a clickable local prototype. Select a layout and save feedback into planning. Previews render from plan text only, carry their own strict content policy and have no network access.

**Files → Prepare Word download** builds a version-bound .docx of the master plan or a feature brief, including scope, contracts, acceptance, design previews and decisions. The download becomes available only after the owner renders it and genuinely inspects every page. Rendering uses installed Microsoft Word and an isolated local Chrome/Edge; on hosts without them the export reports the missing capability instead of claiming a layout pass. No external rendering service is used.

The two app guides are Microsoft Word .docx files, reused across features. The writer renders and visually inspects every page before marking them complete. Downloads use exact registered committed bytes matching the reviewed hash. Rendering images and logs remain private. Runtime instruction files remain Markdown.

Unknown usage is shown as unavailable, not zero. API-equivalent cost differs from actual subscription billing. Observed time includes human waits; tool/cache counts do not prove savings.

## 9. Work across existing repositories

From the **package checkout**, install in a parent folder with exact repository paths:

~~~powershell
node factory/setup.mjs --project "D:\my-workspace" --edition codex-claude --workspace current-branches --repositories frontend,backend
~~~

Setup pins their current named branches. Each request selects its writable repositories from that allowlist. Selected repos need committed baselines and reconciled edits before preparation. Unselected repos and the parent folder can retain unrelated edits.

This policy creates no product/feature branches and performs no Git merge. Changes are visible on existing branches before acceptance. The owner captures a clean set of actual commits; checks/reviews bind to its snapshot ID. **Approve integration** accepts that exact set and runs integration checks. Expanding writable scope requires a new request or explicitly reviewed migration.

## 10. Convert a web app to mobile

Use a **separate, non-nested mobile output repository**. The frontend is read-only reference material and the existing backend is reused. Multi-repository editing mode cannot be used for a web-to-mobile request.

For a dedicated mobile installation, run from the **package checkout**:

~~~powershell
node factory/setup.mjs --project "D:\mobile-app" --edition codex-claude --purpose web-to-mobile
~~~

Alternatively choose **Web app to mobile app** in a new request. Supply the frontend's absolute local Git root or credential-free HTTPS Git URL, Android/iOS platforms, preferred approach (assess, Expo native or Capacitor) and optional public backend address.

The owner analyses a pinned frontend commit, discovers screens/API/auth constraints and proposes a roadmap. Missing backend support blocks implementation. A roadmap proposal can also be shown while foundation work is active; **Proposed** is planning data and grants no execution approval. The formal feature queue shows actual delivery status. Portal labels come from the proposal, so different apps can use their own roles.

Follow the usual approvals. QA needs API-parity checks and actual device/emulator results for every planned platform at the reviewed version. A browser preview does not establish device success. iOS native builds need suitable Apple tooling or separately approved cloud builds. Dependencies, devices, signing, production writes and store publishing need their authorized scope.

## 11. Optional integrations and host permissions

Bundled Agent Skills are always available. Four external integrations default off:

| Integration | Purpose |
| --- | --- |
| Context7 | Focused library documentation for an installed version |
| Graphify | Local code-only index and dependency context |
| 21st.dev | UI catalog and separately approved generation |
| Strix | Scan an approved URL with model/budget/turn limits |

Enable tools in **Integrations** while work is idle and reconciled. Availability is distinct from a verified real connection. Tool use needs request/plan scope. Enabling a tool does not authorize dependency installation, publishing or source uploads.

Enter keys only in the masked integration fields or server environment. Saved keys override environment values. Removing them restores environment fallback. Windows storage is encrypted for the current user; other platforms use a local owner-only file. Keys never enter config, public state, prompts or Git. Credentials/settings changes revoke affected offers and require a specification revision.

Factory's stage decisions and host command permissions are separate. Use existing host permissions for routine authorized work. Optional Codex **Full access** requires your explicit choice; Factory installation never enables it. Where supported, the corresponding settings are approval_policy = "never" and sandbox_mode = "danger-full-access". This permits broad local filesystem/network actions; host/managed policy can override settings. See [official OpenAI permissions guidance](https://learn.chatgpt.com/docs/sandboxing). Factory cannot change the active host profile or approve security dialogs for you.

## 12. Pause, reconnect and recover

- **Pause/Cancel:** the owner stops dispatch and reconciles actual workers/tools before confirming. A request is not confirmation. Partial work and history remain available.
- **Resume:** continue the same stage after reconciliation; changed scope or frozen source requires its real revision gate.
- **Restart:** start the dashboard again and reconnect the same owner. Pending commands expire; running commands/workers/tools become uncertain. Inspect actual results and reconcile without replaying paid work or a merge.
- **Changed branch/commit:** preserve Git, reconcile the actual result and request the appropriate revision. Never reset branches to force an approval through.
- **Legacy active job:** choose **Adopt staged workflow**. Previous work is archived, and new stages need fresh decisions.
- **Interrupted publication:** the original connected owner can recover the existing command and publish the result it already has, without relaunching a worker or repeating a paid call. Recovery refuses pause, cancel and integration commands, and a recovered command cannot dispatch workers, start tools or touch the workspace — reconcile those actual side effects first.
- **Queued decision after a reconnect:** an exact stage approval stays valid across elapsed time and reconnection. It is still revoked if the offer, the plan, the source or the security configuration changed.
- **Switch an existing job to Streamlined:** choose **Migrate**, which is reversible until execution starts. Rollback is refused once fresh workers, usage or acceptance receipts exist, and after a security configuration change.

### Release an idle disconnected owner

Use this only after explicit authorization to replace a stale owner. It refuses a connected/listening owner, unfinished jobs and outstanding commands/workers/tools. The original owner must reconcile unfinished work first.

The owner inspects private state and writes a payload containing expected_owner_id, expected_generation, current revision and the authorized note. Then, **from the application root**:

~~~powershell
node factory/runtime/cli.mjs owner release --session ACTUAL_NEW_SESSION_ID --runtime codex --file factory/.local/owner-release.json
~~~

Use claude or deepseek for those editions. Release preserves history, clears registration and resets host-specific access checks. It never kills processes. Connect the new actual session normally and reverify access. Detailed rules are in [WORKFLOW.md](runtime/WORKFLOW.md#explicit-release-of-a-disconnected-owner).

## 13. Command reference: all 23 runtime operations

The shared action catalog is available through **Help** in the dashboard, **$factory help** / **/factory help** in chat, and these terminal forms:

~~~powershell
node factory/runtime/cli.mjs help
node factory/runtime/cli.mjs --help
node factory/runtime/cli.mjs help next
node factory/runtime/cli.mjs owner next --help
node factory/runtime/cli.mjs help workflow
node factory/runtime/cli.mjs help --json
~~~

Help needs no owner session or running dashboard. Terminal help also works before installation when invoked using this package checkout's CLI path. It is an additional read-only entry point alongside the twenty-three operational commands. Everyday operations, workflow decisions and advanced owner operations are grouped separately. Workflow decisions are dashboard/chat approvals, not extra terminal subcommands. Required arguments and examples come from runtime/help.mjs, also used by the dashboard. Replace uppercase example placeholders with actual values; help never executes them. A host must discover the installed skill before its chat shortcut can work. The API-provider edition uses the dashboard or terminal reference.

Run these **from the installed application root**. These are terminal operations, not twenty separate skills. **$factory** and **/factory** invoke chat skills; a phrase such as **$factory next** asks that assistant to handle the factory, rather than defining a terminal subcommand. Halo's private **Factory Next** helpers launch/poll this same service and are not another edition or an included script.

### Six general operations

Prefix each operation with **node factory/runtime/cli.mjs**:

| Operation | Purpose/example suffix |
| --- | --- |
| start | Open the dashboard; optional --port 56057 --no-open |
| check | Refresh local prerequisites without model calls |
| status | Show jobs and outstanding-command summaries |
| role-context | Get a role's assigned skill/tools: --role builder |
| integrations | Show integration status and receipts |
| inspect-frontend | Inspect committed frontend candidates: --source "D:\web-app" |

Each supports --project "D:\my-app" for an explicit application root. Frontend inspection belongs in a separate mobile output workspace and does not execute scripts or fetch remotes.

### Seventeen owner operations

These are for the actual assistant/runner. Prefix each with **node factory/runtime/cli.mjs owner** and supply **--session ACTUAL_SESSION_ID**.

| Operation | Purpose | Additional arguments |
| --- | --- | --- |
| connect | Register/reconnect the actual owner | --runtime codex (or claude / deepseek) |
| next | Wait for the next queued instruction | Optional --wait 50000 (0–55000 ms) |
| heartbeat | Renew the owner lease | None |
| publish | Report progress or a stage deliverable | --file factory/.local/publish.json |
| worker | Record actual worker execution/reconciliation | --file factory/.local/worker.json |
| workspace | Prepare branches/repos, snapshot or verify integration | --file factory/.local/workspace.json |
| checks | Record authorized live-access evidence | --file factory/.local/checks.json |
| tool | Start an approved scoped integration | --file factory/.local/tool.json |
| tool-result | Read a reserved invocation's result | --file factory/.local/tool-id.json |
| tool-cancel | Request cancellation during pause/cancel | --file factory/.local/tool-id.json |
| tool-reconcile | Record conclusive interruption reconciliation | --file factory/.local/tool-reconcile.json |
| feature-readiness | Record a planned feature's actual readiness check results | --file factory/.local/readiness.json |
| review-plan-export | Register genuine page-by-page inspection of a rendered plan | --file factory/.local/plan-review.json |
| recover-command | Resume an interrupted command for publication only | --file factory/.local/recover.json |
| finish | Complete/block/fail the current command | --file factory/.local/finish.json |
| disconnect | Disconnect owner; unfinished commands become uncertain | None |
| release | Release a reviewed idle disconnected binding | --runtime codex --file factory/.local/owner-release.json |

Example owner connection and poll, **from the application root**:

~~~powershell
node factory/runtime/cli.mjs owner connect --session ACTUAL_SESSION_ID --runtime codex
node factory/runtime/cli.mjs owner next --session ACTUAL_SESSION_ID --wait 50000
~~~

The next operation claims a queued instruction once. If none arrives before the wait ends it returns no command. It never grants approval or automatically starts a feature. The owner keeps listening and heartbeats at least every 60 seconds during long work; the lease lasts 90 seconds.

JSON filenames above are examples, not files setup creates. The owner writes actual current IDs, bindings and evidence privately. Read the [owner protocol](runtime/WORKFLOW.md) for schemas; do not fabricate successful evidence or edit normalized state manually.

## 14. Upgrade and troubleshoot

For an upgrade, stop/reconcile the owner/server, then rerun the original setup command **from a trusted package checkout**. Versioned upgrades preserve config, jobs, sessions, receipts and usage. Changed managed files or unmanaged legacy factories stop for a reviewed migration. A custom Halo-style installation may need reconciliation; copying files over it is not an upgrade procedure.

| Problem | Next step |
| --- | --- |
| Dashboard does not open | Run start in the installed app; use its printed link; try --no-open |
| Link no longer connects | Use the current server's private link; restart rotates keys |
| Owner disconnected | Invoke the edition skill in the original session and verify listening |
| Missing CLI/login/model | Follow checklist/native permissions; executable presence is not proof of access |
| Action stays pending | Owner must poll and acknowledge it; inspect Activity |
| Offer expired/changed | Refresh and review the current deliverable |
| Branch preparation blocked | Reconcile intended edits/baseline without discarding unrelated files |
| Word guide incomplete | Complete authoring/rendering/page review before implementation approval |
| Server/write lock remains | Inspect PID/processes, reconcile and remove only a conclusively stale lock |
| Integration checks fail | Preserve Git, stop the queue and revise the appropriate earlier stage |

Private .local/ contains credentials, pairing data, jobs, logs, receipts, usage, branch intents and caches. Do not copy it into another project, delete it wholesale, serve it with a generic static server or commit it.

The installed layout is factory/README.md, config.json, runtime/, dashboard/ and lazily created .local/, plus necessary native discovery launchers. There are no empty boards, copied setup prompts or duplicate app guides. The source checkout also contains the installer, checksum manifest and offline tests.

Offline tests verify installer/bridge behavior, not live provider identity, reviewer quality, browser fidelity or a completed app. Native writes outside the bridge still need the owner's scope checks. See [WORKFLOW.md](runtime/WORKFLOW.md) for precise execution/recovery rules.
