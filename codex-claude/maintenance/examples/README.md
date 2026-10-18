# Offline reference examples

These small plans are synthetic metadata fixtures, not generated applications, real commits, measured usage or accepted requirements. Repository/base values are placeholders. They demonstrate workflow version 2's explicit modes and the optional reference-plan schema_version 1. They do not replace an edition's complete runtime contracts, provider evidence, permission/budget policy or authenticated approvals.

- [Requirements](requirements.md): the source text for the samples.
- [Product plan](product-plan.json): two ordered features with dependency and requirement/acceptance coverage.
- [Feature plan](feature-plan.json): one separately approved feature-mode request.
- [Reference implementation](../scripts/product-workflow.mjs): offline validators and decision helpers.
- [Full generation guide](../../docs/PRODUCT.md): real owner, design, dashboard and final acceptance requirements.

From the repository root:

~~~powershell
node codex-claude/maintenance/scripts/check-plan.mjs codex-claude/maintenance/examples/product-plan.json
node codex-claude/maintenance/scripts/check-plan.mjs codex-claude/maintenance/examples/feature-plan.json
~~~

VALID_PLAN_METADATA only means the JSON passes this reference format's structural, dependency and coverage checks. It is not go ahead, authenticated human approval, live readiness, evidence verification or permission to dispatch/merge.

## Reference format

Each plan has schema_version, id, explicit mode, positive revision, repository/target_branch/base_commit binding, requirements, features, design, both documentation plans and final_checks. A feature-mode plan has exactly one feature. Each requirement includes id, text, source locator and mandatory boolean; mandatory items must appear in acceptance verification. Features include id/title, depends_on, requirement_ids, design_screen_ids and acceptance_criteria (id/text/requirement_ids/verification). Stable IDs use letters, digits, underscore and hyphen, never paths. Verification strings are descriptions here, not shell commands; real generated contracts use approved executable/argument/cwd arrays.

Design is explicitly none, blocked with a reason, or ready with a source, snapshot hash and mapped screens. Ready screens have their own source, reference hash and positive integer viewport dimensions. The examples have no supplied design; behavior tests use clearly synthetic design metadata. No fake Figma connection or visual comparison is claimed.

## Reference API boundaries

- selectMode requires an explicit feature/product choice; missing selection stays unresolved.
- validatePlan returns diagnostics; fingerprint binds canonical metadata, preserving feature order.
- nextReadyFeature checks approved plan identity, owner/phase, budget state and integrated dependencies. It returns a candidate only; the real owner must verify evidence, acquire locks and atomically recheck before dispatch.
- affectedFeatures includes transitive dependents of changed requirements, screens or features.
- checkpointIssues checks metadata bindings for acceptance, docs, five reviews, approver and visual comparisons. Final product scope also requires all features integrated and named final checks passing. The real owner must verify artifact contents, runtime identities, permissions and execution evidence; these strings are not trusted on their own.
- validateControlCommand checks typed control-envelope scope, stage, state/offer hashes and expiry. It does not supply HTTP authentication, Host/Origin/CSRF checks or human provenance. A valid envelope cannot approve a job by itself.
- replayDecision recognizes identical persisted event receipts and rejects conflicting ID reuse. The owner must persist/consume commands atomically under its own lock; no storage or execution engine is provided here.

These helpers never call providers, extract documents, fetch design URLs, start servers, run workers, write workflow state or perform Git operations. Generated factories must be self-contained and do not import these optional maintainer files at runtime.
