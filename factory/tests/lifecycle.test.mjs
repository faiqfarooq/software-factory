import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { git } from '../runtime/checks.mjs';
import { atomic, json, readState, digest } from '../runtime/storage.mjs';
import { planInstall, install } from '../setup.mjs';
import { serve } from '../runtime/server.mjs';
import { enqueue, claim, publish, finish, publicState } from '../runtime/workflow.mjs';
import { stage, currentUnit, recordWorker, evidenceReady } from '../runtime/lifecycle.mjs';
import { workspaceOperation, assertWorkspace, workspaceView } from '../runtime/workspace.mjs';
import { models, profile } from '../runtime/profiles.mjs';
import { wordFixture, reviewFixture } from './word-fixture.mjs';

const SHA = 'a'.repeat(40);
const cfg = { roles: profile('claude-only').roles, models: models('claude-only') };
function state() { return { revision: 1, checks: [], jobs: [], commands: [], activity: [], owner: { id: 'owner', generation: 'one', connected: true, expires_at: new Date(Date.now() + 90000).toISOString() } }; }
function send(s, action, job, input) {
  const c = { id: 'cmd-' + s.commands.length, action, revision: s.revision, ...(job ? { job_id: job.id } : {}),
    ...(['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance'].includes(action) ? { offer_id: job.offer?.id } : {}), ...(input ? { input } : {}) };
  enqueue(s, c); return claim(s);
}
function started(mode = 'feature') {
  const s = state(), c = send(s, 'request', null, { mode, title: 'Customer portal', requirements: 'Customer can sign in', target_branch: 'main' });
  return { s, c, job: s.jobs[0] };
}
const deliverable = { summary: 'Synthetic stage fixture', content: 'Explicit synthetic scope and outcomes. No live agent or model was used.' };
function deliver(s, c, job, extra = {}) {
  if (stage(job) === 'implementation' && extra.commit && !extra.documentation) extra = { ...extra, documentation: evidence(extra.commit).documentation };
  return publish(s, { command_id: c.id, job_id: job.id, status: 'awaiting-stage', deliverable, ...extra });
}
function complete(s, c) { finish(s, { id: c.id, status: 'completed' }); }
function plan(w, extra = {}) { return { summary: 'Fixture plan', scope: ['Customer can sign in'], acceptance: ['Customer can sign in'], permissions: ['Local fixture source/docs and tests only'], budget: 'Zero live providers', target_branch: w.target, base_commit: w.base_commit, documentation: ['developer', 'user'], ...extra }; }
function evidence(commit) { return { commit, checks: [{ label: 'Sign-in acceptance', status: 'passed', detail: 'Synthetic test fixture', commit }],
  reviews: ['security', 'ux', 'ui', 'code', 'qa'].map(role => ({ role, verdict: 'PASS', commit, reviewer_id: 'fixture-' + role, summary: 'Synthetic verdict, not actual review.' })),
  documentation: ['developer', 'user'].map(kind => ({ kind, status: 'complete', commit, entry: 'docs/' + kind + '.docx', format: 'docx', verification: reviewFixture(wordFixture(kind)) })), approver: { verdict: 'APPROVE', commit } }; }
function reviewers(s, c, job, e) {
  for (const role of ['security', 'ux', 'ui', 'code', 'qa', 'approver']) recordWorker(s, cfg, { owner_id: 'owner', command_id: c.id, job_id: job.id, id: role + '-' + c.id,
    role, model: cfg.models[role], session: e.reviews.find(r => r.role === role)?.reviewer_id || 'fixture-approver', task: 'Synthetic review fixture', status: 'completed', commit: e.commit });
}
function throughDesign(mode = 'feature') {
  const f = started(mode), { s, job } = f; let c = f.c;
  Object.assign(job.workspace, { prepared: true, base_commit: SHA });
  for (const step of ['feasibility', 'requirements', 'specification', 'design']) {
    assert.equal(stage(job), step);
    deliver(s, c, job, step === 'specification' ? { plan: plan(job.workspace, mode === 'product' ? { features: [{ id: 'login', title: 'Login', depends_on: [], acceptance: ['Customer can sign in'] }, { id: 'profile', title: 'Profile', depends_on: ['login'], acceptance: ['Customer can sign in'] }] } : {}) } : {});
    complete(s, c); c = send(s, 'approve-stage', job);
  }
  return { s, job, c };
}

