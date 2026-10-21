# Shared maintenance and diagnostic tools

These supporting files are kept under the Codex + Claude edition to leave only three edition folders at the repository root. They also provide optional Claude diagnostics and repository-wide documentation tests. New users should start with the [edition chooser](../../README.md).

## Files

- [check-claude.mjs](scripts/check-claude.mjs): read-only local/auth or explicitly requested live Claude checks.
- [check-claude.test.mjs](scripts/check-claude.test.mjs): offline evidence/timeout/parser tests.
- [docs.test.mjs](scripts/docs.test.mjs): links and generation requirements across all three editions.
- [product-workflow.mjs](scripts/product-workflow.mjs): offline reference plan/coverage validation, dependency selection, change impact, checkpoint evidence bindings and typed control envelopes. No dispatch, authentication, server or Git execution.
- [product-workflow.test.mjs](scripts/product-workflow.test.mjs): offline behavioral regression tests for those invariants.
- [check-plan.mjs](scripts/check-plan.mjs): read-only JSON plan validator.
- [Synthetic product/feature examples and API boundaries](examples/README.md).
- [Connection and validation reference](docs/REPOSITORY-GUIDE.md): the former root guide, with updated paths.
- [Shared troubleshooting](docs/TROUBLESHOOTING.md): connection, environment and saved-dashboard issues.

## Run offline tests

From the prompt repository root:

~~~powershell
node --test codex-claude/maintenance/scripts/check-claude.test.mjs codex-claude/maintenance/scripts/docs.test.mjs codex-claude/maintenance/scripts/product-workflow.test.mjs
~~~

These tests make no live model calls and do not prove account access, application acceptance or a full generated factory run.

## Optional Claude connection checks

From the same repository root, inspect the supported options:

~~~powershell
node codex-claude/maintenance/scripts/check-claude.mjs --help
~~~

Without --live, the checker inspects local Claude installation/authentication. An explicit live call consumes provider usage; use the full reference before running one. It returns sanitized evidence to the terminal and never writes a factory board or ledger. An external success does not prove the generated runner's execution environment works; its owner must verify and publish a fresh result.

The low-cost edition requires its own provider checks. The reusable prompts must generate necessary diagnostics inside their target application without depending on these shared files.

## Path migration

| Old repository path | New path |
| --- | --- |
| software-factory/ | codex-claude/ |
| software-factory-with-claude/ | claude-only/ |
| low-cost-software-factory/ | low-cost/ |
| scripts/ | codex-claude/maintenance/scripts/ |
| docs/TROUBLESHOOTING.md | codex-claude/maintenance/docs/TROUBLESHOOTING.md |

Edition setup and detailed guides now live under each edition's docs directory. Claude-only's former software-factory.md is now GENERATION.md. The generation prompt's example paths for files created inside a user's application are runtime paths, not old repository links.

Useful previous guides have been moved rather than discarded. Existing external links to renamed repository paths need updating; the new root README and relative links are the supported entry points. GitHub Wiki pages or Releases can be added separately later; this reorganization creates no remote publication.


## Validate a reference plan

~~~powershell
node codex-claude/maintenance/scripts/check-plan.mjs codex-claude/maintenance/examples/product-plan.json
node codex-claude/maintenance/scripts/check-plan.mjs codex-claude/maintenance/examples/feature-plan.json
~~~

VALID_PLAN_METADATA proves only the documented reference metadata invariants. The helpers are not a running factory, a control backend, a human authentication mechanism, a Figma reader or proof of actual review results. They do not approve/dispatch/merge anything. Their validators must be supplied trusted owner state and verified evidence by a separately implemented generated runtime. The shared factory package supplies setup/dashboard/control; the actual edition owner and provider tools still require their own verified execution evidence. See the [product/design/dashboard guide](../docs/PRODUCT.md). The reusable dashboard/control package lives in factory/ at the repository root; these optional reference tools are not its dependencies.
