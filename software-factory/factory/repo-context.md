# Repository context

Starter snapshot. The orchestrator must re-inspect the repo and overwrite this
before spawning any agent.

- Contents: the factory itself (Markdown agent/skill definitions, `factory/dashboard.html`,
  `factory/board.json`). No application source and no test suite exist yet.
- Dashboard: one self-contained HTML file (plain HTML/CSS/JS), served with Python's
  standard `http.server`.
- Test/lint/build commands: none discovered. Do not invent any; the spec must say how
  a change is verified (e.g. a manual browser check or a script added by the feature).
- Platform: Windows 11, PowerShell. Python 3.12 is installed but not on PATH.
