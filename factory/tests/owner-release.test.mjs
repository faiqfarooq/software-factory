import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { releaseOwner } from '../runtime/workflow.mjs';
import { main } from '../runtime/cli.mjs';
import { serve } from '../runtime/server.mjs';

const now = Date.now();
const fixture = () => ({
  schema_version: 1, revision: 12,
  owner: { id: 'old-session', runtime: 'codex', generation: 'old-generation', connected: false, listening: false,
    expires_at: new Date(now - 60000).toISOString() },
  jobs: [{ id: 'finished-job', lifecycle: 2, status: 'merged', workers: [], decisions: [{ action: 'approved' }], usage: { tokens: 42 } }],
  commands: [{ id: 'finished-command', status: 'completed' }],
  integration_runs: [{ id: 'finished-tool', status: 'completed', usd: 1 }],
  checks: [{ id: 'live', status: 'passed', evidence: { session: 'old-session' } }], activity: []
});
const request = state => ({ requester_id: 'new-session', runtime: 'codex', expected_owner_id: state.owner.id,
  expected_generation: state.owner.generation, revision: state.revision, note: 'Human requested replacing the disconnected owner.' });

test('release preserves completed work/history, archives the owner and invalidates host evidence', () => {
  const state = fixture(), before = structuredClone(state);
  assert.deepEqual(releaseOwner(state, request(state), 'codex', now), { status: 'released' });
  assert.equal(state.owner, null);
  for (const key of ['jobs', 'commands', 'integration_runs']) assert.deepEqual(state[key], before[key]);
  assert.deepEqual(state.owner_history[0].owner, before.owner);
  assert.equal(state.owner_history[0].released_by, 'new-session');
  assert.equal(state.checks[0].status, 'not-checked');
  assert.equal(state.checks[0].evidence, undefined);
  assert.deepEqual(state.check_history[0], before.checks[0]);
});

for (const [name, mutate] of [
  ['live owner', s => Object.assign(s.owner, { connected: true, expires_at: new Date(now + 60000).toISOString() })],
  ['listener', s => { s.owner.listening = true; }],
  ...['pending', 'running', 'uncertain'].map(status => [`${status} command`, s => s.commands.push({ status })]),
  ...['running', 'uncertain'].map(status => [`${status} tool`, s => s.integration_runs.push({ status })]),
  ...['running', 'uncertain'].map(status => [`${status} worker`, s => s.jobs[0].workers.push({ status })]),
  ['feature worker', s => { s.jobs[0].features = [{ workers: [{ status: 'uncertain' }] }]; }],
  ['unfinished job', s => { s.jobs[0].status = 'awaiting-stage'; }],
  ['changed revision', s => { s.revision++; }],
  ['changed generation', s => { s.owner.generation = 'new-generation'; }],
  ['different registered owner', s => { s.owner.id = 'another-session'; }]
]) test(`refuses ${name} without changing any saved history`, () => {
  const state = fixture(), input = request(state); mutate(state);
  const before = structuredClone(state);
  assert.throws(() => releaseOwner(state, input, 'codex', now));
  assert.deepEqual(state, before);
});

test('requires configured runtime and rejects malformed or unreviewed payloads', () => {
  for (const patch of [{ runtime: 'claude' }, { requester_id: '' }, { note: '' }, { revision: '12' }, { force: true }]) {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => releaseOwner(state, { ...request(state), ...patch }, 'codex', now));
    assert.deepEqual(state, before);
  }
});

test('local CLI releases stale binding and the already-running dashboard accepts only the new real owner', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-owner-release-'));
  let server;
  t.after(async () => {
    try { await server?.close(); }
    finally {
      assert.equal(path.dirname(path.resolve(root)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
      assert.ok(path.basename(root).startsWith('factory-owner-release-'));
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(path.join(root, 'factory', '.local'), { recursive: true });
  await writeFile(path.join(root, 'factory', 'config.json'), JSON.stringify({ schema_version: 1, edition: 'codex-claude' }));
  await writeFile(path.join(root, 'factory', '.local', 'state.json'), JSON.stringify(fixture()));
  server = await serve(root);
  const statePath = path.join(root, 'factory', '.local', 'state.json');
  const before = JSON.parse(await readFile(statePath, 'utf8'));
  const { requester_id, runtime, ...payload } = request(before);
  const file = path.join(root, 'factory', '.local', 'release.json');
  await writeFile(file, JSON.stringify(payload));
  const connection = JSON.parse(await readFile(path.join(root, 'factory', '.local', 'connection.json'), 'utf8'));
  const connect = async id => {
    const response = await fetch(server.origin + '/api/owner/connect', { method: 'POST',
      headers: { Authorization: 'Bearer ' + connection.owner_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, runtime: 'codex' }) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await connect(requester_id)).status, 400);
  assert.deepEqual(await main(['owner', 'release', '--project', root, '--session', requester_id, '--runtime', runtime, '--file', file]), { status: 'released' });
  const released = JSON.parse(await readFile(statePath, 'utf8'));
  assert.equal(released.revision, before.revision + 1);
  assert.deepEqual(released.jobs, before.jobs);
  assert.deepEqual(released.commands, before.commands);
  assert.deepEqual(released.integration_runs, before.integration_runs);
  assert.equal((await connect(requester_id)).status, 200);
  assert.equal((await connect('old-session')).status, 400);
  await assert.rejects(main(['owner', 'release', '--project', root, '--session', requester_id, '--runtime', runtime, '--file', file]), /changed/);
  assert.equal(JSON.parse(await readFile(statePath, 'utf8')).owner.id, requester_id);
});