test('new requests always create staged jobs, named branches and no inferred approval', () => {
  const { s, job, c } = started();
  assert.equal(job.lifecycle, 2); assert.equal(stage(job), 'feasibility'); assert.match(job.workspace.branch, /^feature\/customer-portal-/);
  assert.throws(() => publish(s, { command_id: c.id, job_id: job.id, status: 'awaiting-merge' }), /current stage/);
  assert.throws(() => deliver(s, c, job, { plan: plan(job.workspace) }), /specification stage/);
  deliver(s, c, job); complete(s, c);
  assert.throws(() => send(s, 'approve-plan', job), /current stage approval/);
  assert.throws(() => send(s, 'revise', job, { note: 'Jump ahead', stage: 'implementation' }), /earlier stage/);
  const offer = job.offer.id; send(s, 'approve-stage', job);
  assert.equal(stage(job), 'requirements'); assert.equal(job.decisions.length, 1); assert.equal(job.offer, null); assert.notEqual(offer, undefined);
});
test('product design approval stops before feature dispatch and dependencies are checked', () => {
  const { s, job, c } = throughDesign('product');
  assert.equal(job.status, 'ready-feature'); assert.equal(job.workers.length, 0); complete(s, c);
  const start = send(s, 'start-feature', job); assert.equal(job.active_feature, 'login'); assert.equal(stage(job), 'requirements');
  assert.match(currentUnit(job).workspace.branch, /^feature\/001-login-/); assert.equal(currentUnit(job).workspace.target, job.workspace.branch);
  assert.throws(() => finish(s, { id: start.id, status: 'completed' }), /gate or terminal/);
  assert.throws(() => send(s, 'start-feature', job), /outstanding|offer/);
});
test('roadmap rejects cycles, dangling dependencies and missing acceptance criteria', () => {
  const f = started('product'); Object.assign(f.job.workspace, { prepared: true, base_commit: SHA });
  let c = f.c;
  for (let i = 0; i < 2; i++) { deliver(f.s, c, f.job); complete(f.s, c); c = send(f.s, 'approve-stage', f.job); }
  for (const features of [[{ id: 'a', title: 'A', depends_on: ['a'], acceptance: ['A'] }], [{ id: 'a', title: 'A', depends_on: ['missing'], acceptance: ['A'] }], [{ id: 'a', title: 'A', depends_on: [], acceptance: [] }]]) {
    assert.throws(() => deliver(f.s, c, f.job, { plan: plan(f.job.workspace, { features }) }), /Roadmap/);
  }
});
test('revision preserves history and invalidates downstream consent/evidence', () => {
  const { s, job, c } = throughDesign();
  deliver(s, c, job, { commit: 'b'.repeat(40) }); complete(s, c);
  const revise = send(s, 'revise', job, { note: 'Change login requirements', stage: 'requirements' });
  assert.equal(stage(job), 'requirements'); assert.equal(job.stages.length, 1); assert.equal(job.approved_plan_hash, null);
  assert.ok(job.history[0].stages.some(r => r.stage === 'design' && r.approved));
  assert.equal(job.offer, null); assert.equal(job.reviews.length, 0);
  assert.throws(() => deliver(s, revise, job, { commit: 'c'.repeat(40) }), /implementation/);
});
test('workers keep builder identity and stage permissions, hide sessions, and block approval while running', () => {
  const { s, job, c } = throughDesign();
  const report = { owner_id: 'owner', command_id: c.id, job_id: job.id, id: 'builder1', role: 'builder', model: cfg.models.builder, session: 'PRIVATE_BUILDER_SESSION', task: 'Implement sign-in', status: 'running' };
  recordWorker(s, cfg, report);
  assert.throws(() => deliver(s, c, job, { commit: 'b'.repeat(40) }), /workers/);
  assert.throws(() => recordWorker(s, cfg, { ...report, id: 'builder2', session: 'replacement' }), /same feature builder/);
  assert.throws(() => recordWorker(s, cfg, { ...report, model: 'unapproved-model' }), /configured/);
  assert.throws(() => recordWorker(s, cfg, { ...report, id: 'security', role: 'security', model: cfg.models.security }), /stage/);
  recordWorker(s, cfg, { ...report, status: 'completed', result: 'Fixture source written' });
  const view = publicState(s, { ...cfg, edition: 'claude-only', integrations: {}, project_name: 'Fixture' });
  assert.doesNotMatch(JSON.stringify(view), /PRIVATE_BUILDER_SESSION/); assert.equal(view.jobs[0].workers[0].identity, 'owner-reported');
});
test('QA binds every criterion and all independent reviews/guides to the frozen commit', () => {
  const { s, job, c } = throughDesign(); const commit = 'b'.repeat(40);
  deliver(s, c, job, { commit }); complete(s, c); const qa = send(s, 'approve-stage', job);
  assert.equal(stage(job), 'qa');
  assert.throws(() => deliver(s, qa, job), /Five passing/);
  assert.throws(() => deliver(s, qa, job, evidence(commit)), /Map every/);
  assert.throws(() => deliver(s, qa, job, { ...evidence(commit), commit: 'c'.repeat(40) }), /Rework implementation/);
  const e = evidence(commit); e.reviews.forEach(r => r.reviewer_id = 'one-writer');
  assert.throws(() => deliver(s, qa, job, e), /Five passing/);
  reviewers(s, qa, job, evidence(commit));
  deliver(s, qa, job, { ...evidence(commit), deliverable: { ...deliverable, coverage: [{ requirement: 'Customer can sign in', check: 'Sign-in acceptance' }] } });
  assert.equal(evidenceReady(job), true);
});
test('implementation cannot complete with Markdown guides or missing Word page review', () => {
  const { s, job, c } = throughDesign(), commit = 'b'.repeat(40);
  const payload = { command_id: c.id, job_id: job.id, status: 'awaiting-stage', commit, deliverable };
  assert.throws(() => publish(s, payload), /both Word guides/);
  const documentation = evidence(commit).documentation;
  assert.throws(() => publish(s, { ...payload, documentation: documentation.map(d => ({ ...d, entry: d.entry.replace('.docx', '.md') })) }), /Microsoft Word/);
  assert.throws(() => publish(s, { ...payload, documentation: documentation.map(({ verification, ...d }) => d) }), /rendered-page review/);
  publish(s, { ...payload, documentation }); assert.equal(job.status, 'awaiting-stage');
});

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-stages-')); let server;
  t.after(async () => { if (server) await server.close(); assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('factory-stages-')); await rm(root, { recursive: true, force: true }); });
  await git(root, ['init', '-b', 'main']); await writeFile(path.join(root, 'README.md'), '# Fixture application\n');
  const commit = async (message, files) => { await git(root, ['add', '--', ...files]); await git(root, ['-c', 'user.name=Factory Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', message]); return git(root, ['rev-parse', 'HEAD']); };
  await commit('Fixture baseline', ['README.md']); await install(await planInstall(root, 'claude-only'));
  await commit('Fixture factory installation', ['factory', '.claude', '.gitignore']);
  server = await serve(root); const connection = await json(path.join(root, 'factory/.local/connection.json'));
  async function call(route, input, owner = false) {
    const response = await fetch(server.origin + '/api/' + (owner ? 'owner/' : '') + route, { method: input === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + (owner ? connection.owner_key : connection.browser_key), ...(input === undefined ? {} : { Origin: server.origin, 'X-Factory-CSRF': connection.browser_key, 'Content-Type': 'application/json' }) },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const data = await response.json(); return { status: response.status, data };
  }
  const ok = async (route, input, owner = false) => { const r = await call(route, input, owner); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
  await ok('connect', { id: 'owner', runtime: 'claude' }, true);
  let current;
  const get = async () => (await ok('state')).jobs[0];
  const action = async (action, input) => { const s = await ok('state'), job = s.jobs[0];
    await ok('commands', { id: 'cmd-' + s.revision, action, revision: s.revision, ...(job ? { job_id: job.id } : {}), ...(input ? { input } : {}), ...(job?.offer && ['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance'].includes(action) ? { offer_id: job.offer.id } : {}) });
    current = (await ok('next', { owner_id: 'owner', wait_ms: 0 }, true)).command; assert.ok(current); return current;
  };
  const workspace = (operation, extra = {}) => ok('workspace', { owner_id: 'owner', job_id: current.job_id, command_id: current.id, operation, ...extra }, true);
  const publishStage = async (extra = {}) => {
    const j = await get();
    if (j.stage === 'implementation' && extra.commit && !extra.documentation) extra = { ...extra, documentation: evidence(extra.commit).documentation };
    if (extra.reviews) {
      if (j.phase === 'final') extra = { ...extra, reviews: extra.reviews.map(r => ({ ...r, reviewer_id: 'final-' + r.reviewer_id })) };
      for (const role of ['security', 'ux', 'ui', 'code', 'qa', 'approver']) await ok('worker', { owner_id: 'owner', command_id: current.id, job_id: j.id, id: role + '-' + current.id,
        role, model: cfg.models[role], session: extra.reviews.find(r => r.role === role)?.reviewer_id || 'fixture-approver', task: 'Synthetic fixture review; no live provider', status: 'completed', commit: extra.commit }, true);
    }
    await ok('publish', { owner_id: 'owner', update: { job_id: current.job_id, command_id: current.id, status: 'awaiting-stage', deliverable, ...extra } }, true); await done();
  };
  const done = (status = 'completed') => ok('finish', { owner_id: 'owner', result: { id: current.id, status } }, true);
  return { root, call, ok, get, action, workspace, publishStage, done, commit, current: () => current, server };
}
async function planningStages(f, mode) {
  await f.action('request', { mode, title: 'Customer portal', requirements: 'Customer can sign in', target_branch: 'main' });
  await f.workspace('prepare');
  for (const s of ['feasibility', 'requirements', 'specification', 'design']) {
    const j = await f.get(); assert.equal(j.stage, s);
    await f.publishStage(s === 'specification' ? { plan: plan(j.workspace, mode === 'product' ? { features: [{ id: 'login', title: 'Login', depends_on: [], acceptance: ['Customer can sign in'] }, { id: 'profile', title: 'Profile', depends_on: ['login'], acceptance: ['Customer can sign in'] }] } : {}) } : {});
    await f.action('approve-stage');
  }
  if (mode === 'product') await f.done();
}
async function buildAndIntegrate(f, name, failIntegration = false) {
  const j = await f.get(); assert.equal(j.stage, 'implementation');
  await mkdir(path.join(f.root, 'docs'), { recursive: true });
  await writeFile(path.join(f.root, name + '.txt'), 'Customer can sign in\n');
  for (const kind of ['developer', 'user']) await writeFile(path.join(f.root, 'docs', kind + '.docx'), wordFixture(kind));
  const commit = await f.commit('Synthetic feature ' + name, [name + '.txt', 'docs']);
  assert.equal((await readFile(path.join(f.root, name + '.txt'), 'utf8')).trim(), 'Customer can sign in');
  const diff = await f.ok('workspace/diff?job=' + j.id); assert.match(diff.diff, /Customer can sign in/);
  assert.equal(await git(f.root, ['symbolic-ref', '--short', 'HEAD']), j.workspace.branch);
  await f.publishStage({ commit, preview: 'http://127.0.0.1:3000/', preview_commit: commit });
  assert.equal((await f.get()).preview_commit, commit);
  await f.action('approve-stage');
  await f.publishStage({ ...evidence(commit), deliverable: { ...deliverable, coverage: [{ requirement: 'Customer can sign in', check: 'Sign-in acceptance' }] } });
  await f.action('approve-stage'); assert.equal((await f.get()).stage, 'integration');
  await f.publishStage(); await f.action('approve-merge');
  await f.workspace('merge'); assert.equal((await f.get()).status, 'merging');
  const before = await readState(f.root); assert.ok(before.jobs[0].merge_receipt);
  if (failIntegration) {
    const failed = await f.workspace('verify-integration', { checks: [{ label: 'Failed fixture regression', detail: 'Deliberate negative fixture', kind: 'post-merge', status: 'needs-action', commit }] });
    assert.equal(failed.status, 'blocked'); assert.equal((await f.get()).status, 'blocked');
    assert.equal(await git(f.root, ['rev-parse', 'HEAD']), commit); await f.done('blocked'); return commit;
  }
  await f.workspace('verify-integration', { checks: [{ label: 'Fixture post-merge acceptance', detail: 'Actually read the fixture file on target', kind: 'post-merge', status: 'passed', commit }] });
  await f.done(); return commit;
}
test('real standalone lifecycle creates a branch, exposes local changes, waits at every gate and verifies merge', async t => {
  const f = await fixture(t); await planningStages(f, 'feature');
  const branch = (await f.get()).workspace.branch; await buildAndIntegrate(f, 'login');
  const j = await f.get(); assert.equal(j.status, 'merged'); assert.equal(j.decisions.length, 7);
  assert.equal(await git(f.root, ['symbolic-ref', '--short', 'HEAD']), 'main');
  assert.equal(await git(f.root, ['rev-parse', 'refs/heads/' + branch]), j.commit);
  assert.equal(j.merge_history.length, 1);
  assert.match((await f.ok('workspace/diff?job=' + j.id)).diff, /Customer can sign in/);
});
test('real product delivers two separate feature branches sequentially, then requires fresh aggregate approval', async t => {
  const f = await fixture(t); await planningStages(f, 'product');
  let j = await f.get(); const productBranch = j.workspace.branch;
  assert.equal(j.status, 'ready-feature'); assert.equal(j.features[1].status, 'planned');
  const branches = [];
  for (const name of ['login', 'profile']) {
    await f.action('start-feature'); await f.workspace('prepare');
    for (const s of ['requirements', 'specification', 'design']) {
      j = await f.get(); assert.equal(j.stage, s); branches.push(j.workspace.branch);
      await f.publishStage(s === 'specification' ? { plan: plan(j.workspace) } : {}); await f.action('approve-stage');
    }
    await buildAndIntegrate(f, name); j = await f.get();
    assert.equal(j.status, name === 'login' ? 'ready-feature' : 'ready-acceptance');
    assert.equal(await git(f.root, ['symbolic-ref', '--short', 'HEAD']), productBranch);
  }
  assert.equal(new Set(branches).size, 2); assert.ok(j.features.every(f => f.status === 'accepted'));
  assert.notEqual(await git(f.root, ['rev-parse', 'main']), await git(f.root, ['rev-parse', productBranch]));
  await f.action('start-acceptance'); await f.workspace('select-product');
  const commit = await git(f.root, ['rev-parse', 'HEAD']);
  await f.publishStage({ ...evidence(commit), deliverable: { ...deliverable, coverage: [{ requirement: 'Customer can sign in', check: 'Sign-in acceptance' }] } });
  await f.action('approve-stage'); assert.equal((await f.get()).stage, 'final-merge');
  await f.publishStage(); await f.action('approve-merge'); await f.workspace('merge');
  await f.workspace('verify-integration', { checks: [{ label: 'Fixture aggregate check', detail: 'Read both feature files', status: 'passed', kind: 'post-merge', commit }] }); await f.done();
  assert.equal((await f.get()).status, 'merged'); assert.equal(await git(f.root, ['rev-parse', 'main']), commit);
});
test('dirty app changes are preserved and prevent branch creation', async t => {
  const f = await fixture(t); await writeFile(path.join(f.root, 'unrelated.txt'), 'Keep me');
  await f.action('request', { mode: 'feature', title: 'Login', requirements: 'Customer can sign in' });
  const c = f.current(); const r = await f.call('workspace', { owner_id: 'owner', command_id: c.id, job_id: c.job_id, operation: 'prepare' }, true);
  assert.equal(r.status, 400); assert.match(r.data.error, /Existing changes/);
  assert.equal(await readFile(path.join(f.root, 'unrelated.txt'), 'utf8'), 'Keep me'); assert.equal(await git(f.root, ['symbolic-ref', '--short', 'HEAD']), 'main');
});
test('failed post-merge checks preserve Git, block completion and require revised base consent for fixes', async t => {
  const f = await fixture(t); await planningStages(f, 'feature'); const branch = (await f.get()).workspace.branch;
  const commit = await buildAndIntegrate(f, 'login', true);
  let j = await f.get(); assert.equal(j.status, 'blocked'); assert.equal(j.merge_history.length, 0);
  assert.equal(j.integration_checks[0].checks[0].status, 'needs-action');
  assert.equal(await git(f.root, ['rev-parse', 'main']), commit);
  await f.action('revise', { note: 'Fix failed post-merge acceptance on the same builder branch', stage: 'specification' });
  await f.workspace('refresh-base'); j = await f.get();
  assert.equal(j.workspace.base_commit, commit); assert.equal(j.workspace.branch, branch); assert.equal(j.plan_approved, false);
  assert.equal(await git(f.root, ['symbolic-ref', '--short', 'HEAD']), branch);
});
test('a changed branch/target blocks both offering and consuming a frozen stage approval', async t => {
  const f = await fixture(t); await planningStages(f, 'feature');
  await writeFile(path.join(f.root, 'login.txt'), 'Customer can sign in'); await mkdir(path.join(f.root, 'docs'));
  for (const kind of ['developer', 'user']) await writeFile(path.join(f.root, 'docs', kind + '.docx'), wordFixture(kind));
  const commit = await f.commit('Fixture implementation', ['login.txt', 'docs']);
  await f.publishStage({ commit }); const j = await f.get();
  await git(f.root, ['switch', 'main']);
  const r = await f.call('commands', { id: 'stale-native-branch', action: 'approve-stage', revision: (await f.ok('state')).revision, job_id: j.id, offer_id: j.offer.id });
  assert.equal(r.status, 400); assert.match(r.data.error, /branch/);
  await git(f.root, ['switch', j.workspace.branch]); await writeFile(path.join(f.root, 'unrelated.txt'), 'Keep this local edit');
  const dirty = await f.call('commands', { id: 'dirty-native-tree', action: 'approve-stage', revision: (await f.ok('state')).revision, job_id: j.id, offer_id: j.offer.id });
  assert.equal(dirty.status, 400); assert.match(dirty.data.error, /Existing changes/);
  assert.equal(await readFile(path.join(f.root, 'unrelated.txt'), 'utf8'), 'Keep this local edit');
});
test('parent roadmap revisions preserve integrated history and revoke dependent feature consent', () => {
  const { s, job, c } = throughDesign('product'); complete(s, c); const start = send(s, 'start-feature', job);
  // Simulate a safe blocked checkpoint; no workers or source edits are active.
  publish(s, { command_id: start.id, job_id: job.id, status: 'blocked', message: 'New product requirement needs a new roadmap' });
  finish(s, { id: start.id, status: 'blocked' });
  const previousBranches = job.features.map(f => f.workspace.branch);
  const revision = send(s, 'revise-product', job, { note: 'Add required password reset to the product', stage: 'requirements' });
  assert.equal(job.phase, 'product'); assert.equal(stage(job), 'requirements'); assert.equal(job.approved_plan_hash, null);
  assert.equal(job.archived_cycles[0].active_feature, 'login'); assert.equal(job.features.every(f => f.status === 'planned'), true);
  assert.ok(job.features.every((f, i) => f.workspace.branch !== previousBranches[i]));
  assert.throws(() => deliver(s, revision, job, { plan: plan(job.workspace) }), /specification stage/);
});
test('restart reconciliation can stop an uncertain worker but cannot relaunch it', () => {
  const { s, job, c } = throughDesign();
  const report = { owner_id: 'owner', command_id: c.id, job_id: job.id, id: 'interrupted', role: 'builder', model: cfg.models.builder, session: 'same-builder', task: 'Actual worker reconciliation fixture', status: 'running' };
  recordWorker(s, cfg, report); c.status = 'uncertain'; job.workers[0].status = 'uncertain';
  assert.throws(() => recordWorker(s, cfg, report), /reconcile/);
  recordWorker(s, cfg, { ...report, status: 'stopped', result: 'Fixture process was inspected and is stopped' });
  assert.equal(job.workers[0].status, 'stopped'); finish(s, { id: c.id, status: 'blocked' });
  assert.equal(c.status, 'blocked');
});
