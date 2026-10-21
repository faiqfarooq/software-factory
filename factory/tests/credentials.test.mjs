import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { loadCredentials, saveCredentials, updateCredentials, credentialEnvironment, credentialView } from '../runtime/credentials.mjs';
import { planInstall, install } from '../setup.mjs';
import { atomic, json, readState, digest } from '../runtime/storage.mjs';
import { serve } from '../runtime/server.mjs';
import { newLifecycle } from '../runtime/lifecycle.mjs';

const config = { edition: 'claude-only' };
async function temporary(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-keys-')); const cleanup = [];
  t.after(async () => { for (const close of cleanup.reverse()) await close(); assert.equal(path.dirname(root), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith('factory-keys-')); await rm(root, { recursive: true, force: true }); });
  return { root, cleanup };
}
test('credential updates accept only supported keys/models and never echo rejected key material', () => {
  const first = updateCredentials({}, { id: 'context7', action: 'save', api_key: 'fixture-"quoted\'-key-$value' }, config, {});
  assert.equal(first.context7.api_key, 'fixture-"quoted\'-key-$value');
  for (const input of [{ id: 'graphify', action: 'save', api_key: 'fixture' }, { id: 'context7', action: 'save', api_key: 'PRIVATE_KEY\nheader' }, { id: 'context7', action: 'save', api_key: 'fixture', command: 'not-allowed' }, { id: 'strix', action: 'save', api_key: 'fixture', model: 'openai/wrong-edition' }, { id: 'context7', action: 'save', api_key: 'fixture', model: 'anthropic/not-for-context7' }]) {
    assert.throws(() => updateCredentials(first, input, config, {}), error => !error.message.includes('PRIVATE_KEY'));
  }
  assert.deepEqual(updateCredentials(first, { id: 'context7', action: 'remove' }, config, {}), {});
  const scan = updateCredentials({}, { id: 'strix', action: 'save', model: 'anthropic/approved-model' }, config, { LLM_API_KEY: 'environment-key' });
  assert.equal(scan.strix.model, 'anthropic/approved-model'); assert.equal(scan.strix.api_key, undefined);
});
test('secret injection is scoped and public credential metadata contains no key values', () => {
  const values = { context7: { api_key: 'PRIVATE_CONTEXT_KEY' }, twentyfirst: { api_key: 'PRIVATE_UI_KEY' }, strix: { api_key: 'PRIVATE_SCAN_KEY', model: 'anthropic/approved' } };
  const base = { PATH: 'fixture-path', CONTEXT7_API_KEY: 'environment-fallback' };
  const onlyContext = credentialEnvironment(values, base, 'context7');
  assert.equal(onlyContext.CONTEXT7_API_KEY, 'PRIVATE_CONTEXT_KEY'); assert.equal(onlyContext.API_KEY_21ST, undefined); assert.equal(onlyContext.LLM_API_KEY, undefined);
  assert.equal(base.CONTEXT7_API_KEY, 'environment-fallback');
  const visible = credentialView(values, base); assert.equal(visible.context7.source, 'dashboard'); assert.equal(visible.strix.model, 'anthropic/approved');
  assert.doesNotMatch(JSON.stringify(visible), /PRIVATE_CONTEXT_KEY|PRIVATE_UI_KEY|PRIVATE_SCAN_KEY|environment-fallback/);
  assert.equal(credentialView({}, base).context7.source, 'environment');
  assert.equal(credentialView({}, { STRIX_LLM: 'PRIVATE_ACCIDENTAL_VALUE' }).strix.model, '');
});
test('local credential storage round-trips, protects Windows plaintext, and fails closed on corrupted data', async t => {
  const { root } = await temporary(t), secret = 'DUMMY_LOCAL_KEY_"\'_$value';
  assert.deepEqual(await loadCredentials(root), {});
  const values = { context7: { api_key: secret }, strix: { api_key: 'DUMMY_SCAN_KEY', model: 'anthropic/fixture' } };
  await saveCredentials(root, values); assert.deepEqual(await loadCredentials(root), values);
  const file = path.join(root, 'factory/.local/credentials.json'), raw = await readFile(file, 'utf8'), saved = JSON.parse(raw);
  if (process.platform === 'win32') { assert.equal(saved.storage, 'windows-user-encrypted'); assert.ok(!raw.includes(secret)); assert.equal(saved.entries, undefined); }
  else { assert.equal((await stat(file)).mode & 0o777, 0o600); }
  await atomic(file, { schema_version: 1, storage: 'windows-user-encrypted', data: 'invalid-data' });
  await assert.rejects(loadCredentials(root), /cannot be read/);
});
async function running(t, environment = {}, fetcher) {
  const f = await temporary(t); await install(await planInstall(f.root, 'claude-only'));
  let server = await serve(f.root, { integrationDependencies: { environment, ...(fetcher ? { fetcher } : {}) } });
  f.cleanup.push(() => server.close()); let connection = await json(path.join(f.root, 'factory/.local/connection.json'));
  async function call(route, payload, options = {}) {
    const response = await fetch(server.origin + '/api/' + route, { method: payload === undefined ? 'GET' : 'POST',
      headers: { ...(options.auth === false ? {} : { Authorization: 'Bearer ' + (options.owner ? connection.owner_key : connection.browser_key) }),
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json', Origin: server.origin, 'X-Factory-CSRF': connection.browser_key }), ...(options.headers || {}) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { status: response.status, data: await response.json() };
  }
  const state = async () => { const r = await call('state'); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };
  const post = async (route, payload) => call(route, { revision: (await state()).revision, ...payload });
  const restart = async () => { await server.close(); server = await serve(f.root, { integrationDependencies: { environment, ...(fetcher ? { fetcher } : {}) } }); connection = await json(path.join(f.root, 'factory/.local/connection.json')); };
  return { ...f, call, state, post, restart };
}
test('dashboard key fields require browser auth/CSRF, preserve config, invalidate offers and never expose saved keys', async t => {
  const f = await running(t), secret = 'PRIVATE_SAVED_CONTEXT_KEY';
  const originalConfig = await readFile(path.join(f.root, 'factory/config.json'), 'utf8');
  const payload = { id: 'context7', action: 'save', api_key: secret, revision: (await f.state()).revision };
  assert.equal((await f.call('integrations/credentials', payload, { auth: false })).status, 401);
  assert.equal((await f.call('integrations/credentials', payload, { owner: true })).status, 401);
  assert.equal((await f.call('integrations/credentials', payload, { headers: { 'X-Factory-CSRF': 'invalid' } })).status, 403);
  assert.equal((await f.call('integrations/credentials', payload, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await f.call('integrations/credentials', payload)).status, 200);
  let visible = await f.state(); assert.equal(visible.integrations.find(i => i.id === 'context7').credentials.present, true);
  assert.equal(visible.integrations.find(i => i.id === 'context7').enabled, false);
  assert.doesNotMatch(JSON.stringify(visible), /PRIVATE_SAVED_CONTEXT_KEY/);
  assert.doesNotMatch(await readFile(path.join(f.root, 'factory/.local/state.json'), 'utf8'), /PRIVATE_SAVED_CONTEXT_KEY/);
  assert.equal(await readFile(path.join(f.root, 'factory/config.json'), 'utf8'), originalConfig);
  assert.equal((await f.call('integrations/credentials', { ...payload, revision: -1 })).status, 400);
  const raw = await readState(f.root), job = newLifecycle({ input: { mode: 'feature', title: 'Paused key rotation', requirements: 'Keep existing work' } });
  job.status = 'paused'; job.builder_session = 'same-builder'; job.plan = { summary: 'Keep this plan', scope: ['Fixture scope'], acceptance: ['Fixture check'], permissions: [], budget: 'No live providers', target_branch: 'main', base_commit: null, documentation: ['developer', 'user'] }; job.approved_plan_hash = digest(JSON.stringify(job.plan)); job.stages.push({ stage: 'feasibility', content: 'Keep history', approved: true }); raw.jobs.push(job);
  await atomic(path.join(f.root, 'factory/.local/state.json'), raw);
  assert.equal((await f.post('integrations/credentials', { id: 'context7', action: 'save', api_key: 'PRIVATE_REPLACEMENT_KEY' })).status, 200);
  const changed = await readState(f.root); assert.equal(changed.jobs[0].status, 'blocked'); assert.equal(changed.jobs[0].approved_plan_hash, null); assert.equal(changed.jobs[0].builder_session, 'same-builder'); assert.equal(changed.jobs[0].stages[0].content, 'Keep history');
  changed.commands.push({ id: 'busy', status: 'uncertain' }); await atomic(path.join(f.root, 'factory/.local/state.json'), changed);
  assert.equal((await f.post('integrations/credentials', { id: 'context7', action: 'remove' })).status, 400);
  assert.equal((await loadCredentials(f.root)).context7.api_key, 'PRIVATE_REPLACEMENT_KEY');
});
test('saved credentials survive restart and reach only an approved adapter call; removing restores environment fallback', async t => {
  const secret = 'PRIVATE_ADAPTER_KEY', fallback = 'PRIVATE_ENVIRONMENT_FALLBACK'; let calls = 0;
  const f = await running(t, { CONTEXT7_API_KEY: fallback }, async (url, options) => { calls++; assert.equal(options.headers.Authorization, 'Bearer ' + secret); return new Response(JSON.stringify({ documentation: 'Synthetic response, no external service used' })); });
  assert.equal((await f.post('integrations/credentials', { id: 'context7', action: 'save', api_key: secret })).status, 200);
  assert.equal((await f.post('integrations/settings', { id: 'context7', enabled: true })).status, 200); assert.equal(calls, 0);
  await f.restart(); let visible = await f.state(); assert.equal(visible.integrations.find(i => i.id === 'context7').credentials.source, 'dashboard');
  assert.equal(visible.integrations.find(i => i.id === 'context7').status, 'available');
  assert.equal((await f.call('owner/connect', { id: 'owner', runtime: 'claude' }, { owner: true })).status, 200);
  const command = await f.post('commands', { id: 'request', action: 'request', input: { mode: 'feature', requirements: 'Synthetic documentation lookup', allow_documentation: true } }); assert.equal(command.status, 200);
  const next = await f.call('owner/next', { owner_id: 'owner', wait_ms: 0 }, { owner: true }), current = next.data.command;
  const tool = await f.call('owner/tool', { owner_id: 'owner', request: { id: 'lookup', command_id: current.id, job_id: current.job_id, role: 'spec-writer', tool: 'context7', operation: 'docs', parameters: { library_id: '/fixture/library', version: '1.0.0', query: 'Public fixture documentation' } } }, { owner: true });
  assert.equal(tool.status, 202);
  for (let i = 0; i < 100; i++) { const result = await f.call('owner/tool-result', { owner_id: 'owner', id: 'lookup' }, { owner: true }); if (result.data.status === 'completed') break; await new Promise(r => setTimeout(r, 10)); }
  assert.equal(calls, 1); assert.doesNotMatch(JSON.stringify(await f.state()), /PRIVATE_ADAPTER_KEY|PRIVATE_ENVIRONMENT_FALLBACK/);
  await f.call('owner/publish', { owner_id: 'owner', update: { command_id: current.id, job_id: current.job_id, status: 'blocked', message: 'Synthetic fixture finished' } }, { owner: true });
  await f.call('owner/finish', { owner_id: 'owner', result: { id: current.id, status: 'blocked' } }, { owner: true });
  assert.equal((await f.post('integrations/credentials', { id: 'context7', action: 'remove' })).status, 200);
  visible = await f.state(); assert.equal(visible.integrations.find(i => i.id === 'context7').credentials.source, 'environment');
  assert.equal(visible.integrations.find(i => i.id === 'context7').status, 'available');
});
