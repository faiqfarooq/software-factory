import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { serve } from '../runtime/server.mjs';

test('local browser access is automatic while origin, CSRF and owner boundaries remain enforced', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-dashboard-access-'));
  let server;
  t.after(async () => {
    try { await server?.close(); } finally {
      assert.equal(path.dirname(path.resolve(root)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
      assert.ok(path.basename(root).startsWith('factory-dashboard-access-'));
      await rm(root, { recursive: true, force: true });
    }
  });
  await mkdir(path.join(root, 'factory', '.local'), { recursive: true });
  await writeFile(path.join(root, 'factory', 'config.json'), JSON.stringify({ schema_version: 1, edition: 'codex-claude', roles: {}, models: {} }));
  server = await serve(root);
  assert.equal(server.url, server.origin + '/');
  const statePath = path.join(root, 'factory', '.local', 'state.json');
  const before = await readFile(statePath, 'utf8');
  const request = (route, headers = {}, method = 'GET', body) => new Promise((resolve, reject) => {
    const req = http.request(server.origin + '/api/' + route, { method, headers }, res => {
      let text = ''; res.on('data', chunk => text += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject); req.end(body);
  });
  const marker = { 'X-Factory-Client': 'dashboard', 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' };
  assert.equal((await request('session')).status, 403);
  // A non-browser local client omits Sec-Fetch-* entirely; reaching the loopback port is not enough.
  assert.equal((await request('session', { 'X-Factory-Client': 'dashboard' })).status, 403);
  for (const omit of ['Sec-Fetch-Site', 'Sec-Fetch-Dest', 'Sec-Fetch-Mode']) {
    const partial = { ...marker }; delete partial[omit];
    assert.equal((await request('session', partial)).status, 403, 'missing ' + omit);
  }
  const session = await request('session', marker);
  assert.equal(session.status, 200); assert.match(session.body.csrf, /^[a-f0-9]{64}$/);
  assert.equal(session.headers['cache-control'], 'no-store');
  assert.equal(session.headers['access-control-allow-origin'], undefined);
  const connection = JSON.parse(await readFile(path.join(root, 'factory', '.local', 'connection.json'), 'utf8'));
  assert.notEqual(session.body.csrf, connection.owner_key);
  assert.deepEqual(Object.keys(session.body), ['csrf']);
  for (const headers of [
    { Host: 'evil.example' }, { Origin: 'https://evil.example' }, { Origin: 'null' },
    { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }, { 'Sec-Fetch-Site': 'none' }, { 'Sec-Fetch-Dest': 'document' }, { 'Sec-Fetch-Mode': 'navigate' }, { 'Sec-Fetch-Mode': 'no-cors' }
  ]) assert.equal((await request('session', { ...marker, ...headers })).status, 403);
  assert.equal((await request('session', marker, 'OPTIONS')).status, 405);
  assert.equal((await request('session', marker, 'POST')).status, 405);
  assert.equal((await request('state')).status, 401);
  const auth = { Authorization: 'Bearer ' + session.body.csrf };
  const state = await request('state', auth);
  assert.equal(state.status, 200);
  assert.ok(!JSON.stringify(state.body).includes(session.body.csrf));
  assert.ok(!JSON.stringify(state.body).includes(connection.owner_key));
  assert.equal((await request('owner/connect', auth, 'POST', '{}')).status, 401);
  assert.equal((await request('commands', { ...auth, Origin: server.origin, 'Content-Type': 'application/json' }, 'POST', '{}')).status, 403);
  assert.equal((await request('commands', { ...auth, Origin: 'https://evil.example', 'X-Factory-CSRF': session.body.csrf }, 'POST', '{}')).status, 403);
  // Authenticated malformed input reaches validation, without recording a command.
  assert.equal((await request('commands', { ...auth, Origin: server.origin, 'X-Factory-CSRF': session.body.csrf, 'Content-Type': 'application/json' }, 'POST', '{}')).status, 400);
  assert.equal(await readFile(statePath, 'utf8'), before);
});
