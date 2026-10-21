# API-provider Software Factory

Use the shared versioned dashboard and local setup package with a DeepSeek-owned tool-calling runner with Qwen and Kimi workers. Setup preserves your app and installs only this edition's required integration.

~~~powershell
node factory/setup.mjs --project 'D:\my-app' --edition low-cost
~~~

Run this from the trusted prompt repository, not the application folder. Review setup once; the installer records the local checklist and opens the dashboard. Alternatively give [GENERATION.md](GENERATION.md) to the indicated assistant with access to this checkout so it completes setup and connects the owner in the same pass.

Inside the application, restart the dashboard with node factory/runtime/cli.mjs start. Use its checklist and controls for requests, plan approval, progress, tests, both guides, usage and final merge approval. The same ten-role workflow and five independent reviews apply. Host permission dialogs and account login remain native. Local installation makes no paid calls; live checks require explicit consent.

The package does not bundle a complete API coding runner. The setup prompt must reuse or implement that necessary project adapter and connect its actual DeepSeek owner; setup reports Action needed until verified. A Claude/Codex generator cannot substitute its own model as owner.

[Product workflow](docs/PRODUCT.md) ? [Edition guide](docs/GUIDE.md) ? [Shared setup/recovery](../factory/README.md) ? [Choose an edition](../README.md)
