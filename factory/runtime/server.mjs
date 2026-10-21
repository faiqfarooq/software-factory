import http from 'node:http';
import path from 'node:path';
import { readFile, unlink, open, mkdir } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { atomic, safePath, readConfig, readState, saveState, locked, stamp, uid, event, json } from './storage.mjs';
import { profile } from './profiles.mjs';
import { inspect, git } from './checks.mjs';
import { enqueue, claim, publish, finish, publicState, fields, connected } from './workflow.mjs';
import { CATALOG, integrationSettings, prerequisites, reserveRun, executeIntegration } from './integrations.mjs';
import { currentUnit, stage, recordWorker } from './lifecycle.mjs';
import { workspaceView, workspaceDiff, workspaceOperation, assertWorkspace } from './workspace.mjs';
import { committedWord, WORD_MIME } from './documents.mjs';
import { loadCredentials, saveCredentials, updateCredentials, credentialEnvironment, credentialView } from './credentials.mjs';

const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const body = async req => {
  let bytes = 0, chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 262144) throw new Error('Request is too large.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};
export async function assertMergeBinding(root, job) {
  if (job?.lifecycle === 2) return assertWorkspace(root, job, { frozen: true });
  if (!job?.plan || !job.commit) throw new Error('Missing merge binding.');
  const target = await git(root, ['rev-parse', '--verify', 'refs/heads/' + job.plan.target_branch]);
  if (target !== (job.target_base_commit || job.plan.base_commit || job.baseline_commit)) throw new Error('Target branch changed. Reconcile and review before offering merge again.');
  const commit = await git(root, ['rev-parse', '--verify', job.commit + '^{commit}']);
  if (commit !== job.commit) throw new Error('Reviewed commit is unavailable.');
  await git(root, ['merge-base', '--is-ancestor', target, commit]);
}
export async function serve(root, { port = 0, integrationDependencies = {} } = {}) {
  root = path.resolve(root);
  let config = await readConfig(root);
  let credentials = await loadCredentials(root);
  const baseEnvironment = integrationDependencies.environment || process.env;
  const toolEnvironment = id => credentialEnvironment(credentials, baseEnvironment, id);
  const selected = profile(config.edition), toolTasks = new Map();
  const lockPath = await safePath(root, 'factory/.local/server.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Dashboard already started or interrupted. Inspect factory/.local/server.lock and connection.json; do not start a second server.'); throw e; }
  await lock.writeFile(JSON.stringify({ pid: process.pid, time: stamp() }));
  const browserKey = randomBytes(32).toString('hex'), ownerKey = randomBytes(32).toString('hex');
  let origin, waiting = false, closing = false, mutation = Promise.resolve();
  const mutate = fn => {
    const task = mutation.then(() => locked(root, async () => {
      const state = await readState(root);
      const result = await fn(state);
      await saveState(root, state);
      return result;
    }));
    mutation = task.catch(() => {}); return task;
  };
  const touch = state => {
    state.owner.connected = true;
    state.owner.expires_at = new Date(Date.now() + 90000).toISOString();
  };
  const requireOwner = (state, id) => {
    if (!state.owner || state.owner.id !== id) throw new Error('Wrong owner session. Reconnect the registered owner.');
    if (!connected(state)) throw new Error('Owner lease expired. Reconnect the same session and reconcile uncertain work.');
  };
  const assertIntegrationChange = (state, revision) => {
    if (revision !== state.revision) throw new Error('State changed. Refresh before changing integrations.');
    if (state.commands.some(c => ['pending', 'running', 'uncertain'].includes(c.status)) || (state.integration_runs || []).some(r => ['running', 'uncertain'].includes(r.status)) ||
        state.jobs.some(j => (j.workers || []).some(w => ['running', 'uncertain'].includes(w.status)) || !['merged', 'cancelled', 'awaiting-plan', 'awaiting-stage', 'ready-feature', 'ready-acceptance', 'paused', 'blocked'].includes(j.status))) throw new Error('Pause/finish and reconcile active work before changing integrations or credentials.');
  };
  const invalidateIntegrationPlans = (state, message) => {
    for (const job of state.jobs.filter(j => !['merged', 'cancelled'].includes(j.status))) {
      if (job.lifecycle === 2) { currentUnit(job).approved_plan_hash = null; job.configuration_changed = true; }
      job.offer = null; job.approved_plan_hash = null; job.status = 'blocked'; job.message = message;
    }
  };
  const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
  const server = http.createServer(async (req, res) => {
    const send = (code, value, type = 'application/json; charset=utf-8') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      res.end(typeof value === 'string' ? value : JSON.stringify(value));
    };
    try {
      if (req.headers.host !== new URL(origin).host) return send(403, { error: 'Untrusted Host.' });
      const route = new URL(req.url, origin).pathname;
      if (req.headers.origin && req.headers.origin !== origin) return send(403, { error: 'Untrusted Origin.' });
      if (req.method === 'GET' && Object.hasOwn(assets, route)) {
        const [file, type] = assets[route];
        return send(200, await readFile(await safePath(root, 'factory/dashboard/' + file), 'utf8'), type);
      }
      if (JSON.stringify(await readConfig(root)) !== JSON.stringify(config)) return send(409, { error: 'Factory configuration changed. Reconcile the owner and restart the dashboard.' });
      const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
      const ownerRoute = route.startsWith('/api/owner/');
      if (!equal(auth, ownerRoute ? ownerKey : browserKey)) return send(401, { error: 'Pair this dashboard using the local link printed by setup.' });
      if (req.method === 'GET' && route === '/api/state') {
        const state = await readState(root), result = publicState(state, config);
        const keys = credentialView(credentials, baseEnvironment);
        result.integrations = result.integrations.map(tool => ({ ...tool, credentials: keys[tool.id] || null }));
        result.workspace = await workspaceView(root, state.jobs.find(j => !['merged', 'cancelled'].includes(j.status)) || state.jobs.at(-1));
        result.roles = Object.entries(config.roles).map(([role, provider]) => ({ role, provider, model: config.models[role] }));
        return send(200, result);
      }
      if (req.method === 'GET' && route === '/api/workspace/diff') {
        const state = await readState(root), job = state.jobs.find(j => j.id === new URL(req.url, origin).searchParams.get('job'));
        if (!job || job.lifecycle !== 2) throw new Error('Select a staged feature/product.');
        const featureId = new URL(req.url, origin).searchParams.get('feature');
        if (featureId && (job.mode !== 'product' || !job.features.some(f => f.id === featureId))) throw new Error('Unknown feature.');
        return send(200, await workspaceDiff(root, featureId ? { ...job, phase: 'feature', active_feature: featureId } : job));
      }
      if (req.method === 'GET' && route === '/api/documents') {
        const query = new URL(req.url, origin).searchParams, state = await readState(root);
        const job = state.jobs.find(j => j.id === query.get('job')), kind = query.get('kind'), feature = query.get('feature');
        if (!job || job.lifecycle !== 2 || !['developer', 'user'].includes(kind)) throw new Error('Select a registered Word guide.');
        const selected = feature ? job.features.find(f => f.id === feature) : currentUnit(job);
        const guide = selected?.documentation?.find(d => d.kind === kind);
        if (!guide) throw new Error('No Word guide is recorded for this selection.');
        const data = await committedWord(root, guide, selected.commit);
        res.writeHead(200, { 'Content-Type': WORD_MIME, 'Content-Disposition': 'attachment; filename="' + kind + '-guide.docx"',
          'Content-Length': data.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
        return res.end(data);
      }
      if (req.method !== 'POST') return send(404, { error: 'Not found.' });
      if (!ownerRoute && (req.headers.origin !== origin || !equal(req.headers['x-factory-csrf'], browserKey))) return send(403, { error: 'Browser origin and CSRF token are required.' });
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: 'Expected JSON.' });
      const input = await body(req);
      if (route === '/api/integrations/check') {
        fields(input, []);
        await mutate(async state => {
          const checks = await prerequisites(root, config, toolEnvironment());
          state.integration_checks = Object.fromEntries(Object.entries(checks).map(([id, value]) => [id, { ...value, time: stamp() }]));
          event(state, 'Integration prerequisites checked locally. No provider requests or installs.');
        });
        return send(200, { status: 'completed' });
      }
      if (route === '/api/integrations/settings') {
        fields(input, ['id', 'enabled', 'revision']);
        if (!Object.hasOwn(CATALOG, input.id) || input.id === 'skills' || typeof input.enabled !== 'boolean') throw new Error('Choose an optional integration and its enabled flag.');
        await mutate(async state => {
          assertIntegrationChange(state, input.revision);
          const settings = integrationSettings(config.integrations); settings[input.id].enabled = input.enabled;
          const updated = { ...config, integrations: settings };
          invalidateIntegrationPlans(state, 'Integration settings changed. Request a revised plan before approval; existing work and history were preserved.');
          await saveState(root, state);
          await atomic(await safePath(root, 'factory/config.json'), updated); config = updated;
          state.integration_profile = Object.entries(settings).filter(([, v]) => v.enabled).map(([id]) => id);
          state.integration_checks = Object.fromEntries(Object.entries(await prerequisites(root, config, toolEnvironment())).map(([id, value]) => [id, { ...value, time: stamp() }]));
          event(state, CATALOG[input.id].name + (input.enabled ? ' enabled; connection still requires verification.' : ' disabled.'));
        });
        return send(200, { status: 'completed' });
      }
      if (route === '/api/integrations/credentials') {
        await mutate(async state => {
          assertIntegrationChange(state, input.revision);
          const next = updateCredentials(credentials, input, config, baseEnvironment);
          if (JSON.stringify(next) === JSON.stringify(credentials)) return;
          const checks = await prerequisites(root, config, credentialEnvironment(next, baseEnvironment));
          // Revoke offers durably before changing secret material. A write failure cannot preserve old consent.
          invalidateIntegrationPlans(state, 'Integration credentials changed. Revise specification or an earlier stage before continuing. Existing work and history were preserved.');
          await saveState(root, state);
          await saveCredentials(root, next); credentials = next;
          state.integration_checks = Object.fromEntries(Object.entries(checks).map(([id, value]) => [id, { ...value, time: stamp() }]));
          event(state, CATALOG[input.id].name + (input.action === 'remove' ? ' saved credentials removed.' : ' credentials saved locally; no provider call made.'));
        });
        return send(200, { status: 'completed' });
      }
      if (route === '/api/check') {
        fields(input, []);
        const report = await inspect(root, config.edition);
        await mutate(state => {
          // Local checks never erase live/acceptance evidence already collected by the owner.
          for (const check of report.checks) if (!['live', 'continuation', 'browser', 'acceptance'].includes(check.id) || !state.checks.some(c => c.id === check.id)) {
            state.checks = state.checks.filter(c => c.id !== check.id); state.checks.push(check);
          }
          event(state, 'Local checklist refreshed. No model calls.');
        });
        return send(200, { status: 'completed' });
      }
      if (route === '/api/commands') {
        const command = await mutate(async state => {
          const job = state.jobs.find(j => j.id === input.job_id);
          if (input.action === 'approve-merge') await assertMergeBinding(root, job);
          if (job?.lifecycle === 2 && input.action === 'approve-stage' && ['specification', 'design', 'implementation', 'qa', 'acceptance'].includes(stage(job))) await assertWorkspace(root, job, { frozen: ['implementation', 'qa', 'acceptance'].includes(stage(job)) });
          return enqueue(state, input);
        });
        return send(200, { id: command.id, status: command.status });
      }
      if (!ownerRoute) return send(404, { error: 'Not found.' });
      if (route === '/api/owner/workspace') {
        const result = await mutate(async state => { requireOwner(state, input.owner_id); touch(state); return workspaceOperation(root, state, input); });
        return send(200, result);
      }
      if (route === '/api/owner/worker') {
        const result = await mutate(state => { requireOwner(state, input.owner_id); touch(state); return recordWorker(state, config, input); });
        return send(200, result);
      }
      if (route === '/api/owner/tool') {
        fields(input, ['owner_id', 'request']);
        const reservation = await mutate(state => { requireOwner(state, input.owner_id); touch(state); return reserveRun(state, config, input.request); });
        const run = reservation.run;
        if (!reservation.duplicate) {
          const controller = new AbortController();
          const started = Date.now();
          const task = (async () => {
            // Start on the next event-loop turn, after the receipt has been durably reserved.
            await delay(0);
            let result;
            try { result = await executeIntegration(root, config, run, { ...integrationDependencies, environment: toolEnvironment(run.tool), signal: controller.signal }); }
            catch (error) {
              result = { status: error.uncertain || controller.signal.aborted || ['TimeoutError', 'AbortError'].includes(error.name) ? 'uncertain' : 'failed',
                data: { error: error.message.startsWith('Integration HTTP') || error.message.startsWith('21st.dev HTTP') ? error.message : 'Integration did not complete. Inspect its local prerequisites and approved inputs.' },
                external_calls: run.tool === 'graphify' ? 0 : null, usd: run.tool === 'graphify' ? 0 : null };
            }
            const file = 'factory/.local/integrations/runs/' + run.id + '.json';
            await atomic(await safePath(root, file), { ...result, trust: 'Untrusted integration output; not an agent verdict or merge approval.' });
            await mutate(state => {
              const saved = state.integration_runs.find(r => r.id === run.id);
              Object.assign(saved, { status: result.status, external_calls: result.external_calls, usd: result.usd ?? null,
                cache_hit: Boolean(result.cache_hit), connection_binding: result.connection_binding || null,
                duration_ms: Date.now() - started, finished_at: stamp(), result_file: file,
                source_commit: result.commit || null });
              event(state, CATALOG[run.tool].name + ' ' + run.operation + ': ' + result.status + '. Results require owner review.');
            });
          })();
          toolTasks.set(run.id, { task, controller });
          task.catch(async () => {
            // A storage/receipt failure must not silently leave a reusable Running invocation.
            await mutate(state => {
              const saved = state.integration_runs?.find(r => r.id === run.id);
              if (saved && saved.status === 'running') { saved.status = 'uncertain'; saved.failure = 'Receipt persistence needs reconciliation.'; }
            }).catch(() => {});
          }).finally(() => toolTasks.delete(run.id));
        }
        return send(202, { id: run.id, status: run.status, duplicate: reservation.duplicate });
      }
      if (route === '/api/owner/tool-result') {
        fields(input, ['owner_id', 'id']);
        const state = await readState(root); requireOwner(state, input.owner_id);
        const run = state.integration_runs?.find(r => r.id === input.id && r.owner_id === input.owner_id);
        if (!run) throw new Error('Unknown tool invocation for this owner.');
        const result = run.result_file ? await json(await safePath(root, run.result_file)) : null;
        return send(200, { id: run.id, status: run.status, result });
      }
      if (route === '/api/owner/tool-cancel') {
        fields(input, ['owner_id', 'id']);
        const state = await readState(root); requireOwner(state, input.owner_id);
        const run = state.integration_runs?.find(r => r.id === input.id && r.owner_id === input.owner_id);
        if (!run || !state.commands.some(c => c.job_id === run.job_id && ['pause', 'cancel'].includes(c.action) && c.status === 'running')) throw new Error('A matching acknowledged pause/cancel command is required.');
        toolTasks.get(run.id)?.controller.abort();
        return send(200, { id: run.id, status: 'cancellation-requested', note: 'Inspect actual processes/containers before confirming stopped.' });
      }
      if (route === '/api/owner/tool-reconcile') {
        fields(input, ['owner_id', 'id', 'note']);
        if (typeof input.note !== 'string' || input.note.trim().length < 10 || input.note.length > 2000) throw new Error('Describe the actual process/container reconciliation.');
        await mutate(state => {
          requireOwner(state, input.owner_id);
          const run = state.integration_runs?.find(r => r.id === input.id && r.owner_id === input.owner_id);
          if (!run || run.status !== 'uncertain' || toolTasks.has(run.id)) throw new Error('Only a conclusively stopped, uncertain invocation can be reconciled.');
          run.reconciliation = { time: stamp(), note: input.note, previous_status: run.status };
          run.status = 'reconciled'; event(state, 'Tool interruption reconciled by the same owner; previous usage and receipts preserved.');
        });
        return send(200, { status: 'reconciled' });
      }
      if (route === '/api/owner/connect') {
        fields(input, ['id', 'runtime']);
        if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(input.id) || input.runtime !== selected.owner) throw new Error('Owner identity/runtime does not match the selected edition.');
        const owner = await mutate(state => {
          if (state.owner && state.owner.id !== input.id) throw new Error('A different owner is registered. Resume the original session; changing owner requires an explicit migration.');
          if (connected(state)) throw new Error('Owner is already connected. Use heartbeat/next instead.');
          for (const command of state.commands) {
            if (command.status === 'pending') command.status = 'expired';
            if (command.status === 'running') command.status = 'uncertain';
          }
          state.owner = { id: input.id, runtime: input.runtime, generation: uid(), connected: true, listening: false };
          touch(state); event(state, 'Owner connected. Local pairing does not prove model access.');
          return { id: state.owner.id, runtime: state.owner.runtime };
        });
        return send(200, owner);
      }
      if (route === '/api/owner/next') {
        fields(input, ['owner_id', 'wait_ms']);
        if (waiting) throw new Error('One owner listener is already active.');
        if (input.wait_ms !== undefined && (!Number.isInteger(input.wait_ms) || input.wait_ms < 0 || input.wait_ms > 55000)) throw new Error('wait_ms must be 0 to 55000.');
        waiting = true;
        try {
          const next = async current => {
            requireOwner(current, input.owner_id);
            for (const c of current.commands.filter(c => c.status === 'pending' && c.action === 'approve-stage')) {
              const j = current.jobs.find(j => j.id === c.job_id);
              if (j?.lifecycle === 2 && ['specification', 'design', 'implementation', 'qa', 'acceptance'].includes(stage(j))) {
                try { await assertWorkspace(root, j, { frozen: ['implementation', 'qa', 'acceptance'].includes(stage(j)) }); }
                catch { c.status = 'blocked'; event(current, 'Stage approval blocked: branch, target or reviewed commit changed.'); }
              }
            }
            const pendingMerge = current.commands.find(c => c.status === 'pending' && c.action === 'approve-merge');
            if (pendingMerge) {
              try { await assertMergeBinding(root, current.jobs.find(j => j.id === pendingMerge.job_id)); }
              catch { pendingMerge.status = 'blocked'; event(current, 'Merge blocked: target or reviewed commit changed.'); }
            }
            return claim(current);
          };
          let command = await mutate(async state => { requireOwner(state, input.owner_id); touch(state); state.owner.listening = true; return next(state); });
          const deadline = Date.now() + (input.wait_ms ?? 50000);
          while (!command && !closing && !res.destroyed && Date.now() < deadline) {
            await delay(300);
            const state = await readState(root);
            if (state.commands.some(c => c.status === 'pending')) command = await mutate(next);
          }
          await mutate(state => { requireOwner(state, input.owner_id); touch(state); state.owner.listening = false; });
          return send(200, { command: command || null });
        } finally { waiting = false; }
      }
      if (route === '/api/owner/heartbeat') {
        fields(input, ['owner_id']);
        await mutate(state => { requireOwner(state, input.owner_id); touch(state); });
        return send(200, { status: 'connected' });
      }
      if (route === '/api/owner/publish') {
        fields(input, ['owner_id', 'update']);
        const result = await mutate(async state => {
          requireOwner(state, input.owner_id); touch(state);
          const job = publish(state, input.update);
          if (job.lifecycle === 2) {
            if (job.status === 'awaiting-stage' && ['specification', 'design', 'implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job))) {
              await assertWorkspace(root, job, { frozen: ['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job)) });
              if (['implementation', 'qa', 'integration', 'acceptance', 'final-merge'].includes(stage(job))) for (const guide of currentUnit(job).documentation) await committedWord(root, guide, currentUnit(job).commit);
            }
            return { status: job.status };
          }
          if (job.status === 'awaiting-merge') await assertMergeBinding(root, job);
          if (job.status === 'merged') {
            const actual = await git(root, ['rev-parse', '--verify', 'refs/heads/' + job.plan.target_branch]);
            if (actual !== job.target_commit) throw new Error('Reported merge target does not match Git.');
            await git(root, ['merge-base', '--is-ancestor', job.commit, job.target_commit]);
            const reviewedTree = await git(root, ['rev-parse', job.commit + '^{tree}']);
            const targetTree = await git(root, ['rev-parse', job.target_commit + '^{tree}']);
            if (reviewedTree !== targetTree) throw new Error('Merged code differs from the reviewed tree.');
            state.checks = state.checks.filter(c => c.id !== 'acceptance');
            state.checks.push({ id: 'acceptance', label: 'Complete app acceptance', status: 'passed',
              detail: 'Reviewed result merged; required post-merge checks recorded for ' + job.target_commit.slice(0, 10) + '.', time: stamp() });
          }
          return { status: job.status };
        });
        return send(200, result);
      }
      if (route === '/api/owner/checks') {
        fields(input, ['owner_id', 'command_id', 'checks']);
        await mutate(state => {
          requireOwner(state, input.owner_id); touch(state);
          const command = state.commands.find(c => c.id === input.command_id && c.status === 'running' && c.action === 'check-live');
          if (!command || !Array.isArray(input.checks)) throw new Error('Checks need a running authorized live-check command.');
          for (const check of input.checks) {
            fields(check, ['id', 'label', 'status', 'detail', 'action', 'evidence']);
            if (!['live', 'continuation', ...(config.edition === 'low-cost' ? ['api-runner'] : [])].includes(check.id) || !['passed', 'needs-action', 'not-checked'].includes(check.status) ||
                typeof check.detail !== 'string' || typeof check.label !== 'string') throw new Error('Provide sanitized real check evidence.');
            if (check.status === 'passed') {
              const evidence = check.evidence;
              const valid = probe => probe && typeof probe.session === 'string' && probe.session.length > 0 &&
                probe.terminal === 'completed' && probe.exit_code === 0 && typeof probe.environment === 'string' && probe.environment.length > 0;
              if (check.id === 'live') {
                const expected = [...new Set(Object.values(config.models).filter(Boolean))];
                if (!Array.isArray(evidence?.probes) || expected.some(model => !evidence.probes.some(p => p.model === model && valid(p)))) throw new Error('Live readiness requires completed exact-model evidence for every configured model.');
              } else if (!valid(evidence) || evidence.model !== config.models[check.id === 'api-runner' ? 'orchestrator' : 'builder'] ||
                (check.id === 'continuation' && evidence.initial_session !== evidence.session) ||
                (check.id === 'api-runner' && !['read', 'search', 'write', 'test', 'git'].every(tool => evidence.tools?.includes(tool)))) {
                throw new Error('Continuation/runner readiness needs real matching session, model, environment and tool evidence.');
              }
            }
            state.check_history ||= []; state.check_history.push({ ...check, time: stamp() });
            state.checks = state.checks.filter(c => c.id !== check.id); state.checks.push({ ...check, time: stamp() });
          }
        });
        return send(200, { status: 'recorded' });
      }
      if (route === '/api/owner/finish') {
        fields(input, ['owner_id', 'result']);
        const result = await mutate(state => { requireOwner(state, input.owner_id); touch(state); return finish(state, input.result); });
        return send(200, { id: result.id, status: result.status });
      }
      if (route === '/api/owner/disconnect') {
        fields(input, ['owner_id']);
        await mutate(state => {
          requireOwner(state, input.owner_id); state.owner.connected = false; state.owner.listening = false;
          for (const command of state.commands) {
            if (command.status === 'pending') command.status = 'expired';
            if (command.status === 'running') command.status = 'uncertain';
          }
          event(state, 'Owner disconnected; pending commands expired.');
        });
        return send(200, { status: 'disconnected' });
      }
      return send(404, { error: 'Not found.' });
    } catch (error) {
      if (!res.headersSent) send(400, { error: error.message.includes('ENOENT') ? 'A required local factory file is unavailable.' : error.message });
    }
  });
  server.requestTimeout = 65000; server.headersTimeout = 10000;
  try {
    await mutate(async state => {
      state.integration_checks = Object.fromEntries(Object.entries(await prerequisites(root, config, toolEnvironment())).map(([id, value]) => [id, { ...value, time: stamp() }]));
      state.integration_profile = Object.entries(integrationSettings(config.integrations)).filter(([, v]) => v.enabled).map(([id]) => id);
      for (const run of state.integration_runs || []) if (run.status === 'running') run.status = 'uncertain';
      for (const job of state.jobs) {
        for (const worker of job.workers || []) if (worker.status === 'running') worker.status = 'uncertain';
        if (job.lifecycle !== 2 && !['merged', 'cancelled'].includes(job.status)) {
          job.needs_migration = true; job.offer = null; job.status = 'blocked'; job.message = 'Adopt the staged workflow to continue. Previous work and approval history are preserved.';
        }
        if (job.lifecycle === 2 && job.documentation_format !== 'docx' && !['merged', 'cancelled'].includes(job.status)) {
          job.documentation_format = 'docx'; job.configuration_changed = true; job.offer = null; job.status = 'blocked';
          currentUnit(job).approved_plan_hash = null;
          job.message = 'Documentation now requires Word .docx guides and rendered-page review. Previous work was preserved. Revise specification or an earlier stage before continuing.';
        }
      }
      if (state.owner) { state.owner.connected = false; state.owner.listening = false; }
      for (const command of state.commands) {
        if (command.status === 'pending') command.status = 'expired';
        if (command.status === 'running') command.status = 'uncertain';
      }
      event(state, 'Dashboard started. Reconnect the existing owner.');
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    origin = 'http://127.0.0.1:' + server.address().port;
    await atomic(await safePath(root, 'factory/.local/connection.json'), { origin, owner_key: ownerKey, browser_key: browserKey, pid: process.pid });
    const close = async () => {
      if (toolTasks.size) throw new Error('Integration tools are running. Pause/cancel and reconcile them before stopping the dashboard.');
      if (closing) return; closing = true;
      await mutation;
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      await mutate(state => { if (state.owner) { state.owner.connected = false; state.owner.listening = false; } });
      await unlink(await safePath(root, 'factory/.local/connection.json')).catch(() => {});
      await lock.close(); await unlink(lockPath);
    };
    return { origin, url: origin + '/#' + browserKey, close };
  } catch (error) {
    server.close(); await lock.close(); await unlink(lockPath); throw error;
  }
}
