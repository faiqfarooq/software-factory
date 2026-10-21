import path from 'node:path';
import { git } from './checks.mjs';
import { stamp, atomic, json, safePath } from './storage.mjs';
import { currentUnit, stage, recordIntegration, evidenceReady } from './lifecycle.mjs';

const fail = message => { throw new Error(message); };
async function repository(root) {
  const actual = await git(root, ['rev-parse', '--show-toplevel']);
  if (path.resolve(actual).toLowerCase() !== path.resolve(root).toLowerCase()) fail('Choose the application Git root.');
}
export async function workspaceView(root, job) {
  try {
    await repository(root);
    const [branch, commit, status] = await Promise.all([
      git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => null),
      git(root, ['rev-parse', '--verify', 'HEAD']).catch(() => null),
      git(root, ['status', '--porcelain=v1', '-uall'])
    ]);
    const w = job?.lifecycle === 2 ? currentUnit(job)?.workspace : null;
    return { available: true, root, branch, commit, dirty: Boolean(status), changes: status.split('\n').filter(Boolean).map(line => ({ status: line.slice(0, 2).trim(), path: line.slice(3) })),
      expected_branch: w?.branch || null, target: w?.target || null, matches: w ? branch === w.branch : null };
  } catch { return { available: false, root, detail: 'No application Git root or committed baseline is available. Prepare an explicitly approved baseline before specification/design writes.' }; }
}
async function clean(root) { if (await git(root, ['status', '--porcelain', '--untracked-files=all'])) fail('Existing changes must be committed or explicitly reconciled before creating/switching branches. No files were staged or discarded.'); }
export async function assertWorkspace(root, job, { frozen = false } = {}) {
  await repository(root); const u = currentUnit(job), w = u.workspace;
  if (!w?.prepared || await git(root, ['symbolic-ref', '--short', 'HEAD']) !== w.branch) fail('The expected feature/product branch must be checked out in the application folder.');
  if (await git(root, ['rev-parse', '--verify', 'refs/heads/' + w.target]) !== w.base_commit) fail('Target branch changed. Reconcile it and revise the specification before continuing.');
  if (frozen) {
    await clean(root);
    if (await git(root, ['rev-parse', 'HEAD']) !== u.commit) fail('The checked-out branch differs from the reviewed commit.');
    await git(root, ['merge-base', '--is-ancestor', w.base_commit, u.commit]);
  }
}
export async function workspaceDiff(root, job) {
  await repository(root); const w = currentUnit(job)?.workspace;
  if (!w?.prepared) fail('Prepare the branch first.');
  const view = await workspaceView(root, job);
  const comparison = view.matches ? [w.base_commit] : [w.base_commit, 'refs/heads/' + w.branch];
  const diff = await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', ...comparison, '--', '.', ':!factory/.local', ':!**/.env*', ':!**/credentials*', ':!.aws', ':!**/*.pem', ':!**/*.key']);
  const files = await git(root, ['diff', '--name-status', '--no-renames', ...comparison, '--', '.', ':!factory/.local']);
  // This authenticated view is explicitly requested; untracked contents are never opened.
  return { ...view, viewed_branch: w.branch, working_changes_included: view.matches, files, diff, untracked_note: 'Uncommitted changes belong to the actual checked-out branch only. New untracked files appear in Changed files; deliberately add/commit intended files before final review.' };
}
export async function workspaceOperation(root, state, input) {
  if (!input || Object.keys(input).some(k => !['owner_id', 'command_id', 'job_id', 'operation', 'checks'].includes(k))) fail('Unknown workspace fields.');
  const job = state.jobs.find(j => j.id === input.job_id), command = state.commands.find(c => c.id === input.command_id && c.job_id === input.job_id && (c.status === 'running' || (['verify-integration', 'reconcile-integration', 'reconcile-branch'].includes(input.operation) && c.status === 'uncertain')));
  if (!job || job.lifecycle !== 2 || !command || command.owner_id !== input.owner_id) fail('Workspace operation needs the matching active owner command.');
  if (['pause', 'cancel'].includes(command.action)) fail('Stop commands cannot create or merge branches.');
  const u = currentUnit(job), w = u.workspace;
  await repository(root);
  if (input.operation === 'prepare') {
    if (job.status === 'merging' || ['awaiting-stage', 'paused', 'cancelled', 'merged', 'ready-feature', 'ready-acceptance'].includes(job.status)) fail('Prepare the branch only during an authorized stage.');
    if (w.prepared) { await assertWorkspace(root, job); return { status: 'prepared', ...w }; }
    await clean(root);
    const target = w.target || await git(root, ['symbolic-ref', '--short', 'HEAD']);
    await git(root, ['check-ref-format', '--branch', target]);
    const base = await git(root, ['rev-parse', '--verify', 'refs/heads/' + target]);
    if (job.mode === 'product' && job.phase === 'feature' && base !== (job.accepted_product_head || job.workspace.base_commit)) fail('Product head changed outside accepted integration. Revise the product roadmap and reconcile its base first.');
    const exists = await git(root, ['show-ref', '--verify', 'refs/heads/' + w.branch]).then(() => true, () => false);
    if (exists) fail('The proposed branch already exists. Reconcile the interruption; never overwrite or reset it.');
    await atomic(await safePath(root, 'factory/.local/branches/' + job.id + '-' + (job.active_feature || job.phase) + '.json'), { branch: w.branch, target, base_commit: base, command_id: command.id, job_id: job.id, time: stamp() });
    await git(root, ['switch', '-c', w.branch, target]);
    Object.assign(w, { target, base_commit: base, prepared: true, prepared_at: stamp() });
    return { status: 'prepared', ...w };
  }
  if (input.operation === 'reconcile-branch') {
    const intent = await json(await safePath(root, 'factory/.local/branches/' + job.id + '-' + (job.active_feature || job.phase) + '.json'), null);
    if (!intent || intent.branch !== w.branch || intent.command_id !== command.id || intent.job_id !== job.id) fail('No matching durable branch intent. Preserve the existing branch and reconcile manually.');
    if (await git(root, ['symbolic-ref', '--short', 'HEAD']) !== intent.branch || await git(root, ['rev-parse', 'refs/heads/' + intent.target]) !== intent.base_commit) fail('Branch intent differs from actual Git.');
    await git(root, ['merge-base', '--is-ancestor', intent.base_commit, 'HEAD']);
    Object.assign(w, { target: intent.target, base_commit: intent.base_commit, prepared: true, prepared_at: intent.time });
    return { status: 'reconciled', ...w };
  }
  if (input.operation === 'merge') {
    if (command.action !== 'approve-merge' || job.status !== 'merging' || job.merge_receipt?.command_id !== command.id ||
        !['integration', 'final-merge'].includes(stage(job)) || !evidenceReady(u) || job.merge_receipt.offer.commit !== u.commit) fail('An exact human merge receipt and current evidence are required.');
    await assertWorkspace(root, job, { frozen: true });
    // Reserve durable intent before invoking this operation via the server; a crash becomes Uncertain.
    await git(root, ['switch', w.target]);
    await git(root, ['merge', '--ff-only', '--no-edit', u.commit]);
    job.integration_pending = { unit: job.active_feature || job.phase, branch: w.branch, target: w.target, commit: u.commit, time: stamp() };
    return { status: 'verification-required', ...job.integration_pending };
  }
  if (input.operation === 'verify-integration') {
    const pending = job.integration_pending;
    if (job.status !== 'merging' || command.action !== 'approve-merge' || !job.merge_receipt || !evidenceReady(u)) fail('No approved integration is awaiting verification.');
    // Also accepts a safely reconciled merge after a receipt-write interruption.
    const actual = await git(root, ['rev-parse', '--verify', 'refs/heads/' + w.target]);
    if (actual !== u.commit || job.merge_receipt.offer.commit !== u.commit || (pending && pending.commit !== actual) ||
        await git(root, ['symbolic-ref', '--short', 'HEAD']) !== w.target) fail('Actual Git target does not equal the reviewed commit. Stop and reconcile.');
    await clean(root);
    if (!Array.isArray(input.checks) || !input.checks.length || !input.checks.every(c => c && Object.keys(c).every(k => ['label', 'status', 'kind', 'commit', 'detail'].includes(k)) && typeof c.label === 'string' && c.label.length > 0 && c.label.length <= 1000 && ['passed', 'needs-action', 'not-checked'].includes(c.status) && c.kind === 'post-merge' && c.commit === actual && typeof c.detail === 'string' && c.detail.length <= 5000)) fail('Record actual post-merge checks for the exact target commit.');
    job.integration_checks ||= []; job.integration_checks.push({ unit: job.active_feature || job.phase, branch: w.target, commit: actual, checks: input.checks, time: stamp() });
    if (input.checks.some(c => c.status !== 'passed')) {
      job.status = 'blocked'; job.offer = null; job.message = 'Post-merge checks failed or remain unverified. Git was preserved. Revise specification and refresh-base before source fixes; no next feature can start.';
      return { status: 'blocked', commit: actual };
    }
    recordIntegration(job, actual); job.integration_pending = null;
    return { status: job.status, commit: actual };
  }
  if (input.operation === 'refresh-base') {
    if (!['revise', 'revise-product', 'rework'].includes(command.action) || !['feasibility', 'requirements', 'specification'].includes(stage(job)) || !w.prepared) fail('Base reconciliation requires a human revision of specification or an earlier stage.');
    await clean(root); await git(root, ['switch', w.branch]);
    const target = await git(root, ['rev-parse', 'refs/heads/' + w.target]);
    await git(root, ['merge-base', '--is-ancestor', target, 'HEAD']);
    w.base_commit = target; job.merge_receipt = null; job.integration_pending = null;
    if (job.mode === 'product' && job.phase === 'product') job.accepted_product_head = await git(root, ['rev-parse', 'HEAD']);
    return { status: 'reconciled', ...w };
  }
  if (input.operation === 'reconcile-integration') {
    if (command.action !== 'approve-merge' || job.status !== 'merging' || !job.merge_receipt) fail('No interrupted approved merge to reconcile.');
    if (await git(root, ['rev-parse', 'refs/heads/' + w.target]) !== w.base_commit) fail('Target changed or merge completed. Verify the actual integration; never replay it.');
    job.status = 'blocked'; job.offer = null; job.message = 'Interrupted merge did not advance the target. Inspect Git, then request a revision for a fresh merge offer. No merge was replayed.';
    return { status: 'blocked' };
  }
  if (input.operation === 'select-product') {
    if (job.mode !== 'product' || !['start-acceptance', 'revise-product'].includes(command.action)) fail('Product checkout needs explicit acceptance/roadmap revision consent.');
    await clean(root);
    await git(root, ['switch', job.workspace.branch]);
    await assertWorkspace(root, job);
    return { status: 'prepared', ...job.workspace };
  }
  fail('Workspace operations: prepare, reconcile-branch, refresh-base, merge, verify-integration, reconcile-integration, select-product.');
}
