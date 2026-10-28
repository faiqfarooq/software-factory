import { digest, stamp, uid, event } from './storage.mjs';
import { REVIEWERS } from './profiles.mjs';
import { integrationScopes } from './integrations.mjs';
import { wordEvidence } from './documents.mjs';
import { purpose, mobileRequest, mobileAnalysis, validateMobilePlan, mobileQuality, mobileRuns } from './mobile.mjs';
import { isStreamlined, generatedDesign, validatePlanExtras, rememberPlan, approvePlanVersion, planLibraryView, featurePlan, revisionImpact } from './plans.mjs';

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
export const sequence = job => isStreamlined(job) ? (job.phase === 'product' ? ['specification'] : job.phase === 'final' ? FINAL : job.mode === 'feature' ? ['specification', ...FEATURE.slice(3)] : FEATURE.slice(3)) : job.phase === 'product' ? PRODUCT : job.phase === 'final' ? FINAL : job.mode === 'feature' ? [...PRODUCT, ...FEATURE.slice(3)] : FEATURE;
export const stage = job => sequence(job)[unit(job)?.cursor || 0];
export const stageKey = job => (job.phase === 'feature' ? job.active_feature : job.phase) + ':' + stage(job);
export const currentPlan = job => unit(job)?.plan || job.plan;
export const hasActiveTools = (state, job) => (state.integration_runs || []).some(r => r.job_id === job.id && ['running', 'uncertain'].includes(r.status));
export const hasActiveWorkers = job => (job.workers || []).some(w => ['running', 'uncertain'].includes(w.status));
export function newLifecycle(command) {
  const input = command.input, id = uid(), title = input.title || input.requirements.slice(0, 100);
  const branch = input.mode + '/' + slug(title) + '-' + id.slice(0, 8);
  return { id, lifecycle: 2, purpose: purpose(input.purpose), mobile: input.mobile ? mobileRequest(input.mobile) : null, mode: input.mode, title, requirements: input.requirements, design: input.design || '',
    workflow_profile: input.workflow_profile || 'strict', workflow_version: input.workflow_profile === 'streamlined' ? 3 : 2,
    status: 'planning', phase: input.mode === 'product' ? 'product' : 'feature', active_feature: input.mode === 'product' ? null : 'standalone',
    cursor: 0, stages: [], decisions: [], workers: [], features: [], plan: null, offer: null, documentation_format: 'docx',
    workspace: command.workspace_binding ? structuredClone(command.workspace_binding) : { branch, target: input.target_branch || null, base_commit: null, prepared: false },
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
    preview: u.preview, preview_commit: u.preview_commit, preview_source: u.preview_source, mobile_runs: u.mobile_runs, mobile: job.mobile, mobile_analysis: job.mobile_analysis,
      ...(isStreamlined(job) ? { workflow_profile: job.workflow_profile, master_version: job.approved_master_version || null } : {}),
      roadmap: job.phase === 'product' ? job.features.map(f => ({ id: f.id, status: f.status, workspace: f.workspace, acceptance: f.acceptance, depends_on: f.depends_on })) : undefined }));
}
function offer(job, kind = 'approve-stage') {
  job.offer = { id: uid(), kind, stage: stage(job), unit: job.active_feature || job.phase,
    hash: approvalHash(job), commit: context(job).commit || job.commit || null,
    expires_at: new Date(Date.now() + 24 * 3600000).toISOString() };
}
export const currentOfferHash = job => approvalHash(job);
export const startReadinessReady = job => {const feature=nextFeature(job),readiness=job.feature_readiness?.[feature?.id];return Boolean(feature&&(!feature.readiness?.length || readiness?.plan_hash===job.approved_plan_hash&&feature.readiness.every(label=>readiness.checks.some(c=>c.label===label&&c.status==='passed'))));};
export const refreshLifecycleOffer = (job, kind = 'approve-stage') => { offer(job,kind); return job.offer; };
export function validateLifecycleCommand(state, input, job) {
  if (input.action === 'request') {
    only(input.input, ['mode', 'title', 'target_branch', 'requirements', 'design', 'allow_documentation', 'purpose', 'mobile', 'repositories', 'workflow_profile']);
    const p = input.input;
    if (p.workflow_profile !== undefined && !['strict', 'streamlined'].includes(p.workflow_profile)) fail('Choose Strict or Streamlined workflow.');
    if (purpose(p.purpose) === 'web-to-mobile') mobileRequest(p.mobile);
    else if (p.mobile !== undefined) fail('Mobile settings require a web-to-mobile request.');
    if (!['feature', 'product'].includes(p.mode) || !text(p.requirements) || (p.title !== undefined && !text(p.title, 120)) ||
        (p.design !== undefined && typeof p.design !== 'string') || (p.target_branch !== undefined && !text(p.target_branch, 200)) ||
        (p.allow_documentation !== undefined && typeof p.allow_documentation !== 'boolean')) fail('Choose a title, mode and requirements.');
    if (input.job_id !== undefined || input.offer_id !== undefined || state.jobs.some(j => !j.trashed_at && !TERMINAL.includes(j.status))) fail('Finish, cancel or move current work to Plan trash before a new request.');
    if (state.commands.some(c => active(c.status))) fail('Resolve outstanding commands before starting work.');
    return;
  }
  if (job.needs_migration) {
    if (!['migrate-workflow', 'cancel'].includes(input.action)) fail('Adopt the staged workflow first. Old approvals cannot authorize new stages.');
  }
  const allowed = ['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance', 'revise', 'revise-product', 'rework', 'pause', 'resume', 'cancel', 'migrate-workflow'];
  if (!allowed.includes(input.action)) fail('Use the current stage approval; the old two-gate workflow cannot advance this job.');
  if (TERMINAL.includes(job.status)) fail('This job is already complete.');
  if (job.trashed_at) fail('Restore this plan before running it.');
  if (input.action === 'migrate-workflow' && !job.needs_migration) fail('No migration is needed.');
  if (['revise', 'revise-product', 'rework', 'resume', 'migrate-workflow'].includes(input.action) && (hasActiveTools(state, job) || hasActiveWorkers(job))) fail('Reconcile active or uncertain workers/tools before revising or resuming.');
  if (['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance'].includes(input.action)) {
    if(job.configuration_changed)fail('Configuration changed. Reconcile and revise the specification before any approval.');
    if (!job.offer || job.offer.id !== input.offer_id || job.offer.kind !== input.action || Date.parse(job.offer.expires_at) <= Date.now()) fail('Approval offer changed or expired.');
    if (job.offer.hash !== approvalHash(job)) fail('Stage deliverable or evidence changed. Review again.');
    if (input.input !== undefined || hasActiveTools(state, job) || hasActiveWorkers(job)) fail('Reconcile active tools/workers before approval.');
    if (input.action === 'start-feature') {
      if (job.status !== 'ready-feature' || !nextFeature(job) || !nextFeature(job).depends_on.every(id => job.features.some(f => f.id === id && f.status === 'accepted'))) fail('The next feature has unfinished dependencies.');
      if(!startReadinessReady(job))fail('Complete and record the feature readiness checks before Start feature.');
    } else if (input.action === 'start-acceptance') {
      if (job.status !== 'ready-acceptance' || job.features.some(f => f.status !== 'accepted')) fail('Accept every feature before product acceptance.');
    } else if (job.status !== 'awaiting-stage' || job.offer.stage !== stage(job)) fail('Stage deliverable changed. Review again.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job)) && !evidenceReady(context(job))) fail('Quality evidence changed. Review again.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job))) mobileQuality(job, context(job));
  } else {
    if (input.offer_id !== undefined) fail('Unexpected approval offer.');
    if (['revise', 'revise-product', 'rework'].includes(input.action)) {
      only(input.input, ['note', 'stage']);
      const stages = input.action === 'revise-product' ? isStreamlined(job) ? ['specification'] : PRODUCT : sequence(job);
      if (input.action === 'revise-product' && job.mode !== 'product') fail('Only products have a parent roadmap.');
      if (!text(input.input.note, 10000) || (input.input.stage !== undefined && (!stages.includes(input.input.stage) || (input.action !== 'revise-product' && stages.indexOf(input.input.stage) > context(job).cursor)))) fail('Describe the changes and a current or earlier stage.');
      if (!['awaiting-stage', 'blocked', 'paused', 'ready-feature', 'ready-acceptance'].includes(job.status)) fail('Wait for a checkpoint before revision.');
      if (job.configuration_changed && job.phase === 'final' && input.action !== 'revise-product') fail('Documentation or tool requirements changed. Revise the product specification before acceptance.');
      const target = input.input.stage || (input.action === 'revise-product' ? 'specification' : stage(job));
      if (job.configuration_changed && stages.includes('specification') && stages.indexOf(target) > stages.indexOf('specification')) fail('Documentation or tool requirements changed. Revise specification or an earlier stage.');
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
    if (s === 'specification') { u.approved_plan_hash = digest(JSON.stringify(u.plan)); if (job.mode === 'feature' || job.phase === 'product') { job.approved_plan_hash = u.approved_plan_hash; approvePlanVersion(job); } }
    if (['integration', 'final-merge'].includes(s)) {
      job.merge_receipt = { command_id: command.id, offer: structuredClone(job.offer), time: stamp() }; job.status = 'merging';
    } else if (job.phase === 'product' && (s === 'design' || isStreamlined(job) && s === 'specification')) {
      job.status = nextFeature(job) ? 'ready-feature' : 'ready-acceptance'; offer(job, nextFeature(job) ? 'start-feature' : 'start-acceptance'); return job;
    } else if (job.phase === 'final' && s === 'acceptance') {
      u.cursor++; job.status = 'reviewing';
    } else { u.cursor++; job.status = ['qa'].includes(stage(job)) ? 'reviewing' : ['implementation'].includes(stage(job)) ? 'running' : 'planning'; }
    job.offer = null;
  } else if (command.action === 'start-feature') {
    job.execution_epoch=(job.execution_epoch||0)+1;
    const feature = nextFeature(job); feature.status = 'running'; feature.cursor = 0; feature.stages ||= [];
    job.active_feature = feature.id; job.phase = 'feature'; job.status = 'planning'; job.offer = null; job.merge_receipt = null;
    if (isStreamlined(job)) {
      feature.plan = featurePlan(job, feature); feature.approved_plan_hash = digest(JSON.stringify(feature.plan));
      feature.inherited_master_version = job.approved_master_version;
      feature.inherited_approval = { master_plan_hash: job.approved_plan_hash, start_command: command.id, time: stamp() };
      job.status = 'running';
    }
  } else if (command.action === 'start-acceptance') {
    job.execution_epoch=(job.execution_epoch||0)+1;
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
    u.cursor = index; u.stages = u.stages.filter(r => sequence(job).indexOf(r.stage) < index); u.reviews = []; u.checks = []; u.mobile_runs = []; u.approver = null;
    if (index <= sequence(job).indexOf('specification')) u.approved_plan_hash = null;
    if (job.configuration_changed) {
      const spec = sequence(job).indexOf('specification');
      if (spec >= 0 && index > spec) fail('Tool settings changed. Revise specification or an earlier stage.');
      job.configuration_changed = false;
    }
    if (job.phase === 'product' && job.features.length && !isStreamlined(job)) {
      // Product changes never silently rewrite integrated history or skip dependent reviews.
      job.revalidation_required = true;
      job.features.forEach(f => { f.previous_acceptance = f.status; f.status = 'planned'; f.workspace = { ...f.workspace, prepared: false, branch: job.workspace.policy === 'current-branches' ? job.workspace.branch : 'feature/' + slug(f.title) + '-' + uid().slice(0, 8), base_commit: null }; delete f.workspace.reviewed; f.stages = []; f.cursor = 0; });
    }
    job.offer = null; job.merge_receipt = null; job.preview = null; job.status = selected === 'implementation' ? 'running' : selected === 'qa' ? 'reviewing' : 'planning';
  } else if (command.action === 'resume') { job.status = job.resume_status || 'planning'; job.offer = null; }
  return job;
}
export function validatePlan(plan, job) {
  only(plan, ['summary', 'scope', 'acceptance', 'permissions', 'budget', 'target_branch', 'base_commit', 'documentation', 'features', 'integrations', 'mobile', 'repositories', 'design', 'code_analysis']);
  validatePlanExtras(plan);
  if(isStreamlined(job) && (job.phase==='product'||job.mode==='feature')) {
    const features=plan.features||[],baselines=context(job).workspace.repositories?.map(r=>r.base_commit)||[context(job).workspace.base_commit];
    if(!plan.code_analysis?.length||plan.code_analysis.some(row=>!baselines.includes(row.commit))||features.some(f=>!f.brief||!plan.code_analysis.some(row=>row.feature_id===f.id)))fail('The master plan needs feature briefs and actual baseline-bound code analysis before approval.');
  }
  if (!text(plan.summary) || !strings(plan.scope) || !strings(plan.acceptance) || !strings(plan.permissions) || !(typeof plan.budget === 'number' ? Number.isFinite(plan.budget) && plan.budget >= 0 : text(plan.budget, 3000)) ||
      !text(plan.target_branch, 200) || !sha(plan.base_commit) || !['developer', 'user'].every(k => plan.documentation?.includes(k))) fail('Plan needs scope, acceptance, permissions, budget, committed base, target and both guides.');
  integrationScopes(plan.integrations);
  validateMobilePlan(plan.mobile, job, plan.acceptance);
  const w = context(job).workspace;
  if (!w?.prepared || plan.target_branch !== w.target || plan.base_commit !== w.base_commit) fail('Plan must match the prepared branch and its actual target/base.');
  if (w.policy === 'current-branches' && JSON.stringify(plan.repositories) !== JSON.stringify(w.repositories)) fail('Plan must show every selected repository, existing branch and exact baseline.');
  if (w.policy !== 'current-branches' && plan.repositories !== undefined) fail('Repository plans require the existing-branch workspace policy.');
  if (job.phase === 'product') {
    if (!Array.isArray(plan.features) || !plan.features.length || plan.features.length > 100) fail('Product specification requires an ordered feature roadmap.');
    const seen = new Set();
    for (const f of plan.features) {
      only(f, ['id', 'title', 'depends_on', 'acceptance', 'brief', 'design', 'readiness']);
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
    ['developer', 'user'].every(kind => u.documentation?.some(d => d.kind === kind && wordEvidence(d, u.commit))) &&
    u.approver?.verdict === 'APPROVE' && u.approver.commit === u.commit);
}
export function publishLifecycle(state, input, command, job) {
  only(input, ['command_id', 'job_id', 'status', 'deliverable', 'plan', 'checks', 'reviews', 'documentation', 'usage', 'commit', 'approver', 'message', 'preview', 'preview_commit', 'preview_source', 'mobile_analysis', 'mobile_runs', 'advance']);
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
  if (input.mobile_analysis !== undefined) {
    if (job.purpose !== 'web-to-mobile' || !(s === 'feasibility' || isStreamlined(job) && s === 'specification')) fail('Mobile source analysis belongs to feasibility or the streamlined master plan.');
    job.mobile_analysis = mobileAnalysis(input.mobile_analysis);
  }
  if (input.plan !== undefined) { if (s !== 'specification') fail('Plans can change only in the specification stage.');
    const proposed = structuredClone(input.plan);
    if (isStreamlined(job) && !proposed.design) proposed.design = generatedDesign(proposed, job.design);
    validatePlan(proposed, job);
    const prior = u.plan, impact = revisionImpact(prior, proposed), oldFeatures = job.features;
    if (job.phase === 'product' && impact.removed.length) { job.removed_features ||= []; for(const removed of oldFeatures.filter(f=>impact.removed.includes(f.id)))job.removed_features.push({time:stamp(),reason:'Removed by plan revision',feature:structuredClone(removed)}); }
    if (job.phase === 'product' || job.mode === 'feature') { if (prior) rememberPlan(job, prior, job.approved_plan_hash ? 'approved' : 'draft'); rememberPlan(job, proposed); }
    u.plan = proposed; u.approved_plan_hash = null;
    if (job.phase === 'product') job.features = proposed.features.map((f, i) => {
      const old = oldFeatures.find(old => old.id === f.id);
      if (isStreamlined(job) && old && !impact.affected.includes(f.id)) return { ...structuredClone(old), ...structuredClone(f) };
      return ({ ...structuredClone(f), builder_session: old?.builder_session,
      ...(old ? { previous_acceptance: old.status, requires_revalidation: old.status === 'accepted', history: [...(old.history || []), { time: stamp(), reason: 'Plan revision', previous: structuredClone(Object.fromEntries(Object.entries(old).filter(([key]) => key !== 'history'))) }] } : {}),
      status: 'planned', cursor: 0, stages: [], reviews: [], checks: [], documentation: [], workspace: job.workspace.policy === 'current-branches' ?
        { policy: 'current-branches', branch: job.workspace.branch, target: job.workspace.target, prepared: false, base_commit: null, repositories: structuredClone(job.workspace.repositories) } :
        { branch: 'feature/' + String(i + 1).padStart(3, '0') + '-' + slug(f.title) + '-' + uid().slice(0, 8), target: job.workspace.branch, prepared: false, base_commit: null } }); });
  }
  if (input.commit !== undefined) {
    if (!sha(input.commit) || !['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(s)) fail('Commit evidence belongs to implementation and later stages.');
    if (u.commit && u.commit !== input.commit && s !== 'implementation') fail('Rework implementation and refresh reviews after changing the commit.');
    if (u.commit && u.commit !== input.commit) { u.checks = []; u.reviews = []; u.mobile_runs = []; u.documentation = []; u.approver = null; }
    u.commit = input.commit;
  }
  if (input.mobile_runs !== undefined) {
    if (!['qa', 'integration', 'acceptance', 'final-merge'].includes(s)) fail('Device evidence belongs to mobile QA and acceptance.');
    u.mobile_runs = mobileRuns(input.mobile_runs, job);
  }
  for (const k of ['checks', 'reviews', 'documentation']) if (input[k] !== undefined) {
    if (!(k === 'documentation' && s === 'implementation') && !['qa', 'integration', 'acceptance', 'final-merge'].includes(s)) fail('Quality evidence belongs to QA and acceptance; Word guides may also be published during implementation.');
    if (!Array.isArray(input[k]) || input[k].length > 500) fail('Invalid evidence list.');
    for (const item of input[k]) {
      if (k === 'checks') {
        only(item, ['label', 'status', 'detail', 'commit', 'kind']);
        if (!text(item.label, 1000) || !['passed', 'needs-action', 'not-checked'].includes(item.status) || !text(item.detail, 5000) || !sha(item.commit)) fail('Check evidence needs a label, status, actual detail and commit.');
      } else if (k === 'reviews') {
        only(item, ['role', 'verdict', 'commit', 'reviewer_id', 'summary']);
        if (!REVIEWERS.includes(item.role) || !['PASS', 'FAIL', 'BLOCKED'].includes(item.verdict) || !sha(item.commit) || !text(item.reviewer_id, 200) || !text(item.summary, 5000)) fail('Review evidence needs its role, verdict, commit, reviewer and summary.');
      } else {
        only(item, ['kind', 'status', 'commit', 'entry', 'text', 'format', 'verification']);
        if (!['developer', 'user'].includes(item.kind) || !['complete', 'needs-action'].includes(item.status) || !sha(item.commit) || !text(item.entry, 400) || item.format !== 'docx' || !/\.docx$/i.test(item.entry) || (item.text !== undefined && !text(item.text))) fail('Documentation must be Microsoft Word .docx with kind, status, commit and actual entry.');
        if (item.verification !== undefined) only(item.verification, ['method', 'status', 'sha256', 'pages']);
        if (item.status === 'complete' && !wordEvidence(item, item.commit)) fail('Complete Word guides require rendered-page review bound to their file SHA-256.');
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
    if(isStreamlined(job)&&job.mode==='product'){
      job.usage_totals ||= Object.fromEntries([...(Number.isFinite(job.usage?.usd)?[['product',job.usage.usd]]:[]),...job.features.filter(f=>Number.isFinite(f.usage?.usd)).map(f=>['feature:'+f.id,f.usage.usd])]);
      if(input.usage.usd!==null){const key=job.phase==='feature'?'feature:'+job.active_feature:job.phase;job.usage_totals[key]=Math.max(job.usage_totals[key]||0,input.usage.usd);}
    }
    u.usage = structuredClone(input.usage);
    if(isStreamlined(job)&&job.mode==='product'&&typeof job.plan?.budget==='number'&&Object.values(job.usage_totals).reduce((sum,value)=>sum+value,0)>job.plan.budget){job.status='blocked';job.offer=null;job.message='Cumulative reported product usage exceeded the master budget. Revise the approved budget before more work.';return job;}
    if (typeof u.plan?.budget === 'number' && u.usage.usd !== null && u.usage.usd > u.plan.budget) { job.status = 'blocked'; job.offer = null; job.message = 'Reported usage exceeded the approved budget. Revise the specification and budget before more work.'; return job; }
  }
  if (input.preview === null) { u.preview = null; u.preview_commit = null; }
  else if (input.preview !== undefined) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(input.preview) || !sha(input.preview_commit)) fail('Preview needs a loopback URL and the actual served commit.');
    u.preview = input.preview; u.preview_commit = input.preview_commit;
    if (u.workspace.policy === 'current-branches') {
      only(input.preview_source, ['repository', 'commit']);
      if (!u.workspace.reviewed?.some(r => r.path === input.preview_source.repository && r.commit === input.preview_source.commit)) fail('Report the actual served repository and Git commit from the reviewed snapshot.');
      u.preview_source = structuredClone(input.preview_source);
    }
  }
  if (input.message !== undefined) job.message = String(input.message).slice(0, 3000);
  if (input.advance !== undefined) {
    if (!isStreamlined(job) || !['qa', 'implementation'].includes(input.advance) || hasActiveWorkers(job) || hasActiveTools(state, job)) fail('Only idle streamlined work can advance internally.');
    if (input.advance === 'qa') {
      if (s !== 'implementation' || !sha(u.commit) || !['developer','user'].every(kind => u.documentation?.some(d => d.kind === kind && wordEvidence(d,u.commit)))) fail('Commit source and both rendered/inspected guides before formal QA.');
      u.stages.push({stage:'implementation',summary:input.message || 'Implementation committed; formal QA authorized by Start feature.',content:input.deliverable?.content || 'Source and guide evidence prepared for the frozen snapshot.',verified:true,approved:false,time:stamp(),commit:u.commit});
      u.cursor = sequence(job).indexOf('qa'); job.status = 'reviewing'; job.offer = null;
    } else {
      if (s !== 'qa' || !text(input.message,3000)) fail('QA rework needs actual findings and the original builder.');
      u.rework_rounds = (u.rework_rounds || 0) + 1;
      if (u.rework_rounds > 2) { job.status='blocked';job.message='Two unsuccessful review rounds need human attention. '+input.message;job.offer=null;return job; }
      u.evidence_history ||= []; u.evidence_history.push({time:stamp(),commit:u.commit,checks:u.checks,reviews:u.reviews,approver:u.approver,mobile_runs:u.mobile_runs});
      u.checks=[];u.reviews=[];u.approver=null;u.mobile_runs=[];u.cursor=sequence(job).indexOf('implementation');job.status='running';job.offer=null;
    }
    event(state,'Internal '+input.advance+' transition under existing feature consent.'); return job;
  }
  if (input.status === 'awaiting-stage') {
    if (job.purpose === 'web-to-mobile' && s === 'feasibility' && !job.mobile_analysis) fail('Analyse the pinned frontend source before offering mobile feasibility approval.');
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
    if (s === 'implementation' && !['developer', 'user'].every(kind => u.documentation?.some(d => d.kind === kind && wordEvidence(d, u.commit)))) fail('Complete and review both Word guides before offering implementation approval.');
    if (['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(s) && u.preview && u.preview_commit !== u.commit) fail('Refresh the local preview for the exact reviewed commit or explicitly revise its preview limitation.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(s) && !evidenceReady(u)) fail('Five passing independent reviews, checks, both guides and technical approval must match this commit.');
    if (['qa', 'integration', 'acceptance', 'final-merge'].includes(s)) mobileQuality(job, u);
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
    if (isStreamlined(job) && ['qa','acceptance'].includes(s)) {
      record.verified=true; u.cursor++;
      u.stages = u.stages.filter(r => r.stage !== stage(job));
      u.stages.push({...structuredClone(record),stage:stage(job),approved:false,summary:'Reviewed result ready for explicit integration'});
      offer(job,'approve-merge');
    }
    else offer(job, ['integration', 'final-merge'].includes(s) ? 'approve-merge' : 'approve-stage');
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
  const u = context(job), s = stage(job), permitted = s === 'implementation' ? ['builder', 'documentation-writer'] : s === 'design' ? ['spec-writer', 'builder'] : ['qa', 'acceptance', 'integration', 'final-merge'].includes(s) ? [...REVIEWERS, 'approver'] : isStreamlined(job) && s === 'specification' ? ['spec-writer','documentation-writer','builder'] : ['spec-writer'];
  if (!permitted.includes(input.role)) fail('Worker role is not permitted at this stage.');
  const existing = job.workers.find(w => w.id === input.id);
  if (command.recovered_for === 'publication-only' && (!existing || !['completed','failed','stopped'].includes(input.status))) fail('Publication recovery cannot dispatch workers; only existing terminal receipts may be reconciled.');
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
  return { lifecycle: 2, purpose: job.purpose || 'software', mobile: job.mobile || null, mobile_analysis: job.mobile_analysis || null, title: job.title, phase: job.phase, active_feature: job.active_feature, stage: stage(job), documentation_format: 'docx', requires_specification_revision: Boolean(job.configuration_changed),
    timeline: sequence(job).map(id => ({ id, label: isStreamlined(job) && id==='specification' ? 'Master plan and design' : id === 'final-merge' && u.workspace.policy === 'current-branches' ? 'Final integration' : STAGES[id], status: u.stages.find(r => r.stage === id)?.approved ? 'approved' : u.stages.find(r => r.stage===id)?.verified ? 'verified' : stage(job) === id ? job.status : 'locked' })),
    deliverables: u.stages.map(clean), decisions: job.decisions.map(({ command_id, ...d }) => d),
    workspace: u.workspace, product_workspace: job.workspace, needs_migration: false, workflow_profile:job.workflow_profile || 'strict',workflow_version:job.workflow_version || 2,plan_library:planLibraryView(job),trashed_at:job.trashed_at || null,
    features: job.features.map(f => ({ id: f.id, title: f.title, brief:f.brief, design:f.design, readiness:f.readiness||[], readiness_result:job.feature_readiness?.[f.id]||null, depends_on: f.depends_on, acceptance: f.acceptance, status: f.status, workspace: f.workspace, integrated_commit: f.integrated_commit, stages: (f.stages || []).map(clean), checks: f.checks || [], reviews: (f.reviews || []).map(({ reviewer_id, ...r }) => r), documentation: f.documentation || [], usage: f.usage || null })),
    workers: job.workers.map(({ session, ...w }) => w),
    plan: u.plan || job.plan, plan_approved: Boolean(u.plan && u.approved_plan_hash === digest(JSON.stringify(u.plan))),
    mobile_runs: u.mobile_runs || [], checks: u.checks || [], reviews: (u.reviews || []).map(({ reviewer_id, ...r }) => r), documentation: u.documentation || [], usage: u.usage || null,
    commit: u.commit || null, preview: u.preview || null, preview_commit: u.preview_commit || null, preview_source: u.preview_source || null, accepted_preview: job.accepted_preview || null,
    integration_checks: (job.integration_checks || []).map(c => ({ unit: c.unit, branch: c.branch, commit: c.commit, time: c.time, checks: c.checks })),
    merge_history: (job.merge_history || []).map(m => ({ branch: m.branch, target: m.target, commit: m.commit, time: m.time })) };
}
