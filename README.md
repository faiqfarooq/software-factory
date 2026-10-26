# Software Factory

Plan, build, review and approve application changes from one local dashboard. Factory connects to your coding assistant, stops at each stage for your decision, and records progress, tests and documentation.

## 1. Choose your edition

| Edition | What you need | Setup prompt |
| --- | --- | --- |
| claude-only | Claude Code | [Claude setup](claude-only/GENERATION.md) |
| codex-claude | Codex owner and Claude workers | [Codex + Claude setup](codex-claude/GENERATION.md) |
| low-cost | A DeepSeek coding runner with Qwen and Kimi access | [API-provider setup](low-cost/GENERATION.md) |

Every edition uses the same dashboard. The API edition needs a real tool-calling runner; this package does not bundle one.

## 2. Install into your application

Install Node.js **22+** and Git, and have an existing application folder ready. Open a terminal **in this software-factory checkout**, then run:

~~~powershell
node factory/setup.mjs --project "D:\my-app" --edition codex-claude
~~~

Replace D:\my-app with your application folder and choose your edition from the table. Review the proposed local files and approve setup. Setup prints a private dashboard link and opens it. **Keep that terminal running.**

Setup preserves existing files and checks local prerequisites. It does not install app dependencies, log into providers, make paid model calls or start an app build.

For several application repositories, install in their parent folder with exact relative paths:

~~~powershell
node factory/setup.mjs --project "D:\my-workspace" --edition codex-claude --workspace current-branches --repositories frontend,backend
~~~

This records their current named branches. Each request selects which repositories may change. Changes stay on those branches; integration accepts a reviewed commit set without a Git merge. The single-repository default creates separate product/feature branches.

## 3. Connect your assistant

Open **your application folder** in the selected assistant:

- Codex + Claude: invoke **$factory** in Codex. Claude's **/factory** forwards to that owner.
- Claude only: invoke **/factory** in Claude Code.
- API providers: connect the configured DeepSeek runner using the [owner protocol](factory/runtime/WORKFLOW.md).

Wait for **Owner listening** in the dashboard. An idle or closed assistant cannot receive requests automatically. Local pairing does not prove model access; follow **Setup & connections**. **Check live access** needs explicit consent and can consume usage.

## 4. Start work and approve each stage

1. Choose **New request**.
2. Choose **Build a complete app** or **Add or change a feature**.
3. Enter a name, requirements, target branch (or selected repositories) and optional design reference.
4. Read the feasibility result, then click **Approve & continue** once to authorize the next stage.
5. Continue through requirements, specification, design, implementation, QA and integration.
6. Inspect the local app, files/diff, five independent reviews and both Word guides before integration approval.

One approval in chat **or** the dashboard is enough for that exact stage offer. Routine authorized fixes and checks continue within the stage. Integration, starting another feature and final product acceptance each have their own decisions. Push, deployment and branch deletion need separate scope.

Products deliver features one at a time. After each accepted feature, choose **Start next feature**. After all features, choose **Start product acceptance**, then review the separate final integration offer.

## 5. Reopen the dashboard later

Run these commands **inside your application**, not this checkout:

~~~powershell
cd D:\my-app
node factory/runtime/cli.mjs start
~~~

Open the newly printed link, keep the terminal running, and reconnect the same assistant owner. To stop, first pause/finish and reconcile active work, then use **Ctrl+C** in the dashboard terminal. Restart marks unfinished activity uncertain; the owner reconciles it instead of replaying work.

## Complete guide and commands

The [step-by-step guide](factory/README.md) covers every dashboard view, all **20 runtime operations**, mobile conversion, optional integrations, upgrades and recovery. The [owner protocol](factory/runtime/WORKFLOW.md) contains detailed payloads and evidence rules.

**Factory Next** is a name used by Halo's private launcher helpers for this same dashboard. It is not another edition or a shipped command. The terminal operation **owner next** receives the next queued instruction; it does not approve or start a new feature by itself.

## Maintainer checks

After changing shipped assets, refresh the manifest, verify it and run the offline tests from this checkout:

~~~powershell
node factory/setup.mjs --build-manifest
node factory/setup.mjs --verify
node --test factory/tests/*.test.mjs codex-claude/maintenance/scripts/*.test.mjs
~~~

Version **2.5.0** includes direct stage approval, duplicate-submission guards, generic mobile roadmap proposals and explicit idle-owner release. Tests use no live providers and do not establish live model access, browser fidelity or a completed app. Manifest hashes establish consistency with the trusted checkout.

Installed apps contain factory/README.md, config.json, runtime/, dashboard/, and ignored private .local/ data, plus the necessary native launcher. App source stays in its existing folders. Developer and end-user guides are reusable Microsoft Word .docx files with review of every rendered page. Credentials, jobs, receipts and raw reports stay private. Optional external integrations default off.

[Shared maintenance tools](codex-claude/maintenance/README.md) · [MIT license](LICENSE)
