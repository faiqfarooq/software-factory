import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, cp, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { planInstall, install, verifyBundle, buildManifest, SOURCE } from '../setup.mjs';
import { profile, VERSION } from '../runtime/profiles.mjs';
import { exists, json, atomic, safePath, readState, digest } from '../runtime/storage.mjs';
import { git } from '../runtime/checks.mjs';
import { serve, assertMergeBinding } from '../runtime/server.mjs';
import { enqueue, claim, publish, finish, mergeReady } from '../runtime/workflow.mjs';

const resources = new Map();
async function temporary(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'software-factory-test-'));
  resources.set(dir, []);
  t.after(async () => {
    for (const close of resources.get(dir).reverse()) await close();
    resources.delete(dir);
    const full = path.resolve(dir), parent = path.resolve(tmpdir());
    assert.equal(path.dirname(full), parent); assert.ok(path.basename(full).startsWith('software-factory-test-'));
    await rm(full, { recursive: true, force: true });
  });
  return dir;
}
async function app(t, edition = 'claude-only') {
  const root = await temporary(t);
  await git(root, ['init', '-b', 'main']);
  await writeFile(path.join(root, 'README.md'), '# Existing application\n');
  await git(root, ['add', 'README.md']);
  await git(root, ['-c', 'user.name=Factory Test', '-c', 'user.email=factory@example.invalid', 'commit', '-m', 'Fixture base']);
  await install(await planInstall(root, edition));
  return root;
}
async function running(t, edition = 'claude-only') {
  const root = await app(t, edition), server = await serve(root);
  resources.get(root).push(() => server.close());
  const connection = await json(path.join(root, 'factory/.local/connection.json'));
  const request = async (route, input, { owner = false, headers = {}, auth = true } = {}) => {
    const response = await fetch(server.origin + route, {
      method: input === undefined ? 'GET' : 'POST',
      headers: { ...(auth ? { Authorization: 'Bearer ' + (owner ? connection.owner_key : connection.browser_key) } : {}),
        ...(input === undefined ? {} : { 'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': connection.browser_key }), ...headers },
      ...(input === undefined ? {} : { body: JSON.stringify(input) })
    });
    return { status: response.status, data: await response.json() };
  };
  const owner = (op, input) => request('/api/owner/' + op, input, { owner: true });
  return { root, server, connection, request, owner };
}
function unitState() {
  return { revision: 1, owner: { id: 'session', generation: 'one', connected: true, expires_at: new Date(Date.now() + 60000).toISOString() }, jobs: [], commands: [], activity: [] };
}
function planning() {
  const state = unitState();
  enqueue(state, { id: 'request1', action: 'request', revision: state.revision, input: { mode: 'product', requirements: 'Build a task app.' } });
  const command = claim(state), job = state.jobs[0];
  // Persisted v1 fixtures retain their historical validation; HTTP requests always create v2 jobs.
  delete job.lifecycle;
  const plan = { summary: 'Task app', scope: ['Tasks'], acceptance: ['Create a task'], permissions: ['Application source edits and local tests'], budget: 'Approved subscription usage', target_branch: 'main', base_commit: 'a'.repeat(40), documentation: ['developer', 'user'] };
  publish(state, { command_id: command.id, job_id: job.id, status: 'awaiting-plan', plan });
  finish(state, { id: command.id, status: 'completed' });
  return { state, job, command, plan };
}

