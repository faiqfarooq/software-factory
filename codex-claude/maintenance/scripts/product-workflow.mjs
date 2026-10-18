// Offline reference helpers for generated factories. No providers, servers, Git or dispatch.
// These validate owner-supplied metadata, not the underlying files or human identity.
// A generated owner must verify real artifacts/provenance and persist state atomically.
import { createHash } from 'node:crypto';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const list = value => Array.isArray(value) ? value : [];
const roles = ['security', 'ux', 'ui', 'code', 'qa'];
export const MODES = Object.freeze(['feature', 'product']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function reject(code) { const error = new Error(code); error.code = code; throw error; }
export function selectMode(selection) {
  if (selection === undefined || selection === null || selection === '') return { status: 'needs-mode', choices: [...MODES] };
  if (!MODES.includes(selection)) reject('INVALID_MODE');
  return { status: 'selected', mode: selection };
}

// Version 1 of the optional reference plan format, within workflow version 2.
// Generated editions may extend it, but must preserve these invariants.
export function validatePlan(plan) {
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };
  if (!object(plan)) return ['plan must be an object'];
  need(plan.schema_version === 1, 'unsupported plan schema_version');
  need(id(plan.id), 'invalid plan id');
  need(MODES.includes(plan.mode), 'invalid mode');
  need(Number.isSafeInteger(plan.revision) && plan.revision > 0, 'invalid plan revision');
  need(text(plan.repository) && text(plan.target_branch) && sha(plan.base_commit), 'missing repository/target/base binding');
  need(Array.isArray(plan.requirements) && plan.requirements.length > 0, 'requirements must be nonempty');
  need(Array.isArray(plan.features) && plan.features.length > 0, 'features must be nonempty');
  if (plan.mode === 'feature') need(list(plan.features).length === 1, 'feature mode requires exactly one feature');
  const requirements = new Map(), features = new Map(), criteria = new Set(), screens = new Map();
  for (const requirement of list(plan.requirements)) {
    if (!object(requirement)) { errors.push('invalid requirement'); continue; }
    need(id(requirement.id) && !requirements.has(requirement.id), 'invalid or duplicate requirement id');
    need(text(requirement.text) && text(requirement.source), 'requirement needs text and source locator');
    need(typeof requirement.mandatory === 'boolean', 'requirement mandatory must be boolean');
    requirements.set(requirement.id, requirement);
  }
  const design = plan.design;
  need(object(design) && ['none', 'ready', 'blocked'].includes(design.status), 'invalid design status');
  if (object(design)) {
    need(Array.isArray(design.screens), 'design screens must be an array');
    if (design.status === 'ready') need(text(design.source) && hash(design.snapshot_hash) && list(design.screens).length > 0, 'ready design needs source, snapshot hash and screens');
    if (design.status === 'blocked') need(text(design.reason), 'blocked design needs a reason');
    if (design.status === 'none') need(list(design.screens).length === 0 && !design.source && !design.snapshot_hash, 'no-design state cannot hide a supplied reference');
    for (const screen of list(design.screens)) {
      if (!object(screen)) { errors.push('invalid screen'); continue; }
      need(id(screen.id) && !screens.has(screen.id), 'invalid or duplicate screen id');
      need(text(screen.source) && hash(screen.reference_hash), 'screen needs source and reference hash');
      need(Array.isArray(screen.viewports) && screen.viewports.length > 0 && screen.viewports.every(v => object(v) && Number.isSafeInteger(v.width) && v.width > 0 && Number.isSafeInteger(v.height) && v.height > 0), 'screen needs valid viewports');
      screens.set(screen.id, screen);
    }
  }
  for (const feature of list(plan.features)) {
    if (!object(feature)) { errors.push('invalid feature'); continue; }
    need(id(feature.id) && !features.has(feature.id) && text(feature.title), 'invalid or duplicate feature id/title');
    need(Array.isArray(feature.depends_on) && feature.depends_on.every(id) && new Set(feature.depends_on).size === feature.depends_on.length, 'invalid or duplicate dependencies');
    need(Array.isArray(feature.requirement_ids) && feature.requirement_ids.length > 0 && new Set(feature.requirement_ids).size === feature.requirement_ids.length, 'feature needs unique requirement_ids');
    need(Array.isArray(feature.design_screen_ids) && new Set(feature.design_screen_ids).size === feature.design_screen_ids.length, 'feature needs unique design_screen_ids');
    for (const ref of list(feature.requirement_ids)) need(requirements.has(ref), 'unknown requirement ' + ref);
    for (const ref of list(feature.design_screen_ids)) need(screens.has(ref), 'unknown design screen ' + ref);
    need(Array.isArray(feature.acceptance_criteria) && feature.acceptance_criteria.length > 0, 'feature needs acceptance criteria');
    for (const criterion of list(feature.acceptance_criteria)) {
      if (!object(criterion)) { errors.push('invalid acceptance criterion'); continue; }
      need(id(criterion.id) && !criteria.has(criterion.id) && text(criterion.text) && text(criterion.verification), 'invalid/duplicate criterion or missing verification');
      criteria.add(criterion.id);
      need(Array.isArray(criterion.requirement_ids) && criterion.requirement_ids.length > 0 && new Set(criterion.requirement_ids).size === criterion.requirement_ids.length, 'criterion needs unique requirement_ids');
      for (const ref of list(criterion.requirement_ids)) need(list(feature.requirement_ids).includes(ref), 'criterion requirement outside its feature');
    }
    features.set(feature.id, feature);
  }
  const visited = new Set(), visiting = new Set();
  function visit(featureId) {
    if (visiting.has(featureId)) { errors.push('dependency cycle at ' + featureId); return; }
    if (visited.has(featureId)) return;
    visiting.add(featureId);
    for (const dep of list(features.get(featureId)?.depends_on)) {
      need(features.has(dep), 'unknown dependency ' + dep);
      if (features.has(dep)) visit(dep);
    }
    visiting.delete(featureId); visited.add(featureId);
  }
  for (const featureId of features.keys()) visit(featureId);
  for (const requirement of requirements.values()) if (requirement.mandatory === true) {
    need([...features.values()].some(f => list(f.acceptance_criteria).some(c => list(c?.requirement_ids).includes(requirement.id))), 'uncovered mandatory requirement ' + requirement.id);
  }
  for (const screenId of screens.keys()) need([...features.values()].some(f => list(f.design_screen_ids).includes(screenId)), 'unmapped design screen ' + screenId);
  for (const name of ['developer_documentation', 'end_user_manual']) {
    const guide = plan.documentation_plan?.[name];
    need(object(guide) && text(guide.entry_page) && Array.isArray(guide.required_topics) && guide.required_topics.length > 0 && guide.required_topics.every(text) && text(guide.verification), 'missing documentation plan ' + name);
  }
  need(Array.isArray(plan.final_checks) && plan.final_checks.length > 0 && plan.final_checks.every(text), 'final_checks must be nonempty');
  return errors;
}
function checked(plan) { const errors = validatePlan(plan); if (errors.length) reject('INVALID_PLAN: ' + errors.join('; ')); }

