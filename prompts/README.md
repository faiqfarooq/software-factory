# Software Factory

A reusable generation prompt for building a small, visual software factory in your own project using Claude Code or local Codex.

## What it generates

- An orchestrator skill and specialist agents.
- A coding agent and independent security, UX, UI, code, and QA reviews.
- A dashboard showing features, review results, and human approval states.
- Token usage and USD cost breakdowns by model, agent, and feature.
- Markdown specifications, build reports, reviews, and decisions.

## Get started

1. Open [the generation prompt](prompts/software-factory.md).
2. Copy its complete contents.
3. Open your target project in local Codex or Claude Code.
4. Paste the prompt and let the agent inspect your project and create the files.
5. Follow the generated `factory/README.md` to start the dashboard and run your first feature.

Use your own AI provider account. Exact usage reporting depends on the installed runtime and available telemetry. Estimated API costs must be distinguished from actual charges.

## Workflow

Feature → Specification → Coding → Five independent reviews → Approver → Human approval → Merge.

Requested changes return to the same coding agent. All reviewers must finish before revisions begin.

## Contributing

Open an issue to suggest improvements, or submit a pull request updating the prompt and documentation.

## License

MIT. See [LICENSE](LICENSE).