test('release manifest verifies every shipped runtime and dashboard file', async () => {
  const manifest = await verifyBundle(); assert.equal(manifest.version, VERSION); assert.ok(Object.keys(manifest.files).length >= 10);
});
test('fresh Claude setup preserves the app and creates no Codex integration or placeholders', async t => {
  const root = await app(t);
  assert.equal(await readFile(path.join(root, 'README.md'), 'utf8'), '# Existing application\n');
  assert.ok(await exists(path.join(root, '.claude/skills/factory/SKILL.md')));
  for (const file of ['.agents', '.codex', 'factory/jobs', 'factory/board.json', 'factory/usage.jsonl', 'prompts']) assert.equal(await exists(path.join(root, file)), false, file);
  assert.match(await readFile(path.join(root, '.gitignore'), 'utf8'), /\/factory\/\.local\//);
  const config = await json(path.join(root, 'factory/config.json'));
  assert.equal(Object.keys(config.roles).length, 10); assert.ok(Object.values(config.roles).every(r => r === 'claude'));
  const launcher = await readFile(path.join(root, '.claude/skills/factory/SKILL.md'), 'utf8');
  assert.match(launcher, /chat OR dashboard approval/);
  assert.match(launcher, /without asking again/);
  assert.doesNotMatch(launcher, /danger-full-access|\.codex\/config/);
  assert.equal(config.version, VERSION);
});
test('repeat setup preserves configuration, history and existing ignore entries without duplicate writes', async t => {
  const root = await app(t), configFile = path.join(root, 'factory/config.json');
  const config = await json(configFile); config.budgets.usd = 12; await atomic(configFile, config);
  const before = await readState(root); before.jobs.push({ id: 'kept' }); await atomic(path.join(root, 'factory/.local/state.json'), before);
  const plan = await planInstall(root, 'claude-only'); assert.equal(plan.changes.length, 0); await install(plan);
  assert.equal((await json(configFile)).budgets.usd, 12); assert.equal((await readState(root)).jobs[0].id, 'kept');
  assert.equal((await readFile(path.join(root, '.gitignore'), 'utf8')).split('/factory/.local/').length, 2);
});
test('Windows checkout line endings do not become false managed-file conflicts', async t => {
  const root = await app(t), file = path.join(root, 'factory/runtime/cli.mjs');
  await writeFile(file, (await readFile(file, 'utf8')).replaceAll('\n', '\r\n'));
  const plan = await planInstall(root, 'claude-only'); assert.equal(plan.changes.length, 0);
});
test('hybrid and API profiles install only their intended launcher paths and role assignments', async t => {
  for (const edition of ['codex-claude', 'low-cost']) {
    const root = await app(t, edition);
    assert.equal(Object.keys(profile(edition).roles).length, 10);
    assert.equal(await exists(path.join(root, '.agents/skills/factory/SKILL.md')), edition === 'codex-claude');
    assert.equal(await exists(path.join(root, '.claude/skills/factory/SKILL.md')), edition === 'codex-claude');
    assert.equal(await exists(path.join(root, '.codex')), false);
    if (edition === 'codex-claude') {
      const launcher = await readFile(path.join(root, '.agents/skills/factory/SKILL.md'), 'utf8');
      const forwarder = await readFile(path.join(root, '.claude/skills/factory/SKILL.md'), 'utf8');
      assert.match(launcher, /Full Access is optional and requires an explicit user request/);
      assert.match(forwarder, /Forward an exact approval once/);
    }
  }
});
test('modified managed files block upgrade before unrelated writes', async t => {
  const root = await app(t), original = await readFile(path.join(root, 'factory/runtime/cli.mjs'), 'utf8');
  await writeFile(path.join(root, 'factory/dashboard/app.js'), '// custom');
  await assert.rejects(planInstall(root, 'claude-only'), /File conflict/);
  assert.equal(await readFile(path.join(root, 'factory/runtime/cli.mjs'), 'utf8'), original);
  await assert.rejects(planInstall(root, 'codex-claude'), /migration/);
});
test('tampered bundle and unsafe manifest paths never install', async t => {
  const source = await temporary(t); await cp(SOURCE, source, { recursive: true, filter: name => !name.split(path.sep).includes('.local') && !name.split(path.sep).includes('tests') });
  await writeFile(path.join(source, 'dashboard/app.js'), 'tampered');
  await assert.rejects(verifyBundle(source), /checksum/);
  const manifest = await json(path.join(source, 'manifest.json')); manifest.files['../escape'] = 'a'.repeat(64); await atomic(path.join(source, 'manifest.json'), manifest);
  await assert.rejects(verifyBundle(source), /manifest/);
});
test('upgrade changes unchanged managed assets while preserving jobs/config', async t => {
  const root = await app(t), source = await temporary(t);
  await cp(SOURCE, source, { recursive: true, filter: name => !name.split(path.sep).includes('.local') && !name.split(path.sep).includes('tests') });
  await writeFile(path.join(source, 'dashboard/style.css'), '/* new tested release fixture */\n'); await buildManifest(source);
  const plan = await planInstall(root, 'claude-only', source); assert.equal(plan.changes.length, 1); await install(plan);
  assert.match(await readFile(path.join(root, 'factory/dashboard/style.css'), 'utf8'), /new tested release/);
  assert.ok((await readState(root)).setup_receipts.length === 2);
});
test('changes after setup approval are rejected before installation', async t => {
  const root = await temporary(t), plan = await planInstall(root, 'claude-only');
  await writeFile(path.join(root, '.gitignore'), 'user-added\n');
  await assert.rejects(install(plan), /changed since/);
  assert.equal(await exists(path.join(root, 'factory/dashboard')), false);
});
test('path traversal and junction destinations are rejected', async t => {
  const root = await temporary(t), external = await temporary(t);
  for (const relative of ['../outside', '/absolute', 'factory/../outside', 'factory\\outside', 'C:/outside', 'factory//x']) await assert.rejects(safePath(root, relative), /Unsafe/);
  await symlink(external, path.join(root, 'factory'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(planInstall(root, 'claude-only'), /symbolic link|junction/);
});
test('an unmanaged legacy factory is preserved for explicit migration', async t => {
  const root = await temporary(t); await mkdir(path.join(root, 'factory')); await writeFile(path.join(root, 'factory/board.json'), '{}');
  await assert.rejects(planInstall(root, 'claude-only'), /unmanaged factory/);
  assert.equal(await readFile(path.join(root, 'factory/board.json'), 'utf8'), '{}');
});
test('an interrupted approved package resumes without overwriting later user edits', async t => {
  const root = await temporary(t), plan = await planInstall(root, 'claude-only');
  await atomic(await safePath(root, 'factory/.local/installing.json'), {
    root_binding: plan.rootBinding, edition: plan.edition,
    bundle_hash: digest(JSON.stringify(plan.manifest)), files: plan.managed
  });
  const first = plan.changes[0]; await atomic(await safePath(root, first.path), first.content);
  const resumed = await planInstall(root, 'claude-only');
  assert.ok(!resumed.changes.some(c => c.path === first.path));
  await install(resumed); assert.equal(await exists(path.join(root, 'factory/.local/installing.json')), false);
  assert.ok(await exists(path.join(root, 'factory/.local/install.json')));
});
test('copying private installation state into a different project cannot import its owner or jobs', async t => {
  const root = await app(t), target = await temporary(t);
  await cp(path.join(root, 'factory'), path.join(target, 'factory'), { recursive: true });
  await assert.rejects(planInstall(target, 'claude-only'), /another project path/);
});
test('browser authentication, Origin, Host, CSRF and private routes are enforced', async t => {
  const { request, connection, server } = await running(t);
  assert.equal((await request('/api/state', undefined, { auth: false })).status, 401);
  const hostile = await new Promise((resolve, reject) => {
    const req = http.get(server.origin + '/api/state', { headers: { Host: 'evil.invalid', Authorization: 'Bearer ' + connection.browser_key } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject);
  });
  assert.equal(hostile, 403);
  assert.equal((await request('/api/check', {}, { headers: { Origin: 'http://evil.invalid' } })).status, 403);
  assert.equal((await request('/api/check', {}, { headers: { 'X-Factory-CSRF': 'wrong' } })).status, 403);
  assert.equal((await request('/api/owner/connect', { id: 'test', runtime: 'claude' })).status, 401);
  assert.equal((await request('/factory/.local/connection.json')).status, 404);
  const state = await request('/api/state'); assert.equal(state.status, 200);
  assert.ok(!JSON.stringify(state.data).includes(connection.owner_key)); assert.ok(!JSON.stringify(state.data).includes(connection.browser_key));
});
test('no owner means disabled commands; wrong-runtime registration is rejected', async t => {
  const { request, owner } = await running(t);
  const input = { id: 'request', action: 'request', revision: (await request('/api/state')).data.revision, input: { mode: 'feature', requirements: 'Task list' } };
  assert.match((await request('/api/commands', input)).data.error, /disconnected/);
  assert.equal((await owner('connect', { id: 'session', runtime: 'codex' })).status, 400);
  assert.equal((await owner('connect', { id: 'session', runtime: 'claude' })).status, 200);
  assert.equal((await owner('connect', { id: 'other', runtime: 'claude' })).status, 400);
});
test('live readiness rejects missing/wrong model evidence, verifies continuation, and preserves check history', async t => {
  const { root, request, owner } = await running(t);
  await owner('connect', { id: 'session', runtime: 'claude' });
  const state = (await request('/api/state')).data;
  await request('/api/commands', { id: 'live-check', action: 'check-live', revision: state.revision, input: { consent: true } });
  await owner('next', { owner_id: 'session', wait_ms: 0 });
  const record = checks => owner('checks', { owner_id: 'session', command_id: 'live-check', checks });
  assert.equal((await record([{ id: 'live', label: 'Fixture live checks', status: 'needs-action', detail: 'Synthetic initial failure.' }])).status, 200);
  assert.equal((await record([{ id: 'live', label: 'Fixture live checks', status: 'passed', detail: 'Unproved' }])).status, 400);
  const config = await json(path.join(root, 'factory/config.json'));
  const probes = [...new Set(Object.values(config.models).filter(Boolean))].map(model => ({ model, session: 'private-fixture-session', terminal: 'completed', exit_code: 0, environment: 'synthetic-environment' }));
  assert.equal((await record([{ id: 'live', label: 'Fixture live checks', status: 'passed', detail: 'Synthetic metadata fixture; no actual provider calls.', evidence: { probes } }])).status, 200);
  const continuation = { id: 'continuation', label: 'Fixture builder continuation', status: 'passed', detail: 'Synthetic metadata only.', evidence: { ...probes[0], model: config.models.builder, initial_session: 'different-session' } };
  assert.equal((await record([continuation])).status, 400);
  continuation.evidence.initial_session = continuation.evidence.session;
  assert.equal((await record([continuation])).status, 200);
  await request('/api/check', {});
  const published = (await request('/api/state')).data;
  assert.equal(published.checks.find(c => c.label === 'Fixture live checks').status, 'passed');
  assert.equal(JSON.stringify(published).includes('private-fixture-session'), false);
  assert.equal((await readState(root)).check_history.length, 3);
});
test('live owner polling receives a queued action once; requests remain pending until acknowledged', async t => {
  const { request, owner } = await running(t);
  await owner('connect', { id: 'session', runtime: 'claude' });
  const poll = owner('next', { owner_id: 'session', wait_ms: 2000 });
  // Wait for actual listening evidence, not a guessed delay.
  let state;
  for (let i = 0; i < 40; i++) { state = (await request('/api/state')).data; if (state.owner.listening) break; await new Promise(r => setTimeout(r, 10)); }
  assert.equal(state.owner.listening, true);
  const result = await request('/api/commands', { id: 'request', action: 'request', revision: state.revision, input: { mode: 'feature', requirements: '<script>untrusted request</script>' } });
  assert.equal(result.data.status, 'pending');
  const received = await poll; assert.equal(received.data.command.id, 'request'); assert.equal(received.data.command.status, 'running');
  const second = await owner('next', { owner_id: 'session', wait_ms: 0 }); assert.equal(second.data.command, null);
});
test('restart expires pending actions, marks running actions uncertain, and preserves the owner identity', async t => {
  const root = await app(t), first = await serve(root);
  const connection = await json(path.join(root, 'factory/.local/connection.json'));
  const state = await readState(root); state.owner = { id: 'same-session', runtime: 'claude', connected: true, generation: 'old', expires_at: new Date(Date.now() + 60000).toISOString() };
  state.commands = [{ id: 'pending', status: 'pending' }, { id: 'running', status: 'running' }]; await atomic(path.join(root, 'factory/.local/state.json'), state);
  await first.close(); const second = await serve(root); resources.get(root).push(() => second.close());
  const after = await readState(root); assert.equal(after.owner.id, 'same-session'); assert.equal(after.owner.connected, false);
  assert.deepEqual(after.commands.map(c => c.status), ['expired', 'uncertain']);
  const result = await fetch(second.origin + '/api/state', { headers: { Authorization: 'Bearer ' + connection.browser_key } }); assert.equal(result.status, 401);
});
test('commands reject stale state, wrong stages, id conflicts and extra fields', () => {
  const { state, job } = planning();
  const approve = { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id };
  assert.throws(() => enqueue(state, { ...approve, revision: 0 }), /changed/);
  assert.throws(() => enqueue(state, { ...approve, offer_id: 'wrong' }), /offer/);
  assert.throws(() => enqueue(state, { ...approve, bypass: true }), /fields/);
  enqueue(state, approve); assert.equal(enqueue(state, approve).id, 'approve');
  assert.throws(() => enqueue(state, { ...approve, action: 'cancel' }), /conflict/);
  claim(state); assert.equal(job.status, 'running'); assert.ok(job.plan_receipt);
});
test('changed approval context expires a queued approval instead of dispatching it', () => {
  const { state, job } = planning();
  enqueue(state, { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id });
  job.plan.summary = 'Changed'; assert.equal(claim(state), null); assert.equal(state.commands.at(-1).status, 'expired');
});
test('implementation, merge offers and completion cannot bypass plan/evidence gates', () => {
  const { state, job, command } = planning();
  command.status = 'running';
  assert.throws(() => publish(state, { command_id: command.id, job_id: job.id, status: 'running' }), /approved plan/);
  assert.throws(() => publish(state, { command_id: command.id, job_id: job.id, status: 'merged' }), /consent/);
  command.status = 'completed';
  enqueue(state, { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id }); claim(state);
  assert.throws(() => finish(state, { id: 'approve', status: 'completed' }), /gate or terminal/);
  assert.throws(() => publish(state, { command_id: 'approve', job_id: job.id, status: 'awaiting-merge', commit: 'b'.repeat(40) }), /Five passing/);
});
test('all five reviews, both guides, checks and approver must match the immutable final commit', () => {
  const { state, job } = planning();
  enqueue(state, { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id }); claim(state);
  const commit = 'b'.repeat(40);
  const evidence = { command_id: 'approve', job_id: job.id, status: 'awaiting-merge', commit,
    reviews: ['security', 'ux', 'ui', 'code', 'qa'].map(role => ({ role, verdict: 'PASS', commit, reviewer_id: 'fixture-' + role })),
    documentation: ['developer', 'user'].map(kind => ({ kind, status: 'complete', commit, entry: 'docs/' + kind + '.md' })),
    checks: [{ label: 'Acceptance', status: 'passed', commit }], approver: { verdict: 'APPROVE', commit } };
  publish(state, evidence); assert.equal(mergeReady(job), true);
  job.reviews[0].commit = 'c'.repeat(40); assert.equal(mergeReady(job), false);
  job.reviews[0].commit = commit; job.documentation.pop(); assert.equal(mergeReady(job), false);
});
test('pause/cancel can interrupt a running command without dispatching another builder', () => {
  const { state, job } = planning();
  enqueue(state, { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id }); claim(state);
  enqueue(state, { id: 'pause', action: 'pause', revision: state.revision, job_id: job.id });
  const command = claim(state); assert.equal(command.action, 'pause');
  publish(state, { command_id: 'pause', job_id: job.id, status: 'paused' }); finish(state, { id: 'pause', status: 'completed' });
  assert.equal(job.status, 'paused'); assert.equal(state.commands.find(c => c.id === 'approve').status, 'blocked');
});
test('dashboard serves only the fixed shared assets with no inline executable code', async t => {
  const { server } = await running(t);
  const response = await fetch(server.origin); const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /Setup &amp; connections|Setup & connections/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
  assert.equal((await fetch(server.origin + '/style.css')).status, 200);
});

test('an active v1 job requires explicit migration and never imports old approvals', async t => {
  const root = await app(t), state = await readState(root);
  state.jobs.push({ id: 'old-job', mode: 'feature', requirements: 'Preserve previous work', design: '', status: 'awaiting-merge',
    plan: { summary: 'Old plan', scope: ['Old scope'], acceptance: ['Old check'], permissions: [], budget: 'Old budget', target_branch: 'main', base_commit: 'a'.repeat(40) },
    features: [], checks: [], reviews: [], documentation: [], offer: { id: 'old-offer' }, approved_plan_hash: 'old-approval' });
  await atomic(path.join(root, 'factory/.local/state.json'), state);
  const server = await serve(root); resources.get(root).push(() => server.close());
  const after = await readState(root);
  assert.equal(after.jobs[0].needs_migration, true); assert.equal(after.jobs[0].offer, null);
  after.owner = unitState().owner;
  assert.throws(() => enqueue(after, { id: 'old-merge', action: 'approve-merge', revision: after.revision, job_id: 'old-job', offer_id: 'old-offer' }), /Adopt/);
  enqueue(after, { id: 'adopt', action: 'migrate-workflow', revision: after.revision, job_id: 'old-job' });
  claim(after); const migrated = after.jobs[0];
  assert.equal(migrated.lifecycle, 2); assert.equal(migrated.cursor, 0);
  assert.equal(migrated.previous_workflow.approved_plan_hash, 'old-approval');
  assert.equal(migrated.approved_plan_hash, undefined);
  assert.match(migrated.workspace.branch, /^feature\/preserve-previous-work-/);
});

test('an expired lease and explicit live consent prevent accidental paid dispatch', () => {
  const state = unitState();
  assert.throws(() => enqueue(state, { id: 'live', action: 'check-live', revision: 1, input: { consent: false } }), /consent/);
  state.owner.expires_at = new Date(Date.now() - 100).toISOString();
  assert.throws(() => enqueue(state, { id: 'live', action: 'check-live', revision: 1, input: { consent: true } }), /disconnected/);
});
test('actual target drift blocks a merge even when old evidence and consent still match', async t => {
  const root = await app(t), base = await git(root, ['rev-parse', 'HEAD']);
  await git(root, ['switch', '-c', 'reviewed-feature']); await writeFile(path.join(root, 'feature.txt'), 'Feature');
  await git(root, ['add', 'feature.txt']);
  await git(root, ['-c', 'user.name=Factory Test', '-c', 'user.email=factory@example.invalid', 'commit', '-m', 'Reviewed fixture']);
  const commit = await git(root, ['rev-parse', 'HEAD']); await git(root, ['switch', 'main']);
  const job = { plan: { target_branch: 'main', base_commit: base }, commit };
  await assertMergeBinding(root, job);
  await writeFile(path.join(root, 'unrelated.txt'), 'Target change'); await git(root, ['add', 'unrelated.txt']);
  await git(root, ['-c', 'user.name=Factory Test', '-c', 'user.email=factory@example.invalid', 'commit', '-m', 'Target drift fixture']);
  await assert.rejects(assertMergeBinding(root, job), /Target branch changed/);
  job.target_base_commit = await git(root, ['rev-parse', 'HEAD']);
  await assert.rejects(assertMergeBinding(root, job)); // Fresh target snapshot cannot waive source reconciliation.
});

test('matching counters never replace missing independent reviewers or guide entry pages', () => {
  const { state, job } = planning();
  enqueue(state, { id: 'approve', action: 'approve-plan', revision: state.revision, job_id: job.id, offer_id: job.offer.id }); claim(state);
  const commit = 'b'.repeat(40);
  Object.assign(job, { commit, checks: [{ status: 'passed', commit }], approver: { verdict: 'APPROVE', commit },
    documentation: ['developer', 'user'].map(kind => ({ kind, status: 'complete', commit, entry: 'docs/' + kind + '.md' })),
    reviews: ['security', 'ux', 'ui', 'code', 'qa'].map(role => ({ role, verdict: 'PASS', commit, reviewer_id: 'one-writer' })) });
  assert.equal(mergeReady(job), false);
  job.reviews.forEach(r => r.reviewer_id = r.role); assert.equal(mergeReady(job), true);
  job.documentation[0].entry = ''; assert.equal(mergeReady(job), false);
});
