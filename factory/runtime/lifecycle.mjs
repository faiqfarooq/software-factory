import { digest, stamp, uid, event } from './storage.mjs';
import { REVIEWERS } from './profiles.mjs';
import { integrationScopes } from './integrations.mjs';

export const STAGES = Object.freeze({
  feasibility: 'Feasibility', requirements: 'Requirements', specification: 'Specification & plan',
  design: 'System & UI design', implementation: 'Implementation', qa: 'Testing & QA',
  integration: 'Feature integration', acceptance: 'Product acceptance', 'final-merge': 'Final merge'
});
const PRODUCT = ['feasibility', 'requirements', 'specification', 'design'];
const FEATURE = ['requirements', 'specification', 'design', 'implementation', 'qa', 'integration'];
const FINAL = ['acceptance', 'final-merge'];
const TERMINAL = ['merged', 'cancelled'];
const active = s => ['pending', 'running', 'uncertain'].includes(s);
const fail = message => { throw new Error(message); };
const text = (v, max = 50000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !v.includes('\0');
const sha = v => typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const strings = v => Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every(x => text(x, 3000));
const only = (v, names) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !names.includes(k))) fail('Unknown lifecycle fields.'); };
export const slug = v => String(v).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'work';
export const unit = job => job.mode === 'feature' ? job : job.phase === 'feature' ? job.features.find(f => f.id === job.active_feature) : job;
export const sequence = job => job.phase === 'product' ? PRODUCT : job.phase === 'final' ? FINAL : job.mode === 'feature' ? [...PRODUCT, ...FEATURE.slice(3)] : FEATURE;
export const stage = job => sequence(job)[unit(job)?.cursor || 0];
export const stageKey = job => (job.phase === 'feature' ? job.active_feature : job.phase) + ':' + stage(job);
export const currentPlan = job => unit(job)?.plan || job.plan;
export const hasActiveTools = (state, job) => (state.integration_runs || []).some(r => r.job_id === job.id && ['running', 'uncertain'].includes(r.status));
export const hasActiveWorkers = job => (job.workers || []).some(w => ['running', 'uncertain'].includes(w.status));
export function newLifecycle(command) {
  const input = command.input, id = uid(), title = input.title || input.requirements.slice(0, 100);
  const branch = input.mode + '/' + slug(title) + '-' + id.slice(0, 8);
  return { id, lifecycle: 2, mode: input.mode, title, requirements: input.requirements, design: input.design || '',
    status: 'planning', phase: input.mode === 'product' ? 'product' : 'feature', active_feature: input.mode === 'product' ? null : 'standalone',
    cursor: 0, stages: [], decisions: [], workers: [], features: [], plan: null, offer: null,
    workspace: { branch, target: input.target_branch || null, base_commit: null, prepared: false },
    planning_docs_consent: input.allow_documentation === true, reviews: [], checks: [], documentation: [], usage: null, created_at: stamp() };
}
// A standalone feature uses the job itself; product features have their own branch, plan and approvals.
export function currentUnit(job) { return job.mode === 'feature' ? job : unit(job); }
function context(job) { return job.mode === 'feature' ? job : unit(job); }
export function nextFeature(job) { return job.features.find(f => f.status !== 'accepted'); }
function approvalHash(job) {
  const u = context(job);
  return digest(JSON.stringify({ stages: u.stages, plan: u.plan, commit: u.commit, workspace: u.workspace,
    checks: u.checks, reviews: u.reviews, documentation: u.documentation, approver: u.approver,
    preview: u.preview, preview_commit: u.preview_commit,
    roadmap: job.phase === 'product' ? job.features.map(f => ({ id: f.id, status: f.status, workspace: f.workspace, acceptance: f.acceptance, depends_on: f.depends_on })) : undefined }));
}
function offer(job, kind = 'approve-stage') {
  job.offer = { id: uid(), kind, stage: stage(job), unit: job.active_feature || job.phase,
    hash: approvalHash(job), commit: context(job).commit || job.commit || null,
    expires_at: new Date(Date.now() + 24 * 3600000).toISOString() };
}
export function validateLifecycleCommand(state, input, job) {
  if (input.action === 'request') {
    only(input.input, ['mode', 'title', 'target_branch', 'requirements', 'design', 'allow_documentation']);
    const p = input.input;
    if (!['feature', 'product'].includes(p.mode) || !text(p.requirements) || (p.title !== undefined && !text(p.title, 120)) ||
        (p.design !== undefined && typeof p.design !== 'string') || (p.target_branch !== undefined && !text(p.target_branch, 200)) ||
        (p.allow_documentation !== undefined && typeof p.allow_documentation !== 'boolean')) fail('Choose a title, mode and requirements.');
    if (input.job_id !== undefined || input.offer_id !== undefined || state.jobs.some(j => !TERMINAL.includes(j.status))) fail('Finish or cancel current work before starting another branch.');
    if (state.commands.some(c => active(c.status))) fail('Resolve outstanding commands before starting work.');
    return;
  }
  if (job.needs_migration) {
    if (!['migrate-workflow', 'cancel'].includes(input.action)) fail('Adopt the staged workflow first. Old approvals cannot authorize new stages.');
  }
  const allowed = ['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance', 'revise', 'revise-product', 'rework', 'pause', 'resume', 'cancel', 'migrate-workflow'];
  if (!allowed.includes(input.action)) fail('Use the current stage approval; the old two-gate workflow cannot advance this job.');
  if (TERMINAL.includes(job.status)) fail('This job is already complete.');
  if (input.action === 'migrate-workflow' && !job.needs_migration) fail('No migration is needed.');
  if (['revise', 'revise-product', 'rework', 'resume', 'migrate-workflow'].includes(input.action) && (hasActiveTools(state, job) || hasActiveWorkers(job))) fail('Reconcile active or uncertain workers/tools before revising or resuming.');
  if (['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance'].includes(input.action)) {
    if (!job.offer || job.offer.id !== input.offer_id || job.offer.kind !== input.action || Date.parse(job.offer.expires_at) <= Date.now()) fail('Approval offer changed or expired.');
    if (job.offer.hash !== approvalHash(job)) fail('Stage deliverable or evidence changed. Review again.');
    if (input.input !== undefined || hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Reconcile active tools/workers before approval.');
    if (input.action === 'start-feature') {
      if (job.status !== 'ready-feature' || !nextFeature(job) || !nextFeature(job).depends_on.every(id => job.features.some(f => f.id === id && f.status === 'accepted'))) fail('The next feature has unfinished dependencies.');
    } else if (input.action === 'start-acceptance') {
      if (job.status !== 'ready-acceptance' || job.features.some(f => f.status !== 'accepted')) fail('Accept every feature before product acceptance.');
    } else if (job.status !== 'awaiting-stage' || job.offer.stage !== stage(job)) fail('Stage deliverable changed. Review again.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job)) && !evidenceReady(context(job))) fail('Quality evidence changed. Review again.');
  } else {
    if (input.offer_id !== undefined) fail('Unexpected approval offer.');
    if (['revise', 'revise-product', 'rework'].includes(input.action)) {
      only(input.input, ['note', 'stage']);
      const stages = input.action === 'revise-product' ? PRODUCT : sequence(job);
      if (input.action === 'revise-product' && job.mode !== 'product') fail('Only products have a parent roadmap.');
      if (!text(input.input.note, 10000) || (input.input.stage !== undefined && (!stages.includes(input.input.stage) || (input.action !== 'revise-product' && stages.indexOf(input.input.stage) > context(job).cursor)))) fail('Describe the changes and a current or earlier stage.');
      if (!['awaiting-stage', 'blocked', 'paused', 'ready-feature', 'ready-acceptance'].includes(job.status)) fail('Wait for a checkpoint before revision.');
      if (job.configuration_changed && job.phase === 'final' && input.action !== 'revise-product') fail('Tool settings changed. Revise the product specification before acceptance.');
    } else if (input.input !== undefined) fail('Unexpected action input.');
    if (input.action === 'resume' && job.status !== 'paused') fail('Only paused work can resume.');
    if (input.action === 'pause' && !['planning', 'running', 'reviewing'].includes(job.status)) fail('Work is already at a checkpoint.');
  }
}
export function claimLifecycle(state, command, job) {
  if (command.action === 'request') { const created = newLifecycle(command); created.integration_profile = state.integration_profile || []; state.jobs.push(created); command.job_id = created.id; return created; }
  if (command.action === 'migrate-workflow') {
    if (hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Reconcile previous work before migration.');
    const history = structuredClone(job);
    const fresh = newLifecycle({ input: { mode: job.mode, title: job.title || job.requirements.slice(0, 100), requirements: job.requirements, design: job.design, target_branch: job.plan?.target_branch } });
    for (const key of Object.keys(job)) delete job[key];
    Object.assign(job, fresh, { id: history.id, previous_workflow: history, message: 'Previous work preserved. Review all stages; no old approval was carried forward.' });
  } else if (['approve-stage', 'approve-merge'].includes(command.action)) {
    const u = context(job), s = stage(job), record = u.stages.find(r => r.stage === s);
    job.decisions.push({ action: command.action, unit: job.active_feature || job.phase, stage: s, hash: job.offer.hash, commit: job.offer.commit, command_id: command.id, time: stamp() });
    record.approved = true; record.approved_at = stamp();
    if (s === 'specification') { u.approved_plan_hash = digest(JSON.stringify(u.plan)); if (job.mode === 'feature' || job.phase === 'product') job.approved_plan_hash = u.approved_plan_hash; }
    if (['integration', 'final-merge'].includes(s)) {
      job.merge_receipt = { command_id: command.id, offer: structuredClone(job.offer), time: stamp() }; job.status = 'merging';
    } else if (job.phase === 'product' && s === 'design') {
      job.status = 'ready-feature'; offer(job, 'start-feature'); return job;
    } else if (job.phase === 'final' && s === 'acceptance') {
      u.cursor++; job.status = 'reviewing';
    } else { u.cursor++; job.status = ['qa'].includes(stage(job)) ? 'reviewing' : ['implementation'].includes(stage(job)) ? 'running' : 'planning'; }
    job.offer = null;
  } else if (command.action === 'start-feature') {
    const feature = nextFeature(job); feature.status = 'running'; feature.cursor = 0; feature.stages ||= [];
    job.active_feature = feature.id; job.phase = 'feature'; job.status = 'planning'; job.offer = null; job.merge_receipt = null;
  } else if (command.action === 'start-acceptance') {
    job.phase = 'final'; job.active_feature = null; job.cursor = 0; job.final_stages = job.stages; job.stages = []; job.status = 'reviewing'; job.offer = null; job.merge_receipt = null;
  } else if (['revise', 'revise-product', 'rework'].includes(command.action)) {
    if (command.action === 'revise-product') {
      job.archived_cycles ||= []; job.archived_cycles.push({ phase: job.phase, active_feature: job.active_feature, stages: structuredClone(job.stages), features: structuredClone(job.features), time: stamp() });
      if (job.phase === 'final') job.stages = job.final_stages || [];
      job.phase = 'product'; job.active_feature = null;
    }
    const u = context(job), selected = command.input.stage || (command.action === 'revise-product' ? 'specification' : stage(job)), index = sequence(job).indexOf(selected);
    if (hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Reconcile workers before revising.');
    u.history ||= []; u.history.push({ time: stamp(), stages: structuredClone(u.stages), plan: u.plan, commit: u.commit, reviews: u.reviews, checks: u.checks, documentation: u.documentation, features: job.phase === 'product' ? structuredClone(job.features) : undefined });
    u.cursor = index; u.stages = u.stages.filter(r => sequence(job).indexOf(r.stage) < index); u.reviews = []; u.checks = []; u.approver = null;
    if (index <= sequence(job).indexOf('specification')) u.approved_plan_hash = null;
    if (job.configuration_changed) {
      const spec = sequence(job).indexOf('specification');
      if (spec >= 0 && index > spec) fail('Tool settings changed. Revise specification or an earlier stage.');
      job.configuration_changed = false;
    }
    if (job.phase === 'product' && job.features.length) {
      // Product changes never silently rewrite integrated history or skip dependent reviews.
      job.revalidation_required = true;
      job.features.forEach(f => { f.previous_acceptance = f.status; f.status = 'planned'; f.workspace = { ...f.workspace, prepared: false, branch: 'feature/' + slug(f.title) + '-' + uid().slice(0, 8), base_commit: null }; f.stages = []; f.cursor = 0; });
    }
    job.offer = null; job.merge_receipt = null; job.preview = null; job.status = selected === 'implementation' ? 'running' : selected === 'qa' ? 'reviewing' : 'planning';
  } else if (command.action === 'resume') { job.status = job.resume_status || 'planning'; job.offer = null; }
  return job;
}
function validatePlan(plan, job) {
  only(plan, ['summary', 'scope', 'acceptance', 'permissions', 'budget', 'target_branch', 'base_commit', 'documentation', 'features', 'integrations']);
  if (!text(plan.summary) || !strings(plan.scope) || !strings(plan.acceptance) || !strings(plan.permissions) || !(typeof plan.budget === 'number' ? Number.isFinite(plan.budget) && plan.budget >= 0 : text(plan.budget, 3000)) ||
      !text(plan.target_branch, 200) || !sha(plan.base_commit) || !['developer', 'user'].every(k => plan.documentation?.includes(k))) fail('Plan needs scope, acceptance, permissions, budget, committed base, target and both guides.');
  integrationScopes(plan.integrations);
  const w = context(job).workspace;
  if (!w?.prepared || plan.target_branch !== w.target || plan.base_commit !== w.base_commit) fail('Plan must match the prepared branch and its actual target/base.');
  if (job.phase === 'product') {
    if (!Array.isArray(plan.features) || !plan.features.length || plan.features.length > 100) fail('Product specification requires an ordered feature roadmap.');
    const seen = new Set();
    for (const f of plan.features) {
      only(f, ['id', 'title', 'depends_on', 'acceptance']);
      if (!/^[a-zA-Z0-9_-]{1,60}$/.test(f.id) || seen.has(f.id) || !text(f.title, 120) || !Array.isArray(f.depends_on) || new Set(f.depends_on).size !== f.depends_on.length ||
          !f.depends_on.every(id => seen.has(id)) || !strings(f.acceptance)) fail('Roadmap needs unique features, acceptance checks and dependencies on earlier features only.');
      seen.add(f.id);
    }
    if (!plan.acceptance.every(requirement => plan.features.some(f => f.acceptance.includes(requirement)))) fail('Map every product acceptance criterion to at least one feature.');
  } else if (job.mode === 'product' && job.phase === 'feature' && !context(job).acceptance.every(requirement => plan.acceptance.includes(requirement))) {
    fail('The feature plan cannot drop approved roadmap acceptance criteria. Revise the product roadmap first.');
  }
}
export function evidenceReady(u) {
  const reviews = REVIEWERS.map(role => u.reviews?.find(r => r.role === role));
  return Boolean(sha(u.commit) && u.checks?.length && u.checks.every(c => c.status === 'passed' && c.commit === u.commit) &&
    reviews.every(r => r?.verdict === 'PASS' && r.commit === u.commit && text(r.reviewer_id, 200)) && new Set(reviews.map(r => r?.reviewer_id)).size === 5 &&
    ['developer', 'user'].every(kind => u.documentation?.some(d => d.kind === kind && d.status === 'complete' && d.commit === u.commit && text(d.entry, 400))) &&
    u.approver?.verdict === 'APPROVE' && u.approver.commit === u.commit);
}
export function publishLifecycle(state, input, command, job) {
  only(input, ['command_id', 'job_id', 'status', 'deliverable', 'plan', 'checks', 'reviews', 'documentation', 'usage', 'commit', 'approver', 'message', 'preview', 'preview_commit']);
  const u = context(job), s = stage(job);
  if (['paused', 'cancelled', 'blocked'].includes(input.status)) {
    if ((input.status === 'paused' && command.action !== 'pause') || (input.status === 'cancelled' && command.action !== 'cancel')) fail('Pause/cancel needs its matching command.');
    if (hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Reconcile workers and tools before confirming a stop.');
    job.resume_status = job.status; job.status = input.status; job.offer = null; job.message = input.message || '';
    if (['paused', 'cancelled'].includes(input.status)) for (const c of state.commands.filter(c => c.job_id === job.id && c.id !== command.id && ['running', 'uncertain'].includes(c.status))) c.status = 'blocked';
    return job;
  }
  if (['pause', 'cancel'].includes(command.action) || ['paused', 'cancelled', 'merging'].includes(job.status)) fail('This command cannot publish stage progress.');
  if (!['planning', 'running', 'reviewing', 'awaiting-stage'].includes(input.status)) fail('Publish the current stage only. Git integration is recorded through the workspace bridge.');
  if (['awaiting-stage', 'ready-feature', 'ready-acceptance', 'merged'].includes(job.status)) fail('A human decision is required before more work.');
  if (input.plan !== undefined) { if (s !== 'specification') fail('Plans can change only in the specification stage.'); validatePlan(input.plan, job); u.plan = structuredClone(input.plan); u.approved_plan_hash = null;
    if (job.phase === 'product') job.features = input.plan.features.map((f, i) => ({ ...structuredClone(f), builder_session: job.features.find(old => old.id === f.id)?.builder_session,
      status: 'planned', cursor: 0, stages: [], reviews: [], checks: [], documentation: [], workspace: { branch: 'feature/' + String(i + 1).padStart(3, '0') + '-' + slug(f.title) + '-' + uid().slice(0, 8), target: job.workspace.branch, prepared: false, base_commit: null } }));
  }
  if (input.commit !== undefined) {
    if (!sha(input.commit) || !['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(s)) fail('Commit evidence belongs to implementation and later stages.');
    if (u.commit && u.commit !== input.commit && s !== 'implementation') fail('Rework implementation and refresh reviews after changing the commit.');
    if (u.commit && u.commit !== input.commit) { u.checks = []; u.reviews = []; u.documentation = []; u.approver = null; }
    u.commit = input.commit;
  }
  for (const k of ['checks', 'reviews', 'documentation']) if (input[k] !== undefined) {
    if (!['qa', 'integration', 'acceptance', 'final-merge'].includes(s) || !Array.isArray(input[k]) || input[k].length > 500) fail('Quality evidence belongs to QA and acceptance.');
    for (const item of input[k]) {
      if (k === 'checks') {
        only(item, ['label', 'status', 'detail', 'commit', 'kind']);
        if (!text(item.label, 1000) || !['passed', 'needs-action', 'not-checked'].includes(item.status) || !text(item.detail, 5000) || !sha(item.commit)) fail('Check evidence needs a label, status, actual detail and commit.');
      } else if (k === 'reviews') {
        only(item, ['role', 'verdict', 'commit', 'reviewer_id', 'summary']);
        if (!REVIEWERS.includes(item.role) || !['PASS', 'FAIL', 'BLOCKED'].includes(item.verdict) || !sha(item.commit) || !text(item.reviewer_id, 200) || !text(item.summary, 5000)) fail('Review evidence needs its role, verdict, commit, reviewer and summary.');
      } else {
        only(item, ['kind', 'status', 'commit', 'entry', 'text']);
        if (!['developer', 'user'].includes(item.kind) || !['complete', 'needs-action'].includes(item.status) || !sha(item.commit) || !text(item.entry, 400) || (item.text !== undefined && !text(item.text))) fail('Guide evidence needs kind, status, commit and actual entry.');
      }
    }
    u[k] = structuredClone(input[k]);
  }
  if (input.approver !== undefined) {
    if (!['qa', 'integration', 'acceptance', 'final-merge'].includes(s)) fail('Technical approval belongs to QA and acceptance.');
    only(input.approver, ['verdict', 'commit']); u.approver = structuredClone(input.approver);
  }
  if (input.usage !== undefined) {
    only(input.usage, ['tokens', 'usd', 'completeness']);
    if (!['complete', 'partial', 'unavailable'].includes(input.usage.completeness) || !['tokens', 'usd'].every(k => input.usage[k] === null || (Number.isFinite(input.usage[k]) && input.usage[k] >= 0))) fail('Report actual usage and its completeness; unknown values are null.');
    u.usage = structuredClone(input.usage);
    if (typeof u.plan?.budget === 'number' && u.usage.usd !== null && u.usage.usd > u.plan.budget) { job.status = 'blocked'; job.offer = null; job.message = 'Reported usage exceeded the approved budget. Revise the specification and budget before more work.'; return job; }
  }
  if (input.preview === null) { u.preview = null; u.preview_commit = null; }
  else if (input.preview !== undefined) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(input.preview) || !sha(input.preview_commit)) fail('Preview needs a loopback URL and the actual served commit.');
    u.preview = input.preview; u.preview_commit = input.preview_commit;
  }
  if (input.message !== undefined) job.message = String(input.message).slice(0, 3000);
  if (input.status === 'awaiting-stage') {
    if (hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Finish/reconcile current workers and tools before requesting approval.');
    only(input.deliverable, ['summary', 'content', 'limitations', 'coverage']);
    if (!text(input.deliverable.summary, 3000) || !text(input.deliverable.content) ||
        (input.deliverable.limitations !== undefined && !strings(input.deliverable.limitations))) fail('Show a substantive stage deliverable and any limitations.');
    if (input.deliverable.coverage !== undefined) {
      if (!Array.isArray(input.deliverable.coverage) || input.deliverable.coverage.length > 500) fail('Invalid acceptance coverage.');
      for (const c of input.deliverable.coverage) { only(c, ['requirement', 'check']); if (!text(c.requirement, 3000) || !text(c.check, 1000)) fail('Acceptance coverage needs requirement/check names.'); }
    }
    if (s === 'specification' && !u.plan) fail('Publish the complete feature/product specification.');
    if (['design', 'implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(s) && (!u.approved_plan_hash || u.approved_plan_hash !== digest(JSON.stringify(u.plan)))) fail('Approve the current specification before design or implementation.');
    if (s === 'implementation' && !sha(u.commit)) fail('Commit the feature before offering implementation review.');
    if (['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(s) && u.preview && u.preview_commit !== u.commit) fail('Refresh the local preview for the exact reviewed commit or explicitly revise its preview limitation.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(s) && !evidenceReady(u)) fail('Five passing independent reviews, checks, both guides and technical approval must match this commit.');
    if (['qa', 'acceptance'].includes(s)) {
      const coverage = input.deliverable.coverage;
      const required = u.plan?.acceptance || job.plan?.acceptance || [];
      if (!Array.isArray(coverage) || required.some(requirement => !coverage.some(c => c.requirement === requirement && u.checks.some(check => check.label === c.check && check.commit === u.commit && check.status === 'passed')))) fail('Map every acceptance criterion to a passing check.');
      for (const review of u.reviews) {
        if (!job.workers.some(w => w.role === review.role && w.session === review.reviewer_id && w.status === 'completed' && w.commit === u.commit && w.feature === job.active_feature && w.stage === s)) fail('Each reviewer needs a completed matching worker receipt for this stage/commit.');
        if (review.reviewer_id === u.builder_session || review.reviewer_id === state.owner?.id) fail('The builder/owner cannot be an independent reviewer.');
      }
      if (!job.workers.some(w => w.role === 'approver' && w.status === 'completed' && w.commit === u.commit && w.feature === job.active_feature && w.stage === s)) fail('Record the completed technical approver execution.');
      if (job.phase === 'final' && u.reviews.some(r => job.features.some(f => f.reviews?.some(old => old.reviewer_id === r.reviewer_id)))) fail('Product acceptance needs fresh independent reviewer sessions, not child verdicts.');
    }
    const record = { stage: s, ...structuredClone(input.deliverable), commit: u.commit || null, approved: false, time: stamp() };
    u.stages = u.stages.filter(r => r.stage !== s); u.stages.push(record); job.status = 'awaiting-stage';
    offer(job, ['integration', 'final-merge'].includes(s) ? 'approve-merge' : 'approve-stage');
  } else { job.status = input.status; }
  job.updated_at = stamp(); event(state, STAGES[s] + ': ' + job.status + '.'); return job;
}
export function recordIntegration(job, commit) {
  const u = context(job); u.integrated_commit = commit; u.status = 'accepted';
  if (job.mode === 'product' && job.phase === 'feature') { job.accepted_product_head = commit; job.accepted_preview = u.preview && u.preview_commit === commit ? { url: u.preview, commit, branch: u.workspace.target } : null; }
  job.merge_history ||= []; job.merge_history.push({ receipt: job.merge_receipt, branch: u.workspace.branch, target: u.workspace.target, commit, time: stamp() });
  job.merge_receipt = null;
  if (job.mode === 'feature' || job.phase === 'final') { job.status = 'merged'; job.target_commit = commit; job.commit = u.commit; job.offer = null; }
  else { job.active_feature = null; job.phase = 'product'; job.status = nextFeature(job) ? 'ready-feature' : 'ready-acceptance'; offer(job, nextFeature(job) ? 'start-feature' : 'start-acceptance'); }
}
export function recordWorker(state, config, input) {
  only(input, ['owner_id', 'command_id', 'job_id', 'id', 'role', 'model', 'session', 'task', 'status', 'result', 'tokens', 'usd', 'commit']);
  const job = state.jobs.find(j => j.id === input.job_id), command = state.commands.find(c => c.id === input.command_id && c.job_id === job?.id && ['running', 'uncertain'].includes(c.status));
  if (!job || job.lifecycle !== 2 || !command || command.owner_id !== input.owner_id || !/^[A-Za-z0-9_-]{1,80}$/.test(input.id) || !Object.hasOwn(config.roles, input.role) || !text(input.task, 2000) || !text(input.session, 200) ||
      !['running', 'completed', 'failed', 'uncertain', 'stopped'].includes(input.status) || input.model !== config.models[input.role]) fail('Worker needs the current command, actual session and configured role/model.');
  const u = context(job), s = stage(job), permitted = s === 'implementation' ? ['builder', 'documentation-writer'] : s === 'design' ? ['spec-writer', 'builder'] : ['qa', 'acceptance', 'integration', 'final-merge'].includes(s) ? [...REVIEWERS, 'approver'] : ['spec-writer'];
  if (!permitted.includes(input.role)) fail('Worker role is not permitted at this stage.');
  const existing = job.workers.find(w => w.id === input.id);
  if (command.status === 'uncertain' && (!existing || !['completed', 'failed', 'stopped'].includes(input.status))) fail('Only reconcile an existing interrupted worker; never relaunch it.');
  if (existing && (existing.session !== input.session || existing.role !== input.role || existing.model !== input.model || existing.feature !== job.active_feature)) fail('Worker identity cannot change.');
  if (input.role === 'builder') {
    if (u.builder_session && u.builder_session !== input.session) fail('Resume the same feature builder.');
    u.builder_session = input.session;
  }
  if (input.status === 'running' && job.workers.some(w => w.id !== input.id && w.status === 'running' && (['builder', 'documentation-writer'].includes(input.role) || ['builder', 'documentation-writer'].includes(w.role)))) fail('Keep writers idle during reviews and use one writer at a time.');
  if (['paused', 'cancelled', 'awaiting-stage', 'ready-feature', 'ready-acceptance', 'merged'].includes(job.status)) fail('A human checkpoint blocks worker dispatch.');
  const worker = { id: input.id, role: input.role, model: input.model, provider: config.roles[input.role], session: input.session,
    feature: job.active_feature, stage: s, task: input.task, status: input.status, result: typeof input.result === 'string' ? input.result.slice(0, 3000) : '',
    tokens: Number.isFinite(input.tokens) && input.tokens >= 0 ? input.tokens : null, usd: Number.isFinite(input.usd) && input.usd >= 0 ? input.usd : null,
    commit: input.commit || u.commit || null, started_at: existing?.started_at || stamp(), updated_at: stamp(), identity: 'owner-reported' };
  if (existing) Object.assign(existing, worker); else job.workers.push(worker);
  event(state, input.role + ': ' + input.status + '.'); return { id: worker.id, status: worker.status };
}
export function lifecycleView(job) {
  if (job.lifecycle !== 2) return { needs_migration: Boolean(job.needs_migration) };
  const clean = r => ({ stage: r.stage, summary: r.summary, content: r.content, limitations: r.limitations || [], coverage: r.coverage || [], approved: r.approved, time: r.time, commit: r.commit });
  const u = context(job);
  return { lifecycle: 2, title: job.title, phase: job.phase, active_feature: job.active_feature, stage: stage(job),
    timeline: sequence(job).map(id => ({ id, label: STAGES[id], status: u.stages.find(r => r.stage === id)?.approved ? 'approved' : stage(job) === id ? job.status : 'locked' })),
    deliverables: u.stages.map(clean), decisions: job.decisions.map(({ command_id, ...d }) => d),
    workspace: u.workspace, product_workspace: job.workspace, needs_migration: false,
    features: job.features.map(f => ({ id: f.id, title: f.title, depends_on: f.depends_on, acceptance: f.acceptance, status: f.status, workspace: f.workspace, integrated_commit: f.integrated_commit, stages: (f.stages || []).map(clean), checks: f.checks || [], reviews: (f.reviews || []).map(({ reviewer_id, ...r }) => r), documentation: f.documentation || [], usage: f.usage || null })),
    workers: job.workers.map(({ session, ...w }) => w),
    plan: u.plan || job.plan, plan_approved: Boolean(u.plan && u.approved_plan_hash === digest(JSON.stringify(u.plan))),
    checks: u.checks || [], reviews: (u.reviews || []).map(({ reviewer_id, ...r }) => r), documentation: u.documentation || [], usage: u.usage || null,
    commit: u.commit || null, preview: u.preview || null, preview_commit: u.preview_commit || null, accepted_preview: job.accepted_preview || null,
    integration_checks: (job.integration_checks || []).map(c => ({ unit: c.unit, branch: c.branch, commit: c.commit, time: c.time, checks: c.checks })),
    merge_history: (job.merge_history || []).map(m => ({ branch: m.branch, target: m.target, commit: m.commit, time: m.time })) };
}
