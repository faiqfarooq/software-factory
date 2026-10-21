import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { integrationDefaults, integrationSettings, integrationScopes, roleContext, prerequisites, reserveRun, executeIntegration, integrationView, performance } from '../runtime/integrations.mjs';
import { profile, models, VERSION } from '../runtime/profiles.mjs';
import { digest, atomic, json, exists } from '../runtime/storage.mjs';
import { git } from '../runtime/checks.mjs';
import { planInstall, install } from '../setup.mjs';
import { serve } from '../runtime/server.mjs';
import { enqueue } from '../runtime/workflow.mjs';

async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-integrations-'));
  const cleanup = [];
  t.after(async () => {
    for (const close of cleanup.reverse()) await close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('factory-integrations-'));
    await rm(root, { recursive: true, force: true });
  });
  return { root, cleanup };
}
function config() {
  return { schema_version: 1, version: VERSION, project_name: 'Fixture', edition: 'claude-only',
    roles: profile('claude-only').roles, models: models('claude-only'), integrations: integrationDefaults() };
}
function scoped(tool = 'context7', operations = ['docs']) {
  const settings = config(); settings.integrations[tool].enabled = true;
  const plan = { integrations: [{ tool, operations, max_calls: 3 }] };
  const state = { revision: 1, checks: [], activity: [], owner: { id: 'same-owner', generation: 'one', connected: true, expires_at: new Date(Date.now() + 60000).toISOString() },
    commands: [{ id: 'work', action: 'approve-plan', status: 'running', owner_id: 'same-owner', owner_generation: 'one', job_id: 'job' }],
    jobs: [{ id: 'job', status: 'running', mode: 'feature', plan, approved_plan_hash: digest(JSON.stringify(plan)), commit: 'a'.repeat(40) }] };
  const request = { id: 'tool1', command_id: 'work', job_id: 'job', tool, operation: operations[0], role: tool === 'strix' ? 'security' : 'builder', parameters: {} };
  return { settings, state, request };
}
async function fakeBinary(root, name) {
  const file = path.join(root, name + (process.platform === 'win32' ? '.exe' : ''));
  await writeFile(file, 'not executed; adapter test fixture', { mode: 0o755 }); return file;
}

