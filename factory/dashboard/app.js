/* Shared dashboard. All project text is rendered with textContent, never HTML. */
'use strict';
const $ = id => document.getElementById(id);
const titles = { overview: 'Product board', setup: 'Setup & connections', integrations: 'Integrations', plan: 'Workflow & features', mobile: 'Web to mobile', workspace: 'Workspace & changes', preview: 'App & design', agents: 'Agents', reviews: 'Tests & reviews', docs: 'Documentation', usage: 'Usage', activity: 'Activity' };
let token = /^[a-f0-9]{64}$/.test(location.hash.slice(1)) ? location.hash.slice(1) : sessionStorage.getItem('factory-key') || '';
if (location.hash) history.replaceState(null, '', location.pathname);
if (token) sessionStorage.setItem('factory-key', token);
let state, page = 'overview', selectedJob, signature = '', actionContext, actionJobSnapshot, refreshing = false;
const credentialDrafts = new Map(), credentialRequests = new Set();
const commandRequests = new Map();
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const label = value => value === 'merged' && state?.workspace_settings ? 'accepted' : String(value || '').replaceAll('-', ' ');
const badge = value => node('span', label(value), 'badge ' + value);
const button = (text, action, primary = false, enabled = true) => {
  const e = node('button', text, primary ? 'primary' : ''); e.type = 'button'; e.disabled = !enabled; e.addEventListener('click', action); return e;
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
async function downloadGuide(jobId, kind, feature) {
  try {
    const query = new URLSearchParams({ job: jobId, kind, ...(feature ? { feature } : {}) });
    const response = await fetch('/api/documents?' + query, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Word download failed.'); }
    const url = URL.createObjectURL(await response.blob()), link = node('a');
    link.href = url; link.download = kind + '-guide.docx'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { toast(error.message, true); }
}
function wordCard(current, kind, name, guide, feature) {
  const c = card(name + ' · Microsoft Word');
  c.append(badge(guide?.status || 'not-checked'), node('p', guide?.entry || 'The documentation writer will create a .docx guide in the app documentation folder.', 'details section-gap'));
  if (guide) {
    c.append(node('code', guide.commit.slice(0, 10)));
    const ready = guide.format === 'docx' && guide.status === 'complete' && guide.verification?.status === 'passed';
    c.append(node('p', ready ? guide.verification.pages + ' pages · rendered-page review reported for this file' : 'Word creation and rendered-page review are pending.', 'muted section-gap'));
    c.append(button('Download Word file', () => downloadGuide(current.id, kind, feature), true, ready));
    if (guide.text) c.append(node('p', guide.text, 'details section-gap'));
  }
  return c;
}
function credentialForm(tool, locked) {
  const info = tool.credentials, box = node('form', undefined, 'credential-form');
  if (!info) { box.append(node('p', 'No API key is needed for this integration.', 'integration-note')); return box; }
  const draft = credentialDrafts.get(tool.id) || {}, keyInput = node('input'), keyLabel = node('label', 'API key');
  keyInput.id = 'api-key-' + tool.id; keyLabel.htmlFor = keyInput.id; keyInput.type = 'password'; keyInput.autocomplete = 'new-password';
  keyInput.maxLength = 4096; keyInput.spellcheck = false; keyInput.setAttribute('autocapitalize', 'none');
  keyInput.value = draft.api_key || ''; keyInput.placeholder = info.present ? 'Enter a replacement key' : 'Paste API key';
  keyInput.disabled = locked || credentialRequests.has(tool.id);
  keyInput.addEventListener('input', () => { credentialDrafts.set(tool.id, { ...credentialDrafts.get(tool.id), api_key: keyInput.value }); });
  box.append(keyLabel, keyInput, node('p', info.present ? (info.source === 'dashboard' ? 'A saved key is configured. Leave blank to keep it.' : 'Using a server environment key. A saved key will override it.') : 'No API key configured.', 'integration-note'));
  let modelInput;
  if (tool.id === 'strix') {
    modelInput = node('input'); modelInput.id = 'strix-model'; modelInput.value = draft.model ?? info.model; modelInput.maxLength = 180;
    modelInput.placeholder = 'provider/approved-model'; modelInput.disabled = keyInput.disabled;
    const modelLabel = node('label', 'Strix model'); modelLabel.htmlFor = modelInput.id;
    modelInput.addEventListener('input', () => credentialDrafts.set(tool.id, { ...credentialDrafts.get(tool.id), model: modelInput.value }));
    box.append(modelLabel, modelInput, node('p', 'Use the edition provider and exact model approved in your scan plan.', 'integration-note'));
  }
  const controls = node('div', undefined, 'actions'), save = node('button', credentialRequests.has(tool.id) ? 'Saving…' : 'Save credentials', 'primary');
  save.type = 'submit'; save.disabled = keyInput.disabled; controls.append(save);
  const change = async payload => {
    if (credentialRequests.has(tool.id)) return;
    credentialRequests.add(tool.id); save.disabled = true; keyInput.disabled = true; if (modelInput) modelInput.disabled = true;
    try {
      const latest = await api('state');
      await api('integrations/credentials', { id: tool.id, revision: latest.revision, ...payload });
      keyInput.value = ''; credentialDrafts.delete(tool.id);
      toast(payload.action === 'remove' ? 'Saved credentials removed. Environment settings may still apply.' : 'Credentials saved locally. No provider call made.');
    } catch (error) { toast(error.message, true); }
    finally { credentialRequests.delete(tool.id); signature = ''; await refresh(); }
  };
  if (info.saved || info.saved_model) controls.append(button('Remove saved credentials', () => change({ action: 'remove' }), false, !keyInput.disabled));
  box.addEventListener('submit', event => {
    event.preventDefault(); const api_key = keyInput.value.trim(), model = modelInput?.value.trim();
    change({ action: 'save', ...(api_key ? { api_key } : {}), ...(modelInput ? { model } : {}) });
  });
  box.append(controls, node('p', info.storage === 'windows-user-encrypted' ? 'Saved privately and encrypted for your Windows user. Keys are never returned to this page.' : 'Saved in a private local file with owner-only permissions (0600). Keys are never returned to this page.', 'integration-note'));
  return box;
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
  const busy = [...commandRequests.values()].includes(current.id) || state.commands.some(c => c.job_id === current.id && ['pending', 'running', 'uncertain'].includes(c.status));
  const add = (text, action, primary = false) => box.append(button(text, () => openAction(action, current), primary, online && (!busy || ['pause', 'cancel'].includes(action))));
  if (current.lifecycle === 2 || current.needs_migration) {
    if (current.needs_migration) add('Adopt staged workflow', 'migrate-workflow', true);
    else {
      if (current.offer) add(({ 'approve-stage': 'Approve & continue', 'approve-merge': current.workspace?.policy === 'current-branches' ? 'Approve integration' : 'Approve merge', 'start-feature': 'Start next feature', 'start-acceptance': 'Start product acceptance' })[current.offer.kind], current.offer.kind, true);
      if (['awaiting-stage', 'ready-feature', 'ready-acceptance', 'blocked', 'paused'].includes(current.status) && !(current.phase === 'final' && current.requires_specification_revision)) add('Request changes', 'revise');
      if (current.mode === 'product' && current.phase !== 'product' && ['awaiting-stage', 'blocked', 'paused'].includes(current.status)) add('Revise product roadmap', 'revise-product');
      if (['planning', 'running', 'reviewing'].includes(current.status)) add('Pause', 'pause');
      if (current.status === 'paused') add('Resume current stage', 'resume');
    }
    if (!['merged', 'cancelled'].includes(current.status)) add('Cancel work', 'cancel');
    if (busy) box.append(node('span', 'Waiting for the current command. See Activity.', 'muted'));
    return box;
  }
  if (current.status === 'awaiting-plan') { add('Approve plan and start', 'approve-plan', true); add('Request plan changes', 'revise'); }
  if (current.status === 'awaiting-merge') { add('Approve merge', 'approve-merge', true); add('Request rework', 'rework'); }
  if (current.status === 'blocked' && current.plan_approved) add('Request rework', 'rework', true);
  if (['blocked', 'paused', 'awaiting-merge'].includes(current.status)) add('Revise scope or budget', 'revise');
  if (['running', 'reviewing'].includes(current.status)) add('Pause', 'pause');
  if (current.status === 'paused') add('Resume', 'resume', true);
  if (!['merged', 'cancelled'].includes(current.status)) add('Cancel job', 'cancel');
  if (state.commands.some(c => c.job_id === current.id && ['pending', 'running', 'uncertain'].includes(c.status))) box.append(node('span', 'An action is outstanding. See Activity for its status.', 'muted'));
  return box;
}
function previewLink(current) {
  const e = node('div');
  if (current?.preview) {
    const a = node('a', 'Open app locally'); a.href = current.preview; a.target = '_blank'; a.rel = 'noopener noreferrer'; e.append(a);
    e.append(node('p', current.preview_source ? 'Served repository: ' + current.preview_source.repository + ' · Git commit: ' + current.preview_source.commit :
      'Served commit: ' + (current.preview_commit || 'unreported') + ' · ' + (current.workspace?.branch || ''), 'muted'));
    if (current.preview_commit !== current.commit && current.commit) e.append(node('p', 'This preview differs from the current reviewed commit. Ask the owner to refresh it.', 'error'));
    if (state.workspace?.dirty || (state.workspace?.commit && state.workspace.commit !== current.preview_commit)) e.append(node('p', 'The local workspace has changed since this preview was reported. Its served version needs verification.', 'muted'));
  } else e.append(node('p', 'No local preview has been reported. The owner must record its URL and served commit, or explain the limitation.', 'muted'));
  return e;
}
function workflowContent(current) {
  const e = node('div');
  if (!current?.lifecycle) return planContent(current);
  const stages = node('ol', undefined, 'workflow-timeline');
  for (const s of current.timeline) { const li = node('li'); li.append(node('strong', s.label), badge(s.status)); stages.append(li); }
  e.append(node('p', current.title + ' · ' + label(current.phase) + (current.active_feature ? ' / ' + current.active_feature : ''), 'details'), stages);
  const d = current.deliverables.find(d => d.stage === current.stage);
  if (d) {
    e.append(node('h3', d.summary), node('pre', deliverableText(d.content), 'deliverable'));
    if (d.limitations.length) e.append(node('h3', 'Limitations'), list(d.limitations));
    if (d.coverage.length) e.append(table(['Acceptance criterion', 'Passing check'], d.coverage.map(c => [c.requirement, c.check])));
  } else e.append(node('p', 'Preparing ' + label(current.stage) + '. The owner publishes the deliverable here before requesting your decision.', 'muted'));
  if (current.message) e.append(node('p', current.message, 'details'));
  if (current.stage === 'specification') e.append(planContent(current));
  if (['implementation', 'qa', 'integration', 'acceptance', 'final-merge', 'design'].includes(current.stage)) e.append(previewLink(current));
  e.append(node('p', 'Approval permits only the next displayed stage. No automatic next-feature start, push or deployment.', 'muted'));
  return e;
}
function featureBoard(current) {
  if (!current?.features.length) return node('p', 'The feature roadmap appears after the product specification is prepared.', 'muted');
  return table(['Feature', 'Dependencies', 'Status', 'Branch / accepted commit'], current.features.map(f => [
    f.id + ' · ' + f.title, f.depends_on?.join(', ') || 'None', badge(f.status), (f.workspace?.branch || '') + (f.integrated_commit ? '\n' + f.integrated_commit.slice(0, 12) : '')
  ]));
}
function mobileRoadmapProposal(current) {
  const text = (v, max = 3000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const strings = v => Array.isArray(v) && v.length <= 100 && v.every(s => text(s));
  for (const deliverable of [...(current?.deliverables || [])].reverse()) {
    const match = deliverable.content?.match(/```factory-roadmap\r?\n([\s\S]*?)\r?\n```/);
    if (!match || match[1].length > 50000) continue;
    try {
      const p = JSON.parse(match[1]);
      if (p.kind !== 'mobile-product-proposal' || p.version !== 1 || p.status !== 'proposed' || !text(p.title) ||
          !text(p.source_repo) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(p.source_commit) || !text(p.output_repo) ||
          !Array.isArray(p.platforms) || !p.platforms.length || new Set(p.platforms).size !== p.platforms.length || !p.platforms.every(v => ['android', 'ios'].includes(v)) ||
          !['expo-native', 'capacitor'].includes(p.strategy) || !['scope', 'excluded', 'prerequisites', 'release_checks'].every(k => strings(p[k])) ||
          !text(p.execution) || !Array.isArray(p.features) || !p.features.length || p.features.length > 100) continue;
      const seen = new Set(), screens = new Set(); let valid = true;
      for (const f of p.features) {
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(f.id) || seen.has(f.id) || !text(f.title) ||
            !text(f.portal, 120) || f.status !== 'proposed' ||
            !Array.isArray(f.depends_on) || !f.depends_on.every(id => seen.has(id)) || new Set(f.depends_on).size !== f.depends_on.length ||
            !strings(f.web_screens) || !f.web_screens.length || !strings(f.acceptance) || !f.acceptance.length) { valid = false; break; }
        seen.add(f.id);
        for (const screen of f.web_screens) { if (!screen.startsWith('/') || screens.has(screen)) valid = false; screens.add(screen); }
      }
      if (valid && p.screen_count === screens.size) return p;
    } catch { /* An invalid attachment cannot become a displayed or executable plan. */ }
  }
  return null;
}
function deliverableText(content) {
  return content.replace(/\n?```factory-roadmap\r?\n[\s\S]*?\r?\n```/g, '').trim();
}
function mobileRoadmapCard(p) {
  const box = card(p.title);
  box.append(badge('proposed'), node('p', 'Proposed release plan. No conversion feature has started; this is not implementation approval.', 'details section-gap'));
  box.append(list(['Portals: ' + [...new Set(p.features.map(f => f.portal))].join(', '), 'Platforms: ' + p.platforms.join(', '), 'Approach: ' + label(p.strategy),
    'Read-only web reference: ' + p.source_repo, 'Source commit: ' + p.source_commit, 'Mobile output: ' + p.output_repo,
    'Mapped web routes: ' + p.screen_count]));
  box.append(node('h3', 'Ordered feature delivery'), table(['Order / feature', 'Portal', 'Depends on', 'Acceptance / web screens', 'State'], p.features.map((f, i) => [
    (i + 1) + '. ' + f.id + ' · ' + f.title, f.portal, f.depends_on.join(', ') || 'None',
    f.acceptance.join('\n') + '\nWeb: ' + f.web_screens.join(', '), 'Proposed'
  ])));
  box.append(node('h3', 'Execution'), node('p', p.execution, 'details'), node('h3', 'Before implementation'), list(p.prerequisites),
    node('h3', 'Release acceptance'), list(p.release_checks), node('h3', 'Included'), list(p.scope), node('h3', 'Outside this release'), list(p.excluded));
  return box;
}
function planContent(current) {
  const e = node('div');
  if (!current?.plan) return empty('The plan comes first', 'Submit your requirements. The owner will prepare a scoped plan for your approval.');
  const p = current.plan;
  e.append(node('p', p.summary, 'details'), node('h3', 'Scope'), list(p.scope), node('h3', 'Acceptance checks'), list(p.acceptance),
    node('h3', 'Permissions'), list(p.permissions), node('h3', 'Budget'), node('p', p.budget === '' ? 'Not specified — resolve before approval.' : String(p.budget), 'details'),
    node('h3', p.repositories ? 'Repository baseline snapshot' : 'Merge target'), node('p', p.target_branch), node('code', p.base_commit));
  if (p.repositories) e.append(table(['Repository', 'Existing branch', 'Baseline commit'], p.repositories.map(r => [r.path, r.branch, r.base_commit])));
  if (p.integrations?.length) {
    e.append(node('h3', 'Approved tool scope', 'section-gap'), table(['Tool', 'Operations / limits'], p.integrations.map(s => [s.tool,
      s.operations.join(', ') + ' · ' + s.max_calls + ' invocations' + (s.targets ? ' · Targets: ' + s.targets.join(', ') + ' · Model: ' + s.model + ' · $' + s.max_usd + ' per scan (best effort), ' + s.max_turns + ' turns per agent' : '')])));
  }
  if (current.commit) e.append(node('h3', 'Reviewed commit', 'section-gap'), node('code', current.commit));
  if (p.mobile) e.append(node('h3', 'Mobile scope', 'section-gap'), list(['Source: ' + p.mobile.source_commit, 'Approach: ' + label(p.mobile.strategy), 'Existing API: ' + p.mobile.api_base_url, ...p.mobile.screens.map(s => s.web + ' → ' + s.mobile + ' · ' + s.acceptance), ...p.mobile.device_checks.map(d => d.platform + ': ' + d.check)]), node('p', 'Web to mobile shows the full API inventory and device evidence.', 'muted'));
  return e;
}
function activity(limit = 100) {
  const ul = node('ul', undefined, 'activity-list');
  for (const entry of state.activity.slice(0, limit)) { const li = node('li'); li.append(node('time', new Date(entry.time).toLocaleString()), node('span', entry.message)); ul.append(li); }
  if (!state.activity.length) ul.append(node('li', 'Activity will appear here as setup and work progress.'));
  return ul;
}
function render() {
  if (!$('request-dialog').open) { $('factory-purpose').value = state.purpose || 'software'; mobileFields(); }
  $('planning-docs-option').hidden = !state.integrations?.some(i => i.id === 'context7' && i.enabled);
  if ($('planning-docs-option').hidden) $('planning-docs').checked = false;
  $('project').textContent = state.project;
  $('purpose').textContent = state.purpose === 'web-to-mobile' ? 'Web-to-mobile factory' : 'Software factory';
  $('edition').textContent = 'Agent: ' + ({ 'claude-only': 'Claude only', 'codex-claude': 'Codex + Claude', 'low-cost': 'API providers' })[state.edition]; $('version').textContent = 'v' + state.version;
  $('page-label').textContent = titles[page]; $('owner-label').textContent = state.owner.connected ? state.owner.listening ? 'Owner listening' : 'Owner paired' : 'Owner disconnected'; $('owner-dot').classList.toggle('online', state.owner.connected);
  for (const e of document.querySelectorAll('[data-page]')) { e.classList.toggle('selected', e.dataset.page === page); e.setAttribute('aria-current', e.dataset.page === page ? 'page' : 'false'); }
  const main = $('main'); main.replaceChildren();
  const current = job(), heading = node('div', undefined, 'page-head'), headingText = node('div');
  const existing = state.workspace_settings?.policy === 'current-branches';
  if (!$('request-dialog').open) {
    $('target-branch').value = existing ? 'current-branches' : state.workspace?.target || state.workspace?.branch || 'main';
    $('target-branch').hidden = existing; $('target-label').hidden = existing;
    $('repository-fields').hidden = !existing; $('repository-options').replaceChildren();
    if (existing) for (const r of state.workspace_settings.repositories) {
      const box = node('input'); box.type = 'checkbox'; box.name = 'repositories'; box.value = r.path;
      const row = node('label'); row.append(box, node('span', r.path + ' / ' + r.branch)); $('repository-options').append(row);
    }
    $('request-scope-note').textContent = existing ?
      'Start authorizes feasibility analysis in the selected repositories. Later stages require approval. Preserve existing edits and reconcile selected repositories before implementation. No new branches or Git merges. Analysis can consume provider usage.' :
      'Start authorizes a fresh named branch and feasibility analysis. Each later stage needs approval. Existing changes must be reconciled before switching branches. Analysis can consume provider usage.';
  }
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
  if (page === 'mobile') {
    const proposal = mobileRoadmapProposal(current);
    if (proposal) {
      if (current.features?.length) {
        main.append(card('Feature delivery queue', featureBoard(current)), node('p', 'This queue comes from the current specification. Its status and current stage determine what can run.', 'muted'));
        const reference = node('details'); reference.append(node('summary', 'Web route mapping and original proposal'), mobileRoadmapCard(proposal)); main.append(reference);
      } else main.append(mobileRoadmapCard(proposal));
    }
    if (current?.purpose !== 'web-to-mobile') {
      if (proposal) {
        main.append(card('Current conversion planning stage', workflowContent(current)), actions(current));
      } else {
        const e = card('Convert an existing web app', node('p', 'Create a mobile request, supply the frontend repo and reuse its backend. Approve analysis, requirements, screen design and the feature roadmap before coding.'));
        e.append(button('New mobile request', () => { $('factory-purpose').value = 'web-to-mobile'; mobileFields(); $('request-dialog').showModal(); }, true, canRequest)); main.append(e);
      }
    } else {
      const input = current.mobile, analysis = current.mobile_analysis, plan = current.plan?.mobile;
      main.append(card('Source and targets', list([input.source_repo, 'Platforms: ' + input.platforms.join(', '), 'API address: ' + (input.api_base_url || 'Discover during analysis'), 'Requested approach: ' + label(input.strategy)])));
      main.append(card('Frontend analysis', analysis ? list(['Source commit: ' + analysis.source_commit, 'Framework: ' + analysis.framework, 'Recommended approach: ' + label(analysis.recommendation), 'Authentication: ' + analysis.auth, ...analysis.risks.map(r => 'Risk: ' + r)]) : node('p', 'Awaiting read-only source analysis. No app has been converted yet.', 'muted')));
      if (analysis) main.append(card('Discovered web screens', list(analysis.screens)), card('Existing API modules', list(analysis.api_modules)));
      if (plan) {
        main.append(card('Approved scope / current proposal', list(['Approach: ' + label(plan.strategy), 'Existing API: ' + plan.api_base_url, 'Existing backend reused', 'Auth: ' + plan.auth, 'Storage: ' + plan.storage, 'Offline: ' + plan.offline])));
        main.append(card('Web to mobile screen mapping', list(plan.screens.map(s => s.web + ' → ' + s.mobile + ' · ' + s.acceptance))));
        main.append(card('Existing API contracts', list(plan.api_contracts.map(a => a.method + ' ' + a.path + ' · ' + a.check))));
        const checks = [...plan.api_contracts.map(a => ({ name: a.check, kind: 'API parity' })), ...plan.device_checks.map(d => ({ name: d.check, kind: d.platform + ' device' }))];
        main.append(card('Mobile verification', list(checks.map(c => c.kind + ': ' + c.name + ' · ' + (current.checks.find(t => t.label === c.name && t.commit === current.commit)?.status || 'not checked')))));
      }
      if (current.mobile_runs?.length) main.append(card('Reported device runs', list(current.mobile_runs.map(r => r.platform + ' · ' + r.device + ' (' + r.runtime + ') · ' + r.check + ' · ' + r.status + ' · ' + r.commit.slice(0, 12)))));
      main.append(node('p', 'Device results are owner-reported evidence. A browser preview does not prove Android or iOS works. Missing SDKs, API access or backend capabilities must be shown as blockers. App signing and publishing are separate work.', 'muted'), card('Current stage', workflowContent(current)), actions(current));
    }
  } else if (page === 'overview') {
    const metrics = node('div', undefined, 'grid');
    const values = [['Setup checks', state.checks.filter(c => c.status === 'passed').length + ' / ' + state.checks.length, 'Passed local and recorded checks'], ['Current stage', current ? (current.timeline?.find(s => s.id === current.stage)?.label || label(current.status)) : 'Ready to plan', current ? label(current.status) : 'Start with your requirements'], ['Reviews', (current?.reviews.filter(r => r.verdict === 'PASS' && r.commit === current.commit).length || 0) + ' / 5', 'Independent reviews of the final commit']];
    for (const [name, value, note] of values) { const c = card(); c.append(node('p', name, 'metric-label'), node('div', value, 'metric'), node('div', note, 'metric-note')); metrics.append(c); } main.append(metrics);
    const split = node('div', undefined, 'split'), progress = card('Current work');
    if (!current) { const e = empty('Your next idea starts here', 'Describe a complete app or one feature. Review the plan before the factory starts building.'); e.append(button('Prepare your first plan', () => $('request-dialog').showModal(), true, canRequest)); progress.append(e); }
    else {
      progress.append(badge(current.status), node('p', current.requirements, 'details section-gap'));
      if (current.lifecycle === 2) progress.append(workflowContent(current));
      else { const stages = node('div', undefined, 'stage-row'); for (const [name, states] of [['Plan', ['planning', 'awaiting-plan']], ['Build', ['running', 'paused']], ['Review', ['reviewing']], ['Approve', ['awaiting-merge']], ['Merge', ['merged']]]) stages.append(node('span', name, 'stage' + (states.includes(current.status) ? ' active' : ''))); progress.append(stages); }
      if (current.message && current.lifecycle !== 2) progress.append(node('p', current.message, 'muted')); progress.append(actions(current));
      if (current.preview) { const link = node('a', 'Open app preview ↗'); link.href = current.preview; link.target = '_blank'; link.rel = 'noopener noreferrer'; progress.append(link); }
    }
    const recent = card('Latest activity', activity(5)); split.append(progress, recent); main.append(split);
    if (current?.mode === 'product') main.append(card('Sequential feature roadmap', featureBoard(current)));
    const setup = card('Readiness at a glance', checksList(state.checks.slice(0, 4), true)); setup.append(button('View full checklist →', () => { page = 'setup'; render(); })); main.append(setup);
  } else if (page === 'setup') {
    const permissions = card('Command approvals');
    permissions.append(node('p', 'Factory asks once at each stage checkpoint. Routine commands, fixes, tests and reviews continue within the approved stage.', 'details'), node('p', 'To remove separate Codex command prompts in this trusted workspace, select Full access in the permissions menu below the message box, or use /permissions in the CLI. Project defaults are approval_policy = "never" and sandbox_mode = "danger-full-access" in .codex/config.toml.', 'details section-gap'), node('p', 'Full access grants broad local filesystem and network access. Factory stage, integration and next-feature decisions still apply. This dashboard cannot change the active host profile; managed policy and other tools may have separate controls.', 'muted section-gap'));
    const permissionDocs = node('a', 'OpenAI permissions documentation'); permissionDocs.href = 'https://learn.chatgpt.com/docs/sandboxing'; permissionDocs.target = '_blank'; permissionDocs.rel = 'noopener noreferrer'; permissions.append(permissionDocs); main.append(permissions);
    const setup = card('Setup checklist', checksList(state.checks));
    const a = node('div', undefined, 'actions'); a.append(button('Recheck local setup', async () => { try { await api('check', {}); toast('Local checks refreshed.'); await refresh(); } catch (e) { toast(e.message, true); } }), button('Check live access', () => openAction('check-live'), true, state.owner.connected)); setup.append(a, node('p', 'Local checks make no model calls. Live checks require your explicit consent and can consume provider usage.', 'muted section-gap')); main.append(setup);
  } else if (page === 'integrations') {
    main.append(node('p', 'Enable only what this project needs. Enabling does not install software, connect accounts, spend credits, or authorize a scan. The owner uses tools within the displayed plan scope.', 'subtitle'));
    const controls = node('div', undefined, 'actions');
    controls.append(button('Check local availability', async () => { try { await api('integrations/check', {}); toast('Local availability checked. No provider calls.'); await refresh(); } catch (e) { toast(e.message, true); } })); main.append(controls);
    const grid = node('div', undefined, 'integration-grid');
    const settingsLocked = credentialRequests.size > 0 || state.commands.some(c => ['pending', 'running', 'uncertain'].includes(c.status)) || state.jobs.some(j => (j.workers || []).some(w => ['running', 'uncertain'].includes(w.status)) || !['merged', 'cancelled', 'awaiting-plan', 'awaiting-stage', 'ready-feature', 'ready-acceptance', 'paused', 'blocked'].includes(j.status));
    for (const tool of state.integrations || []) {
      const c = card(tool.name); c.append(badge(tool.status), node('p', tool.description, 'details section-gap'), node('p', tool.detail, 'muted'));
      c.append(node('p', 'Roles: ' + tool.roles.join(', '), 'integration-note'));
      if (tool.enabled && tool.action) c.append(node('p', 'Next: ' + tool.action, 'integration-note'));
      c.append(node('p', 'Known external requests: ' + tool.calls + (tool.calls_complete ? '' : ' · partial') + ' · Cache hits: ' + tool.cache_hits + ' · Cost: ' + (tool.usd === null ? 'unavailable' : '$' + tool.usd.toFixed(6)), 'integration-note'));
      if (tool.last_checked) c.append(node('p', 'Checked: ' + new Date(tool.last_checked).toLocaleString() + (tool.last_verified ? ' · Verified: ' + new Date(tool.last_verified).toLocaleString() : ''), 'integration-note'));
      const a = node('div', undefined, 'actions');
      if (tool.id !== 'skills') a.append(button(tool.enabled ? 'Disable' : 'Enable', async () => {
        try { await api('integrations/settings', { id: tool.id, enabled: !tool.enabled, revision: state.revision }); toast(tool.name + (tool.enabled ? ' disabled.' : ' enabled. Review its next action and include use in your plan.')); await refresh(); } catch (e) { toast(e.message, true); }
      }, !tool.enabled, !settingsLocked));
      const link = node('a', 'Official setup guide ↗'); link.href = tool.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; a.append(link); c.append(a);
      if (tool.id !== 'skills') c.append(credentialForm(tool, settingsLocked));
      if (tool.latest.length) c.append(table(['Recent operation', 'Result', 'Duration'], tool.latest.map(r => [r.operation + (r.cache_hit ? ' · cached' : ''), badge(r.status), r.duration_ms === null ? '—' : (r.duration_ms / 1000).toFixed(1) + ' s'])));
      grid.append(c);
    }
    main.append(grid);
    if (settingsLocked) main.append(node('p', 'Tool settings are locked while work is active. Pause/finish and reconcile it first. Changes require a revised plan offer and preserve existing work.', 'muted'));
    const p = state.performance;
    if (p) main.append(card('Measure before expanding', table(['Observed metric', 'Value'], [
      ['Completed jobs', String(p.completed_jobs)], ['Known measured tokens', p.measured_tokens === null ? 'Unavailable' : p.measured_tokens.toLocaleString()],
      ['Known API-equivalent cost', p.known_usd === null ? 'Unavailable' : '$' + p.known_usd.toFixed(6) + (p.usage_complete ? '' : ' · partial')],
      ['Elapsed time including approval waits', p.elapsed_ms === null ? 'Unavailable' : (p.elapsed_ms / 60000).toFixed(1) + ' min'],
      ['Completed rework requests', String(p.rework_requests)], ['Escaped defects', 'Not measured']
    ])), node('p', 'These are observations from this project, not claimed savings. Compare similar accepted work with and without each optional tool.', 'muted'));
    if (p?.cohorts.length) main.append(card('Compare observed tool use', table(['Tools actually invoked', 'Completed jobs', 'Mean elapsed, including waits', 'Mean known tokens'], p.cohorts.map(c => [
      c.tools.length ? c.tools.join(', ') : 'No optional tools', String(c.jobs), c.average_elapsed_ms === null ? 'Unavailable' : (c.average_elapsed_ms / 60000).toFixed(1) + ' min',
      c.average_known_tokens === null ? 'Unavailable' : Math.round(c.average_known_tokens).toLocaleString() + ' (' + c.token_samples + ' samples)'
    ]))));
  } else if (page === 'plan') {
    const c = card(current ? 'Current stage & decision' : null, workflowContent(current)); if (current) { c.append(actions(current)); if (current.design) c.append(node('h3', 'Design reference', 'section-gap'), node('p', current.design, 'details')); } main.append(c);
    if (current?.mode === 'product') main.append(card('Features', featureBoard(current)));
    for (const f of current?.lifecycle === 2 ? current.features : []) {
      const details = node('details'); details.append(node('summary', f.title + ' · ' + label(f.status)), node('code', f.workspace.branch));
      for (const d of f.stages || []) details.append(node('h3', label(d.stage) + (d.approved ? ' · approved' : ''), 'section-gap'), node('pre', d.content));
      if (f.checks?.length) details.append(node('h3', 'Feature checks', 'section-gap'), checksList(f.checks));
      if (f.reviews?.length) details.append(table(['Role', 'Verdict', 'Summary', 'Commit'], f.reviews.map(r => [r.role, r.verdict, r.summary, r.commit.slice(0, 12)])));
      if (f.workspace.prepared) details.append(button('View committed feature changes', async () => { try { const result = await api('workspace/diff?job=' + encodeURIComponent(current.id) + '&feature=' + encodeURIComponent(f.id)); details.append(node('pre', result.diff || 'No tracked changes.')); } catch (error) { toast(error.message, true); } }));
      main.append(card(null, details));
    }
    if (current?.decisions?.length) main.append(card('Approval history', table(['Stage', 'Unit', 'Decision', 'Time'], current.decisions.map(d => [label(d.stage), d.unit, label(d.action), new Date(d.time).toLocaleString()]))));
    for (const d of current?.deliverables?.filter(d => d.stage !== current.stage) || []) { const details = node('details'); details.append(node('summary', label(d.stage) + (d.approved ? ' · approved' : '')), node('pre', d.content)); main.append(card(null, details)); }
  } else if (page === 'workspace') {
    const w = state.workspace;
    if (w.policy === 'current-branches') {
      main.append(card('Repositories on existing branches', node('p', w.root + ' · No branch creation or Git merge. Commits form one reviewed snapshot.')));
      main.append(table(['Repository', 'Branch', 'HEAD', 'Local changes'], w.repositories.map(r => [r.path, r.branch || 'Unavailable', r.commit || 'No committed baseline', r.dirty ? 'Needs reconciliation' : 'Clean'])));
      if (current?.workspace?.reviewed) main.append(card('Reviewed snapshot', table(['Repository', 'Branch', 'Commit'], current.workspace.reviewed.map(r => [r.path, r.branch, r.commit]))));
    } else main.append(card('Your local application folder', list([w.root, 'Checked-out branch: ' + (w.branch || 'Unavailable'), 'HEAD: ' + (w.commit || 'No committed baseline'), 'Feature/product branch: ' + (current?.workspace?.branch || 'Not assigned'), 'Merge target: ' + (current?.workspace?.target || 'Not assigned')])));
    if (w.detail) main.append(node('p', w.detail, 'muted'));
    if (current?.workspace?.prepared && w.branch !== current.workspace.branch && !['ready-feature', 'ready-acceptance', 'merged', 'merging'].includes(current.status)) main.append(node('p', 'The local checkout differs from the active feature branch. The owner must reconcile it before continuing.', 'error'));
    main.append(card('Uncommitted local changes', w.changes?.length ? table(['Status', 'Path'], w.changes.map(f => [f.status, f.path])) : node('p', 'No uncommitted changes reported.', 'muted')));
    const diff = card('Feature changes against its base');
    diff.append(node('p', 'Changes are in the application folder above. Open it in your editor to inspect or run the app. Diff content is fetched only when you request it.', 'muted'), button('Load feature diff', async () => {
      try { const result = await api('workspace/diff?job=' + encodeURIComponent(current.id)); const output = node('div'); output.append(node('pre', result.files || 'No tracked file changes.'), node('pre', result.diff || 'Empty tracked diff.'), node('p', result.untracked_note, 'muted')); diff.append(output); } catch (error) { toast(error.message, true); }
    }, false, Boolean(current?.workspace?.prepared)));
    main.append(diff);
    if (current?.merge_history?.length) main.append(card('Accepted integrations', table(['Source branch', 'Target', 'Commit'], current.merge_history.map(m => [m.branch, m.target, m.commit]))));
  } else if (page === 'preview') {
    main.append(card('Current local app / prototype', previewLink(current)));
    if (current?.accepted_preview) main.append(card('Last accepted product checkpoint', state.workspace.commit === current.accepted_preview.commit && !state.workspace.dirty ? previewLink({ preview: current.accepted_preview.url, preview_commit: current.accepted_preview.commit, commit: current.accepted_preview.commit, workspace: { branch: current.accepted_preview.branch } }) : node('p', current.accepted_preview.branch + ' / ' + current.accepted_preview.commit + '. The shared local server is now on another workspace version; this is a historical checkpoint, not a separate running preview.', 'muted')));
    if (current?.design) main.append(card('Supplied design reference', node('p', current.design, 'details')));
    const design = current?.deliverables?.find(d => d.stage === 'design');
    main.append(card('System & UI design', design ? node('pre', design.content) : node('p', 'Design appears when the design stage is prepared. Text diagrams, data models, API examples and local prototypes can be included.', 'muted')));
    main.append(node('p', 'The preview is served by your application process, separate from this dashboard. After each feature is integrated, the owner refreshes it for the accepted product and reports the served commit.', 'muted'));
  } else if (page === 'agents') {
    main.append(card('Configured roles', table(['Role', 'Provider', 'Configured model'], state.roles.map(r => [r.role, r.provider, r.model || 'Existing owner session']))));
    main.append(card('Reported worker executions', current?.workers?.length ? table(['Role / model', 'Feature / stage', 'Task', 'Status / last update', 'Usage / result'], current.workers.map(w => [w.role + ' / ' + w.model, (w.feature || 'product') + ' / ' + label(w.stage), w.task, label(w.status) + ' / ' + new Date(w.updated_at).toLocaleString(), (w.tokens === null ? 'Tokens unavailable' : w.tokens + ' tokens') + ' / ' + (w.usd === null ? 'Cost unavailable' : '$' + w.usd) + '\n' + w.result])) : node('p', 'No worker executions reported. Configured roles are not running workers.', 'muted')));
    main.append(node('p', 'Execution identities and model details are owner-reported. Native provider receipts must support them; dashboard registration alone does not verify a model or launch an agent.', 'muted'));
  } else if (page === 'reviews') {
    if (!current) main.append(card(null, empty('Evidence arrives with the build', 'Tests and five independent reviews appear here when the owner records their real results.')));
    else { main.append(card('Acceptance checks', current.checks.length ? checksList(current.checks) : node('p', 'No acceptance checks recorded yet.', 'muted')));
      main.append(card('Independent reviews', current.reviews.length ? table(['Role', 'Verdict', 'Findings', 'Commit'], current.reviews.map(r => [r.role, badge(r.verdict), r.summary, r.commit.slice(0, 10)])) : node('p', 'Security, UX, UI, code and QA reviews are pending.', 'muted'))); }
    for (const result of current?.integration_checks || []) main.append(card('Post-merge verification · ' + result.unit + ' / ' + result.commit.slice(0, 12), checksList(result.checks)));
  } else if (page === 'docs') {
    const box = node('div', undefined, 'grid'); for (const [kind, name] of [['developer', 'Developer guide'], ['user', 'End-user manual']]) box.append(wordCard(current, kind, name, current?.documentation.find(d => d.kind === kind)));
    main.append(box, node('p', 'Documentation deliverables are Word .docx files. Downloads use the exact committed version whose file hash matches its reported page review. Rendered images and private review logs are kept outside the download endpoint.', 'muted'));
    for (const feature of current?.features || []) if (feature.documentation?.length) {
      main.append(node('h2', feature.title, 'section-gap'));
      const files = node('div', undefined, 'grid'); for (const d of feature.documentation) files.append(wordCard(current, d.kind, d.kind === 'developer' ? 'Developer guide' : 'End-user manual', d, feature.id)); main.append(files);
    }
  } else if (page === 'usage') {
    const usage = current?.usage, grid = node('div', undefined, 'grid'); for (const [name, value] of [['Measured tokens', usage?.tokens == null ? 'Unavailable' : usage.tokens.toLocaleString()], ['API-equivalent cost', usage?.usd == null ? 'Unavailable' : '$' + usage.usd.toFixed(6)], ['Reporting', usage?.completeness || 'Unavailable']]) { const c = card(); c.append(node('p', name, 'metric-label'), node('div', value, 'metric')); grid.append(c); } main.append(grid, card('Budget & accounting', node('p', current?.plan ? 'Approved budget: ' + String(current.plan.budget) + '. Subscription usage is not an actual API charge. Unknown counters are never reported as zero.' : 'Budgets are agreed in the plan. Measured provider counters appear when the runtime exposes them.', 'details')));
  } else {
    main.append(card('Command receipts', state.commands.length ? table(['Action', 'Status', 'Result'], state.commands.map(c => [label(c.action), badge(c.status), c.message || '—'])) : node('p', 'No commands submitted yet.', 'muted')), card('Project activity', activity()));
  }
}
function openAction(action, current) {
  if (action === 'approve-stage') {
    if (current?.offer?.kind !== action || !current.offer.id) { toast('No current stage offer. Refresh and review the work.', true); return; }
    return submitCommand({ action, job_id: current.id, offer_id: current.offer.id, revision: state.revision });
  }
  const names = { 'start-feature': 'Start next feature', 'start-acceptance': 'Start product acceptance', 'migrate-workflow': 'Adopt staged workflow', 'approve-plan': 'Approve plan and start', 'approve-merge': 'Approve the reviewed merge', revise: 'Request changes', 'revise-product': 'Revise product roadmap', rework: 'Request rework', pause: 'Pause work', resume: 'Resume work', cancel: 'Cancel this job', 'check-live': 'Check live model access' };
  if (current?.workspace?.policy === 'current-branches') names['approve-merge'] = 'Approve integration';
  if (['pause', 'resume', 'cancel'].includes(action)) { submitCommand({ action, job_id: current.id, revision: state.revision }); return; }
  actionContext = { action, ...(current ? { job_id: current.id } : {}), revision: state.revision, ...(['approve-plan', 'approve-merge', 'start-feature', 'start-acceptance'].includes(action) ? { offer_id: current.offer?.id } : {}) };
  actionJobSnapshot = current ? JSON.stringify(current) : null;
  $('action-title').textContent = names[action]; $('action-submit').textContent = names[action]; $('action-details').replaceChildren();
  $('note-field').hidden = !['revise', 'revise-product', 'rework'].includes(action); $('action-note').value = ''; $('action-note').required = !$('note-field').hidden;
  $('revision-stage').replaceChildren();
  for (const s of (action === 'revise-product' ? ['feasibility', 'requirements', 'specification', 'design'].map(id => ({ id, label: label(id) })) : current?.timeline?.filter(s => s.status !== 'locked') || [])) { const o = node('option', s.label); o.value = s.id; $('revision-stage').append(o); }
  $('revision-stage').value = action === 'revise-product' || (current?.requires_specification_revision && current.timeline?.some(s => s.id === 'specification' && s.status !== 'locked')) ? 'specification' : current?.stage || '';
  $('revision-stage').hidden = current?.lifecycle !== 2;
  if (action === 'start-feature') { const f = current.features.find(f => f.status !== 'accepted'); $('action-details').append(node('p', 'Start ' + f.title + ' on ' + f.workspace.branch + '. Begin with its requirements; implementation needs later approval.'), list(f.acceptance)); }
  else if (action === 'start-acceptance') $('action-details').append(node('p', 'All features are integrated. Authorize complete product acceptance and fresh product reviews. Final ' + (current.workspace?.policy === 'current-branches' ? 'integration' : 'target merge') + ' needs another approval.'));
  else if (action === 'migrate-workflow') $('action-details').append(node('p', 'Preserve previous work/history and return to feasibility on a fresh branch. No previous approval will be treated as approval of a new stage. Reconcile existing processes and changes first.'));
  if (action === 'approve-plan') $('action-details').append(planContent(current), node('p', 'This approves implementation and routine checks within the displayed scope. Final target merge requires a separate approval.', 'muted section-gap'));
  else if (action === 'approve-merge') {
    if (current.workspace?.policy === 'current-branches') $('action-details').append(node('p', 'Accept this exact reviewed repository snapshot on the existing branches, then run integration checks. Source changes are already on these branches. This performs no Git merge, push or deployment.'), node('code', current.commit), table(['Repository', 'Branch', 'Commit'], current.workspace.reviewed.map(r => [r.path, r.branch, r.commit])));
    else $('action-details').append(node('p', 'Merge ' + (current.workspace?.branch || 'the reviewed result') + ' into ' + (current.workspace?.target || current.plan.target_branch) + ' after checking that its evidence and target are still current.'), node('code', current.commit), node('p', 'Run post-merge checks, then wait. This does not start the next feature, push or deploy.', 'muted section-gap'));
  }
  else if (action === 'check-live') $('action-details').append(node('p', 'Authorize one bounded probe per unique configured model/environment, sequentially, and a continuation check of the same builder session. These requests can consume provider usage. No automatic retries or account changes.'), list(state.models), node('p', 'The owner records actual identity, terminal results and available usage; unavailable capabilities remain blocked.', 'muted'));
  $('action-dialog').showModal();
}
async function submitCommand(input) {
  const requestKey = JSON.stringify([input.job_id, input.action, input.offer_id]);
  if (commandRequests.has(requestKey)) return false;
  commandRequests.set(requestKey, input.job_id);
  try {
    // An owner heartbeat may change the state revision while a person reads an offer.
    // Refresh that revision only if the exact displayed offer is still current.
    if (input.offer_id) {
      const latest = await api('state'), current = latest.jobs.find(j => j.id === input.job_id);
      if (latest.commands.some(c => c.job_id === input.job_id && ['pending', 'running', 'uncertain'].includes(c.status))) throw new Error('This job already has a queued or active command. See Activity.');
      if (!current?.offer || current.offer.id !== input.offer_id) throw new Error('The offer changed. Review the updated plan or commit.');
      input = { ...input, revision: latest.revision };
    }
    await api('commands', { id: crypto.randomUUID(), ...input }); toast('Queued. Waiting for the owner to acknowledge.'); return true;
  }
  catch (e) { toast(e.message, true); return false; }
  finally { commandRequests.delete(requestKey); signature = ''; await refresh(); }
}
async function refresh() {
  if (refreshing) return; refreshing = true;
  try { const next = await api('state'); const nextSignature = JSON.stringify(next); if (!state && next.purpose === 'web-to-mobile') page = 'mobile'; state = next; if (signature !== nextSignature) { signature = nextSignature; render(); } $('connection-status').textContent = 'Connected to local dashboard'; }
  catch (e) { $('connection-status').textContent = 'Disconnected · ' + e.message; }
  finally { refreshing = false; }
}
for (const e of document.querySelectorAll('[data-page]')) e.addEventListener('click', () => { if (e.dataset.page !== 'integrations') credentialDrafts.clear(); page = e.dataset.page; if (state) render(); });
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); credentialDrafts.clear(); page = 'overview'; if (state) render(); });
window.addEventListener('pagehide', () => credentialDrafts.clear());
for (const e of document.querySelectorAll('[data-close]')) e.addEventListener('click', () => $(e.dataset.close).close());
$('pair-form').addEventListener('submit', async e => { e.preventDefault(); token = $('pair-key').value.trim(); try { state = await api('state'); sessionStorage.setItem('factory-key', token); $('pair-dialog').close(); signature = ''; render(); } catch (error) { $('pair-error').textContent = error.message; } });
function mobileFields() {
  const enabled = $('factory-purpose').value === 'web-to-mobile';
  $('mobile-fields').hidden = !enabled; $('source-repo').required = enabled;
  for (const e of $('mobile-fields').querySelectorAll('input, select')) e.disabled = !enabled;
}
$('factory-purpose').addEventListener('change', mobileFields);
$('request-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  const purpose = $('factory-purpose').value;
  const mobile = purpose === 'web-to-mobile' ? { source_repo: $('source-repo').value.trim(), platforms: ['android', 'ios'].filter(p => $('platform-' + p).checked), strategy: $('mobile-strategy').value, api_base_url: $('api-base-url').value.trim() } : undefined;
  const form = new FormData(e.target), repositories = state.workspace_settings ? form.getAll('repositories') : undefined;
  if (repositories && !repositories.length) { toast('Select at least one repository for this request.', true); submit.disabled = false; return; }
  const ok = await submitCommand({ action: 'request', revision: state.revision, input: { purpose, ...(mobile ? { mobile } : {}), ...(repositories ? { repositories } : {}), mode: form.get('mode'), title: $('work-title').value, target_branch: $('target-branch').value, requirements: $('requirements').value, design: $('design').value, allow_documentation: $('planning-docs').checked } });
  submit.disabled = false; if (ok) { $('request-dialog').close(); e.target.reset(); }
});
$('action-form').addEventListener('submit', async e => {
  e.preventDefault(); const submit = e.submitter; submit.disabled = true;
  const command = { ...actionContext };
  if (command.action === 'check-live') command.input = { consent: true };
  if (['revise', 'revise-product', 'rework'].includes(command.action)) command.input = { note: $('action-note').value, ...($('revision-stage').value ? { stage: $('revision-stage').value } : {}) };
  if (!command.offer_id) {
    try {
      const latest = await api('state');
      if (command.job_id && JSON.stringify(latest.jobs.find(j => j.id === command.job_id)) !== actionJobSnapshot) throw new Error('The work changed while this dialog was open. Review its current stage before submitting.');
      command.revision = latest.revision;
    } catch (error) { toast(error.message, true); submit.disabled = false; await refresh(); return; }
  }
  const ok = await submitCommand(command); submit.disabled = false; if (ok) $('action-dialog').close();
});
refresh(); setInterval(refresh, 2000);
