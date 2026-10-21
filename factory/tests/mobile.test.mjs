import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import vm from 'node:vm';
import { mobileRequest, mobileAnalysis, validateMobilePlan, mobileQuality, mobileRuns, inspectFrontend, assertMobileSource } from '../runtime/mobile.mjs';
import { enqueue, claim, publish, finish, publicState } from '../runtime/workflow.mjs';
import { stage, currentUnit } from '../runtime/lifecycle.mjs';
import { git } from '../runtime/checks.mjs';
import { planInstall, install } from '../setup.mjs';
import { json } from '../runtime/storage.mjs';
import { serve } from '../runtime/server.mjs';
const SHA = 'a'.repeat(40), MOBILE_SHA = 'b'.repeat(40);
const request = () => ({ source_repo: 'https://example.com/team/frontend.git', platforms: ['android', 'ios'], strategy: 'assess', api_base_url: 'https://api.example.com/' });
const analysis = () => ({ source_commit: SHA, framework: 'React', screens: ['/login'], api_modules: ['src/api.ts'], auth: 'OAuth PKCE; native redirect needs verification', risks: ['Browser-only components need native alternatives'], recommendation: 'expo-native' });
const mobilePlan = () => ({ source_commit: SHA, strategy: 'expo-native', api_base_url: 'https://api.example.com/', backend_changes: false, screens: [{ web: '/login', mobile: 'SignIn', acceptance: 'User can sign in' }], api_contracts: [{ method: 'POST', path: '/auth/login', check: 'API parity' }], auth: 'PKCE', storage: 'Secure platform storage', offline: 'Show retry state', device_checks: [{ platform: 'android', check: 'Android sign-in' }, { platform: 'ios', check: 'iOS sign-in' }], blockers: [] });
const state = () => ({ revision: 0, jobs: [], commands: [], activity: [], checks: [], owner: { id: 'owner', generation: 'one', connected: true, expires_at: new Date(Date.now() + 90000).toISOString() } });
function send(s, action, job, input) { enqueue(s, { id: 'cmd' + s.commands.length, revision: s.revision, action, ...(job ? { job_id: job.id, ...(['approve-stage', 'start-feature'].includes(action) ? { offer_id: job.offer.id } : {}) } : {}), ...(input ? { input } : {}) }); return claim(s); }
const deliverable = { summary: 'Synthetic mobile fixture', content: 'Test evidence only, no live conversion.' };
function offer(s, c, job, extra = {}) { publish(s, { command_id: c.id, job_id: job.id, status: 'awaiting-stage', deliverable, ...extra }); finish(s, { id: c.id, status: 'completed' }); }
const closers = new Map();
async function temp(t) { const root = await mkdtemp(path.join(tmpdir(), 'factory-mobile-test-')); closers.set(root, []); t.after(async () => { for (const close of closers.get(root)) await close(); closers.delete(root); assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('factory-mobile-test-')); await rm(root, { recursive: true, force: true }); }); return root; }

