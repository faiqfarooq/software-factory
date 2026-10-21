/* Shared dashboard. All project text is rendered with textContent, never HTML. */
'use strict';
const $ = id => document.getElementById(id);
const titles = { overview: 'Overview', setup: 'Setup & connections', plan: 'Plan & features', reviews: 'Tests & reviews', docs: 'Documentation', usage: 'Usage', activity: 'Activity' };
let token = /^[a-f0-9]{64}$/.test(location.hash.slice(1)) ? location.hash.slice(1) : sessionStorage.getItem('factory-key') || '';
if (location.hash) history.replaceState(null, '', location.pathname);
if (token) sessionStorage.setItem('factory-key', token);
let state, page = 'overview', selectedJob, signature = '', actionContext, refreshing = false;
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const label = value => String(value || '').replaceAll('-', ' ');
const badge = value => node('span', label(value), 'badge ' + value);
const button = (text, action, primary = false, enabled = true) => {
  const e = node('button', text, primary ? 'primary' : ''); e.disabled = !enabled; e.addEventListener('click', action); return e;
};
function toast(text, error = false) {
  const box = $('toast'); box.textContent = text; box.className = 'toast' + (error ? ' error' : ''); box.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => box.hidden = true, error ? 10000 : 4500);
}
async function api(route, data) {
  const response = await fetch('/api/' + route, {
    method: data === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token,
      ...(data === undefined ? {} : { 'Content-Type': 'application/json', 'X-Factory-CSRF': token }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  if (response.status === 401) { if (!$('pair-dialog').open) $('pair-dialog').showModal(); throw new Error('Use your private dashboard link to reconnect.'); }
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
const job = () => state?.jobs.find(j => j.id === selectedJob) || state?.jobs.at(-1);
function card(title, content) {
  const e = node('section', undefined, 'card'); if (title) { const head = node('div', undefined, 'card-heading'); head.append(node('h2', title)); e.append(head); }
  if (content) e.append(content); return e;
}
function empty(title, text) {
  const e = node('div', undefined, 'empty'); e.append(node('div', '◇', 'empty-icon'), node('h2', title), node('p', text)); return e;
}
function list(items) { const e = node('ul', undefined, 'details-list'); for (const item of items) e.append(node('li', item)); return e; }
function table(headers, rows) {
  const e = node('table'), head = node('thead'), row = node('tr'); headers.forEach(h => row.append(node('th', h))); head.append(row); e.append(head);
  const body = node('tbody'); for (const data of rows) { const row = node('tr'); for (const cell of data) { const td = node('td'); td.append(cell instanceof Node ? cell : node('span', cell)); row.append(td); } body.append(row); } e.append(body); return e;
}
function checksList(checks, compact = false) {
  const ul = node('ul', undefined, 'check-list');
  for (const check of checks) {
    const li = node('li'), content = node('div', undefined, 'check-content');
    content.append(node('strong', check.label), node('p', check.detail || ''));
    if (!compact && check.status !== 'passed' && check.action) content.append(node('p', 'Next: ' + check.action));
    li.append(node('span', check.status === 'passed' ? '✓' : check.status === 'needs-action' ? '!' : '–', 'check-symbol ' + check.status), content, badge(check.status)); ul.append(li);
  }
  return ul;
}
function ownerBanner() {
  const e = node('div', undefined, 'banner' + (state.owner.connected ? ' success' : ''));
  const content = node('div');
  content.append(node('strong', state.owner.connected ? (state.owner.listening ? 'Owner is listening' : 'Owner paired · waiting for its next poll') : 'Connect your factory owner'));
  content.append(node('p', state.owner.connected ? 'Requests go to the registered owner. Status changes only when it acknowledges and executes them.' :
    state.edition === 'claude-only' ? 'Open this application in Claude Code and invoke /factory. The installed skill connects the session to this dashboard.' :
    state.edition === 'codex-claude' ? 'Open this application in Codex and invoke $factory. Claude forwards to that same owner.' : 'Connect your configured DeepSeek tool-calling runner using factory/runtime/WORKFLOW.md. Installing the dashboard does not create a provider runner.'));
  e.append(node('span', state.owner.connected ? '✓' : '↗', 'mark'), content); return e;
}
function actions(current) {
  const box = node('div', undefined, 'actions'), online = state.owner.connected;
  if (!current) return box;
  const busy = state.commands.some(c => c.job_id === current.id && ['pending', 'running', 'uncertain'].includes(c.status));
  const add = (text, action, primary = false) => box.append(button(text, () => openAction(action, current), primary, online && (!busy || ['pause', 'cancel'].includes(action))));
  if (current.status === 'awaiting-plan') { add('Approve plan and start', 'approve-plan', true); add('Request plan changes', 'revise'); }
  if (current.status === 'awaiting-merge') { add('Approve merge', 'approve-merge', true); add('Request rework', 'rework'); }
  if (current.status === 'blocked') add('Request rework', 'rework', true);
  if (['blocked', 'paused', 'awaiting-merge'].includes(current.status)) add('Revise scope or budget', 'revise');
  if (['running', 'reviewing'].includes(current.status)) add('Pause', 'pause');
  if (current.status === 'paused') add('Resume', 'resume', true);
  if (!['merged', 'cancelled'].includes(current.status)) add('Cancel job', 'cancel');
  if (state.commands.some(c => c.job_id === current.id && ['pending', 'running', 'uncertain'].includes(c.status))) box.append(node('span', 'An action is outstanding. See Activity for its status.', 'muted'));
  return box;
}
function planContent(current) {
  const e = node('div');
  if (!current?.plan) return empty('The plan comes first', 'Submit your requirements. The owner will prepare a scoped plan for your approval.');
  const p = current.plan;
  e.append(node('p', p.summary, 'details'), node('h3', 'Scope'), list(p.scope), node('h3', 'Acceptance checks'), list(p.acceptance),
    node('h3', 'Permissions'), list(p.permissions), node('h3', 'Budget'), node('p', p.budget === '' ? 'Not specified — resolve before approval.' : String(p.budget), 'details'),
    node('h3', 'Merge target'), node('p', p.target_branch), node('code', p.base_commit));
  if (current.commit) e.append(node('h3', 'Reviewed commit', 'section-gap'), node('code', current.commit));
  return e;
}
function activity(limit = 100) {
  const ul = node('ul', undefined, 'activity-list');
  for (const entry of state.activity.slice(0, limit)) { const li = node('li'); li.append(node('time', new Date(entry.time).toLocaleString()), node('span', entry.message)); ul.append(li); }
  if (!state.activity.length) ul.append(node('li', 'Activity will appear here as setup and work progress.'));
  return ul;
}
function render() {
  $('project').textContent = state.project; $('edition').textContent = ({ 'claude-only': 'Claude only', 'codex-claude': 'Codex + Claude', 'low-cost': 'API providers' })[state.edition]; $('version').textContent = 'v' + state.version;
  $('page-label').textContent = titles[page]; $('owner-label').textContent = state.owner.connected ? state.owner.listening ? 'Owner listening' : 'Owner paired' : 'Owner disconnected'; $('owner-dot').classList.toggle('online', state.owner.connected);
  for (const e of document.querySelectorAll('[data-page]')) { e.classList.toggle('selected', e.dataset.page === page); e.setAttribute('aria-current', e.dataset.page === page ? 'page' : 'false'); }
  const main = $('main'); main.replaceChildren();
  const current = job(), heading = node('div', undefined, 'page-head'), headingText = node('div');
  headingText.append(node('p', page === 'overview' ? 'YOUR DEVELOPMENT WORKSPACE' : 'FACTORY / ' + titles[page].toUpperCase(), 'eyebrow'), node('h1', page === 'overview' ? 'From idea to working software.' : titles[page]), node('p', page === 'overview' ? 'One place to plan, build, review, and approve your app.' : page === 'setup' ? 'Know what is ready, what needs attention, and what comes next.' : 'Actual progress and evidence from your project.', 'subtitle'));
  heading.append(headingText);
  const canRequest = state.owner.connected && !state.jobs.some(j => !['merged', 'cancelled'].includes(j.status)) && !state.commands.some(c => c.action === 'request' && ['pending', 'running', 'uncertain'].includes(c.status));
  heading.append(button('＋ New request', () => $('request-dialog').showModal(), true, canRequest)); main.append(heading);
  if (page === 'overview' || page === 'setup') main.append(ownerBanner());
  if (state.jobs.length > 1) {
    const select = node('select', undefined, 'job-select'); select.setAttribute('aria-label', 'Select job');
    for (const j of [...state.jobs].reverse()) { const option = node('option', label(j.status) + ' · ' + j.requirements.slice(0, 40)); option.value = j.id; select.append(option); }
    select.value = current.id; select.onchange = () => { selectedJob = select.value; render(); }; main.append(select);
  }
  if (page === 'overview') {
    const metrics = node('div', undefined, 'grid');
    const values = [['Setup checks', state.checks.filter(c => c.status === 'passed').length + ' / ' + state.checks.length, 'Passed local and recorded checks'], ['Current stage', current ? label(current.status) : 'Ready to plan', current ? label(current.mode) + ' mode' : 'Start with your requirements'], ['Reviews', (current?.reviews.filter(r => r.verdict === 'PASS' && r.commit === current.commit).length || 0) + ' / 5', 'Independent reviews of the final commit']];
    for (const [name, value, note] of values) { const c = card(); c.append(node('p', name, 'metric-label'), node('div', value, 'metric'), node('div', note, 'metric-note')); metrics.append(c); } main.append(metrics);
    const split = node('div', undefined, 'split'), progress = card('Current work');
    if (!current) { const e = empty('Your next idea starts here', 'Describe a complete app or one feature. Review the plan before the factory starts building.'); e.append(button('Prepare your first plan', () => $('request-dialog').showModal(), true, canRequest)); progress.append(e); }
    else {
      progress.append(badge(current.status), node('p', current.requirements, 'details section-gap'));
      const stages = node('div', undefined, 'stage-row'); for (const [name, states] of [['Plan', ['planning', 'awaiting-plan']], ['Build', ['running', 'paused']], ['Review', ['reviewing']], ['Approve', ['awaiting-merge']], ['Merge', ['merged']]]) stages.append(node('span', name, 'stage' + (states.includes(current.status) ? ' active' : '')));
      progress.append(stages); if (current.message) progress.append(node('p', current.message, 'muted')); progress.append(actions(current));
      if (current.preview) { const link = node('a', 'Open app preview ↗'); link.href = current.preview; link.target = '_blank'; link.rel = 'noopener noreferrer'; progress.append(link); }
    }
    const recent = card('Latest activity', activity(5)); split.append(progress, recent); main.append(split);
    const setup = card('Readiness at a glance', checksList(state.checks.slice(0, 4), true)); setup.append(button('View full checklist →', () => { page = 'setup'; render(); })); main.append(setup);
  } else if (page === 'setup') {
    const setup = card('Setup checklist', checksList(state.checks));
    const a = node('div', undefined, 'actions'); a.append(button('Recheck local setup', async () => { try { await api('check', {}); toast('Local checks refreshed.'); await refresh(); } catch (e) { toast(e.message, true); } }), button('Check live access', () => openAction('check-live'), true, state.owner.connected)); setup.append(a, node('p', 'Local checks make no model calls. Live checks require your explicit consent and can consume provider usage.', 'muted section-gap')); main.append(setup);
  } else if (page === 'plan') {
    const c = card(current ? 'Approved scope & acceptance' : null, planContent(current)); if (current) { c.append(actions(current)); if (current.design) c.append(node('h3', 'Design reference', 'section-gap'), node('p', current.design, 'details')); } main.append(c);
    if (current?.features.length) main.append(card('Features', table(['Feature', 'Progress'], current.features.map(f => [f.title, badge(f.status)]))));
  } else if (page === 'reviews') {
    if (!current) main.append(card(null, empty('Evidence arrives with the build', 'Tests and five independent reviews appear here when the owner records their real results.')));
    else { main.append(card('Acceptance checks', current.checks.length ? checksList(current.checks) : node('p', 'No acceptance checks recorded yet.', 'muted')));
      main.append(card('Independent reviews', current.reviews.length ? table(['Role', 'Verdict', 'Findings', 'Commit'], current.reviews.map(r => [r.role, badge(r.verdict), r.summary, r.commit.slice(0, 10)])) : node('p', 'Security, UX, UI, code and QA reviews are pending.', 'muted'))); }
  } else if (page === 'docs') {
    const box = node('div', undefined, 'grid'); for (const [kind, name] of [['developer', 'Developer guide'], ['user', 'End-user manual']]) { const d = current?.documentation.find(d => d.kind === kind); const c = card(name); c.append(badge(d?.status || 'not-checked'), node('p', d?.entry || 'The owner updates the actual app guides after implementation.', 'details section-gap')); if (d) { c.append(node('code', d.commit.slice(0, 10))); if (d.text) c.append(node('pre', d.text)); } box.append(c); } main.append(box, node('p', 'Guide paths refer to your application. Only owner-approved text is published here.', 'muted'));
  } else if (page === 'usage') {
    const usage = current?.usage, grid = node('div', undefined, 'grid'); for (const [name, value] of [['Measured tokens', usage?.tokens == null ? 'Unavailable' : usage.tokens.toLocaleString()], ['API-equivalent cost', usage?.usd == null ? 'Unavailable' : '$' + usage.usd.toFixed(6)], ['Reporting', usage?.completeness || 'Unavailable']]) { const c = card(); c.append(node('p', name, 'metric-label'), node('div', value, 'metric')); grid.append(c); } main.append(grid, card('Budget & accounting', node('p', current?.plan ? 'Approved budget: ' + String(current.plan.budget) + '. Subscription usage is not an actual API charge. Unknown counters are never reported as zero.' : 'Budgets are agreed in the plan. Measured provider counters appear when the runtime exposes them.', 'details')));
  } else {
    main.append(card('Command receipts', state.commands.length ? table(['Action', 'Status', 'Result'], state.commands.map(c => [label(c.action), badge(c.status), c.message || '—'])) : node('p', 'No commands submitted yet.', 'muted')), card('Project activity', activity()));
  }
}
function openAction(action, current) {
  const names = { 'approve-plan': 'Approve plan and start', 'approve-merge': 'Approve the reviewed merge', revise: 'Request plan changes', rework: 'Request rework', pause: 'Pause work', resume: 'Resume work', cancel: 'Cancel this job', 'check-live': 'Check live model access' };
  if (['pause', 'resume', 'cancel'].includes(action)) { submitCommand({ action, job_id: current.id, revision: state.revision }); return; }
  actionContext = { action, ...(current ? { job_id: current.id } : {}), revision: state.revision, ...(action.startsWith('approve-') ? { offer_id: current.offer?.id } : {}) };
  $('action-title').textContent = names[action]; $('action-submit').textContent = names[action]; $('action-details').replaceChildren();
  $('note-field').hidden = !['revise', 'rework'].includes(action); $('action-note').value = ''; $('action-note').required = !$('note-field').hidden;
  if (action === 'approve-plan') $('action-details').append(planContent(current), node('p', 'This approves implementation and routine checks within the displayed scope. Final target merge requires a separate approval.', 'muted section-gap'));
  else if (action === 'approve-merge') $('action-details').append(node('p', 'Merge the reviewed result into ' + current.plan.target_branch + ' after checking that its evidence and target are still current.'), node('code', current.commit), node('p', 'This does not authorize a push or deployment.', 'muted section-gap'));
  else if (action === 'check-live') $('action-details').append(node('p', 'Authorize one bounded probe per unique configured model/environment, sequentially, and a continuation check of the same builder session. These requests can consume provider usage. No automatic retries or account changes.'), list(state.models), node('p', 'The owner records actual identity, terminal results and available usage; unavailable capabilities remain blocked.', 'muted'));
  $('action-dialog').showModal();
}
async function submitCommand(input) {
  try {
    // An owner heartbeat may change the state revision while a person reads an offer.
    // Refresh that revision only if the exact displayed offer is still current.
    if (input.action.startsWith('approve-')) {
      const latest = await api('state'), current = latest.jobs.find(j => j.id === input.job_id);
      if (!current?.offer || current.offer.id !== input.offer_id) throw new Error('The offer changed. Review the updated plan or commit.');
      input = { ...input, revision: latest.revision };
    }
    await api('commands', { id: crypto.randomUUID(), ...input }); toast('Queued. Waiting for the owner to acknowledge.'); await refresh(); return true;
  }
  catch (e) { toast(e.message, true); await refresh(); return false; }
}
async function refresh() {
  if (refreshing) return; refreshing = true;
  try { const next = await api('state'); const nextSignature = JSON.stringify(next); state = next; if (signature !== nextSignature) { signature = nextSignature; render(); } $('connection-status').textContent = 'Connected to local dashboard'; }
  catch (e) { $('connection-status').textContent = 'Disconnected · ' + e.message; }
  finally { refreshing = false; }
}
for (const e of document.querySelectorAll('[data-page]')) e.addEventListener('click', () => { page = e.dataset.page; if (state) render(); });
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); page = 'overview'; if (state) render(); });
for (const e of document.querySelectorAll('[data-close]')) e.addEventListener('click', () => $(e.dataset.close).close());
$('pair-form').addEventListener('submit', async e => { e.preventDefault(); token = $('pair-key').value.trim(); try { state = await api('state'); sessionStorage.setItem('factory-key', token); $('pair-dialog').close(); signature = ''; render(); } catch (error) { $('pair-error').textContent = error.message; } });
$('request-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  const ok = await submitCommand({ action: 'request', revision: state.revision, input: { mode: new FormData(e.target).get('mode'), requirements: $('requirements').value, design: $('design').value } });
  submit.disabled = false; if (ok) { $('request-dialog').close(); e.target.reset(); }
});
$('action-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  const command = { ...actionContext };
  if (command.action === 'check-live') command.input = { consent: true };
  if (['revise', 'rework'].includes(command.action)) command.input = { note: $('action-note').value };
  const ok = await submitCommand(command); submit.disabled = false; if (ok) $('action-dialog').close();
});
refresh(); setInterval(refresh, 2000);
