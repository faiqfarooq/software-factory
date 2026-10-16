# Software Factory

Choose an edition, copy its generation prompt into your application's coding assistant, and follow the generated setup guide.

This repository contains **generation prompts and support tools**. Cloning it does not install or start a running factory.

## Choose your edition

| Edition | Runtime and accounts | Start here |
| --- | --- | --- |
| **Claude only** | Claude Code and your Claude account; ten configured roles, including a Sonnet documentation writer | [Claude-only guide](claude-only/README.md) |
| **Codex + Claude** | Both tools and accounts; ten roles, including a documentation writer for developer documentation and an end-user manual, with token-efficiency and unified-dashboard requirements | [Codex + Claude guide](codex-claude/README.md) |
| **Low-cost providers** | Generated Python runner and DeepSeek, Qwen and Kimi API credentials; ten configured roles, including a Qwen documentation writer | [Low-cost guide](low-cost/README.md) |

Each edition documents its actual requirements and features. Provider access and cost depend on your accounts and workload.

All three editions plan and maintain two documentation deliverables: complete developer documentation so another developer can understand, run and maintain the app, and an end-user manual with step-by-step usage instructions. Both are reviewed with the implementation and must be complete and current before approval.

## Start in three steps

1. **Choose an edition** from the table and check its requirements.
2. **Copy its complete GENERATION.md** into the indicated coding assistant opened in your own application project.
3. **Follow the generated factory/README.md**, verify readiness, then submit your first feature.

Keep account credentials out of prompts and Git. A successful file generation or login does not prove a live provider connection or a fully validated feature. Every edition requires independent reviews and human approval before merging.

## Repository layout

~~~text
claude-only/     Claude Code edition
codex-claude/    Codex + Claude edition
low-cost/        API-provider edition
~~~

Each folder has a short README, one GENERATION.md and a docs folder for details. Required guides stay in the repository so a clone contains the instructions.

## More help

- [Claude-only details](claude-only/docs/GUIDE.md)
- [Codex + Claude setup](codex-claude/docs/SETUP.md), [troubleshooting](codex-claude/docs/TROUBLESHOOTING.md) and [efficient daily use](codex-claude/docs/EFFICIENCY.md)
- [Low-cost details and historical pricing example](low-cost/docs/GUIDE.md)
- [Shared maintainer tools and checks](codex-claude/maintenance/README.md)

The editions are generation designs, not three bundled production-ready runtime installers. Updating this repository does not patch an existing generated factory; use that factory's owner to apply an appropriate upgrade while preserving its sessions and history.

MIT licensed. See [LICENSE](LICENSE).