export function nextReadyFeature(plan, run) {
  checked(plan);
  const blocked = reason => ({ status: 'blocked', reason });
  if (plan.mode !== 'product' || run?.mode !== 'product') return blocked('feature-mode-requires-its-own-offer');
  if (run.plan_hash !== fingerprint(plan) || run.approved_plan_hash !== run.plan_hash) return blocked('plan-not-approved-or-changed');
  if (run.phase !== 'running' || run.owner_connected !== true || run.active_feature_id != null) return blocked('owner-not-ready');
  if (!['ready', 'unlimited'].includes(run.budget_status)) return blocked('budget-not-ready');
  if (plan.design.status === 'blocked') return blocked('design-inaccessible');
  if (!object(run.features) || Object.keys(run.features).some(key => !plan.features.some(f => f.id === key))) return blocked('invalid-feature-state');
  const statuses = plan.features.map(f => run.features[f.id]);
  if (statuses.some(s => !['planned', 'integrated'].includes(s))) return blocked('unfinished-or-invalid-feature-state');
  const next = plan.features.find(f => run.features[f.id] === 'planned' && f.depends_on.every(dep => run.features[dep] === 'integrated'));
  return next ? { status: 'ready', feature_id: next.id } : { status: 'awaiting-final-validation' };
}

export function affectedFeatures(plan, changes) {
  checked(plan);
  if (!object(changes) || Object.keys(changes).some(key => !['requirement_ids', 'screen_ids', 'feature_ids'].includes(key))) reject('INVALID_CHANGE');
  for (const [key, source] of [['requirement_ids', plan.requirements], ['screen_ids', plan.design.screens], ['feature_ids', plan.features]]) {
    if (changes[key] !== undefined && (!Array.isArray(changes[key]) || changes[key].some(ref => !source.some(item => item.id === ref)))) reject('UNKNOWN_CHANGE_REFERENCE');
  }
  const affected = new Set(list(changes.feature_ids));
  for (const feature of plan.features) if (feature.requirement_ids.some(ref => list(changes.requirement_ids).includes(ref)) || feature.design_screen_ids.some(ref => list(changes.screen_ids).includes(ref))) affected.add(feature.id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const feature of plan.features) if (!affected.has(feature.id) && feature.depends_on.some(dep => affected.has(dep))) { affected.add(feature.id); changed = true; }
  }
  return plan.features.filter(feature => affected.has(feature.id)).map(feature => feature.id);
}

