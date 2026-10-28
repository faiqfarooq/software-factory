import { digest, stamp, uid } from './storage.mjs';

export const PLAN_SCHEMA = 1;
export const isStreamlined = job => job?.workflow_profile === 'streamlined';
const fail = message => { throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 3000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !value.includes('\0');
const strings = (value, max = 500) => Array.isArray(value) && value.length <= max && value.every(v => text(v));
export function onlyPlanFields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unknown or malformed plan fields.');
}
export function validateDesign(design) {
  onlyPlanFields(design, ['summary', 'source', 'reference', 'variant', 'screens']);
  if (!text(design.summary, 10000) || !['generated', 'reference'].includes(design.source) || !['comfortable', 'compact'].includes(design.variant)) fail('Design needs a summary, source and layout.');
  if (design.reference) {
    let url; try { url = new URL(design.reference); } catch { fail('Invalid design reference.'); }
    if (url.protocol !== 'https:' || url.username || url.password) fail('Design reference must be a credential-free HTTPS URL.');
  }
  if (!Array.isArray(design.screens) || design.screens.length < 1 || design.screens.length > 12) fail('Design needs one to twelve screens.');
  const ids = new Set();
  for (const screen of design.screens) {
    onlyPlanFields(screen, ['id', 'title', 'kind', 'description', 'fields', 'sections', 'accent']);
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(screen.id) || ids.has(screen.id) || !text(screen.title, 100) ||
        !['auth', 'dashboard', 'picker', 'family', 'detail'].includes(screen.kind) || !text(screen.description, 500) ||
        !strings(screen.fields, 8) || !strings(screen.sections, 8) || !/^#[0-9a-fA-F]{6}$/.test(screen.accent)) fail('Invalid design screen.');
    ids.add(screen.id);
  }
  return structuredClone(design);
}
export function generatedDesign(plan, reference = '') {
  if(reference){try{const url=new URL(reference);if(url.protocol!=='https:'||url.username||url.password)reference='';}catch{reference='';}}
  const mobile = /\b(scholarme|learner)\b/i.test(JSON.stringify([plan.summary, plan.features?.map(f => f.title)]));
  const feature = plan.features?.[0]?.title || 'Your workspace';
  const screen = (id, title, kind, description, fields, sections) => ({ id, title, kind, description, fields, sections, accent: mobile ? '#1CB0F6' : '#245FE3' });
  return validateDesign({ source: reference ? 'reference' : 'generated', reference, variant: 'comfortable',
    summary: reference ? 'Design reference supplied by the user. The companion screen concepts are proposals for review, using sample data.' : 'Representative screen concepts for review. These are design prototypes with sample data, not the running application or native QA evidence.',
    screens: mobile ? [
      screen('sign-in', 'Sign in', 'auth', 'A clear sign-in form with accessible labels and a reusable password control.', ['Email', 'Password'], ['Sign in', 'Forgot password', 'Create account']),
      screen('learner-home', 'Learner dashboard', 'dashboard', 'An overview of the learner’s courses and study activity.', [], ['Your progress', 'My courses', 'Recent activity']),
      screen('course-picker', 'Choose a course', 'picker', 'A focused course selection flow with a clear next action.', ['Qualification', 'Subject', 'Exam board', 'Tier'], ['Continue', 'Back']),
      screen('parent-home', 'Your children', 'family', 'A parent summary with clear child cards and a safe add-child entry.', [], ['Family overview', 'Add a child', 'Account'])
    ] : [
      screen('sign-in', 'Sign in', 'auth', 'A simple entry to the workspace.', ['Email', 'Password'], ['Sign in', 'Help']),
      screen('overview', 'Overview', 'dashboard', 'The key work and current progress in one place.', [], [feature, 'Recent activity', 'Next action']),
      screen('feature-detail', feature.slice(0, 100), 'detail', 'A focused view for the first planned feature.', [], ['Details', 'Save changes', 'Back'])
    ] });
}
export function validatePlanExtras(plan) {
  if (plan.design !== undefined) validateDesign(plan.design);
  if (plan.code_analysis !== undefined) {
    if (!Array.isArray(plan.code_analysis) || plan.code_analysis.length > 500) fail('Invalid existing-code analysis.');
    for (const row of plan.code_analysis) {
      onlyPlanFields(row, ['feature_id', 'status', 'files', 'commit', 'detail']);
      if (!text(row.feature_id, 60) || !['present', 'partial', 'missing', 'needs-verification'].includes(row.status) || !strings(row.files, 100) ||
          !/^[a-f0-9]{40}$/.test(row.commit) || !text(row.detail, 3000)) fail('Existing code needs its actual commit, paths and verification status.');
    }
  }
  for (const feature of plan.features || []) {
    if (feature.brief !== undefined && !text(feature.brief, 10000)) fail('Feature brief is too long or empty.');
    if (feature.design !== undefined && !text(feature.design, 10000)) fail('Feature design is too long or empty.');
    if (feature.readiness !== undefined && !strings(feature.readiness, 50)) fail('Invalid feature readiness list.');
  }
}
export function planHash(plan) { return digest(JSON.stringify(plan)); }
export function executionJobHash(job){return digest(JSON.stringify(Object.fromEntries(Object.entries(job).filter(([key])=>!['plan_artifacts','plan_draft','plan_versions','design_feedback'].includes(key)))));}
export function stopJobHash(job){return digest(JSON.stringify({id:job.id,phase:job.phase,feature:job.active_feature,master:job.approved_plan_hash||null,workspace:job.workspace?.branch,target:job.workspace?.target}));}
export function revisionOf(job, revisionId) {
  if (revisionId && job.plan_draft?.id === revisionId) return job.plan_draft;
  const versions = job.plan_versions || [];
  if (revisionId) {
    const found = versions.find(v => v.id === revisionId || v.hash === revisionId);
    if(!found && job.plan && revisionId===planHash(job.plan))return revisionOf(job);
    if (!found) fail('Unknown plan version.');
    return found;
  }
  const current = job.plan && versions.findLast(v => v.hash === planHash(job.plan));
  if (current) return current;
  if (!job.plan) return null;
  return { id: planHash(job.plan), number: 1, hash: planHash(job.plan), plan: structuredClone(job.plan),
    status: job.approved_plan_hash === planHash(job.plan) ? 'approved' : 'draft', time: job.updated_at || job.created_at, legacy: true };
}
export function rememberPlan(job, plan, status = 'draft') {
  job.plan_versions ||= [];
  const hash = planHash(plan), last = job.plan_versions.findLast(v => v.hash === hash);
  if (last) return last;
  const entry = { id: uid(), number: job.plan_versions.length + 1, hash, plan: structuredClone(plan), status, time: stamp() };
  job.plan_versions.push(entry);
  return entry;
}
export function archiveDraft(job){
  const draft=job.plan_draft;if(!draft)return;
  job.plan_versions ||= [];
  if(!job.plan_versions.some(v=>v.id===draft.id))job.plan_versions.push(structuredClone(draft));
}
export function approvePlanVersion(job) {
  const version = rememberPlan(job, job.plan);
  version.status = 'approved'; version.approved_at = stamp(); job.approved_master_version = version.id;
  return version;
}
export function revisionImpact(before, after) {
  const previous = new Map((before?.features || []).map(f => [f.id, f]));
  const changed = new Set(), removed = [];
  for (const feature of after.features || []) {
    if (JSON.stringify(feature) !== JSON.stringify(previous.get(feature.id))) changed.add(feature.id);
    previous.delete(feature.id);
  }
  for (const id of previous.keys()) { removed.push(id); changed.add(id); }
  const shared = ['scope', 'permissions', 'budget', 'design', 'mobile', 'repositories', 'base_commit', 'target_branch', 'integrations'];
  const sharedChanged = shared.filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after[key]));
  if (sharedChanged.length) for (const feature of after.features || []) changed.add(feature.id);
  let growing = true;
  while (growing) { growing = false; for (const feature of after.features || []) if (!changed.has(feature.id) && feature.depends_on.some(id => changed.has(id))) { changed.add(feature.id); growing = true; } }
  return { affected: [...changed], removed, sharedChanged, unchanged: (after.features || []).filter(f => !changed.has(f.id)).map(f => f.id) };
}
export function migrationPreview(job) {
  const active = job.features?.find(f => f.id === job.active_feature);
  const masterApproved = Boolean(job.plan && job.approved_plan_hash === planHash(job.plan));
  const designed = job.stages?.some(s => s.stage === 'design' && s.approved) || Boolean(job.plan?.design);
  return { from: job.workflow_profile || 'strict', to: 'streamlined', eligible: job.lifecycle === 2 && job.mode === 'product' && !job.trashed_at,
    masterApproved, designCovered: designed, currentFeature: active?.id || null, preservesCode: true,
    preservesBuilder: Boolean(active?.builder_session), acceptedFeatures: job.features?.filter(f => f.status === 'accepted').map(f => f.id) || [],
    next: masterApproved && designed ? 'Ready for explicit Start feature; no repeated planning for covered work.' : 'Complete and approve the master plan and design before Start feature.',
    note: 'Switching workflow is not permission to implement or integrate. Existing code, decisions and evidence remain in history.' };
}
export function planLibraryView(job) {
  const fallback = revisionOf(job), versions = job.plan_versions?.length ? job.plan_versions : fallback ? [fallback] : [];
  return { schema: PLAN_SCHEMA, profile: job.workflow_profile || 'strict', master: job.plan || null,
    currentVersion:fallback?{id:fallback.id,number:fallback.number,hash:fallback.hash,status:fallback.status}:null,
    previewDesign:job.plan ? job.plan.design||generatedDesign(job.plan,job.design) : null,
    versions: versions.map(v => ({ id: v.id, number: v.number, hash: v.hash, status: v.status, time: v.time, approved_at: v.approved_at })),
    draft: job.plan_draft ? {...job.plan_draft,impact:revisionImpact(job.plan,job.plan_draft.plan)} : null, trash: job.trashed_at ? { time: job.trashed_at, previousStatus: job.trash_previous_status } : null,
    migration: migrationPreview(job), rollbackAvailable: Boolean(job.workflow_backup && !job.configuration_changed && (job.execution_epoch||0)===(job.workflow_backup.job.execution_epoch||0) && job.decisions.length === job.workflow_backup.job.decisions.length), designFeedback: job.design_feedback || [],
    artifacts: (job.plan_artifacts || []).map(({ file, render, ...artifact }) => artifact),
    codeAnalysis: job.plan?.code_analysis || [], executionNote: 'Dashboard commands require the actual connected owner. A heartbeat is not an unattended runner.' };
}
export function featurePlan(job, feature) {
  const parent = job.plan;
  if (!parent || job.approved_plan_hash !== planHash(parent)) fail('Approve the current master plan before starting a feature.');
  const previous = feature.plan;
  if (previous && feature.approved_plan_hash === planHash(previous)) return structuredClone(previous);
  const { features, ...base } = parent;
  return { ...structuredClone(base), summary: feature.title + '\n\n' + (feature.brief || 'Implementation inherits the approved master plan and design. Only this feature’s acceptance is in scope.'),
    scope: [...parent.scope, 'Active feature: ' + feature.id + ' — ' + feature.title, ...(feature.design ? ['Feature design: ' + feature.design] : [])],
    acceptance: structuredClone(feature.acceptance), target_branch:feature.workspace.target||parent.target_branch, base_commit: feature.workspace.base_commit || parent.base_commit,
    repositories: structuredClone(feature.workspace.repositories || parent.repositories) };
}
