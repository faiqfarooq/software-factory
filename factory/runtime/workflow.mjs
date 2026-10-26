import { stamp, uid, digest, event } from './storage.mjs';
import { REVIEWERS } from './profiles.mjs';
import { integrationScopes, integrationView, performance } from './integrations.mjs';
import { validateLifecycleCommand, claimLifecycle, publishLifecycle, lifecycleView, hasActiveWorkers } from './lifecycle.mjs';

const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 10000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export function fields(input, allowed) {
  if (!object(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('Unknown or malformed fields.');
}
export function connected(state, now = Date.now()) {
  return Boolean(state.owner && state.owner.connected && Date.parse(state.owner.expires_at) > now);
}
// Local maintenance only: release a reviewed stale binding, never impersonate its session.
export function releaseOwner(state, input, runtime, now = Date.now()) {
  fields(input, ['requester_id', 'runtime', 'expected_owner_id', 'expected_generation', 'revision', 'note']);
  const identity = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  if (!identity(input.requester_id) || input.runtime !== runtime || !identity(input.expected_owner_id) ||
      !identity(input.expected_generation) || !Number.isSafeInteger(input.revision) || !text(input.note, 2000)) fail('Provide the actual requesting session/runtime, reviewed owner binding, revision and release reason.');
  if (input.revision !== state.revision || !state.owner || state.owner.id !== input.expected_owner_id ||
      state.owner.generation !== input.expected_generation) fail('Owner or state changed. Inspect the current binding before releasing it.');
  if (connected(state, now) || state.owner.listening) fail('The owner is connected or listening. Disconnect it before release.');
  if (state.commands.some(c => ['pending', 'running', 'uncertain'].includes(c.status)) ||
      (state.integration_runs || []).some(r => ['running', 'uncertain'].includes(r.status)) ||
      state.jobs.some(j => hasActiveWorkers(j) || (j.features || []).some(hasActiveWorkers))) fail('Reconcile outstanding commands, workers and tools before releasing the owner.');
  if (state.jobs.some(j => !['merged', 'cancelled'].includes(j.status))) fail('Finish or cancel unfinished jobs with the original owner before release.');
  const time = new Date(now).toISOString();
  state.owner_history ||= [];
  state.owner_history.push({ owner: structuredClone(state.owner), released_by: input.requester_id,
    runtime: input.runtime, time, note: input.note.trim() });
  // Access/continuation evidence belongs to its actual host session, not the next owner.
  for (const check of state.checks.filter(c => ['live', 'continuation', 'api-runner'].includes(c.id))) {
    state.check_history ||= []; state.check_history.push(structuredClone(check));
    check.status = 'not-checked'; check.detail = 'Owner released. Verify access in the new owner environment.'; check.time = time;
    delete check.evidence;
  }
  state.owner = null;
  event(state, 'Disconnected owner registration released explicitly; history preserved. Connect the new actual session.');
  return { status: 'released' };
}
export function enqueue(state, input, now = Date.now()) {
  fields(input, ['id', 'action', 'revision', 'job_id', 'offer_id', 'input']);
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.id)) fail('Command needs an id.');
  const hash = digest(JSON.stringify(input));
  const prior = state.commands.find(c => c.id === input.id);
  if (prior) { if (prior.hash !== hash) fail('Command id conflict.'); return prior; }
  if (!connected(state, now)) fail('Owner disconnected. Reconnect the original owning session.');
  if (input.revision !== state.revision) fail('State changed. Refresh and review the current offer.');
  const allowed = ['request', 'check-live', 'approve-plan', 'approve-merge', 'revise', 'rework', 'pause', 'resume', 'cancel'];
  const pending = state.commands.filter(c => ['pending', 'running', 'uncertain'].includes(c.status));
  if (pending.length >= 100) fail('Too many outstanding commands.');
  let job;
  const lifecycleJob = state.jobs.find(j => j.id === input.job_id);
  if (input.action === 'request' || lifecycleJob?.lifecycle === 2 || lifecycleJob?.needs_migration) {
    if (pending.some(c => c.job_id === lifecycleJob?.id && lifecycleJob && (!['pause', 'cancel'].includes(input.action) || ['pause', 'cancel'].includes(c.action)))) fail('This job already has an outstanding command.');
    validateLifecycleCommand(state, input, lifecycleJob);
    const command = { ...input, hash, owner_id: state.owner.id, owner_generation: state.owner.generation,
      job_binding: lifecycleJob ? digest(JSON.stringify(lifecycleJob)) : null, status: 'pending', created_at: stamp(),
      expires_at: new Date(now + 10 * 60000).toISOString() };
    state.commands.push(command); event(state, input.action + ' queued; awaiting the owner.'); return command;
  }
  if (!allowed.includes(input.action)) fail('Unsupported action.');
  if (input.action === 'request') {
    if (input.job_id !== undefined || input.offer_id !== undefined) fail('Unexpected request binding.');
    fields(input.input, ['mode', 'requirements', 'design', 'allow_documentation']);
    if (input.input.allow_documentation !== undefined && typeof input.input.allow_documentation !== 'boolean') fail('Invalid planning documentation consent.');
    if (!['feature', 'product'].includes(input.input.mode) || !text(input.input.requirements, 50000) ||
        (input.input.design !== undefined && typeof input.input.design !== 'string')) fail('Choose a mode and supply requirements.');
    if (state.jobs.some(j => !['merged', 'cancelled'].includes(j.status)) || pending.some(c => c.action === 'request')) fail('Finish or cancel the current job first.');
  } else if (input.action === 'check-live') {
    if (input.job_id !== undefined || input.offer_id !== undefined) fail('Unexpected check binding.');
    fields(input.input, ['consent']);
    if (input.input.consent !== true) fail('Live checks require explicit usage consent.');
  } else {
    job = state.jobs.find(j => j.id === input.job_id);
    if (!job) fail('Unknown job.');
    if (pending.some(c => c.job_id === job.id &&
        (!['pause', 'cancel'].includes(input.action) || ['pause', 'cancel'].includes(c.action)))) fail('This job already has an outstanding command.');
    const stages = {
      'approve-plan': ['awaiting-plan'], 'approve-merge': ['awaiting-merge'],
      revise: ['awaiting-plan', 'blocked', 'paused', 'awaiting-merge'], rework: ['blocked', 'awaiting-merge'],
      pause: ['running', 'reviewing'], resume: ['paused'],
      cancel: ['planning', 'awaiting-plan', 'running', 'reviewing', 'blocked', 'paused', 'awaiting-merge']
    };
    if (!stages[input.action]?.includes(job.status)) fail('Action is unavailable at this stage.');
    if (['rework', 'resume'].includes(input.action) && (!job.plan || job.approved_plan_hash !== digest(JSON.stringify(job.plan)))) fail('Revise and approve the current plan before resuming implementation.');
    if (input.action.startsWith('approve-')) {
      if (!job.offer || job.offer.id !== input.offer_id || Date.parse(job.offer.expires_at) <= now || job.offer.kind !== input.action) fail('Approval offer changed or expired.');
      if (input.action === 'approve-merge' && !mergeReady(job)) fail('Merge evidence is incomplete.');
      if (input.input !== undefined) fail('Unexpected approval input.');
    } else {
      if (input.offer_id !== undefined) fail('Unexpected offer.');
      if (['revise', 'rework'].includes(input.action)) {
        fields(input.input, ['note']); if (!text(input.input.note)) fail('Describe the requested changes.');
      } else if (input.input !== undefined) fail('Unexpected command input.');
    }
  }
  const command = {
    ...input, hash, owner_id: state.owner.id, owner_generation: state.owner.generation,
    job_binding: job ? digest(JSON.stringify(job)) : null,
    status: 'pending', created_at: new Date(now).toISOString(), expires_at: new Date(Math.min(now + 10 * 60000, job?.offer ? Date.parse(job.offer.expires_at) : Infinity)).toISOString()
  };
  state.commands.push(command);
  event(state, input.action + ' queued; awaiting the owner.');
  return command;
}
export function claim(state, now = Date.now()) {
  const busy = state.commands.some(c => ['running', 'uncertain'].includes(c.status));
  for (const command of state.commands.filter(c => c.status === 'pending' && (!busy || ['pause', 'cancel'].includes(c.action))).sort((a, b) => Number(['pause', 'cancel'].includes(b.action)) - Number(['pause', 'cancel'].includes(a.action)))) {
    const job = state.jobs.find(j => j.id === command.job_id);
    if (Date.parse(command.expires_at) <= now || command.owner_id !== state.owner.id ||
        command.owner_generation !== state.owner.generation ||
        (command.job_binding && digest(JSON.stringify(job)) !== command.job_binding)) {
      command.status = 'expired'; event(state, command.action + ' expired after its context changed.'); continue;
    }
    command.status = 'running'; command.started_at = stamp();
    if (command.action === 'request' || job?.lifecycle === 2 || job?.needs_migration) {
      claimLifecycle(state, command, job); event(state, command.action + ' acknowledged by the owner.'); return command;
    }
    if (command.action === 'request') {
      const job = { id: uid(), mode: command.input.mode, requirements: command.input.requirements,
        design: command.input.design || '', status: 'planning', plan: null, offer: null,
        planning_docs_consent: command.input.allow_documentation === true, integration_profile: state.integration_profile || [],
        features: [], reviews: [], checks: [], documentation: [], usage: null, created_at: stamp() };
      state.jobs.push(job); command.job_id = job.id;
    }
    const active = state.jobs.find(j => j.id === command.job_id);
    if (active && command.action === 'approve-plan') {
      active.approved_plan_hash = active.offer.plan_hash;
      active.plan_receipt = { command_id: command.id, offer: active.offer, time: stamp() };
      active.offer = null; active.status = 'running';
    }
    if (active && command.action === 'approve-merge') {
      active.merge_receipt = { command_id: command.id, offer: active.offer, time: stamp() };
      active.offer = null; active.status = 'merging';
    }
    if (active && ['revise', 'rework'].includes(command.action)) {
      active.history ||= [];
      active.history.push({ time: stamp(), plan: active.plan, plan_receipt: active.plan_receipt, offer: active.offer,
        commit: active.commit, reviews: active.reviews, checks: active.checks, documentation: active.documentation, usage: active.usage });
      active.offer = null;
      active.status = command.action === 'revise' ? 'planning' : 'running';
      if (command.action === 'revise') active.approved_plan_hash = null;
      active.reviews = []; active.checks = []; active.approver = null;
    }
    event(state, command.action + ' acknowledged by the owner.');
    return command;
  }
  return null;
}
export function mergeReady(job) {
  const verdicts = REVIEWERS.map(role => job.reviews.find(r => r.role === role));
  return Boolean(job.plan && job.approved_plan_hash === digest(JSON.stringify(job.plan)) && sha(job.commit) &&
    job.checks.length && job.checks.every(c => c.status === 'passed' && c.commit === job.commit) &&
    verdicts.every(r => r && r.verdict === 'PASS' && r.commit === job.commit && text(r.reviewer_id, 200)) &&
    new Set(verdicts.map(r => r?.reviewer_id)).size === 5 &&
    ['developer', 'user'].every(kind => job.documentation.some(d => d.kind === kind && d.status === 'complete' && d.commit === job.commit && text(d.entry, 500))) &&
    job.approver?.verdict === 'APPROVE' && job.approver.commit === job.commit);
}
export function publish(state, input, now = Date.now()) {
  fields(input, ['command_id', 'job_id', 'status', 'plan', 'features', 'checks', 'reviews', 'documentation', 'usage', 'commit', 'baseline_commit', 'target_base_commit', 'target_commit', 'target_branch', 'approver', 'message', 'preview', 'preview_commit', 'preview_source', 'deliverable', 'mobile_analysis', 'mobile_runs']);
  const command = state.commands.find(c => c.id === input.command_id && c.status === 'running');
  if (!command || command.owner_id !== state.owner?.id || command.owner_generation !== state.owner?.generation) fail('No matching running owner command.');
  const job = state.jobs.find(j => j.id === input.job_id);
  if (!job || job.id !== command.job_id) fail('Wrong job for this command.');
  if (job.needs_migration && !(command.action === 'cancel' && input.status === 'cancelled')) fail('Adopt the staged workflow before publishing more work.');
  if (job.lifecycle === 2) return publishLifecycle(state, input, command, job);
  const statuses = ['planning', 'awaiting-plan', 'running', 'reviewing', 'awaiting-merge', 'blocked', 'paused', 'cancelled', 'merged'];
  if (!statuses.includes(input.status)) fail('Invalid job status.');
  if (input.plan !== undefined) {
    if (command.action !== 'request' && command.action !== 'revise') fail('Plan revisions need a revise command.');
    fields(input.plan, ['summary', 'scope', 'acceptance', 'permissions', 'budget', 'target_branch', 'base_commit', 'documentation', 'features', 'integrations']);
    integrationScopes(input.plan.integrations);
    if (!text(input.plan.summary) || !Array.isArray(input.plan.scope) || !input.plan.scope.length ||
        !Array.isArray(input.plan.acceptance) || !input.plan.acceptance.length ||
        !Array.isArray(input.plan.permissions) || !text(input.plan.target_branch, 250) || !(input.plan.base_commit === null || sha(input.plan.base_commit)) ||
        !Array.isArray(input.plan.documentation) || !['developer', 'user'].every(k => input.plan.documentation.includes(k)) ||
        !(text(input.plan.budget) || (typeof input.plan.budget === 'number' && input.plan.budget >= 0)) ||
        ![...input.plan.scope, ...input.plan.acceptance, ...input.plan.permissions].every(v => text(v))) fail('Plan requires scope, checks, permissions, budget, Git binding and both guides.');
    job.plan = structuredClone(input.plan);
    job.approved_plan_hash = null;
  }
  if (input.baseline_commit !== undefined) {
    if (job.plan?.base_commit !== null || !job.approved_plan_hash || !sha(input.baseline_commit) ||
        (job.baseline_commit && job.baseline_commit !== input.baseline_commit)) fail('Baseline needs an approved empty-repository proposal and immutable commit binding.');
    job.baseline_commit = input.baseline_commit;
  }
  for (const key of ['features', 'checks', 'reviews', 'documentation']) if (input[key] !== undefined) {
    if (!Array.isArray(input[key]) || input[key].length > 2000 || !input[key].every(object)) fail('Invalid evidence list.');
    job[key] = structuredClone(input[key]);
  }
  for (const key of ['usage', 'commit', 'target_base_commit', 'target_commit', 'target_branch', 'approver', 'message', 'preview']) if (input[key] !== undefined) job[key] = input[key];
  if (input.status === 'awaiting-plan' && !job.plan) fail('Publish the complete plan before asking approval.');
  if (['running', 'reviewing', 'awaiting-merge'].includes(input.status) && !job.approved_plan_hash) fail('No approved plan.');
  if (input.status === 'awaiting-merge' && !mergeReady(job)) fail('Five passing reviews, checks, both guides and approver evidence must match the final commit.');
  if (input.status === 'merged' && (!job.merge_receipt || job.merge_receipt.offer.commit !== job.commit ||
      !sha(job.target_commit) || !job.checks.some(c => c.kind === 'post-merge' && c.status === 'passed' && c.commit === job.target_commit))) fail('Merge consent and passing post-merge evidence are required.');
  if (input.status === 'paused' && command.action !== 'pause') fail('Pause needs a pause request.');
  if (input.status === 'cancelled' && command.action !== 'cancel') fail('Cancellation needs a cancel request.');
  if (['paused', 'cancelled', 'awaiting-merge', 'merged'].includes(input.status) && (state.integration_runs || []).some(r => r.job_id === job.id && ['running', 'uncertain'].includes(r.status))) fail('Reconcile active or uncertain integration processes before confirming this stage.');
  job.status = input.status; job.updated_at = stamp();
  if (['paused', 'cancelled'].includes(job.status)) {
    for (const other of state.commands.filter(c => c.job_id === job.id && c.id !== command.id && ['running', 'uncertain'].includes(c.status))) {
      other.status = 'blocked'; other.message = 'Owner confirmed job ' + job.status + '; reconcile before resuming.';
    }
  }
  if (['awaiting-plan', 'awaiting-merge'].includes(job.status)) {
    job.offer = {
      id: uid(), kind: job.status === 'awaiting-plan' ? 'approve-plan' : 'approve-merge',
      plan_hash: digest(JSON.stringify(job.plan)), commit: job.commit || null,
      target_base_commit: job.target_base_commit || job.plan.base_commit || job.baseline_commit || null,
      expires_at: new Date(now + 24 * 3600000).toISOString()
    };
  } else job.offer = null;
  event(state, 'Job ' + job.status + (typeof input.message === 'string' ? ': ' + input.message.slice(0, 300) : '.'));
  return job;
}
export function finish(state, input) {
  fields(input, ['id', 'status', 'message']);
  const command = state.commands.find(c => c.id === input.id);
  if (!command || !['running', 'uncertain'].includes(command.status) || !['completed', 'failed', 'blocked'].includes(input.status)) fail('No matching command to finish.');
  const job = state.jobs.find(j => j.id === command.job_id);
  if (input.status === 'completed' && (state.integration_runs || []).some(r => r.command_id === command.id && ['running', 'uncertain'].includes(r.status))) fail('Resolve outstanding integration results before completing the command.');
  if (input.status === 'completed' && job && (hasActiveWorkers(job) || !['awaiting-plan', 'awaiting-merge', 'awaiting-stage', 'ready-feature', 'ready-acceptance', 'merged', 'paused', 'cancelled', 'blocked'].includes(job.status))) fail('Publish the actual gate or terminal job result before completing this command.');
  command.status = input.status; command.finished_at = stamp();
  if (job?.lifecycle === 2 && ['failed', 'blocked'].includes(input.status) && !['merged', 'cancelled', 'paused'].includes(job.status)) {
    job.status = 'blocked'; job.offer = null; job.message = typeof input.message === 'string' ? input.message.slice(0, 1000) : 'The owner reported a blocker. Reconcile activity, then request changes.';
  }
  command.message = typeof input.message === 'string' ? input.message.slice(0, 1000) : '';
  event(state, command.action + ': ' + input.status + '.');
  return command;
}
export function publicState(state, config) {
  // Explicit publication schema. Never expose raw reports, credentials or session IDs.
  const line = value => typeof value === 'string' ? value.slice(0, 50000) : '';
  const check = c => ({ label: line(c.label), status: line(c.status), detail: line(c.detail), action: line(c.action), time: c.time, commit: c.commit });
  const jobs = state.jobs.map(j => ({
    id: j.id, mode: j.mode, status: j.status, plan_approved: Boolean(j.plan && j.approved_plan_hash === digest(JSON.stringify(j.plan))), requirements: line(j.requirements), design: line(j.design),
    plan: j.plan ? { summary: line(j.plan.summary), scope: j.plan.scope.map(line), acceptance: j.plan.acceptance.map(line),
      permissions: j.plan.permissions.map(line), budget: typeof j.plan.budget === 'number' ? j.plan.budget : line(j.plan.budget),
      target_branch: line(j.plan.target_branch), base_commit: line(j.plan.base_commit), integrations: j.plan.integrations || [] } : null,
    offer: j.offer, commit: line(j.commit), target_base_commit: line(j.target_base_commit || j.plan?.base_commit || j.baseline_commit), message: line(j.message),
    features: j.features.map(f => ({ title: line(f.title), status: line(f.status) })),
    checks: j.checks.map(check), reviews: j.reviews.map(r => ({ role: line(r.role), verdict: line(r.verdict), commit: line(r.commit), summary: line(r.summary) })),
    documentation: j.documentation.map(d => ({ kind: line(d.kind), status: line(d.status), commit: line(d.commit), entry: line(d.entry), text: line(d.text) })),
    usage: j.usage ? { tokens: Number.isFinite(j.usage.tokens) ? j.usage.tokens : null, usd: Number.isFinite(j.usage.usd) ? j.usage.usd : null, completeness: line(j.usage.completeness) } : null,
    preview: typeof j.preview === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(j.preview) ? j.preview : null,
    ...lifecycleView(j)
  }));
  return { revision: state.revision, project: config.project_name, edition: config.edition, purpose: config.purpose || 'software', version: config.version,
    workspace_settings: config.workspace || null, integrations: integrationView(state, config), performance: performance(state),
    models: [...new Set(Object.values(config.models).filter(Boolean))],
    owner: { connected: connected(state), runtime: state.owner?.runtime || null, listening: Boolean(state.owner?.listening) },
    checks: [...state.checks.map(check), { label: 'Dashboard owner connection', status: connected(state) ? 'passed' : 'needs-action', detail: connected(state) ? 'The edition owner is paired. Live model identity is checked separately.' : 'No active owner lease.', action: 'Invoke the installed factory skill in the original owning session.' }], jobs,
    commands: state.commands.slice(-100).reverse().map(c => ({ id: c.id, action: c.action, job_id: c.job_id, status: c.status, message: line(c.message), time: c.created_at })),
    activity: state.activity.slice(0, 100).map(e => ({ time: e.time, message: line(e.message) })) };
}
