import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

// Exercise the dashboard's real actions and command submission without running
// its page startup or making requests to a live Factory job.
const source = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8');
const handlers = source.slice(0, source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
assert(handlers.length > 0 && handlers.length < source.length);

class Element {
  children = []; listeners = new Map(); disabled = false; value = ''; hidden = false;
  constructor(tag, onModal) { this.tagName = tag; this.onModal = onModal; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  showModal() { this.onModal(); }
  click() { if (!this.disabled) return this.listeners.get('click')?.(); }
}

function dashboard() {
  let modals = 0, readBarrier, commandFailure;
  const elements = new Map(), posts = [], notices = [];
  const current = { id: 'job', lifecycle: 2, status: 'awaiting-stage', stage: 'qa', phase: 'feature', mode: 'feature',
    offer: { id: 'qa-offer', kind: 'approve-stage' }, timeline: [], features: [], workspace: { policy: 'current-branches', reviewed: [] }, commit: 'abc' };
  const displayed = { revision: 10, owner: { connected: true }, jobs: [structuredClone(current)], commands: [] };
  const latest = structuredClone(displayed); latest.revision = 20;
  const context = vm.createContext({
    location: { hash: '', pathname: '/' }, history: {}, sessionStorage: { getItem: () => '' },
    document: {
      createElement: tag => new Element(tag, () => modals++),
      getElementById: id => { if (!elements.has(id)) elements.set(id, new Element('div', () => modals++)); return elements.get(id); }
    }, Node: Element, crypto: { randomUUID }, displayed, notices,
    apiStub: async (route, data) => {
      if (route === 'state') { if (readBarrier) await readBarrier; return structuredClone(latest); }
      assert.equal(route, 'commands'); posts.push(data);
      if (commandFailure) { const error = commandFailure; commandFailure = undefined; throw error; }
      latest.commands.push({ id: data.id, job_id: data.job_id, action: data.action, status: 'pending' });
      return { id: data.id, status: 'pending' };
    }
  });
  vm.runInContext(handlers, context);
  vm.runInContext('state = displayed; api = apiStub; render = () => {}; toast = (message, error) => notices.push({ message, error });', context);
  return { current, latest, posts, notices, context, get modals() { return modals; },
    open: (action, item = current) => context.openAction(action, item),
    buttons: () => context.actions(current).children,
    holdReads: () => { let release; readBarrier = new Promise(r => { release = r; }); return () => { readBarrier = undefined; release(); }; },
    failNextPost: () => { commandFailure = new Error('Temporary command failure'); }
  };
}

test('one stage-button click submits the exact offer without a second confirmation, despite heartbeat revision changes', async () => {
  const d = dashboard(), approve = d.buttons().find(b => b.textContent === 'Approve & continue');
  assert(approve); await approve.click();
  assert.equal(d.modals, 0); assert.equal(d.posts.length, 1);
  assert.equal(d.posts[0].action, 'approve-stage'); assert.equal(d.posts[0].offer_id, 'qa-offer');
  assert.equal(d.posts[0].revision, 20); assert.equal(d.posts[0].input, undefined);
  assert(d.buttons().find(b => b.textContent === 'Approve & continue').disabled);
});

test('rapid repeated approval clicks produce one command and disable approval while submitting', async () => {
  const d = dashboard(), release = d.holdReads();
  const first = d.open('approve-stage');
  assert(d.buttons().find(b => b.textContent === 'Approve & continue').disabled);
  assert.equal(await d.open('approve-stage'), false); release(); await first;
  assert.equal(d.posts.length, 1); assert.equal(d.modals, 0);
});

test('a stage already queued by chat or another dashboard does not submit again', async () => {
  const d = dashboard(); d.latest.commands.push({ job_id: 'job', action: 'approve-stage', status: 'pending' });
  assert.equal(await d.open('approve-stage'), false); assert.equal(d.posts.length, 0);
  assert.match(d.notices.at(-1).message, /already has a queued or active command/);
});

test('a changed offer is not silently approved', async () => {
  const d = dashboard(); d.latest.jobs[0].offer.id = 'different-offer';
  assert.equal(await d.open('approve-stage'), false); assert.equal(d.posts.length, 0);
  assert.match(d.notices.at(-1).message, /offer changed/); assert.equal(d.modals, 0);
});

test('a rejected submission releases its guard and permits a deliberate retry', async () => {
  const d = dashboard(); d.failNextPost();
  assert.equal(await d.open('approve-stage'), false);
  assert.equal(d.buttons().find(b => b.textContent === 'Approve & continue').disabled, false);
  assert.equal(await d.open('approve-stage'), true); assert.equal(d.posts.length, 2);
});

test('integration keeps its explicit review action and never submits from an ordinary stage click', () => {
  const d = dashboard(); d.current.stage = 'integration'; d.current.offer = { id: 'integration-offer', kind: 'approve-merge' };
  d.open('approve-merge'); assert.equal(d.modals, 1); assert.equal(d.posts.length, 0);
  d.open('approve-stage'); assert.equal(d.posts.length, 0); assert.equal(d.modals, 1);
});
