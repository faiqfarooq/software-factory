# Codex + Claude Software Factory

Use the shared versioned dashboard and local setup package with Codex, with Claude workers. Setup preserves your app and installs only this edition's required integration.

~~~powershell
node factory/setup.mjs --project 'D:\my-app' --edition codex-claude
~~~

Run this from the trusted prompt repository, not the application folder. Review setup once; the installer records the local checklist and opens the dashboard. Alternatively give [GENERATION.md](GENERATION.md) to the indicated assistant with access to this checkout so it completes setup and connects the owner in the same pass.

Inside the application, restart the dashboard with node factory/runtime/cli.mjs start. Use its checklist and controls for requests, plan approval, progress, tests, both guides, usage and final merge approval. The same ten-role workflow and five independent reviews apply. Host permission dialogs and account login remain native. Local installation makes no paid calls; live checks require explicit consent.

Invoke $factory in the owning Codex session if setup has not connected it. The Claude /factory launcher forwards to that owner; it must not start a second orchestrator. Native runtime capabilities and exact model access still need verification.

[Product workflow](docs/PRODUCT.md) ? [Edition guide](docs/GUIDE.md) ? [Shared setup/recovery](../factory/README.md) ? [Choose an edition](../README.md)
