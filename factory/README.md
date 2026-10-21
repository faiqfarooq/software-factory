# Reusable factory

Node.js 22+ and Git are the shared prerequisites. No npm install, Python dashboard server, build step, or framework is required.

The same dashboard supports **Software development** and **Web app to mobile app** requests, with any provider edition. For a dedicated mobile workspace, create a separate application folder and install with `node factory/setup.mjs --project "D:\mobile-app" --edition claude-only --purpose web-to-mobile`. Setup installs the factory only; the owner proposes the app baseline and dependencies through the staged workflow. Existing installations can choose the mobile purpose in New request without reinstalling.

Supply the frontend's local Git root or credential-free HTTPS Git URL, Android/iOS targets and optional public API address. The factory analyses a committed frontend snapshot, proposes Expo native UI or Capacitor web UI reuse, maps screens and existing API contracts, and builds approved features sequentially in the mobile repo. The backend is reused without changes. Missing API/auth support blocks implementation until resolved. Remote cloning, dependencies, device tooling, signing and store publishing require their actual authorized scope. iOS native builds need appropriate Apple tooling or separately approved cloud builds; a browser preview is not a device test. This package coordinates real coding agents; it does not convert an app merely by saving a request.

Offline installer/bridge tests have been run on Windows with Node.js 22. Other platforms and live native/provider workflows require separate verification.

From a trusted checkout of this repository:

```text
node factory/setup.mjs --project "D:\my-app"
```

Choose an edition, review the file/permission proposal and approve setup once. Setup verifies the package manifest, preserves existing work, installs the selected integration, checks local prerequisites and prints one private dashboard link. It makes no paid requests. The command keeps serving the dashboard; leave that terminal open. In noninteractive automation specify `--edition claude-only --yes`; `--yes` approves only the displayed local setup scope. Use `--no-serve` for offline installation and `--verify` to verify the source bundle without installing.

Inside an installed app:

```text
node factory/runtime/cli.mjs start
```

The dashboard's **Integrations** view enables only the tools you choose, checks local availability and shows real tool receipts/usage. Three bundled task skills are always available; Context7, Graphify, 21st.dev and Strix default off. Select optional capabilities during setup with `--integrations context7,graphify` or enable them later while idle. Setup does not install/authenticate external products or make remote calls. Enter API keys in the masked Integration fields or use the server environment. Saved keys override environment keys and can be removed to restore fallback. Windows uses current-user encryption in ignored .local/credentials.json; other platforms use an owner-only 0600 local file. Keys never enter config or public state. Plan approval must include the tool operations and invocation limits; Strix additionally needs exact authorized URL targets, model and per-scan budget/turn limits. The owner protocol documents actual adapter operations, role restrictions and recovery.

Open the printed link, then invoke `/factory` in Claude or `$factory` in the hybrid Codex owner. A hybrid Claude launcher forwards to Codex. If skills are not discovered, refresh the host or explicitly ask it to read factory/runtime/WORKFLOW.md. The owner must listen using the documented protocol; an idle/closed chat cannot receive dashboard commands automatically. The API edition requires its configured DeepSeek tool-calling owner. The shared dashboard does not install or authenticate AI products, generate an API coding runner, or prove provider/model access.

Use the dashboard checklist, then name a product/feature and its target branch. Each stage stops for human approval: feasibility, requirements, specification, design, implementation, QA and integration. Products plan first, then deliver separate named feature branches sequentially; **Start next feature** is always explicit. Workspace shows your actual application folder/branch/HEAD/files and requested diff; App & design shows the owner-reported local preview and served commit. Inspect source/app locally before approving merge. Final product acceptance and product-to-target merge need separate approvals. No push/deployment/branch deletion is implicit. Host permissions/login remain native; paid diagnostics require **Check live access**.

The only project factory entries are this README, config.json, versioned runtime/ and dashboard/, plus ignored .local/ created as needed. The selected host also needs a small native skill in its discovery directory. No unrelated provider files are generated. App source and app guides retain their existing locations. All private jobs/logs/usage/receipts live in .local; only sanitized state is published through authenticated API responses. Treat pairing links as private. The dashboard is loopback-only.

Re-run the same setup command to check or upgrade. A checksum manifest permits updates only to unchanged managed files; conflicts stop before writes. Config, state, jobs and native settings are preserved. Changing editions/owners requires an explicit migration; setup never silently removes another integration. Existing legacy generated factories need a reviewed migration rather than an overwrite. Interrupted server/write locks require checking their recorded PID and reconciling processes/state before removing the specific lock; setup never steals a lock.

Owner integration, evidence formats and recovery are documented in runtime/WORKFLOW.md. Offline tests validate installation and bridge behavior; they do not prove live providers, native background delivery, review quality, or a completed app.

Integration references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [Claude subagents](https://code.claude.com/docs/en/sub-agents). Observed 2026-10-21; verify installed host capabilities at setup.

Documentation deliverables are Microsoft Word .docx files: one developer guide and one end-user manual, updated across features. The documentation writer renders and inspects every page before marking them complete. Documentation downloads the exact registered committed files whose hashes match their reported page review. Runtime instruction files remain Markdown; no duplicate Word guide pair is created per feature.
