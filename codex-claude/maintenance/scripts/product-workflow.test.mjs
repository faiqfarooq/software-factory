import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectMode, validatePlan, fingerprint, nextReadyFeature, affectedFeatures, checkpointIssues, validateControlCommand, replayDecision } from './product-workflow.mjs';
const sample = JSON.parse(await readFile(new URL('../examples/product-plan.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(sample);
const run = plan => ({ mode: 'product', plan_hash: fingerprint(plan), approved_plan_hash: fingerprint(plan), phase: 'running', owner_connected: true, active_feature_id: null, budget_status: 'ready', features: Object.fromEntries(plan.features.map(f => [f.id, 'planned'])) });

test('mode selection is explicit and ambiguity stays unresolved', () => {
  assert.equal(selectMode().status, 'needs-mode');
  assert.equal(selectMode('product').mode, 'product');
  assert.equal(selectMode('feature').mode, 'feature');
  for (const input of ['build everything', 'auto', {}, 1, 'PRODUCT']) assert.throws(() => selectMode(input), /INVALID_MODE/);
});
test('both published example modes validate', async () => {
  assert.deepEqual(validatePlan(copy()), []);
  const feature = JSON.parse(await readFile(new URL('../examples/feature-plan.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePlan(feature), []);
  assert.equal(nextReadyFeature(feature, run(feature)).status, 'blocked');
});
for (const [name, change] of [
  ['unknown schema', p => p.schema_version = 0],
  ['mode mismatch', p => p.mode = 'auto'],
  ['multiple feature-mode items', p => p.mode = 'feature'],
  ['missing repository binding', p => delete p.base_commit],
  ['duplicate requirements', p => p.requirements.push(p.requirements[0])],
  ['duplicate features', p => p.features.push(p.features[0])],
  ['unknown requirement', p => p.features[0].requirement_ids.push('missing')],
  ['uncovered mandatory requirement', p => p.requirements.push({ id: 'R3', text: 'Missing', source: 'requirements.md', mandatory: true })],
  ['unverified acceptance', p => p.features[0].acceptance_criteria[0].verification = ''],
  ['criterion outside feature', p => p.features[0].acceptance_criteria[0].requirement_ids = ['R2']],
  ['duplicate criterion', p => p.features[1].acceptance_criteria[0].id = 'A1'],
  ['unknown dependency', p => p.features[1].depends_on = ['missing']],
  ['duplicate dependency', p => p.features[1].depends_on = ['tasks', 'tasks']],
  ['self dependency', p => p.features[0].depends_on = ['tasks']],
  ['dependency cycle', p => p.features[0].depends_on = ['filters']],
  ['missing guide', p => delete p.documentation_plan.end_user_manual],
  ['missing final verification', p => p.final_checks = []],
  ['design URL hidden as no design', p => p.design.source = 'https://example.com/design'],
  ['unknown design screen', p => p.features[0].design_screen_ids = ['missing']]
]) test('rejects ' + name, () => { const plan = copy(); change(plan); assert.ok(validatePlan(plan).length > 0); });
test('malformed nested input returns diagnostics without crashing', () => {
  for (const input of [null, [], {}, { ...copy(), requirements: [null], features: [null], design: null }, { ...copy(), features: [{ ...copy().features[0], acceptance_criteria: [null] }] }]) assert.ok(validatePlan(input).length);
});
test('fingerprints ignore object-key order but preserve feature order and content', () => {
  const plan = copy();
  assert.equal(fingerprint(plan), fingerprint(Object.fromEntries(Object.entries(plan).reverse())));
  plan.features.reverse(); assert.notEqual(fingerprint(plan), fingerprint(sample));
});
test('scheduler selects the first eligible declared feature, then final validation', () => {
  const plan = copy(), state = run(plan);
  plan.features.reverse(); state.plan_hash = state.approved_plan_hash = fingerprint(plan);
  assert.deepEqual(nextReadyFeature(plan, state), { status: 'ready', feature_id: 'tasks' });
  state.features.tasks = 'integrated';
  assert.equal(nextReadyFeature(plan, state).feature_id, 'filters');
  state.features.filters = 'integrated';
  assert.deepEqual(nextReadyFeature(plan, state), { status: 'awaiting-final-validation' });
});
for (const [name, change] of [
  ['no plan approval', s => s.approved_plan_hash = null],
  ['changed plan', s => s.plan_hash = 'b'.repeat(64)],
  ['disconnected owner', s => s.owner_connected = false],
  ['paused run', s => s.phase = 'paused'],
  ['cancelling run', s => s.phase = 'cancel-requested'],
  ['active worker', s => s.active_feature_id = 'tasks'],
  ['unreconciled reviewing worker', s => s.features.tasks = 'reviewing'],
  ['failed dependency', s => s.features.tasks = 'blocked'],
  ['unknown usage', s => s.budget_status = 'unknown'],
  ['exhausted budget', s => s.budget_status = 'exhausted'],
  ['missing child state', s => delete s.features.tasks],
  ['foreign child state', s => s.features.other = 'integrated']
]) test('scheduler blocks ' + name, () => { const state = run(sample); change(state); assert.equal(nextReadyFeature(sample, state).status, 'blocked'); });
function withDesign() {
  const plan = copy();
  plan.design = { status: 'ready', source: 'synthetic-export', snapshot_hash: 'd'.repeat(64), screens: [{ id: 'task-screen', source: 'synthetic-screen', reference_hash: 'e'.repeat(64), viewports: [{ width: 390, height: 844 }, { width: 1440, height: 900 }] }] };
  plan.features[0].design_screen_ids = ['task-screen'];
  return plan;
}
test('blocked reference access prevents dispatch', () => {
  const plan = copy(); plan.design = { status: 'blocked', reason: 'Access denied', screens: [] };
  assert.equal(nextReadyFeature(plan, run(plan)).reason, 'design-inaccessible');
});
test('design screen validation requires valid viewports and mappings', () => {
  assert.deepEqual(validatePlan(withDesign()), []);
  for (const change of [p => p.design.screens[0].viewports[0].width = 0, p => p.features[0].design_screen_ids = [], p => p.design.snapshot_hash = 'unverified']) {
    const plan = withDesign(); change(plan); assert.ok(validatePlan(plan).length);
  }
});
test('change impact includes transitive dependents in declared order', () => {
  assert.deepEqual(affectedFeatures(sample, { requirement_ids: ['R1'] }), ['tasks', 'filters']);
  assert.deepEqual(affectedFeatures(sample, { feature_ids: ['filters'] }), ['filters']);
  assert.deepEqual(affectedFeatures(withDesign(), { screen_ids: ['task-screen'] }), ['tasks', 'filters']);
  assert.deepEqual(affectedFeatures(sample, {}), []);
  assert.throws(() => affectedFeatures(sample, { feature_ids: ['absent'] }), /UNKNOWN_CHANGE_REFERENCE/);
  assert.throws(() => affectedFeatures(sample, { actor: 'human' }), /INVALID_CHANGE/);
});
function evidence(plan, scope = 'product') {
  const commit = 'c'.repeat(40), planHash = fingerprint(plan);
  return { plan_hash: planHash, commit, round: 1, scope, checks: 'PASS', product_checks: 'PASS', final_checks: Object.fromEntries(plan.final_checks.map(c => [c, 'PASS'])),
    integrated_features: Object.fromEntries(plan.features.map(f => [f.id, true])),
    docs: Object.fromEntries(['developer_documentation', 'end_user_manual'].map(key => [key, { status: 'COMPLETE', commit }])),
    reviews: Object.fromEntries(['security', 'ux', 'ui', 'code', 'qa'].map(key => [key, { verdict: 'PASS', commit, round: 1, plan_hash: planHash, scope }])),
    approver: { decision: 'APPROVE', commit, round: 1, plan_hash: planHash, scope },
    acceptance: Object.fromEntries(plan.features.flatMap(f => f.acceptance_criteria.map(c => [c.id, 'PASS']))),
    visual: Object.fromEntries(plan.design.screens.map(s => [s.id, { status: 'PASS', commit, reference_hash: s.reference_hash, snapshot_hash: plan.design.snapshot_hash, viewports: s.viewports }])) };
}
test('valid child checkpoint and independent final-product checkpoint pass', () => {
  assert.deepEqual(checkpointIssues(sample, evidence(sample, 'tasks'), { feature_id: 'tasks' }), []);
  const plan = withDesign(); assert.deepEqual(checkpointIssues(plan, evidence(plan), { final: true }), []);
});
for (const [name, change] of [
  ['missing review', e => delete e.reviews.security],
  ['failed review', e => e.reviews.qa.verdict = 'CHANGES'],
  ['old review commit', e => e.reviews.ui.commit = 'b'.repeat(40)],
  ['mixed review round', e => e.reviews.ux.round = 2],
  ['child reviews reused for final product', e => e.reviews.code.scope = 'tasks'],
  ['old review plan', e => e.reviews.qa.plan_hash = 'f'.repeat(64)],
  ['stale user manual', e => e.docs.end_user_manual.commit = 'b'.repeat(40)],
  ['incomplete developer guide', e => e.docs.developer_documentation.status = 'CHANGES'],
  ['escalated decision', e => e.approver.decision = 'ESCALATE'],
  ['old approver', e => e.approver.commit = 'b'.repeat(40)],
  ['old approver round', e => e.approver.round = 2],
  ['failed final journey', e => e.product_checks = 'FAIL'],
  ['missing named final check', e => e.final_checks = {}],
  ['unintegrated feature', e => e.integrated_features.filters = false],
  ['missing requirement verification', e => delete e.acceptance.A2],
  ['stale design snapshot', e => e.visual['task-screen'].snapshot_hash = 'f'.repeat(64)],
  ['wrong visual viewport', e => e.visual['task-screen'].viewports = []],
  ['unrendered design', e => delete e.visual['task-screen']]
]) test('checkpoint blocks ' + name, () => { const plan = withDesign(), result = evidence(plan); change(result); assert.ok(checkpointIssues(plan, result, { final: true }).length); });
const now = 100000;
function control() {
  const context = { owner_id: 'owner-1', scope_id: 'product-1', mode: 'product', plan_hash: fingerprint(sample), state_version: 2, stage: 'awaiting-spec-approval', connected: true,
    offer: { id: 'offer-1', kind: 'approve_plan', hash: 'a'.repeat(64), plan_hash: fingerprint(sample), state_version: 2, expires_at: now + 10000 } };
  const command = { id: 'event-1', action: 'approve_plan', owner_id: context.owner_id, scope_id: context.scope_id, mode: context.mode, plan_hash: context.plan_hash, expected_version: 2, expires_at: now + 1000, offer_id: context.offer.id, offer_hash: context.offer.hash };
  return { command, context };
}
test('matching approval envelope validates without pretending to authenticate a human', () => {
  const { command, context } = control();
  assert.equal(validateControlCommand(command, context, now).status, 'valid-envelope');
  command.action = 'approve_merge'; context.stage = 'awaiting-merge-approval'; context.offer.kind = 'approve_merge';
  assert.equal(validateControlCommand(command, context, now).status, 'valid-envelope');
});
for (const [name, change, code] of [
  ['claimed human actor', (c, s) => c.actor = 'human', 'UNKNOWN_COMMAND_FIELD'],
  ['shell endpoint', c => c.action = 'exec', 'UNKNOWN_COMMAND'],
  ['prototype action', c => c.action = 'toString', 'UNKNOWN_COMMAND'],
  ['wrong owner', c => c.owner_id = 'other', 'WRONG_OWNER_OR_SCOPE'],
  ['wrong product', c => c.scope_id = 'other', 'WRONG_OWNER_OR_SCOPE'],
  ['wrong mode', c => c.mode = 'feature', 'WRONG_OWNER_OR_SCOPE'],
  ['disconnected bridge', (c, s) => s.connected = false, 'OWNER_DISCONNECTED'],
  ['stale plan', c => c.plan_hash = 'f'.repeat(64), 'STALE_PLAN'],
  ['stale state', c => c.expected_version--, 'STALE_STATE'],
  ['expired command', c => c.expires_at = now, 'EXPIRED_COMMAND'],
  ['wrong stage', (c, s) => s.stage = 'running', 'ILLEGAL_STAGE'],
  ['stale offer', c => c.offer_hash = 'f'.repeat(64), 'STALE_OR_WRONG_OFFER'],
  ['expired offer', (c, s) => s.offer.expires_at = now, 'STALE_OR_WRONG_OFFER'],
  ['changed offer scope', (c, s) => s.offer.plan_hash = 'f'.repeat(64), 'STALE_OR_WRONG_OFFER'],
  ['changed offer state', (c, s) => s.offer.state_version++, 'STALE_OR_WRONG_OFFER'],
  ['extra approval prose', c => c.note = 'approved', 'UNEXPECTED_NOTE']
]) test('control rejects ' + name, () => { const { command, context } = control(); change(command, context); assert.throws(() => validateControlCommand(command, context, now), new RegExp(code)); });
test('pause, resume and cancellation validate only in their allowed stages', () => {
  for (const [action, stage] of [['pause', 'running'], ['resume', 'paused'], ['cancel', 'running']]) {
    const { command, context } = control(); command.action = action; context.stage = stage; delete command.offer_id; delete command.offer_hash;
    assert.equal(validateControlCommand(command, context, now).status, 'valid-envelope');
    context.stage = 'merged'; assert.throws(() => validateControlCommand(command, context, now), /ILLEGAL_STAGE/);
  }
});
test('rework and plan revision need a note and cannot silently alter a running plan', () => {
  for (const action of ['request_rework', 'request_plan_revision']) {
    const { command, context } = control(); command.action = action; context.stage = 'paused'; delete command.offer_id; delete command.offer_hash;
    assert.throws(() => validateControlCommand(command, context, now), /INVALID_NOTE/);
    command.note = 'Add an agreed missing state.'; assert.equal(validateControlCommand(command, context, now).status, 'valid-envelope');
    context.stage = 'running'; assert.throws(() => validateControlCommand(command, context, now), /ILLEGAL_STAGE/);
  }
});
test('receipt replay survives serialization and conflicting event reuse fails', () => {
  const { command } = control();
  const fresh = replayDecision(command);
  assert.equal(fresh.status, 'new');
  const record = JSON.parse(JSON.stringify({ id: command.id, command_hash: fresh.command_hash, receipt: { status: 'Pending', owner_id: command.owner_id } }));
  const duplicate = replayDecision(command, record);
  assert.equal(duplicate.status, 'duplicate'); assert.equal(duplicate.receipt.status, 'Pending');
  duplicate.receipt.status = 'Completed'; assert.equal(record.receipt.status, 'Pending');
  assert.throws(() => replayDecision({ ...command, action: 'approve_merge' }, record), /COMMAND_ID_CONFLICT/);
});


test('final checkpoint cannot waive blocked design access', () => {
  const plan = copy(); plan.design = { status: 'blocked', reason: 'Reference unreadable', screens: [] };
  assert.ok(checkpointIssues(plan, evidence(plan), { final: true }).includes('design inaccessible'));
});
test('feature-mode evidence cannot become a product-final checkpoint', () => {
  const plan = copy(); plan.mode = 'feature'; plan.features = plan.features.slice(0, 1); plan.requirements = plan.requirements.slice(0, 1);
  assert.ok(checkpointIssues(plan, evidence(plan), { final: true }).includes('final product checkpoint requires product mode'));
});