// This checks evidence bindings only. It neither accepts untrusted reports nor merges Git.
export function checkpointIssues(plan, evidence, { feature_id, final = false } = {}) {
  checked(plan);
  const errors = [], need = (ok, message) => { if (!ok) errors.push(message); };
  if (!object(evidence)) return ['missing evidence'];
  const selected = final ? plan.features : plan.features.filter(feature => feature.id === feature_id);
  need(final || selected.length === 1, 'unknown checkpoint feature');
  const planHash = fingerprint(plan);
  need(evidence.plan_hash === planHash && sha(evidence.commit), 'checkpoint plan/commit mismatch');
  need(Number.isSafeInteger(evidence.round) && evidence.round > 0, 'invalid review round');
  need(evidence.checks === 'PASS', 'required checks incomplete');
  need(plan.design.status !== 'blocked', 'design inaccessible');
  if (final) need(plan.mode === 'product', 'final product checkpoint requires product mode');
  for (const name of ['developer_documentation', 'end_user_manual']) need(evidence.docs?.[name]?.status === 'COMPLETE' && evidence.docs[name].commit === evidence.commit, 'incomplete or stale ' + name);
  for (const role of roles) {
    const review = evidence.reviews?.[role];
    need(review?.verdict === 'PASS' && review.commit === evidence.commit && review.round === evidence.round && review.plan_hash === planHash && review.scope === (final ? 'product' : feature_id), 'missing/stale/wrong-scope review ' + role);
  }
  need(evidence.approver?.decision === 'APPROVE' && evidence.approver.commit === evidence.commit && evidence.approver.plan_hash === planHash && evidence.approver.round === evidence.round && evidence.approver.scope === (final ? 'product' : feature_id), 'approver incomplete or stale');
  for (const feature of selected) {
    if (final) need(evidence.integrated_features?.[feature.id] === true, 'feature not integrated ' + feature.id);
    for (const criterion of feature.acceptance_criteria) need(evidence.acceptance?.[criterion.id] === 'PASS', 'unverified acceptance ' + criterion.id);
    for (const screenId of feature.design_screen_ids) {
      const screen = plan.design.screens.find(s => s.id === screenId), comparison = evidence.visual?.[screenId];
      need(plan.design.status === 'ready' && comparison?.status === 'PASS' && comparison.commit === evidence.commit && comparison.reference_hash === screen.reference_hash && comparison.snapshot_hash === plan.design.snapshot_hash && fingerprint(comparison.viewports ?? []) === fingerprint(screen.viewports), 'missing/stale visual comparison ' + screenId);
    }
  }
  if (final) {
    need(evidence.scope === 'product' && evidence.product_checks === 'PASS', 'whole-product checks incomplete');
    for (const check of plan.final_checks) need(evidence.final_checks?.[check] === 'PASS', 'unverified final check ' + check);
  }
  return errors;
}