test('mobile request rejects credential URLs, unsupported platforms, relative and network paths', () => {
  assert.deepEqual(mobileRequest(request()), request());
  for (const patch of [{ source_repo: 'https://user:secret@example.com/a' }, { source_repo: '../frontend' }, { source_repo: '\\\\server\\share' }, { platforms: [] }, { platforms: ['android', 'android'] }, { platforms: ['windows'] }, { strategy: 'magic' }, { api_base_url: 'https://api.example.com/?token=secret' }, { api_base_url: 'https://user:pass@api.example.com/' }, { api_base_url: 'http://production.example.com/' }]) assert.throws(() => mobileRequest({ ...request(), ...patch }));
  assert.equal(mobileRequest({ ...request(), api_base_url: 'http://127.0.0.1:3000/' }).platforms.length, 2);
});
test('mobile plans pin source, preserve backend, map every product screen and require platform checks', () => {
  const job = { purpose: 'web-to-mobile', mobile: request(), mobile_analysis: analysis(), phase: 'product' };
  validateMobilePlan(mobilePlan(), job, ['User can sign in']);
  for (const patch of [{ source_commit: MOBILE_SHA }, { backend_changes: true }, { api_base_url: '' }, { api_base_url: 'https://other-backend.example.com/' }, { blockers: ['Missing native auth API'] }, { device_checks: [{ platform: 'android', check: 'Android sign-in' }] }, { screens: [{ web: '/other', mobile: 'Other', acceptance: 'User can sign in' }] }, { api_contracts: [{ method: 'GET', path: '/api?key=secret', check: 'bad' }] }]) assert.throws(() => validateMobilePlan({ ...mobilePlan(), ...patch }, job, ['User can sign in']));
  assert.throws(() => validateMobilePlan(mobilePlan(), { ...job, mobile: { ...request(), strategy: 'capacitor' } }, ['User can sign in']), /requested strategy/);
  assert.throws(() => mobileAnalysis({ ...analysis(), source_commit: 'HEAD' }));
});
test('feature plans inherit approved source and mobile strategy', () => {
  const job = { purpose: 'web-to-mobile', mobile: request(), mobile_analysis: analysis(), phase: 'feature', mode: 'product', plan: { mobile: mobilePlan() } };
  assert.throws(() => validateMobilePlan({ ...mobilePlan(), strategy: 'capacitor' }, job, ['User can sign in']), /approved mobile product/);
});
test('mobile QA rejects browser-only, missing platform runs, stale commits and API parity gaps', () => {
  const job = { purpose: 'web-to-mobile', mobile: request() }, unit = { commit: MOBILE_SHA, plan: { mobile: mobilePlan() }, checks: ['API parity', 'Android sign-in', 'iOS sign-in'].map(label => ({ label, status: 'passed', commit: MOBILE_SHA })) };
  assert.throws(() => mobileQuality(job, unit), /actual device/);
  const runs = request().platforms.map((platform, i) => ({ platform, check: mobilePlan().device_checks[i].check, runtime: 'emulator', device: 'Synthetic fixture, not a real run', commit: MOBILE_SHA, status: 'passed', detail: 'Synthetic test result' }));
  unit.mobile_runs = mobileRuns(runs, job); mobileQuality(job, unit);
  unit.mobile_runs[0].commit = SHA; assert.throws(() => mobileQuality(job, unit), /actual device/);
  unit.mobile_runs = runs; unit.checks[0].status = 'not-checked'; assert.throws(() => mobileQuality(job, unit), /API parity/);
  assert.throws(() => mobileRuns([{ ...runs[0], runtime: 'browser' }], job), /Device runs/);
});
test('mobile lifecycle stops at feasibility until source analysis; public dashboard gets typed mappings', () => {
  const s = state(); let c = send(s, 'request', null, { purpose: 'web-to-mobile', mobile: request(), mode: 'product', title: 'Mobile customer portal', requirements: 'User can sign in', target_branch: 'main' }); const job = s.jobs[0];
  assert.throws(() => offer(s, c, job), /Analyse the pinned/);
  offer(s, c, job, { mobile_analysis: analysis() }); c = send(s, 'approve-stage', job); assert.equal(stage(job), 'requirements'); offer(s, c, job);
  c = send(s, 'approve-stage', job); Object.assign(job.workspace, { prepared: true, base_commit: MOBILE_SHA });
  const plan = { summary: 'Mobile plan', scope: ['Sign-in'], acceptance: ['User can sign in'], permissions: ['Only mobile repo source and tests'], budget: 0, target_branch: 'main', base_commit: MOBILE_SHA, documentation: ['developer', 'user'], features: [{ id: 'login', title: 'Sign-in', depends_on: [], acceptance: ['User can sign in'] }], mobile: mobilePlan() };
  assert.throws(() => offer(s, c, job, { plan: { ...plan, mobile: undefined } }), /mobile fields/);
  offer(s, c, job, { plan }); c = send(s, 'approve-stage', job); offer(s, c, job); c = send(s, 'approve-stage', job);
  assert.equal(job.status, 'ready-feature'); finish(s, { id: c.id, status: 'completed' }); c = send(s, 'start-feature', job);
  assert.match(currentUnit(job).workspace.branch, /^feature\/001-sign-in-/); assert.equal(stage(job), 'requirements');
  assert.throws(() => publish(s, { command_id: c.id, job_id: job.id, status: 'planning', mobile_analysis: { ...analysis(), source_commit: MOBILE_SHA } }), /feasibility/);
  const view = publicState(s, { project_name: 'Fixture', models: {}, integrations: {}, edition: 'claude-only' });
  assert.equal(view.jobs[0].mobile_analysis.source_commit, SHA); assert.deepEqual(view.jobs[0].plan.mobile.screens, mobilePlan().screens);
});
test('ordinary software requests do not acquire mobile gates and reject accidental mobile settings', () => {
  const s = state(); assert.throws(() => send(s, 'request', null, { mode: 'feature', requirements: 'Fixture', mobile: request() }), /web-to-mobile request/);
  const c = send(s, 'request', null, { mode: 'feature', requirements: 'Fixture' }); offer(s, c, s.jobs[0]); assert.equal(s.jobs[0].purpose, 'software');
});
test('frontend inspection reads committed candidates without scripts, working-tree changes or secret values', async t => {
  const parent = await temp(t), source = path.join(parent, 'frontend'), target = path.join(parent, 'mobile'); await mkdir(source); await mkdir(target); await mkdir(path.join(source, 'pages'));
  await git(source, ['init', '-b', 'main']);
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ dependencies: { react: 'fixture-version' }, scripts: { install: 'SHOULD NEVER EXECUTE' } }));
  await writeFile(path.join(source, 'pages/login.tsx'), 'fetch("https://example.invalid/?token=SECRET_VALUE");');
  await writeFile(path.join(source, '.env'), 'API_KEY=SECRET_VALUE');
  await git(source, ['add', '.']); await git(source, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic frontend']);
  await writeFile(path.join(source, 'pages/uncommitted.tsx'), 'Never inspected'); const before = await git(source, ['status', '--porcelain']);
  const result = await inspectFrontend(source, target);
  assert.deepEqual(result.framework_candidates, ['react']); assert.deepEqual(result.screen_candidates, ['pages/login.tsx']); assert.deepEqual(result.api_module_candidates, ['pages/login.tsx']); assert.doesNotMatch(JSON.stringify(result), /SECRET_VALUE|SHOULD NEVER|uncommitted/);
  assert.equal(await git(source, ['status', '--porcelain']), before); assert.equal(await readFile(path.join(source, '.env'), 'utf8'), 'API_KEY=SECRET_VALUE');
  await assert.rejects(inspectFrontend(source, source), /separate/); await assert.rejects(inspectFrontend(source, path.join(source, 'pages')), /separate/);
  await assert.rejects(assertMobileSource(source, { ...request(), source_repo: source }), /separate/);
});
test('dedicated mobile installs preserve provider isolation and purpose across upgrades', async t => {
  const root = await temp(t); await install(await planInstall(root, 'claude-only', undefined, { purpose: 'web-to-mobile' }));
  let config = await json(path.join(root, 'factory/config.json')); assert.equal(config.purpose, 'web-to-mobile'); assert.ok(Object.values(config.roles).every(r => r === 'claude'));
  await install(await planInstall(root, 'claude-only')); config = await json(path.join(root, 'factory/config.json')); assert.equal(config.purpose, 'web-to-mobile');
  await assert.rejects(planInstall(root, 'claude-only', undefined, { purpose: 'invalid' }), /factory purpose/);
});
test('HTTP mobile request refuses using the application workspace as reference source', async t => {
  const root = await temp(t); await install(await planInstall(root, 'claude-only')); const server = await serve(root); closers.get(root).push(() => server.close()); const conn = await json(path.join(root, 'factory/.local/connection.json'));
  const post = async (route, data, owner = false) => { const response = await fetch(server.origin + route, { method: 'POST', headers: { Authorization: 'Bearer ' + (owner ? conn.owner_key : conn.browser_key), 'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': conn.browser_key }, body: JSON.stringify(data) }); return { status: response.status, data: await response.json() }; };
  await post('/api/owner/connect', { id: 'fixture-owner', runtime: 'claude' }, true);
  const res = await fetch(server.origin + '/api/state', { headers: { Authorization: 'Bearer ' + conn.browser_key } }); const view = await res.json();
  const result = await post('/api/commands', { id: 'mobile', action: 'request', revision: view.revision, input: { mode: 'product', purpose: 'web-to-mobile', mobile: { ...request(), source_repo: root }, requirements: 'Fixture' } });
  assert.equal(result.status, 400); assert.match(result.data.error, /separate/);
});