test('only bundled skills are enabled by default; secret fields and unknown integrations are rejected', () => {
  const settings = integrationDefaults(); assert.deepEqual(Object.entries(settings).filter(([, v]) => v.enabled).map(([k]) => k), ['skills']);
  assert.throws(() => integrationSettings({ context7: { enabled: true, api_key: 'do-not-save' } }), /fields/);
  assert.throws(() => integrationSettings({ unknown: { enabled: true } }), /fields/);
  assert.throws(() => integrationSettings({ skills: { enabled: false } }), /flag/);
});
test('role contexts expose only assigned skills and enabled capabilities without changing the edition', () => {
  const c = config(); Object.values(c.integrations).forEach(v => v.enabled = true);
  assert.deepEqual(roleContext(c, 'documentation-writer').tools.map(t => t.id), ['context7']);
  assert.deepEqual(roleContext(c, 'security').tools.map(t => t.id), ['graphify', 'strix']);
  assert.deepEqual(roleContext(c, 'ui').tools.map(t => t.id), ['twentyfirst']);
  assert.match(roleContext(c, 'builder').skill, /building\/SKILL.md$/);
  assert.throws(() => roleContext(c, 'new-owner'), /Unknown/);
  assert.ok(Object.values(c.roles).every(v => v === 'claude'));
});
test('three bundled skills use valid minimal frontmatter and matching folder names', async () => {
  for (const name of ['planning', 'building', 'reviewing']) {
    const source = await readFile(new URL('../runtime/skills/' + name + '/SKILL.md', import.meta.url), 'utf8');
    assert.ok(source.startsWith('---\nname: ' + name + '\n'));
    const description = source.match(/\ndescription: ([^\n]+)/)?.[1]; assert.ok(description && description.length <= 1024);
    assert.doesNotMatch(source, /allowed-tools:|TODO|PLACEHOLDER/);
  }
});
test('configuration alone never becomes a verified connection and private bindings are not published', () => {
  const c = config(); c.integrations.context7.enabled = true;
  const state = { integration_checks: { context7: { status: 'available', binding: 'private-binding', detail: 'Key present only.', time: new Date().toISOString() } } };
  let view = integrationView(state, c); assert.equal(view.find(t => t.id === 'context7').status, 'available');
  state.integration_runs = [{ id: 'one', tool: 'context7', status: 'completed', connection_binding: 'private-binding', external_calls: 1, usd: null, finished_at: new Date().toISOString() }];
  view = integrationView(state, c); assert.equal(view.find(t => t.id === 'context7').status, 'verified');
  assert.ok(!JSON.stringify(view).includes('private-binding'));
  state.integration_checks.context7.binding = 'changed-key'; assert.equal(integrationView(state, c).find(t => t.id === 'context7').status, 'available');
});
test('cached documentation cannot renew an expired live connection verification', () => {
  const c = config(); c.integrations.context7.enabled = true;
  const state = { integration_checks: { context7: { status: 'available', binding: 'same' } }, integration_runs: [
    { tool: 'context7', status: 'completed', connection_binding: 'same', finished_at: new Date(Date.now() - 7200000).toISOString(), cache_hit: false },
    { tool: 'context7', status: 'completed', connection_binding: 'same', finished_at: new Date().toISOString(), cache_hit: true }
  ] };
  assert.equal(integrationView(state, c).find(i => i.id === 'context7').status, 'available');
});
test('scope requires bounded supported operations and explicit scanner target, model, budget and turns', () => {
  assert.throws(() => integrationScopes([{ tool: 'twentyfirst', operations: ['publish'], max_calls: 2 }]), /operations/);
  assert.throws(() => integrationScopes([{ tool: 'strix', operations: ['scan'], max_calls: 1 }]), /Strix/);
  const scan = { tool: 'strix', operations: ['scan'], max_calls: 1, targets: ['http://127.0.0.1:3000/'], max_usd: 2, max_turns: 10, model: 'anthropic/fixture' };
  assert.equal(integrationScopes([scan]).length, 1);
  assert.throws(() => integrationScopes([{ ...scan, targets: ['https://user:password@example.com/'] }]), /Strix/);
  assert.throws(() => integrationScopes([{ ...scan, max_usd: 0 }]), /Strix/);
});
test('run receipts enforce role, stage, owner, plan approval, call limits and once-only execution', () => {
  const { settings, state, request } = scoped();
  assert.throws(() => reserveRun(state, settings, { ...request, role: 'qa' }), /role/);
  assert.throws(() => reserveRun(state, settings, { ...request, command_id: 'wrong' }), /command/);
  state.jobs[0].approved_plan_hash = null; assert.throws(() => reserveRun(state, settings, request), /scope/);
  state.jobs[0].approved_plan_hash = digest(JSON.stringify(state.jobs[0].plan));
  const first = reserveRun(state, settings, request); assert.equal(first.duplicate, false);
  assert.equal(reserveRun(state, settings, request).duplicate, true);
  assert.throws(() => reserveRun(state, settings, { ...request, parameters: { changed: true } }), /conflict/);
  assert.throws(() => reserveRun(state, settings, { ...request, id: 'two' }), /outstanding/);
  first.run.status = 'completed'; state.jobs[0].plan.integrations[0].max_calls = 1;
  state.jobs[0].approved_plan_hash = digest(JSON.stringify(state.jobs[0].plan));
  assert.throws(() => reserveRun(state, settings, { ...request, id: 'two' }), /limit/);
});
test('planning documentation lookup is separately consented and does not authorize building', () => {
  const { settings, state, request } = scoped(); state.jobs[0].status = 'planning'; state.jobs[0].approved_plan_hash = null; state.commands[0].action = 'request'; request.role = 'spec-writer';
  assert.throws(() => reserveRun(state, settings, request), /scope/);
  state.jobs[0].planning_docs_consent = true; assert.equal(reserveRun(state, settings, request).run.scope.max_calls, 10);
  assert.equal(state.jobs[0].status, 'planning');
});
test('a tool-settings revision cannot resume code work with the old plan approval', () => {
  const { state } = scoped(); state.commands[0].status = 'completed'; state.jobs[0].status = 'blocked'; state.jobs[0].approved_plan_hash = null;
  assert.throws(() => enqueue(state, { id: 'old-consent', action: 'rework', job_id: 'job', revision: 1, input: { note: 'Continue' } }), /Revise and approve/);
});
test('Context7 requests pin the installed version, cache privately, segregate credentials and never retry failures', async t => {
  const { root } = await temporary(t), c = config(); c.integrations.context7.enabled = true;
  let calls = 0;
  const request = async (input, options) => {
    calls++; const url = new URL(input); assert.equal(url.origin, 'https://context7.com');
    assert.equal(url.searchParams.get('libraryId'), '/vercel/next.js@v16.2.9');
    assert.ok(!url.href.includes('fixture-key')); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ infoSnippets: [{ content: 'Synthetic library documentation.' }] }), { status: 200 });
  };
  const run = { tool: 'context7', operation: 'docs', parameters: { library_id: '/vercel/next.js', version: 'v16.2.9', query: 'How does routing work?' } };
  const deps = { environment: { CONTEXT7_API_KEY: 'fixture-key' }, fetcher: request };
  assert.equal((await executeIntegration(root, c, run, deps)).external_calls, 1);
  assert.equal((await executeIntegration(root, c, run, deps)).cache_hit, true); assert.equal(calls, 1);
  await executeIntegration(root, c, run, { ...deps, environment: { CONTEXT7_API_KEY: 'different-fixture-key' } }); assert.equal(calls, 2);
  let failures = 0;
  await assert.rejects(executeIntegration(root, c, { ...run, parameters: { ...run.parameters, query: 'new query' } }, { ...deps, fetcher: async () => { failures++; return new Response('{}', { status: 429 }); } }), /429/);
  assert.equal(failures, 1);
  await assert.rejects(executeIntegration(root, c, { ...run, parameters: { ...run.parameters, query: 'Malformed terminal fixture' } }, { ...deps, fetcher: async () => new Response('truncated') }), error => error.uncertain === true);
});
test('Graphify snapshots only code locally, reuses current indexes and invalidates them after dirty source changes', async t => {
  const { root } = await temporary(t); await git(root, ['init', '-b', 'main']);
  await writeFile(path.join(root, 'app.js'), 'export const version = 1;\n'); await writeFile(path.join(root, '.env'), 'DO_NOT_COPY=secret');
  await git(root, ['add', 'app.js']); await git(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Fixture']);
  await fakeBinary(root, 'graphify'); const c = config(); c.integrations.graphify.enabled = true; let extractions = 0;
  const execute = async (file, args, options) => {
    assert.equal(options.env.OPENAI_API_KEY, undefined); assert.equal(options.env.ANTHROPIC_API_KEY, undefined);
    if (args[0] === '--version') return { exit_code: 0, stdout: 'Graphify fixture 0.9.62\n' };
    if (args.includes('--help')) return { exit_code: 0, stdout: '--code-only --out --no-cluster' };
    if (args[0] === 'extract') {
      extractions++; assert.ok(args.includes('--code-only')); assert.equal(await exists(path.join(args[1], '.env')), false);
      const out = args[args.indexOf('--out') + 1]; await mkdir(out, { recursive: true }); await atomic(path.join(out, 'graph.json'), { nodes: [], links: [] });
      return { exit_code: 0, stdout: 'Synthetic extraction.' };
    }
    return { exit_code: 0, stdout: 'Synthetic graph context.' };
  };
  const deps = { execute, environment: { PATH: root, OPENAI_API_KEY: 'not-shared', ANTHROPIC_API_KEY: 'not-shared' } }, run = { tool: 'graphify', operation: 'index', parameters: {} };
  await executeIntegration(root, c, run, deps); assert.equal((await executeIntegration(root, c, run, deps)).cache_hit, true); assert.equal(extractions, 1);
  await writeFile(path.join(root, 'app.js'), 'export const version = 2;\n'); await executeIntegration(root, c, run, deps); assert.equal(extractions, 2);
});
test('21st.dev uses negotiated read-only catalog tools and rejects publish or incompatible arguments', async t => {
  const { root } = await temporary(t), c = config(); c.integrations.twentyfirst.enabled = true; const methods = [];
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://21st.dev/api/mcp'); const body = JSON.parse(options.body); methods.push(body.method);
    let result;
    if (body.method === 'initialize') result = { protocolVersion: '2025-03-26' };
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method === 'tools/list') result = { tools: [{ name: 'search', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }] };
    if (body.method === 'tools/call') { assert.equal(body.params.name, 'search'); result = { content: [{ type: 'text', text: 'Synthetic component listing.' }] }; }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { headers: { 'Content-Type': 'application/json' } });
  };
  const deps = { environment: { API_KEY_21ST: 'fixture-key' }, fetcher }, run = { tool: 'twentyfirst', operation: 'catalog', parameters: { tool: 'search', arguments: { query: 'settings form' } } };
  assert.equal((await executeIntegration(root, c, run, deps)).external_calls, 4);
  assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
  await assert.rejects(executeIntegration(root, c, { ...run, parameters: { tool: 'publish', arguments: {} } }, deps), /publish/);
  await assert.rejects(executeIntegration(root, c, { ...run, parameters: { tool: 'search', arguments: { query: 'x', shell: 'install something' } } }, deps), /arguments/);
});
test('21st.dev consumes a matching SSE result without waiting for the provider to close its stream', async t => {
  const { root } = await temporary(t), c = config(); c.integrations.twentyfirst.enabled = true; let cancelled = 0;
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body);
    if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (body.method !== 'initialize') assert.equal(options.headers['MCP-Protocol-Version'], '2025-11-25');
    const result = body.method === 'initialize' ? { protocolVersion: '2025-11-25' } : { tools: [{ name: 'search', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] };
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('event: message\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: body.id, result }) + '\n\n')); }, cancel() { cancelled++; } });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const result = await executeIntegration(root, c, { tool: 'twentyfirst', operation: 'catalog', parameters: { tool: 'discover' } }, { environment: { API_KEY_21ST: 'fixture-key' }, fetcher });
  assert.equal(result.external_calls, 3); assert.equal(result.data.tools[0].name, 'search'); assert.equal(cancelled, 2);
});
test('Strix pins the approved URL/model/budget, isolates state, and never targets a writable source directory', async t => {
  const { root } = await temporary(t); await fakeBinary(root, 'strix'); await fakeBinary(root, 'docker');
  const c = config(); c.integrations.strix.enabled = true;
  let scans = 0;
  const deps = { environment: { PATH: root, LLM_API_KEY: 'fixture-key', STRIX_LLM: 'anthropic/fixture', OPENAI_API_KEY: 'not-shared' },
    execute: async (file, args, options) => {
      if (args.includes('--help')) return { exit_code: 0, stdout: '--max-budget --max-turns --config --non-interactive' };
      scans++; assert.equal(args[args.indexOf('--target') + 1], 'http://127.0.0.1:3000/'); assert.equal(args[args.indexOf('--max-budget') + 1], '2');
      assert.ok(options.cwd.startsWith(path.join(root, 'factory/.local/integrations/strix'))); assert.equal(options.env.USERPROFILE, options.cwd); assert.equal(options.env.OPENAI_API_KEY, undefined);
      return { exit_code: 2, stdout: 'Synthetic finding; not a real scan.' };
    } };
  const run = { id: 'scan-fixture', tool: 'strix', operation: 'scan', parameters: { target: 'http://127.0.0.1:3000/' }, scope: { targets: ['http://127.0.0.1:3000/'], max_usd: 2, max_turns: 10, model: 'anthropic/fixture' } };
  const result = await executeIntegration(root, c, run, deps); assert.equal(result.data.exit_code, 2); assert.match(result.data.note, /not a security PASS/); assert.equal(scans, 1);
  await assert.rejects(executeIntegration(root, c, { ...run, parameters: { target: 'https://unapproved.example/' } }, deps), /allowlist/);
  assert.equal(scans, 1);
  assert.equal((await prerequisites(root, c, { ...deps.environment, STRIX_LLM: 'openai/wrong-edition' })).strix.status, 'needs-action');
});
test('performance reports only observed subtotals and preserves unknown defects/cost', () => {
  const p = performance({ jobs: [{ status: 'merged', usage: { tokens: 100, usd: null, completeness: 'partial' }, created_at: '2026-10-21T00:00:00Z', updated_at: '2026-10-21T00:01:00Z' }], commands: [] });
  assert.equal(p.measured_tokens, 100); assert.equal(p.known_usd, null); assert.equal(p.usage_complete, false); assert.equal(p.defects, null); assert.equal(p.elapsed_ms, 60000);
});

test('dashboard settings are authenticated, persist in the single config, and never perform network/tool installation', async t => {
  const { root, cleanup } = await temporary(t);
  await install(await planInstall(root, 'claude-only'));
  const server = await serve(root); cleanup.push(() => server.close());
  const connection = await json(path.join(root, 'factory/.local/connection.json'));
  const get = async () => (await fetch(server.origin + '/api/state', { headers: { Authorization: 'Bearer ' + connection.browser_key } })).json();
  const state = await get();
  assert.equal(state.integrations.filter(i => i.enabled).length, 1);
  const response = await fetch(server.origin + '/api/integrations/settings', { method: 'POST',
    headers: { Authorization: 'Bearer ' + connection.browser_key, 'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': connection.browser_key },
    body: JSON.stringify({ revision: state.revision, id: 'context7', enabled: true }) });
  assert.equal(response.status, 200); assert.equal((await get()).integrations.find(i => i.id === 'context7').enabled, true);
  assert.equal((await json(path.join(root, 'factory/config.json'))).integrations.context7.enabled, true);
  assert.equal(await exists(path.join(root, '.codex')), false); assert.equal(await exists(path.join(root, '.agents')), false);
  assert.equal((await get()).integrations.find(i => i.id === 'context7').status === 'verified', false);
  assert.equal((await json(path.join(root, 'factory/.local/state.json'))).integration_runs, undefined);
  const raw = await json(path.join(root, 'factory/.local/state.json'));
  const plan = { summary: 'Synthetic paused job', scope: ['Fixture'], acceptance: ['Fixture check'], permissions: [], budget: 'No live providers', target_branch: 'main', base_commit: null };
  raw.jobs.push({ id: 'paused-fixture', status: 'paused', plan, approved_plan_hash: digest(JSON.stringify(plan)), builder_session: 'keep-same-builder',
    requirements: 'Synthetic fixture', features: [], checks: [], reviews: [], documentation: [] });
  await atomic(path.join(root, 'factory/.local/state.json'), raw);
  const changed = await fetch(server.origin + '/api/integrations/settings', { method: 'POST',
    headers: { Authorization: 'Bearer ' + connection.browser_key, 'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': connection.browser_key },
    body: JSON.stringify({ revision: (await get()).revision, id: 'context7', enabled: false }) });
  assert.equal(changed.status, 200);
  const revised = (await get()).jobs[0]; assert.equal(revised.status, 'blocked'); assert.equal(revised.plan_approved, false);
  assert.equal((await json(path.join(root, 'factory/.local/state.json'))).jobs[0].builder_session, 'keep-same-builder');
});

test('the authenticated owner starts tools asynchronously, replays receipts once, and reconciles cancellation before a confirmed stop', async t => {
  const { root, cleanup } = await temporary(t);
  const settings = integrationDefaults(); settings.context7.enabled = true;
  await install(await planInstall(root, 'claude-only', undefined, { integrations: settings }));
  let calls = 0, release, begin;
  let started = new Promise(resolve => begin = resolve);
  const fetcher = async (url, options) => {
    calls++; begin();
    let onAbort;
    await new Promise((resolve, reject) => {
      release = resolve; onAbort = () => reject(new DOMException('Synthetic abort', 'AbortError'));
      if (options.signal.aborted) onAbort(); else options.signal.addEventListener('abort', onAbort, { once: true });
    }).finally(() => options.signal.removeEventListener('abort', onAbort));
    return new Response(JSON.stringify({ infoSnippets: [{ content: 'PRIVATE_FIXTURE_RESULT_DO_NOT_PUBLISH' }] }));
  };
  const server = await serve(root, { integrationDependencies: { environment: { CONTEXT7_API_KEY: 'fixture-provider-key' }, fetcher } });
  cleanup.push(() => server.close());
  const connection = await json(path.join(root, 'factory/.local/connection.json'));
  const call = async (route, payload, owner = false) => {
    const response = await fetch(server.origin + '/api/' + route, { method: 'POST', headers: { Authorization: 'Bearer ' + (owner ? connection.owner_key : connection.browser_key),
      'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': connection.browser_key }, body: JSON.stringify(payload) });
    return { status: response.status, data: await response.json() };
  };
  const state = async () => (await fetch(server.origin + '/api/state', { headers: { Authorization: 'Bearer ' + connection.browser_key } })).json();
  const owner = (op, data) => call('owner/' + op, { owner_id: 'fixture-session', ...data }, true);
  assert.equal((await call('owner/connect', { id: 'fixture-session', runtime: 'claude' }, true)).status, 200);
  await call('commands', { id: 'request', action: 'request', revision: (await state()).revision, input: { mode: 'feature', requirements: 'Synthetic planning fixture.', allow_documentation: true } });
  const primary = (await owner('next', { wait_ms: 0 })).data.command;
  const request = { id: 'async-docs', command_id: primary.id, job_id: primary.job_id, role: 'spec-writer', tool: 'context7', operation: 'docs', parameters: { library_id: '/fixture/library', version: '1.0.0', query: 'Public documentation question' } };
  const first = await owner('tool', { request }); assert.equal(first.status, 202); assert.equal(first.data.status, 'running');
  await started;
  assert.equal((await owner('heartbeat', {})).status, 200);
  const repeated = await owner('tool', { request }); assert.equal(repeated.data.duplicate, true); assert.equal(calls, 1);
  assert.equal((await owner('tool', { request: { ...request, parameters: { ...request.parameters, query: 'changed same id' } } })).status, 400);
  assert.equal((await call('integrations/settings', { id: 'context7', enabled: false, revision: (await state()).revision })).status, 400);
  release();
  let result;
  for (let i = 0; i < 100; i++) { const reply = await owner('tool-result', { id: request.id }); assert.equal(reply.status, 200, JSON.stringify(reply.data)); result = reply.data; if (result.status !== 'running') break; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal(result.status, 'completed'); assert.match(JSON.stringify(result.result), /PRIVATE_FIXTURE_RESULT/);
  assert.doesNotMatch(JSON.stringify(await state()), /PRIVATE_FIXTURE_RESULT|fixture-provider-key/);
  started = new Promise(resolve => begin = resolve);
  const nextRequest = { ...request, id: 'cancel-docs', parameters: { ...request.parameters, query: 'Second public question' } };
  await owner('tool', { request: nextRequest }); await started;
  await call('commands', { id: 'cancel', action: 'cancel', job_id: primary.job_id, revision: (await state()).revision });
  assert.equal((await owner('next', { wait_ms: 0 })).data.command.action, 'cancel');
  assert.equal((await owner('tool-cancel', { id: nextRequest.id })).data.status, 'cancellation-requested');
  for (let i = 0; i < 100; i++) { result = (await owner('tool-result', { id: nextRequest.id })).data; if (result.status !== 'running') break; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal(result.status, 'uncertain');
  const update = { command_id: 'cancel', job_id: primary.job_id, status: 'cancelled' };
  assert.equal((await owner('publish', { update })).status, 400);
  assert.equal((await owner('tool-reconcile', { id: nextRequest.id, note: 'Synthetic fetch aborted. No other process or container was started.' })).status, 200);
  assert.equal((await owner('publish', { update })).status, 200);
  assert.equal((await owner('finish', { result: { id: 'cancel', status: 'completed' } })).status, 200);
});
