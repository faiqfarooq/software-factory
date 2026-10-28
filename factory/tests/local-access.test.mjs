import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8');
const handlers = source.slice(0, source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
const firstKey = 'a'.repeat(64), nextKey = 'b'.repeat(64);
const response = (status, value) => new Response(JSON.stringify(value), { status });
function dashboard(fetch, hash = '') {
  const replaced = [];
  const context = vm.createContext({ fetch, location: { hash, pathname: '/' },
    history: { replaceState: (...args) => replaced.push(args) },
    sessionStorage: new Proxy({}, { get() { throw new Error('Storage unavailable'); } }) });
  vm.runInContext(handlers, context);
  return { context, replaced };
}

test('a cold browser connects without a URL key or browser storage; concurrent reads share connection', async () => {
  let sessions = 0, reads = 0;
  const d = dashboard(async (url, options) => {
    if (url === '/api/session') {
      sessions++; assert.equal(options.headers['X-Factory-Client'], 'dashboard');
      return response(200, { csrf: firstKey });
    }
    reads++; assert.equal(options.headers.Authorization, 'Bearer ' + firstKey);
    return response(200, { revision: 1 });
  });
  const results = await Promise.all([d.context.api('state'), d.context.api('state')]);
  assert.equal(sessions, 1); assert.equal(reads, 2);
  assert.equal(results[0].revision, 1);
});

test('restart reconnects and retries a rejected write once with identical command id and body', async () => {
  let sessions = 0, accepted = 0;
  const attempts = [];
  const d = dashboard(async (url, options) => {
    if (url === '/api/session') return response(200, { csrf: ++sessions === 1 ? firstKey : nextKey });
    if (url === '/api/state') return response(200, {});
    attempts.push(options);
    if (options.headers.Authorization === 'Bearer ' + firstKey) return response(401, { error: 'Expired' });
    accepted++; return response(200, { id: 'same-command' });
  });
  await d.context.api('state');
  await d.context.api('commands', { id: 'same-command', action: 'approve-stage' });
  assert.equal(sessions, 2); assert.equal(attempts.length, 2); assert.equal(accepted, 1);
  assert.equal(attempts[0].body, attempts[1].body);
  assert.equal(attempts[1].headers['X-Factory-CSRF'], nextKey);
});

test('failed bootstrap can recover and server errors never replay a write', async () => {
  let sessions = 0, posts = 0;
  const d = dashboard(async url => {
    if (url === '/api/session') return ++sessions === 1 ? response(503, { error: 'Try again' }) : response(200, { csrf: firstKey });
    posts++; return response(500, { error: 'Write failed' });
  });
  await assert.rejects(d.context.api('commands', { id: 'one' }), /Try again/);
  await assert.rejects(d.context.api('commands', { id: 'one' }), /Write failed/);
  assert.equal(sessions, 2); assert.equal(posts, 1);
});

test('repeated unauthorized replies stop after one refresh and legacy hash is removed', async () => {
  let sessions = 0, reads = 0;
  const d = dashboard(async url => {
    if (url === '/api/session') { sessions++; return response(200, { csrf: firstKey }); }
    reads++; return response(401, { error: 'Unavailable' });
  }, '#' + firstKey);
  await assert.rejects(d.context.api('state'), /Unavailable/);
  assert.equal(sessions, 2); assert.equal(reads, 2); assert.equal(d.replaced.length, 1);
  const html = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /pair-dialog|pair-key|private dashboard link/i);
});
