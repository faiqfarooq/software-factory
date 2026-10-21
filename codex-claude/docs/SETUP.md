# Hybrid setup

From a trusted checkout with Node.js 22+:

~~~powershell
node factory/setup.mjs --project 'D:\my-app' --edition codex-claude
~~~

Review the local changes once. Setup verifies the bundle, preserves the app, installs only the two required native launchers, records the local checklist and opens the shared dashboard. It never installs providers or makes paid checks. See [shared setup/recovery](../../factory/README.md).

The owner is the actual Codex session. Use $factory there if setup has not connected it; the Claude launcher forwards to that same owner. Verify Owner listening and the checklist. Host permission dialogs/account login remain native. Live checks require explicit dashboard consent and actual worker-environment evidence.

In the dashboard choose app/feature mode, submit requirements/designs, inspect the plan and Approve plan and start. Follow implementation, actual tests, both guides and five reviews. Approve merge only for the final eligible reviewed result. Push/deployment are separate scope. See [workflow](PRODUCT.md) and [troubleshooting](TROUBLESHOOTING.md).

Repeat the installer for a versioned update after stopping/reconciling the owner/server. It preserves jobs, settings and history and rejects changed/legacy managed files. Never regenerate an active factory or silently replace its owner.
