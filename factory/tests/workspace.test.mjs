import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { git } from '../runtime/checks.mjs';
import { planInstall, install } from '../setup.mjs';
import { json, readState, atomic } from '../runtime/storage.mjs';
import { serve } from '../runtime/server.mjs';
import { repositorySettings, bindWorkspace, snapshotId, workspaceWord } from '../runtime/workspace.mjs';
import { wordFixture, reviewFixture } from './word-fixture.mjs';
import vm from 'node:vm';

const deliverable = { summary: 'Offline workspace fixture', content: 'Synthetic local fixture only. No live providers or application acceptance evidence.' };
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-repositories-')); let server;
  t.after(async () => {
    if (server) await server.close();
    assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('factory-repositories-'));
    await rm(root, { recursive: true, force: true });
  });
  const commit = async (repo, files) => {
    await git(path.join(root, repo), ['add', '--', ...files]);
    await git(path.join(root, repo), ['-c', 'user.name=Workspace Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Offline fixture']);
    return git(path.join(root, repo), ['rev-parse', 'HEAD']);
  };
  for (const name of ['frontend', 'backend']) {
    await mkdir(path.join(root, name)); await git(path.join(root, name), ['init', '-b', 'dev']);
    await writeFile(path.join(root, name, 'app.txt'), 'Baseline\n'); await commit(name, ['app.txt']);
  }
  await writeFile(path.join(root, 'unrelated.txt'), 'Preserve coordinating-folder edits');
  const workspace = { policy: 'current-branches', repositories: ['frontend', 'backend'].map(p => ({ path: p, branch: 'dev' })) };
  await install(await planInstall(root, 'codex-claude', undefined, { workspace }));
  const config = await json(path.join(root, 'factory/config.json'));
  const repeatChanges = (await planInstall(root, 'codex-claude')).changes.length;
  server = await serve(root); const conn = await json(path.join(root, 'factory/.local/connection.json'));
  const call = async (route, data, owner = false) => {
    const r = await fetch(server.origin + '/api/' + (owner ? 'owner/' : '') + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + (owner ? conn.owner_key : conn.browser_key),
        ...(data === undefined ? {} : { Origin: server.origin, 'X-Factory-CSRF': conn.browser_key, 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };
  const ok = async (...args) => { const r = await call(...args); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
  await ok('connect', { id: 'fixture-owner', runtime: 'codex' }, true);
  let command;
  const view = () => ok('state'), job = async () => (await view()).jobs.at(-1);
  const action = async (action, input) => {
    const s = await view(), j = s.jobs.at(-1);
    await ok('commands', { id: 'cmd-' + s.revision, revision: s.revision, action,
      ...(action === 'request' ? {} : { job_id: j.id }),
      ...(input ? { input } : {}),
      ...(['approve-stage', 'approve-merge', 'start-feature', 'start-acceptance'].includes(action) ? { offer_id: j.offer?.id } : {}) });
    command = (await ok('next', { owner_id: 'fixture-owner', wait_ms: 0 }, true)).command; assert.ok(command);
  };
  const operation = (operation, extra = {}) => ok('workspace', { owner_id: 'fixture-owner', command_id: command.id, job_id: command.job_id, operation, ...extra }, true);
  const done = () => ok('finish', { owner_id: 'fixture-owner', result: { id: command.id, status: 'completed' } }, true);
  const publish = async (extra = {}) => {
    const j = await job();
    if (extra.reviews) for (const role of ['security', 'ux', 'ui', 'code', 'qa', 'approver']) {
      await ok('worker', { owner_id: 'fixture-owner', command_id: command.id, job_id: j.id, id: role + '-' + command.id,
        role, model: config.models[role], session: extra.reviews.find(r => r.role === role)?.reviewer_id || 'approver-' + command.id,
        task: 'Offline synthetic fixture, zero provider calls', status: 'completed', commit: extra.commit }, true);
    }
    await ok('publish', { owner_id: 'fixture-owner', update: { command_id: command.id, job_id: j.id, status: 'awaiting-stage', deliverable, ...extra } }, true);
    await done();
  };
  const plan = async (features) => {
    const w = (await job()).workspace;
    return { summary: 'Offline cross-repository plan', scope: ['Frontend and backend'], acceptance: ['Journey works'], permissions: ['Fixture files only'],
      budget: 0, target_branch: w.target, base_commit: w.base_commit, repositories: w.repositories, documentation: ['developer', 'user'], ...(features ? { features } : {}) };
  };
  const evidence = (id, suffix) => ({
    commit: id, checks: [{ label: 'Journey', detail: 'Actually read local fixture files', status: 'passed', commit: id }],
    reviews: ['security', 'ux', 'ui', 'code', 'qa'].map(role => ({ role, verdict: 'PASS', commit: id, reviewer_id: suffix + '-' + role, summary: 'Synthetic fixture verdict only' })),
    documentation: ['developer', 'user'].map(kind => ({ kind, status: 'complete', commit: id, format: 'docx', entry: 'frontend/docs/' + kind + '.docx', verification: reviewFixture(wordFixture(kind)) })),
    approver: { verdict: 'APPROVE', commit: id }, deliverable: { ...deliverable, coverage: [{ requirement: 'Journey works', check: 'Journey' }] }
  });
  const integrate = async id => {
    await action('approve-merge'); const accepted = await operation('merge'); assert.equal(accepted.git_merge, false);
    await operation('verify-integration', { checks: [{ label: 'Integrated journey', status: 'passed', kind: 'integration', commit: id, detail: 'Read fixture results on existing dev branches' }] });
    await done();
  };
  const build = async name => {
    await mkdir(path.join(root, 'frontend/docs'), { recursive: true });
    for (const kind of ['developer', 'user']) await writeFile(path.join(root, 'frontend/docs/' + kind + '.docx'), wordFixture(kind));
    for (const repo of ['frontend', 'backend']) {
      await writeFile(path.join(root, repo, name + '.txt'), 'Journey works\n'); await commit(repo, [name + '.txt', ...(repo === 'frontend' ? ['docs'] : [])]);
    }
    const snap = await operation('snapshot'), id = snap.snapshot_id;
    assert.equal(id, snapshotId(snap.repositories));
    assert.match((await ok('workspace/diff?job=' + (await job()).id)).diff, /Journey works/);
    const docs = evidence(id, name).documentation;
    await publish({ commit: id, documentation: docs, preview: 'http://127.0.0.1:3000/', preview_commit: id, preview_source: { repository: 'frontend', commit: snap.repositories.find(r => r.path === 'frontend').commit } });
    const downloaded = await call('documents?job=' + (await job()).id + '&kind=developer');
    assert.deepEqual(downloaded.data, wordFixture('developer'));
    await action('approve-stage'); await publish(evidence(id, name));
    await action('approve-stage'); await publish(); await integrate(id);
    return id;
  };
  return { root, config, workspace, repeatChanges, call, ok, view, job, action, operation, done, publish, plan, evidence, integrate, build, commit,
    command: () => command };
}

test('existing-branch configuration preserves editions and rejects paths outside its nonoverlapping allowlist', async t => {
  const f = await fixture(t);
  assert.equal(f.repeatChanges, 0);
  for (const value of ['../outside', 'frontend/../backend', '.git', 'factory', 'frontend/.git']) {
    await assert.rejects(repositorySettings(f.root, { ...f.workspace, repositories: [{ path: value, branch: 'dev' }] }));
  }
  await assert.rejects(repositorySettings(f.root, { ...f.workspace, repositories: [f.workspace.repositories[0], f.workspace.repositories[0]] }), /duplicate/);
  for (const repositories of [[], ['../outside'], ['frontend', 'frontend'], ['unknown']]) {
    await assert.rejects(bindWorkspace(f.root, f.config, { repositories, target_branch: 'current-branches' }), /Select/);
  }
  await assert.rejects(bindWorkspace(f.root, f.config, { repositories: ['frontend'], target_branch: 'dev' }), /existing/);
  const link = path.join(f.root, 'linked');
  await symlink(path.join(f.root, 'frontend'), link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(repositorySettings(f.root, { ...f.workspace, repositories: [{ path: 'linked', branch: 'dev' }] }), /symbolic|junction/);
  assert.equal((await f.view()).workspace.repositories.length, 2);
  assert.equal(await readFile(path.join(f.root, 'unrelated.txt'), 'utf8'), 'Preserve coordinating-folder edits');
});

test('one request freezes both actual repo commits and completes every human gate without new branches or Git merges', async t => {
  const f = await fixture(t);
  await f.action('request', { mode: 'feature', title: 'Cross repo feature', requirements: 'Journey works', target_branch: 'current-branches', repositories: ['frontend', 'backend'] });
  await f.operation('prepare');
  for (const s of ['feasibility', 'requirements', 'specification', 'design']) {
    assert.equal((await f.job()).stage, s); await f.publish(s === 'specification' ? { plan: await f.plan() } : {}); await f.action('approve-stage');
  }
  const id = await f.build('first');
  assert.equal((await f.job()).status, 'merged'); assert.equal((await f.job()).commit, id);
  for (const repo of ['frontend', 'backend']) assert.equal(await git(path.join(f.root, repo), ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']), 'dev');
  const saved = (await readState(f.root)).jobs[0], u = saved.workspace;
  await assert.rejects(workspaceWord(f.root, { ...saved.documentation[0], entry: 'backend/../unrelated.docx' }, saved));
  assert.equal(u.reviewed.length, 2);
});

test('two product features reuse existing branches, wait between features and require fresh aggregate acceptance', async t => {
  const f = await fixture(t), features = ['first', 'second'].map((id, i) => ({ id, title: id, depends_on: i ? ['first'] : [], acceptance: ['Journey works'] }));
  await f.action('request', { mode: 'product', title: 'Cross repo product', requirements: 'Journey works', target_branch: 'current-branches', repositories: ['frontend', 'backend'] });
  await f.operation('prepare');
  for (const s of ['feasibility', 'requirements', 'specification', 'design']) {
    await f.publish(s === 'specification' ? { plan: await f.plan(features) } : {}); await f.action('approve-stage');
  }
  await f.done(); assert.equal((await f.job()).status, 'ready-feature');
  for (const name of ['first', 'second']) {
    await f.action('start-feature'); await f.operation('prepare');
    for (const s of ['requirements', 'specification', 'design']) {
      await f.publish(s === 'specification' ? { plan: await f.plan() } : {}); await f.action('approve-stage');
    }
    await f.build(name); assert.equal((await f.job()).status, name === 'first' ? 'ready-feature' : 'ready-acceptance');
  }
  await f.action('start-acceptance'); await f.operation('select-product');
  const { snapshot_id: id } = await f.operation('snapshot'); await f.publish(f.evidence(id, 'fresh-product'));
  await f.action('approve-stage'); await f.publish(); await f.integrate(id);
  assert.equal((await f.job()).status, 'merged');
  for (const repo of ['frontend', 'backend']) assert.equal(await git(path.join(f.root, repo), ['branch', '--show-current']), 'dev');
});

test('selected dirty repos block preparation; unrelated dirty repos do not; branch and frozen-commit drift reject approval', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'backend/keep.txt'), 'Do not touch');
  await f.action('request', { mode: 'feature', title: 'Frontend only', requirements: 'Journey works', target_branch: 'current-branches', repositories: ['frontend'] });
  await f.operation('prepare');
  for (const s of ['feasibility', 'requirements', 'specification', 'design']) {
    await f.publish(s === 'specification' ? { plan: await f.plan() } : {}); await f.action('approve-stage');
  }
  await writeFile(path.join(f.root, 'frontend/dirty.txt'), 'Preserve this edit');
  let r = await f.call('workspace', { owner_id: 'fixture-owner', command_id: f.command().id, job_id: f.command().job_id, operation: 'snapshot' }, true);
  assert.equal(r.status, 400); assert.equal(await readFile(path.join(f.root, 'frontend/dirty.txt'), 'utf8'), 'Preserve this edit');
  await f.commit('frontend', ['dirty.txt']);
  await mkdir(path.join(f.root, 'frontend/docs'));
  for (const kind of ['developer', 'user']) await writeFile(path.join(f.root, 'frontend/docs/' + kind + '.docx'), wordFixture(kind));
  await f.commit('frontend', ['docs']);
  const { snapshot_id: id } = await f.operation('snapshot'); await f.publish({ commit: id, documentation: f.evidence(id, 'drift').documentation });
  const before = await f.view(), j = before.jobs[0];
  await writeFile(path.join(f.root, 'frontend/drift.txt'), 'Later commit'); await f.commit('frontend', ['drift.txt']);
  r = await f.call('commands', { id: 'stale', revision: before.revision, action: 'approve-stage', job_id: j.id, offer_id: j.offer.id });
  assert.equal(r.status, 400); assert.match(r.data.error, /snapshot|changed/);
  assert.equal(await readFile(path.join(f.root, 'backend/keep.txt'), 'utf8'), 'Do not touch');
  await git(path.join(f.root, 'frontend'), ['switch', '-c', 'fixture-drift']);
  r = await f.call('workspace', { owner_id: 'fixture-owner', command_id: f.command().id, job_id: f.command().job_id, operation: 'prepare' }, true);
  assert.equal(r.status, 400);
});

test('shared dashboard renders repository choices and integration approval without claiming a Git merge', async () => {
  class Element {
    constructor() { this.value = ''; this.children = []; this.dataset = {}; this.classList = { toggle() {} }; this.listeners = {}; }
    append(...x) { this.children.push(...x); } replaceChildren(...x) { this.children = x; }
    setAttribute() {} addEventListener(event, fn) { this.listeners[event] = fn; } querySelectorAll() { return []; }
    showModal() { this.open = true; } close() { this.open = false; }
  }
  const elements = new Map(), get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const context = vm.createContext({ Node: Element, document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => new Element() },
    location: { hash: '', pathname: '/' }, sessionStorage: { getItem: () => '', setItem() {} }, history: { replaceState() {} }, window: { addEventListener() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, fetch: async () => { throw new Error('Offline synthetic DOM'); }, console });
  vm.runInContext(await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8'), context);
  context.fixture = { project: 'Fixture', edition: 'codex-claude', version: 'test', owner: { connected: false }, integrations: [], jobs: [], commands: [], activity: [],
    workspace_settings: { policy: 'current-branches', repositories: [{ path: 'frontend', branch: 'dev' }, { path: 'backend', branch: 'dev' }] },
    workspace: { root: 'Fixture', policy: 'current-branches', repositories: [], changes: [] }, checks: [], performance: {} };
  vm.runInContext("state=fixture;page='workspace';render()", context);
  assert.equal(get('repository-options').children.length, 2);
  assert.equal(get('target-branch').hidden, true);
  assert.match(get('request-scope-note').textContent, /No new branches/);
  context.current = { id: 'fixture', workspace: { policy: 'current-branches', reviewed: [{ path: 'frontend', branch: 'dev', commit: 'a'.repeat(40) }] }, commit: 'b'.repeat(64), offer: { id: 'offer' } };
  vm.runInContext("openAction('approve-merge', current)", context);
  assert.equal(get('action-submit').textContent, 'Approve integration');
  assert.match([...get('action-details').children].map(c => c.textContent).join(' '), /no Git merge/);
});

test('explicit launcher migration previews an exact private archive and rejects post-preview edits without partial installation', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-launcher-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('factory-launcher-')); await rm(root, { recursive: true, force: true }); });
  const relative = '.claude/skills/factory/SKILL.md', file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'Legacy launcher\n');
  await assert.rejects(planInstall(root, 'codex-claude'), /File conflict/);
  const preview = await planInstall(root, 'codex-claude', undefined, { migrateLauncher: true });
  const archive = preview.changes.find(c => c.path.startsWith('factory/.local/migration/'));
  assert.equal(archive.content, 'Legacy launcher\n');
  assert.ok(preview.changes.some(c => c.path === relative && c.before_hash));
  await writeFile(file, 'Keep newer user edit\n');
  await assert.rejects(install(preview), /changed since/);
  const approved = await planInstall(root, 'codex-claude', undefined, { migrateLauncher: true });
  await install(approved);
  const saved = approved.changes.find(c => c.path.startsWith('factory/.local/migration/'));
  assert.equal(await readFile(path.join(root, saved.path), 'utf8'), 'Keep newer user edit\n');
  assert.match(await readFile(file, 'utf8'), /Forward this request to the registered Codex/);
  assert.equal((await planInstall(root, 'codex-claude')).changes.length, 0);
  await mkdir(path.join(root, 'app')); await git(path.join(root, 'app'), ['init', '-b', 'dev']);
  const state = await readState(root); state.jobs.push({ id: 'existing', status: 'planning' });
  await atomic(path.join(root, 'factory/.local/state.json'), state);
  await assert.rejects(planInstall(root, 'codex-claude', undefined, { workspace: { policy: 'current-branches', repositories: [{ path: 'app', branch: 'dev' }] } }), /active history/);
  assert.equal((await json(path.join(root, 'factory/config.json'))).workspace, undefined);
});
