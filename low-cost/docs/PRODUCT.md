# Product and feature workflow

Install the same shared package from a trusted checkout. Updates reach an installed application only when its setup command is run again.

## Beginner setup

1. Open your application in the selected edition owner.
2. Run node factory/setup.mjs --project <app> from the trusted checkout and choose the edition. Setup preserves the app, installs local files/checks and prints a private dashboard link; it makes no paid calls.
3. Keep its server running. Invoke the installed factory skill to connect the actual owner and verify Owner listening. An idle/closed chat cannot receive commands automatically.
4. Resolve local tools/login/permissions using Setup & connections. Live checks require separate explicit usage consent.
5. Choose complete product or feature, enter its name, requirements, target branch and optional design reference.
6. Start authorizes a new named branch and feasibility analysis. Review and approve every stage; inspect the code and app locally before merging.

## Choose the mode explicitly

Product mode plans a complete app before delivering features one at a time. Feature mode handles one scoped change. With the default single-repository policy, every product and feature receives a separate named branch. Product features target the product branch; the product targets the chosen base branch. A standalone feature targets its chosen branch directly.

With workspace.policy=current-branches, each request selects allowed repositories on their pinned existing branches. Changes are visible before acceptance; integration accepts a reviewed set of commits without branch creation or a Git merge. See the [complete setup and command guide](../../factory/README.md).

## Requirements and roadmap

Product preparation: feasibility → requirements → specification/roadmap → system/UI design. Approve each deliverable before the next stage. The roadmap maps every mandatory requirement to a feature and verification step, with unique IDs, acceptance criteria and dependencies on earlier features. Plans bind actual repository/base/target, permissions, budget and both guides. No source implementation before approved design.

Each feature follows requirements → specification → design → implementation → testing/QA → integration review. A standalone feature starts with feasibility too. Approved product material can be referenced without duplicate documents. Request changes returns to the selected current/earlier stage, archives history and invalidates downstream consent/evidence. Material scope/permission/budget changes need an updated specification.

## Follow a supplied design

Show readable architecture, data models, API examples and screens in App & design. Where supported, create a clickable local prototype within the approved design scope. A URL alone proves neither actual access nor rendered fidelity. Use actual reference exports/screenshots for fidelity claims and report missing access/browser/assets as unverified or blocked.

## Human-approved sequential execution

After approved product design, choose Start next feature. It creates the feature branch from the current accepted product head. Keep the normal application folder checked out on this branch, so changes are visible in your editor. Existing unrelated changes are preserved; resolve them before branch creation. Separate worktrees are optional, never the default.

One stable builder implements the feature. Complete the developer guide and end-user manual as Microsoft Word .docx files before presenting the implementation commit. Update the same two files across features. Render and inspect all pages and record the exact file hash; unavailable tooling remains blocked. Download the committed Word files from Documentation. Inspect its local preview/files/diff, then authorize formal QA. Five independent reviewers and the technical approver inspect the same frozen source/docs commit. Each acceptance criterion maps to a real passing check; fixes return to the same builder and refresh affected approvals.

Approve the exact feature merge separately. After actual post-merge checks it is accepted into the product branch. Then the factory WAITS for Start next feature; integration consent never authorizes another feature automatically. Failed integration blocks the queue and preserves Git for recovery. Branches remain available for inspection.

After all features are accepted, explicitly start product acceptance: complete journeys/regressions, design/guide checks, five fresh independent final-product reviews and technical approver. Child verdicts cannot approve the aggregate. Approve acceptance, inspect the final merge offer, then separately approve product-to-target merge and post-merge checks. Push, deployment and branch deletion remain separate.

## Help and hints

Use the header Help button or $factory help / /factory help for the complete action reference. Help is read-only and works with a disconnected owner. Its catalog explains purposes, requirements and examples; workflow decisions remain distinct from terminal commands. The dashboard hint stays visible and Factory replies include a short edition-specific help hint.

## One dashboard for visibility and control

| View | Contents |
| --- | --- |
| Product board | Ordered features, dependencies, current stage, blockers and next human decision |
| Workflow & features | Stage deliverables, locked/approved steps, decisions, acceptance coverage and roadmap |
| Workspace & changes | Absolute app folder, actual/expected branch, target, HEAD, uncommitted paths and requested diff |
| App & design | Local app/prototype URL and served commit, readable system/UI design and limitations |
| Agents | Ten configured roles versus actual owner-reported worker runs, tasks, status, models and known usage |
| Tests & reviews | Current commit-bound acceptance and five independent review results |
| Documentation | Developer and end-user Word downloads, actual committed paths, page-review evidence and brief summaries |
| Setup & connections | Local prerequisites, owner listening, model/continuation evidence and next actions |
| Integrations | Optional role-specific tools, scopes, availability/verification and actual receipts |
| Usage / Activity | Measured counters/completeness, budgets, command receipts and decisions |

Approve & continue submits directly and authorizes only the next displayed stage. One approval through chat OR the dashboard is sufficient for the exact offer. Routine fixes, tests, reviews and evidence-only reruns within an approved stage continue without repeated questions. Source fixes discovered during QA still use the actual implementation revision checkpoint. Request changes, Pause and Cancel remain available at appropriate checkpoints. Routine in-scope commands do not need another dashboard confirmation. Native security/login approvals remain native. Owner disconnected disables dependent actions. Worker registration does not launch or independently verify an agent.

## Pause, changes and recovery

Pause/cancel is pending until the owner confirms actual workers/tools have stopped. Preserve partial changes, identities, receipts and usage. Restart expires pending commands and marks running commands/workers/tools uncertain; never automatically relaunch or replay a merge. Reconcile the same owner/processes and actual Git first. Changed target heads or frozen code invalidate affected approvals/checks. Failed post-merge checks stop progress without silently resetting branches.

Legacy active jobs require explicit Adopt staged workflow. Previous work and approvals remain archived, but all new stages need actual approval. Terminal legacy history remains readable.

## Installed entry points

Use node factory/runtime/cli.mjs start, check or status from the installed app. The actual owner follows the [bridge protocol](../../factory/runtime/WORKFLOW.md), including worker and workspace operations. No manual JSON board or separate dashboard framework is needed.

## Maintainer checks and limits

Run node factory/setup.mjs --verify and the offline tests from the checkout. [Metadata helpers](../../codex-claude/maintenance/README.md) remain optional references, not runtime dependencies. Fixtures do not prove live provider access, actual independent reviewer execution, browser fidelity or an accepted app. The dashboard cannot sandbox native edits performed outside its bridge. Private jobs/stage records/results stay lazily under ignored factory/.local; update existing app docs instead of generating separate stage reports.

## Commands and owner replacement

The [step-by-step guide](../../factory/README.md#13-command-reference-all-20-runtime-operations) explains all 20 runtime operations, with working-directory examples for dashboard startup and owner polling. Factory Next is a Halo-local helper name for the same service, not another edition or a shipped command. The local owner release command allows an explicitly authorized replacement only when the owner is disconnected, all jobs are finished/cancelled and activity is reconciled. It preserves history and invalidates old host-access checks; it never transfers unfinished work. See the [release protocol](../../factory/runtime/WORKFLOW.md#explicit-release-of-a-disconnected-owner).