test('dashboard mobile view and request controls render with synthetic DOM, including device results', async () => {
  class Element {
    constructor() { this.value = ''; this.children = []; this.dataset = {}; this.classList = { toggle() {} }; this.listeners = {}; }
    append(...items) { this.children.push(...items); } replaceChildren(...items) { this.children = items; } setAttribute() {} addEventListener(event, fn) { this.listeners[event] = fn; } querySelectorAll() { return []; } showModal() { this.open = true; } close() { this.open = false; }
  }
  const elements = new Map(), get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const context = vm.createContext({ document: { getElementById: get, createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => new Element() }, location: { hash: '', pathname: '/' }, sessionStorage: { getItem: () => '', setItem() {} }, history: { replaceState() {} }, window: { addEventListener() {} }, setTimeout() {}, clearTimeout() {}, setInterval() {}, fetch: async () => { throw new Error('Synthetic offline DOM'); }, console });
  const code = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8'); vm.runInContext(code, context);
  const s = state(), c = send(s, 'request', null, { mode: 'product', purpose: 'web-to-mobile', mobile: request(), requirements: 'Fixture' });
  const j = s.jobs[0]; j.mobile_analysis = analysis(); j.plan = { summary: 'Synthetic', scope: ['Fixture'], acceptance: ['User can sign in'], permissions: ['Fixture'], budget: 0, base_commit: SHA, target_branch: 'main', mobile: mobilePlan() }; j.mobile_runs = [{ platform: 'android', device: 'Synthetic device', runtime: 'emulator', check: 'Android sign-in', status: 'not-checked', commit: MOBILE_SHA }];
  context.fixture = { ...publicState(s, { models: {}, integrations: {}, project_name: 'Fixture', edition: 'claude-only', purpose: 'web-to-mobile', version: 'test' }), workspace: {} };
  vm.runInContext("state=fixture; page='mobile'; render();", context); assert.ok(get('main').children.length > 5); assert.equal(get('factory-purpose').value, 'web-to-mobile'); assert.equal(get('source-repo').required, true);
  vm.runInContext("state.jobs=[];render();", context); assert.ok(get('main').children.length > 1);
  get('factory-purpose').value = 'software'; vm.runInContext('mobileFields()', context); assert.equal(get('source-repo').required, false);
});
