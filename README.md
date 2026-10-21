# Software Factory

Install one reusable development dashboard inside your application. Choose an edition, finish local setup once, then use the dashboard to submit requirements, approve plans, follow builds/reviews and approve the final merge.

## Start

Clone a trusted version of this repository and run from its root with Node.js 22+:

~~~powershell
node factory/setup.mjs --project 'D:\my-app'
~~~

Choose the edition, review the local changes and approve setup. The command installs the tested shared package, checks prerequisites and opens one private dashboard link. Keep its terminal running. No npm install, Python dashboard server, paid probe or app build happens during setup.

| Edition | Owner and requirements | Setup prompt |
| --- | --- | --- |
| Claude only | Claude Code; no Codex files or checks | [Claude setup](claude-only/GENERATION.md) |
| Codex + Claude | Codex owner and Claude workers | [Hybrid setup](codex-claude/GENERATION.md) |
| API providers | DeepSeek tool-calling owner, Qwen and Kimi access | [API setup](low-cost/GENERATION.md) |

You can also open your app in the chosen assistant and provide its setup prompt with access to this checkout. It should complete the already-authorized local setup and connect the owner in the same pass. Plain terminal installation cannot wake an idle assistant: invoke the installed factory skill if the owner is not yet listening. The API edition still requires a real provider coding runner; the shared package does not bundle one or prove provider access.

## Daily use

Open the dashboard and follow its setup checklist. Missing login, tools, model access or native permissions show a specific next action. Live checks require explicit consent and can consume usage. Local pairing is distinct from verified model identity and an active owner listener.

Choose **Build a complete app** or **Add or change a feature** and enter a name/target/requirements. Approve feasibility, requirements, specification and design separately. Every product/feature gets a fresh named branch in your application folder. Inspect the local app and diff before authorizing QA, then approve the exact feature merge and post-merge checks. Product features run one at a time and WAIT for **Start next feature**. After all features are accepted, explicitly start aggregate acceptance and separately approve the product-to-target merge. Push/deployment and branch deletion are separate.

The existing owner carries out requests; the browser never runs arbitrary shell commands. A disconnected owner disables dependent controls. Pending, Running and Completed have separate receipts. Restart/reconnect marks interrupted activity uncertain and never replays approvals or paid work. Workspace shows local branch/files/diff; Agents distinguishes ten configured roles from actual owner-reported executions. Active legacy jobs require explicit staged migration; previous work and decisions remain archived.

## Minimal app layout

~~~text
factory/
  README.md
  config.json
  runtime/        versioned shared helpers and owner protocol
  dashboard/      the same UI in every edition
  .local/         ignored private state, jobs, logs, receipts and usage
~~~

Only required native discovery skills live outside factory/. App source and app guides retain their existing locations. Setup creates no sample jobs, empty board/usage files, copied generation prompts or extra factory guides. Versioned upgrades preserve configuration and history; conflicts/unmanaged legacy factories stop for an explicit migration.

## Optional integrations

The same dashboard includes an Integrations view. Bundled Agent Skills load per role; Context7, Graphify, 21st.dev and Strix are optional and default off. Select during setup with --integrations context7,graphify or enable later while idle. Credentials stay in the server environment/approved secret storage. Availability is distinct from a real verified connection. Tool usage needs explicit request/plan scope; scanner targets/model/budget are displayed before approval. Raw results and caches remain private. See [the owner protocol](factory/runtime/WORKFLOW.md) for actual adapters, supported operations and recovery.

Observed metrics show completed jobs, elapsed time including human waits, known usage subtotals, rework requests and actual tool/cache counts. Similar-work comparisons are needed before claiming a speed or cost improvement. External integrations do not replace the owner, five reviews or staged human approvals.

## Development

[Package setup and recovery](factory/README.md) ? [Owner protocol](factory/runtime/WORKFLOW.md)

~~~powershell
node factory/setup.mjs --verify
node --test factory/tests/*.test.mjs codex-claude/maintenance/scripts/*.test.mjs
~~~

After editing shipped runtime/dashboard assets, refresh the manifest with node factory/setup.mjs --build-manifest, then run the tests. SHA-256 proves integrity against the checked-out manifest; use a trusted checkout/revision for publisher provenance. Tests use no live providers and do not prove a native background bridge, visual browser results or a complete generated app.

The three edition folders retain setup prompts and workflow guides. [Shared offline reference tools](codex-claude/maintenance/README.md) validate plan/scheduling metadata; they are not runtime dependencies. MIT licensed; see [LICENSE](LICENSE).

Documentation deliverables are Microsoft Word .docx files: one developer guide and one end-user manual, updated across features. The documentation writer renders and inspects every page before marking them complete. Documentation downloads the exact registered committed files whose hashes match their reported page review. Runtime instruction files remain Markdown; no duplicate Word guide pair is created per feature.
