# Reusable factory

Node.js 22+ and Git are the shared prerequisites. No npm install, Python dashboard server, build step, or framework is required.

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

Open the printed link, then invoke `/factory` in Claude or `$factory` in the hybrid Codex owner. A hybrid Claude launcher forwards to Codex. If skills are not discovered, refresh the host or explicitly ask it to read factory/runtime/WORKFLOW.md. The owner must listen using the documented protocol; an idle/closed chat cannot receive dashboard commands automatically. The API edition requires its configured DeepSeek tool-calling owner. The shared dashboard does not install or authenticate AI products, generate an API coding runner, or prove provider/model access.

Use the dashboard checklist, submit an app/feature request, inspect the plan and choose **Approve plan and start**. Routine approved work proceeds under the owner. After tests, both guides, five reviews and the approver pass, inspect the final result and choose **Approve merge**. Merge does not imply push/deployment. Host permission dialogs and account login remain in their native interface. Paid checks require the separate **Check live access** consent in the dashboard.

The only project factory entries are this README, config.json, versioned runtime/ and dashboard/, plus ignored .local/ created as needed. The selected host also needs a small native skill in its discovery directory. No unrelated provider files are generated. App source and app guides retain their existing locations. All private jobs/logs/usage/receipts live in .local; only sanitized state is published through authenticated API responses. Treat pairing links as private. The dashboard is loopback-only.

Re-run the same setup command to check or upgrade. A checksum manifest permits updates only to unchanged managed files; conflicts stop before writes. Config, state, jobs and native settings are preserved. Changing editions/owners requires an explicit migration; setup never silently removes another integration. Existing legacy generated factories need a reviewed migration rather than an overwrite. Interrupted server/write locks require checking their recorded PID and reconciling processes/state before removing the specific lock; setup never steals a lock.

Owner integration, evidence formats and recovery are documented in runtime/WORKFLOW.md. Offline tests validate installation and bridge behavior; they do not prove live providers, native background delivery, review quality, or a completed app.

Integration references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [Claude subagents](https://code.claude.com/docs/en/sub-agents). Observed 2026-10-21; verify installed host capabilities at setup.