const actionStages = Object.freeze({
  approve_plan: ['awaiting-spec-approval'], approve_merge: ['awaiting-merge-approval'],
  pause: ['running'], resume: ['paused'],
  cancel: ['planning', 'awaiting-spec-approval', 'running', 'pause-requested', 'paused', 'blocked', 'needs-human', 'awaiting-merge-approval'],
  request_rework: ['paused', 'blocked', 'needs-human', 'awaiting-merge-approval'],
  request_plan_revision: ['planning', 'awaiting-spec-approval', 'paused', 'blocked', 'needs-human', 'awaiting-merge-approval']
});
// Trusted context is supplied by the authenticated owner bridge, never by request fields.
// Authentication, Origin/Host/CSRF, actual human receipts and atomic consumption are
// deliberately NOT supplied by this offline envelope validator.
export function validateControlCommand(command, context, now = Date.now()) {
  if (!object(command) || !object(context) || !Number.isSafeInteger(now)) reject('INVALID_COMMAND');
  const keys = ['id', 'action', 'owner_id', 'scope_id', 'mode', 'plan_hash', 'expected_version', 'expires_at', 'offer_id', 'offer_hash', 'note'];
  if (Object.keys(command).some(key => !keys.includes(key))) reject('UNKNOWN_COMMAND_FIELD');
  if (!id(command.id) || !Object.hasOwn(actionStages, command.action)) reject('UNKNOWN_COMMAND');
  if (context.connected !== true) reject('OWNER_DISCONNECTED');
  if (!id(command.owner_id) || command.owner_id !== context.owner_id || !id(command.scope_id) || command.scope_id !== context.scope_id || !MODES.includes(command.mode) || command.mode !== context.mode) reject('WRONG_OWNER_OR_SCOPE');
  if (!hash(command.plan_hash) || command.plan_hash !== context.plan_hash) reject('STALE_PLAN');
  if (!Number.isSafeInteger(command.expected_version) || command.expected_version < 0 || command.expected_version !== context.state_version) reject('STALE_STATE');
  if (!Number.isSafeInteger(command.expires_at) || command.expires_at <= now) reject('EXPIRED_COMMAND');
  if (!actionStages[command.action].includes(context.stage)) reject('ILLEGAL_STAGE');
  if (command.action.startsWith('approve_')) {
    const offer = context.offer;
    if (!object(offer) || offer.kind !== command.action || !id(command.offer_id) || command.offer_id !== offer.id || !hash(command.offer_hash) || command.offer_hash !== offer.hash || offer.plan_hash !== command.plan_hash || offer.state_version !== command.expected_version || !Number.isSafeInteger(offer.expires_at) || offer.expires_at <= now) reject('STALE_OR_WRONG_OFFER');
  } else if (command.offer_id !== undefined || command.offer_hash !== undefined) reject('UNEXPECTED_OFFER');
  if (['request_rework', 'request_plan_revision'].includes(command.action)) {
    if (!text(command.note) || command.note.length > 10000) reject('INVALID_NOTE');
  } else if (command.note !== undefined) reject('UNEXPECTED_NOTE');
  return { status: 'valid-envelope', command_hash: fingerprint(command) };
}

// Persist this decision and its receipt under the owner's lock before effects.
// An exact replay may return an old receipt even after expiry; it never re-executes.
export function replayDecision(command, existing) {
  const commandHash = fingerprint(command);
  if (existing === undefined) return { status: 'new', command_hash: commandHash };
  if (!object(existing) || existing.id !== command.id || existing.command_hash !== commandHash || !object(existing.receipt)) reject('COMMAND_ID_CONFLICT');
  return { status: 'duplicate', receipt: structuredClone(existing.receipt) };
}
