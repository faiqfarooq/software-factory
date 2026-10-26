import path from 'node:path';
import { git } from './checks.mjs';
import { stamp, atomic, json, safePath, digest, readConfig } from './storage.mjs';
import { currentUnit, stage, recordIntegration, evidenceReady } from './lifecycle.mjs';
import { committedWord, wordEvidence } from './documents.mjs';

const fail = message => { throw new Error(message); };
export const currentBranches = w => w?.policy === 'current-branches';
export const snapshotId = repositories => digest(JSON.stringify(repositories.map(({ path, branch, commit }) => ({ path, branch, commit }))));
export async function repositorySettings(root, settings) {
  if (settings === undefined) return undefined;
  if (!settings || Object.keys(settings).some(k => !['policy', 'repositories'].includes(k)) || settings.policy !== 'current-branches' ||
      !Array.isArray(settings.repositories) || !settings.repositories.length || settings.repositories.length > 40) fail('Choose current-branches and an explicit repository allowlist.');
  const seen = new Set(), repositories = [];
  for (const item of settings.repositories) {
    if (!item || Object.keys(item).some(k => !['path', 'branch'].includes(k)) || typeof item.path !== 'string' ||
        item.path.split('/').some(p => p.startsWith('.')) || /^(factory|node_modules)(\/|$)/i.test(item.path) || seen.has(item.path.toLowerCase())) fail('Unsafe or duplicate repository selection.');
    const folder = await safePath(root, item.path); await repository(folder);
    if (typeof item.branch !== 'string') fail('Pin each repository to its existing named branch.');
    await git(folder, ['check-ref-format', '--branch', item.branch]);
    seen.add(item.path.toLowerCase()); repositories.push({ path: item.path, branch: item.branch });
  }
  if (repositories.some(a => repositories.some(b => a !== b && b.path.toLowerCase().startsWith(a.path.toLowerCase() + '/')))) fail('Repository scopes cannot overlap.');
  return { policy: 'current-branches', repositories };
}
export async function bindWorkspace(root, config, input) {
  if (!config.workspace) {
    if (input?.repositories !== undefined) fail('Repository selection requires configured workspace support.');
    return null;
  }
  if (input?.purpose === 'web-to-mobile') fail('Use a separate single mobile output factory for web-to-mobile work.');
  const settings = await repositorySettings(root, config.workspace), names = input?.repositories;
  if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length || names.some(p => !settings.repositories.some(r => r.path === p))) fail('Select the exact allowed repositories for this request.');
  if (input.target_branch !== 'current-branches') fail('This workspace uses its pinned existing branches.');
  return { policy: 'current-branches', branch: 'Existing branches', target: 'current-branches', base_commit: null, prepared: false,
    repositories: settings.repositories.filter(r => names.includes(r.path)).map(r => ({ ...r, base_commit: null })) };
}
async function heads(root, w, { requireClean = false } = {}) {
  const settings = await repositorySettings(root, (await readConfig(root)).workspace);
  const result = [];
  for (const entry of w.repositories) {
    if (!settings?.repositories.some(r => r.path === entry.path && r.branch === entry.branch)) fail('Repository scope or branch changed; reconcile the workspace configuration.');
    const folder = await safePath(root, entry.path);
    if (await git(folder, ['symbolic-ref', '--short', 'HEAD']) !== entry.branch) fail('Repository branch changed: ' + entry.path);
    const commit = await git(folder, ['rev-parse', '--verify', 'HEAD']).catch(() => fail('A committed baseline is required: ' + entry.path));
    if (requireClean) await clean(folder);
    if (entry.base_commit) await git(folder, ['merge-base', '--is-ancestor', entry.base_commit, commit]).catch(() => fail('Repository history changed: ' + entry.path));
    result.push({ path: entry.path, branch: entry.branch, commit });
  }
  return result;
}
export async function workspaceWord(root, guide, u) {
  if (!currentBranches(u.workspace)) return committedWord(root, guide, u.commit);
  if (!wordEvidence(guide, u.commit) || snapshotId(u.workspace.reviewed || []) !== u.commit) fail('Word evidence must match the reviewed repository snapshot.');
  const repo = u.workspace.reviewed.find(r => guide.entry.startsWith(r.path + '/'));
  if (!repo) fail('The guide must belong to a selected reviewed repository.');
  return committedWord(await safePath(root, repo.path), { ...guide, entry: guide.entry.slice(repo.path.length + 1), commit: repo.commit }, repo.commit);
}
async function repository(root) {
  const actual = await git(root, ['rev-parse', '--show-toplevel']);
  if (path.resolve(actual).toLowerCase() !== path.resolve(root).toLowerCase()) fail('Choose the application Git root.');
}
export async function workspaceView(root, job, config) {
  const w = job?.lifecycle === 2 ? currentUnit(job)?.workspace : null;
  if (currentBranches(w) || config?.workspace) {
    const repositories = await Promise.all((w?.repositories || config.workspace.repositories).map(async entry => {
      const folder = await safePath(root, entry.path), view = await workspaceView(folder);
      return { ...view, path: entry.path, expected_branch: entry.branch, base_commit: entry.base_commit || null, matches: view.branch === entry.branch };
    }));
    return { available: true, root, policy: 'current-branches', branch: 'Existing branches', target: 'current-branches',
      commit: repositories.every(r => r.commit) ? snapshotId(repositories) : null, repositories,
      dirty: repositories.some(r => r.dirty), matches: repositories.every(r => r.matches),
      changes: repositories.flatMap(r => (r.changes || []).map(c => ({ ...c, path: r.path + '/' + c.path }))) };
  }
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
  const selected = currentUnit(job);
  if (currentBranches(selected.workspace)) {
    if (!selected.workspace.prepared) fail('Prepare the selected repositories first.');
    const actual = await heads(root, selected.workspace, { requireClean: frozen });
    if (frozen && (snapshotId(actual) !== selected.commit || JSON.stringify(actual) !== JSON.stringify(selected.workspace.reviewed))) fail('A repository changed after the reviewed snapshot. Return to implementation.');
    return;
  }
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
  const selected = currentUnit(job);
  if (currentBranches(selected?.workspace)) {
    if (!selected.workspace.prepared) fail('Prepare the repositories first.');
    await heads(root, selected.workspace);
    const pieces = await Promise.all(selected.workspace.repositories.map(async r => {
      const folder = await safePath(root, r.path);
      const result = await workspaceDiff(folder, { ...job, mode: 'feature', workspace: { prepared: true, branch: r.branch, target: r.branch, base_commit: r.base_commit } });
      return { path: r.path, ...result };
    }));
    const diff = pieces.map(p => 'Repository: ' + p.path + '\n' + p.diff).join('\n');
    if (Buffer.byteLength(diff) > 1024 * 1024) fail('Diff exceeds the bounded dashboard limit. Inspect intended files locally.');
    return { ...await workspaceView(root, job), files: pieces.map(p => p.path + '\n' + p.files).join('\n'), diff,
      untracked_note: 'Only selected repositories are shown. Untracked contents stay private; inspect intended new files locally.' };
  }
  await repository(root); const w = currentUnit(job)?.workspace;
  if (!w?.prepared) fail('Prepare the branch first.');
  const view = await workspaceView(root, job);
  const comparison = view.matches ? [w.base_commit] : [w.base_commit, 'refs/heads/' + w.branch];
  const scope = ['.', ':!factory/.local', ':!**/.env*', ':!**/credentials*', ':!**/.aws/**', ':!**/.codex/**', ':!**/.claude/**', ':!**/.ssh/**', ':!**/*.pem', ':!**/*.key', ':!**/*token*', ':!**/*secret*'];
  const diff = await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', ...comparison, '--', ...scope]);
  const files = await git(root, ['diff', '--name-status', '--no-renames', ...comparison, '--', ...scope]);
  // This authenticated view is explicitly requested; untracked contents are never opened.
  return { ...view, viewed_branch: w.branch, working_changes_included: view.matches, files, diff, untracked_note: 'Uncommitted changes belong to the actual checked-out branch only. New untracked files appear in Changed files; deliberately add/commit intended files before final review.' };
}
export async function workspaceOperation(root, state, input) {
  if (!input || Object.keys(input).some(k => !['owner_id', 'command_id', 'job_id', 'operation', 'checks'].includes(k))) fail('Unknown workspace fields.');
  const job = state.jobs.find(j => j.id === input.job_id), command = state.commands.find(c => c.id === input.command_id && c.job_id === input.job_id && (c.status === 'running' || (['verify-integration', 'reconcile-integration', 'reconcile-branch'].includes(input.operation) && c.status === 'uncertain')));
  if (!job || job.lifecycle !== 2 || !command || command.owner_id !== input.owner_id) fail('Workspace operation needs the matching active owner command.');
  if (['pause', 'cancel'].includes(command.action)) fail('Stop commands cannot create or merge branches.');
  const u = currentUnit(job), w = u.workspace;
  if (currentBranches(w)) return existingWorkspaceOperation(root, job, command, input);
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

async function existingWorkspaceOperation(root, job, command, input) {
  const u = currentUnit(job), w = u.workspace;
  if (input.operation === 'prepare') {
    if (['merging', 'awaiting-stage', 'paused', 'cancelled', 'merged', 'ready-feature', 'ready-acceptance'].includes(job.status)) fail('Prepare only during an authorized stage.');
    if (w.prepared) { await assertWorkspace(root, job); return { status: 'prepared', ...w }; }
    const actual = await heads(root, w, { requireClean: true });
    if (job.mode === 'product' && job.phase === 'feature' && snapshotId(actual) !== (job.accepted_product_head || job.workspace.base_commit)) fail('Accepted product repositories changed. Revise the product scope before starting this feature.');
    w.repositories = actual.map(({ commit, ...r }) => ({ ...r, base_commit: commit }));
    Object.assign(w, { base_commit: snapshotId(actual), prepared: true, prepared_at: stamp() });
    return { status: 'prepared', ...w };
  }
  if (input.operation === 'snapshot') {
    if (!['implementation', 'acceptance'].includes(stage(job)) || !['running', 'reviewing'].includes(job.status) || !w.prepared) fail('Capture a snapshot only during implementation or product acceptance.');
    const actual = await heads(root, w, { requireClean: true });
    if (stage(job) === 'acceptance' && snapshotId(actual) !== job.accepted_product_head) fail('Product changed after accepted feature integration.');
    w.reviewed = actual;
    return { status: 'snapshot', snapshot_id: snapshotId(actual), repositories: actual };
  }
  if (input.operation === 'select-product') {
    if (job.mode !== 'product' || !['start-acceptance', 'revise-product'].includes(command.action)) fail('Product selection requires explicit acceptance or revision.');
    await heads(root, w, { requireClean: true });
    return { status: 'prepared', ...w };
  }
  if (input.operation === 'refresh-base') {
    if (!['revise', 'revise-product', 'rework'].includes(command.action) || !['feasibility', 'requirements', 'specification'].includes(stage(job))) fail('Refresh requires an earlier human revision.');
    const actual = await heads(root, w, { requireClean: true });
    w.repositories = actual.map(({ commit, ...r }) => ({ ...r, base_commit: commit }));
    w.base_commit = snapshotId(actual); delete w.reviewed; job.merge_receipt = null; job.integration_pending = null;
    if (job.mode === 'product' && job.phase === 'product') job.accepted_product_head = w.base_commit;
    return { status: 'reconciled', ...w };
  }
  if (['merge', 'verify-integration', 'reconcile-integration'].includes(input.operation)) {
    if (command.action !== 'approve-merge' || job.status !== 'merging' || job.merge_receipt?.command_id !== command.id ||
        !['integration', 'final-merge'].includes(stage(job)) || !evidenceReady(u) || job.merge_receipt.offer.commit !== u.commit) fail('Exact human integration approval and current evidence are required.');
    await assertWorkspace(root, job, { frozen: true });
    if (input.operation === 'merge') {
      job.integration_pending = { unit: job.active_feature || job.phase, commit: u.commit, time: stamp(), policy: w.policy };
      return { status: 'verification-required', policy: w.policy, snapshot_id: u.commit, repositories: w.reviewed, git_merge: false };
    }
    if (!Array.isArray(input.checks) || !input.checks.length || !input.checks.every(c => c && Object.keys(c).every(k => ['label', 'status', 'kind', 'commit', 'detail'].includes(k)) &&
        typeof c.label === 'string' && c.label.length > 0 && c.label.length <= 1000 && c.kind === 'integration' && c.commit === u.commit &&
        ['passed', 'needs-action', 'not-checked'].includes(c.status) && typeof c.detail === 'string' && c.detail.length <= 5000)) fail('Record actual integration checks for the exact repository snapshot.');
    job.integration_checks ||= []; job.integration_checks.push({ unit: job.active_feature || job.phase, commit: u.commit, checks: input.checks, time: stamp() });
    if (input.checks.some(c => c.status !== 'passed')) { job.status = 'blocked'; job.offer = null; job.message = 'Integration checks failed. Preserve all repositories and request a revision.'; return { status: 'blocked' }; }
    recordIntegration(job, u.commit); job.integration_pending = null;
    return { status: job.status, snapshot_id: u.commit, git_merge: false };
  }
  fail('Existing-branch workspace operations: prepare, snapshot, refresh-base, select-product, merge (acceptance only), verify-integration, reconcile-integration.');
}
