"""Regenerate .codex/agents/*.toml from .claude/agents/*.md (single source of truth).

Run from the repo root:  python factory/sync-codex-agents.py
Codex models are NOT set: agents inherit your configured Codex model.
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
dest = root / ".codex" / "agents"
dest.mkdir(parents=True, exist_ok=True)

for src in sorted((root / ".claude" / "agents").glob("*.md")):
    _, front, body = src.read_text(encoding="utf-8").split("---\n", 2)
    meta = dict(line.split(": ", 1) for line in front.strip().splitlines())
    body = body.strip().replace('"""', "'''").replace("\\", "\\\\")
    toml = (
        f'name = "{meta["name"]}"\n'
        f'description = "{meta["description"]}"\n'
        'developer_instructions = """\n'
        "Generated from .claude/agents/ by factory/sync-codex-agents.py; do not hand-edit.\n"
        "Only the orchestrator session creates or continues you; you cannot delegate.\n\n"
        f"{body}\n"
        '"""\n'
    )
    (dest / f"{meta['name']}.toml").write_text(toml, encoding="utf-8", newline="\n")
    print("wrote", dest / f"{meta['name']}.toml")
