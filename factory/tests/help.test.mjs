import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { getHelp, formatHelp } from '../runtime/help.mjs';
import { main } from '../runtime/cli.mjs';
import { install, planInstall, BUNDLE_FILES } from '../setup.mjs';
import { serve } from '../runtime/server.mjs';
import { exists, json } from '../runtime/storage.mjs';

const operations = ['start', 'check', 'status', 'role-context', 'integrations', 'inspect-frontend',
  ...['connect', 'next', 'heartbeat', 'publish', 'worker', 'workspace', 'checks', 'tool', 'tool-result', 'tool-cancel', 'tool-reconcile', 'feature-readiness', 'review-plan-export', 'recover-command', 'finish', 'disconnect', 'release'].map(s => 'owner ' + s)];
const decisions = ['request', 'check-live', 'approve-stage', 'approve-merge', 'start-feature', 'start-acceptance', 'revise', 'revise-product', 'rework', 'pause', 'resume', 'cancel', 'save-draft', 'discard-draft', 'submit-revision', 'regenerate', 'select-design', 'design-feedback', 'trash', 'restore', 'migrate', 'rollback-migration', 'migrate-workflow', 'approve-plan'];

test('catalog covers all operational commands and workflow decisions with purposes, requirements and examples', () => {
  const help = getHelp(), actions = help.groups.flatMap(g => g.actions);
  assert.equal(help.operational_commands, 23);
  assert.deepEqual(help.groups.filter(g => g.id !== 'workflow').flatMap(g => g.actions.map(a => a.id)), operations);
  assert.deepEqual(getHelp('workflow').groups[0].actions.map(a => a.name), decisions);
  assert.equal(new Set(actions.map(a => a.id)).size, actions.length);
  for (const a of actions) for (const field of ['id', 'purpose', 'when', 'arguments', 'example']) assert(a[field]?.trim(), a.id + ': ' + field);
  assert.match(formatHelp('next'), /never approves a stage/);
  assert.equal(getHelp('owner next').groups[0].actions[0].id, 'owner next');
  assert.equal(getHelp('OWNER').groups[0].actions.length, 17);
  assert.throws(() => getHelp('unknown-action'), /Unknown help topic/);
  help.groups[0].actions.pop(); assert.equal(getHelp('everyday').groups[0].actions.length, 6);
  assert(BUNDLE_FILES.includes('runtime/help.mjs'));
});

async function temp(t, cleanup = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'factory-help-'));
  t.after(async () => {
    for (const close of cleanup.reverse()) await close();
    assert.equal(path.dirname(path.resolve(root)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert(path.basename(root).startsWith('factory-help-'));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test('CLI help works before installation, needs no owner and writes no project state', async t => {
  const root = await temp(t), output = [], originalLog = console.log;
  console.log = text => output.push(text);
  try {
    for (const args of [['help'], ['--help'], ['help', 'next'], ['owner', 'next', '--help'], ['start', '--help'], ['help', 'workflow'], ['help', '--json']]) {
      const result = await main([...args, '--project', path.join(root, 'not-installed')]);
      assert.equal(result.operational_commands, 23);
    }
    assert.match(output[0], /Factory help/);
    assert.match(output[2], /owner next/);
    assert.deepEqual(JSON.parse(output.at(-1)), getHelp());
    await assert.rejects(main(['help', 'bad-topic', '--project', root]), /Unknown help topic/);
    await assert.rejects(main(['help', '--file', 'ignored.json']), /Help accepts/);
    assert.equal(await exists(path.join(root, 'factory')), false);
    assert.equal(await exists(path.join(root, 'not-installed')), false);
  } finally { console.log = originalLog; }
});

test('installed help is authenticated, works with a disconnected owner and leaves state unchanged', async t => {
  const cleanup = [], root = await temp(t, cleanup);
  await install(await planInstall(root, 'codex-claude'));
  const server = await serve(root); cleanup.push(() => server.close());
  const connection = await json(path.join(root, 'factory/.local/connection.json'));
  const statePath = path.join(root, 'factory/.local/state.json');
  const before = await readFile(statePath, 'utf8');
  assert.equal(JSON.parse(before).owner, null);
  assert.equal((await fetch(server.origin + '/api/help')).status, 401);
  const response = await fetch(server.origin + '/api/help', { headers: { Authorization: 'Bearer ' + connection.browser_key } });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), getHelp());
  assert.equal(await readFile(statePath, 'utf8'), before);
  assert.equal(await exists(path.join(root, 'factory/runtime/help.mjs')), true);
  const html = await (await fetch(server.origin)).text();
  assert.match(html, /data-help/); assert.match(html, /class="help-hint"/);
  assert.match(html, /\$factory help/); assert.match(html, /\/factory help/);
});

class Element {
  children = []; value = ''; open = false;
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener() {}
  showModal() { this.open = true; }
}
const allText = e => [e.textContent || '', ...(e.children || []).map(allText)].join('\n');

test('dashboard Help renders and filters the shared catalog without state, owner connection or mutation requests', async () => {
  const source = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8');
  const handlers = source.slice(0, source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
  const elements = new Map(), get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Element() },
    location: { hash: '', pathname: '/' }, sessionStorage: { getItem: () => '' }, history: {},
    helpResponse: getHelp(), apiStub: async (route, payload) => { calls.push({ route, payload }); return getHelp(); }
  });
  vm.runInContext(handlers, context);
  vm.runInContext('api = apiStub;', context);
  await context.openHelp();
  assert.equal(get('help-dialog').open, true);
  assert.deepEqual(calls, [{ route: 'help', payload: undefined }]);
  for (const name of ['Everyday terminal commands', 'Workflow decisions', 'Advanced owner operations', 'owner next', 'workflow approve-stage']) assert(allText(get('help-results')).includes(name), name);
  get('help-search').value = 'owner release'; await context.openHelp();
  const filtered = allText(get('help-results'));
  assert(filtered.includes('owner release')); assert(!filtered.includes('owner next'));
  assert.equal(calls.length, 1);
  context.renderHelp('no-such-action'); assert.match(get('help-status').textContent, /No matching actions/);
  vm.runInContext("helpCatalog.groups[0].actions[0].purpose = '<script>untrusted</script>';", context);
  context.renderHelp('start'); assert(allText(get('help-results')).includes('<script>untrusted</script>'));
  assert(!get('help-results').innerHTML);
});

test('a failed dashboard help request can be retried without queuing work', async () => {
  const source = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8');
  const handlers = source.slice(0, source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
  const elements = new Map(), get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  let calls = 0;
  const context = vm.createContext({ document: { getElementById: get, createElement: () => new Element() },
    location: { hash: '', pathname: '/' }, sessionStorage: { getItem: () => '' }, history: {},
    apiStub: async route => { assert.equal(route, 'help'); if (++calls === 1) throw new Error('Offline'); return getHelp(); } });
  vm.runInContext(handlers, context); vm.runInContext('api = apiStub;', context);
  await context.openHelp(); assert.match(get('help-status').textContent, /could not load/);
  await context.openHelp(); assert.equal(calls, 2); assert.match(get('help-status').textContent, /actions shown/);
});
