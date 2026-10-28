import path from 'node:path';
import { readFile, mkdir, lstat, realpath, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { atomic, digest, exists, json, safePath, stamp } from './storage.mjs';
import { executable, git } from './checks.mjs';
import { currentUnit, stage as lifecycleStage } from './lifecycle.mjs';

export const CATALOG = Object.freeze({
  skills: { name: 'Agent Skills', roles: ['spec-writer', 'builder', 'documentation-writer', 'security', 'ux', 'ui', 'code', 'qa', 'approver'], operations: [], url: 'https://agentskills.io/specification', description: 'Bundled planning, building and review procedures, loaded on demand.' },
  context7: { name: 'Context7', roles: ['spec-writer', 'builder', 'documentation-writer'], operations: ['resolve', 'docs'], env: 'CONTEXT7_API_KEY', url: 'https://context7.com/docs/api-guide', description: 'Focused, version-specific library documentation with a local cache.' },
  graphify: { name: 'Graphify', roles: ['spec-writer', 'builder', 'security', 'code', 'qa'], operations: ['index', 'query'], executable: 'graphify', url: 'https://docs.graphify.com/reference/extract', description: 'Local code-only dependency context. No semantic model or cloud indexing.' },
  twentyfirst: { name: '21st.dev', roles: ['builder', 'ui', 'ux'], operations: ['catalog', 'generate'], env: 'API_KEY_21ST', url: 'https://21st.dev/mcp', description: 'Search UI components and explore approved design variants. No automatic install or publish.' },
  strix: { name: 'Strix', roles: ['security'], operations: ['scan'], executable: 'strix', env: 'LLM_API_KEY', url: 'https://docs.strix.ai/usage/cli', description: 'An optional scoped scan of an approved local/staging URL, with a budget and turn limit.' }
});
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 3000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !v.includes('\0');
function only(value, keys) {
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unknown integration fields.');
}
export function integrationDefaults() {
  return Object.fromEntries(Object.keys(CATALOG).map(id => [id, { enabled: id === 'skills' }]));
}
export function integrationSettings(value) {
  if (value === undefined) return integrationDefaults();
  only(value, Object.keys(CATALOG));
  const result = integrationDefaults();
  for (const [id, settings] of Object.entries(value)) {
    only(settings, ['enabled']);
    if (typeof settings.enabled !== 'boolean' || (id === 'skills' && !settings.enabled)) throw new Error('Invalid integration enabled flag. Bundled skills remain available.');
    result[id] = { enabled: settings.enabled };
  }
  return result;
}
export function integrationScopes(scopes = []) {
  if (!Array.isArray(scopes) || scopes.length > 4) throw new Error('Invalid integration scopes.');
  const seen = new Set();
  for (const scope of scopes) {
    only(scope, ['tool', 'operations', 'max_calls', 'targets', 'max_usd', 'max_turns', 'model']);
    const tool = CATALOG[scope.tool];
    if (!tool || scope.tool === 'skills' || seen.has(scope.tool) || !Array.isArray(scope.operations) || !scope.operations.length ||
        new Set(scope.operations).size !== scope.operations.length || !scope.operations.every(op => tool.operations.includes(op)) ||
        !Number.isSafeInteger(scope.max_calls) || scope.max_calls < 1 || scope.max_calls > 50) throw new Error('An integration scope needs unique supported operations and 1–50 calls.');
    seen.add(scope.tool);
    if (scope.tool === 'strix') {
      if (!Array.isArray(scope.targets) || !scope.targets.length || scope.targets.length > 5 ||
          !scope.targets.every(validTarget) || !Number.isFinite(scope.max_usd) || scope.max_usd <= 0 ||
          !Number.isSafeInteger(scope.max_turns) || scope.max_turns < 1 || scope.max_turns > 100 ||
          typeof scope.model !== 'string' || !/^[a-z0-9_-]+\/[A-Za-z0-9_.:-]{1,150}$/.test(scope.model)) throw new Error('Strix requires target URLs, an explicit model, a positive USD budget and 1–100 turns.');
    } else if (scope.targets !== undefined || scope.max_turns !== undefined || scope.max_usd !== undefined || scope.model !== undefined) throw new Error('Unexpected scan settings.');
  }
  return scopes;
}
function validTarget(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.hash && !u.search && Boolean(u.hostname) && value === u.href; } catch { return false; }
}
export function roleContext(config, role) {
  if (!Object.hasOwn(config.roles, role)) throw new Error('Unknown factory role.');
  const skill = role === 'spec-writer' ? 'planning' : ['builder', 'documentation-writer'].includes(role) ? 'building' : role === 'orchestrator' ? null : 'reviewing';
  return { role, runtime: config.roles[role], model: config.models[role],
    purpose: config.purpose || 'software', workflow: 'factory/runtime/WORKFLOW.md',
    skill: skill ? 'factory/runtime/skills/' + skill + '/SKILL.md' : null,
    tools: Object.entries(CATALOG).filter(([id, item]) => id !== 'skills' && integrationSettings(config.integrations)[id].enabled && item.roles.includes(role)).map(([id, item]) => ({ id, operations: item.operations })) };
}
export async function prerequisites(root, config, environment = process.env) {
  const settings = integrationSettings(config.integrations), result = {};
  for (const [id, item] of Object.entries(CATALOG)) {
    if (!settings[id].enabled) { result[id] = { status: 'disabled', detail: 'Not enabled for this project.', action: 'Enable only if this project needs it.' }; continue; }
    if (id === 'skills') { result[id] = { status: 'bundled', detail: 'Three shared task skills. The existing owner and ten roles are unchanged.', action: '' }; continue; }
    const binary = item.executable ? await executable(item.executable, environment) : null;
    const secret = item.env ? environment[item.env] : null;
    let detail = 'Prerequisites found; a real call is still unverified.', action = 'Use an approved task to verify the connection.';
    let status = 'available';
    if (item.executable && !binary) { status = 'needs-action'; detail = item.executable + ' is not on PATH.'; action = 'Install a reviewed version using the linked official guide, then recheck.'; }
    if (binary && /\.(cmd|bat|ps1)$/i.test(binary)) { status = 'needs-action'; detail = 'A native ' + item.executable + ' executable is required; shell wrappers are not launched automatically.'; }
    if (item.env && !secret) { status = 'needs-action'; detail = 'The integration API key is not configured.'; action = 'Save its API key below, or set ' + item.env + ' in the server environment.'; }
    if (id === 'strix') {
      if (!await executable('docker', environment)) { status = 'needs-action'; detail = 'Docker is not on PATH.'; }
      const model = environment.STRIX_LLM || '';
      const prefixes = config.edition === 'claude-only' ? ['anthropic/'] : config.edition === 'low-cost' ? ['deepseek/', 'moonshot/', 'qwen/', 'dashscope/'] : ['anthropic/', 'openai/'];
      if (!prefixes.some(prefix => model.startsWith(prefix))) { status = 'needs-action'; detail = 'STRIX_LLM must explicitly select a provider from this edition.'; }
      action = 'Use the official setup guide and an approved URL/budget. No default scanner model is selected.';
    }
    const binaryStat = binary ? await stat(binary).catch(() => null) : null;
    result[id] = { status, detail, action, binding: digest(JSON.stringify({ edition: config.edition, settings: settings[id], binary,
      binary_size: binaryStat?.size, binary_mtime: binaryStat?.mtimeMs, secret: secret ? digest(secret) : null, model: id === 'strix' ? environment.STRIX_LLM : null })) };
  }
  return result;
}
export function integrationView(state, config) {
  const settings = integrationSettings(config.integrations);
  return Object.entries(CATALOG).map(([id, item]) => {
    const local = state.integration_checks?.[id], runs = (state.integration_runs || []).filter(r => r.tool === id);
    const last = [...runs].reverse().find(r => r.status === 'completed' && r.connection_binding === local?.binding && !(id === 'context7' && r.cache_hit));
    const verified = last && Date.now() - Date.parse(last.finished_at) < 3600000;
    return { id, name: item.name, description: item.description, url: item.url, enabled: settings[id].enabled,
      status: !settings[id].enabled ? 'disabled' : id === 'skills' ? 'bundled' : local?.status === 'needs-action' ? 'needs-action' : verified ? 'verified' : local?.status || 'not-checked',
      detail: local?.detail || 'Local prerequisites have not been checked.', action: local?.action || 'Recheck local prerequisites.',
      last_checked: local?.time || null, last_verified: verified ? last.finished_at : null,
      roles: item.roles, calls: runs.filter(r => r.external_calls > 0).reduce((n, r) => n + r.external_calls, 0),
      cache_hits: runs.filter(r => r.cache_hit).length,
      calls_complete: runs.every(r => Number.isFinite(r.external_calls)),
      usd: runs.length && runs.every(r => Number.isFinite(r.usd)) ? runs.reduce((n, r) => n + r.usd, 0) : null,
      latest: runs.slice(-8).reverse().map(r => ({ id: r.id, job_id: r.job_id, operation: r.operation, status: r.status, commit: r.source_commit || r.commit, duration_ms: r.duration_ms ?? null, cache_hit: Boolean(r.cache_hit), time: r.finished_at || r.started_at })) };
  });
}
export function reserveRun(state, config, request) {
  only(request, ['id', 'command_id', 'job_id', 'tool', 'operation', 'role', 'parameters']);
  if (!text(request.id, 80) || !/^[A-Za-z0-9_-]+$/.test(request.id)) throw new Error('Tool invocation needs a stable id.');
  const hash = digest(JSON.stringify(request));
  state.integration_runs ||= [];
  const previous = state.integration_runs.find(r => r.id === request.id);
  if (previous) { if (previous.hash !== hash) throw new Error('Tool invocation id conflict.'); return { duplicate: true, run: previous }; }
  const tool = CATALOG[request.tool];
  if (!tool || request.tool === 'skills' || !tool.operations.includes(request.operation) || !tool.roles.includes(request.role)) throw new Error('This tool/operation is unavailable to that role.');
  if (!integrationSettings(config.integrations)[request.tool].enabled) throw new Error('Integration is disabled.');
  const command = state.commands.find(c => c.id === request.command_id && c.status === 'running' && c.owner_id === state.owner?.id && c.owner_generation === state.owner?.generation);
  const job = state.jobs.find(j => j.id === request.job_id);
  if (command?.recovered_for === 'publication-only') throw new Error('Publication recovery cannot dispatch new tool invocations.');
  if (!command || !job || command.job_id !== job.id || !['request', 'approve-plan', 'approve-stage', 'start-feature', 'start-acceptance', 'migrate-workflow', 'revise', 'revise-product', 'rework', 'resume'].includes(command.action)) throw new Error('A running scoped owner command is required.');
  if (!['planning', 'running', 'reviewing'].includes(job.status)) throw new Error('Tool calls are unavailable at this stage.');
  const u = job.lifecycle === 2 ? currentUnit(job) : job;
  const early = job.lifecycle === 2 ? ['feasibility', 'requirements', 'specification'].includes(lifecycleStage(job)) : job.status === 'planning';
  if (early && request.role !== 'spec-writer') throw new Error('Only the spec writer can use tools while planning.');
  if (job.lifecycle === 2 && request.tool === 'strix' && !['qa', 'acceptance'].includes(lifecycleStage(job))) throw new Error('Scanner calls require the authorized QA stage.');
  const scope = early && request.tool === 'context7' && job.planning_docs_consent ?
    { tool: 'context7', operations: ['resolve', 'docs'], max_calls: 10 } :
    u.approved_plan_hash === digest(JSON.stringify(u.plan)) ? integrationScopes(u.plan?.integrations).find(s => s.tool === request.tool) : null;
  if (!scope?.operations.includes(request.operation)) throw new Error('This integration operation needs explicit scope in the approved plan (or planning documentation consent).');
  const used = state.integration_runs.filter(r => r.job_id === job.id && r.tool === request.tool);
  if (used.some(r => ['running', 'uncertain'].includes(r.status))) throw new Error('Reconcile the outstanding tool invocation before another call.');
  if (used.length >= scope.max_calls) throw new Error('Approved integration call limit reached. Revise the plan before more calls.');
  const run = { id: request.id, hash, tool: request.tool, operation: request.operation, role: request.role, command_id: command.id,
    job_id: job.id, owner_id: state.owner.id, status: 'running', started_at: stamp(), commit: u.commit || u.plan?.base_commit || null,
    plan_hash: u.approved_plan_hash || null, stage: job.status, scope: structuredClone(scope), parameters: structuredClone(request.parameters || {}),
    external_calls: 0, usd: request.tool === 'graphify' ? 0 : null };
  state.integration_runs.push(run); return { duplicate: false, run };
}

// Small, bounded adapters. No shell evaluation, package installs, source uploads or publish endpoints.
async function limited(response, max = 1024 * 1024) {
  if (!response.body) throw new Error('Empty integration response.');
  const reader = response.body.getReader(), chunks = []; let count = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; count += value.length; if (count > max) throw new Error('Integration response exceeds the limit.'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString('utf8');
}
async function getJson(url, key, fetcher) {
  let response;
  try { response = await fetcher(url, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
  catch (error) { error.uncertain = true; throw error; }
  if (response.status !== 200) { await response.body?.cancel(); throw new Error('Integration HTTP ' + response.status + '. No automatic retry.'); }
  try { return JSON.parse(await limited(response)); }
  catch (error) { error.uncertain = true; throw error; }
}
async function rpcEnvelope(response, id) {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return JSON.parse(await limited(response));
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', bytes = 0;
  const event = block => {
    const value = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
    if (!value) return null; const message = JSON.parse(value); return message.id === id ? message : null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { const message = event(buffer); if (message) return message; throw new Error('MCP stream ended without a matching result.'); }
      bytes += value.length; if (bytes > 1024 * 1024) throw new Error('MCP response exceeds the limit.');
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
        const message = event(block); if (message) return message;
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
}
async function context7(root, run, environment, fetcher) {
  const p = run.parameters;
  only(p, run.operation === 'resolve' ? ['library', 'query'] : ['library_id', 'version', 'query', 'language']);
  if (!text(p.query) || (run.operation === 'resolve' ? !text(p.library, 150) : !text(p.library_id, 300) || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+$/.test(p.library_id) || !text(p.version, 100) || !/^[A-Za-z0-9_.+-]+$/.test(p.version))) throw new Error('Use a focused query, library id and explicit installed version.');
  if (p.query.includes(environment.CONTEXT7_API_KEY || '\0')) throw new Error('Do not send credentials in documentation queries.');
  const cacheName = 'factory/.local/integrations/context7/' + digest(JSON.stringify(p) + run.operation + digest(environment.CONTEXT7_API_KEY || '')) + '.json';
  const cached = await json(await safePath(root, cacheName), null);
  if (cached && Date.now() - Date.parse(cached.time) < 24 * 3600000) return { data: cached.data, cache_hit: true, external_calls: 0, requested_version: p.version || null };
  const url = new URL(run.operation === 'resolve' ? 'https://context7.com/api/v2/libs/search' : 'https://context7.com/api/v2/context');
  url.searchParams.set('query', p.query);
  if (run.operation === 'resolve') url.searchParams.set('libraryName', p.library);
  else { url.searchParams.set('libraryId', p.library_id + '@' + p.version); url.searchParams.set('type', 'json'); if (p.language) { if (!text(p.language, 50)) throw new Error('Invalid language.'); url.searchParams.set('language', p.language); } }
  const data = await getJson(url, environment.CONTEXT7_API_KEY, fetcher);
  await atomic(await safePath(root, cacheName), { time: stamp(), data });
  return { data, cache_hit: false, external_calls: 1, requested_version: p.version || null };
}
export async function native(file, args, options = {}) {
  if (!path.isAbsolute(file) || /\.(cmd|bat|ps1)$/i.test(file)) throw new Error('A native executable is required; automatic shell wrappers are not executed.');
  return new Promise(resolve => execFile(file, args, { windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
    resolve({ exit_code: error ? typeof error.code === 'number' ? error.code : null : 0, uncertain: Boolean(error?.killed || error?.code === 'ETIMEDOUT' || (error && options.signal?.aborted)), stdout: stdout || '', stderr: stderr || '' });
  }));
}

const CODE = /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|kts|c|cc|cpp|h|hpp|cs|rb|php|swift|scala|sql|tf|vue|svelte|css|scss)$/i;
async function codeSnapshot(root, source) {
  const directory = source === '.' || source === undefined ? await realpath(root) : await safePath(root, source);
  const actual = await git(directory, ['rev-parse', '--show-toplevel']);
  if (path.resolve(actual).toLowerCase() !== path.resolve(directory).toLowerCase()) throw new Error('Index an actual application/worktree Git root.');
  const names = (await git(directory, ['ls-files', '-c', '-o', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
  const files = []; let bytes = 0;
  for (const name of [...new Set(names)].sort()) {
    if (!CODE.test(name) || name.split('/').some(p => p.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build'].includes(p))) continue;
    const file = await safePath(directory, name);
    if (!await exists(file)) continue;
    if (!(await lstat(file)).isFile()) continue;
    const data = await readFile(file); bytes += data.length;
    if (bytes > 20 * 1024 * 1024 || files.length >= 5000) throw new Error('Graph snapshot exceeds the local limit. Use focused source search for this repository.');
    files.push({ name, data, hash: digest(data) });
  }
  if (!files.length) throw new Error('No supported code files found; use source search instead.');
  const tracked = new Set((await git(directory, ['ls-files', '-c', '-z'])).split('\0').filter(Boolean));
  const changed = (await git(directory, ['diff', '--name-only', '-z', 'HEAD'])).split('\0').filter(Boolean);
  return { directory, files, bytes, dirty: changed.some(name => CODE.test(name)) || files.some(f => !tracked.has(f.name)), commit: await git(directory, ['rev-parse', 'HEAD']),
    hash: digest(JSON.stringify(files.map(f => [f.name, f.hash]))) };
}
function cleanEnvironment(environment) {
  const allowed = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'LANG'];
  return Object.fromEntries(allowed.filter(k => environment[k] !== undefined).map(k => [k, environment[k]]));
}
async function graphify(root, run, environment, execute) {
  only(run.parameters, run.operation === 'index' ? ['source'] : ['source', 'query']);
  if (run.operation === 'query' && !text(run.parameters.query)) throw new Error('A focused graph question is required.');
  const binary = await executable('graphify', environment);
  if (!binary) throw new Error('Graphify is not installed.');
  const env = { ...cleanEnvironment(environment), GRAPHIFY_QUERY_LOG_DISABLE: '1', GRAPHIFY_MAX_RETRIES: '0' };
  const version = await execute(binary, ['--version'], { env, timeout: 10000 });
  if (version.exit_code !== 0 || !text(version.stdout, 1000)) throw new Error('Cannot verify the installed Graphify version.');
  const snapshot = await codeSnapshot(root, run.parameters.source);
  if (run.stage === 'reviewing' && (snapshot.commit !== run.commit || snapshot.dirty)) throw new Error('Review graph must match the frozen clean commit/worktree.');
  const key = digest(snapshot.directory + snapshot.hash + version.stdout);
  const relative = 'factory/.local/integrations/graphify/' + key;
  const metadataFile = await safePath(root, relative + '/index.json');
  const graphFile = await safePath(root, relative + '/output/graph.json');
  let metadata = await json(metadataFile, null), index_hit = false;
  if (metadata && await exists(graphFile) && metadata.graph_hash === digest(await readFile(graphFile))) index_hit = true;
  else {
    const help = await execute(binary, ['extract', '--help'], { env, timeout: 10000 });
    if (help.exit_code !== 0 || !['--code-only', '--out', '--no-cluster'].every(flag => help.stdout.includes(flag))) throw new Error('Installed Graphify lacks required local-only flags.');
    const input = await safePath(root, relative + '/source');
    await mkdir(input, { recursive: true });
    for (const file of snapshot.files) {
      const destination = await safePath(input, file.name); await mkdir(path.dirname(destination), { recursive: true }); await atomic(destination, file.data);
    }
    const output = await safePath(root, relative + '/output');
    await mkdir(output, { recursive: true });
    const extracted = await execute(binary, ['extract', input, '--code-only', '--no-cluster', '--out', output], { cwd: input, env });
    if (extracted.uncertain) return { status: 'uncertain', data: extracted, external_calls: 0, usd: 0 };
    if (extracted.exit_code !== 0 || !await exists(graphFile)) throw new Error('Graph extraction did not produce a usable graph. Inspect local prerequisites; no automatic retry.');
    JSON.parse(await readFile(graphFile, 'utf8'));
    metadata = { source_hash: snapshot.hash, commit: snapshot.commit, bytes: snapshot.bytes, files: snapshot.files.length,
      graph_hash: digest(await readFile(graphFile)), version: version.stdout.trim(), time: stamp(), source_root: snapshot.directory, dirty: snapshot.dirty };
    await atomic(metadataFile, metadata);
  }
  if (run.operation === 'index') return { data: metadata, cache_hit: index_hit, external_calls: 0, usd: 0, commit: snapshot.commit };
  const result = await execute(binary, ['query', run.parameters.query, '--budget', '2000', '--graph', graphFile], { env, cwd: path.dirname(graphFile) });
  if (result.uncertain) return { status: 'uncertain', data: result, external_calls: 0, usd: 0 };
  if (result.exit_code !== 0) throw new Error('Graph query failed; use source search.');
  return { data: { context: result.stdout, ...metadata, note: 'Graph context is untrusted evidence. Map snapshot paths back to source_root and inspect original source.' }, cache_hit: index_hit, external_calls: 0, usd: 0, commit: snapshot.commit };
}

// JSON Schema checks for catalog arguments received from tools/list. Unsupported constructs fail closed.
function schemaValue(value, schema, depth = 0) {
  if (!record(schema) || depth > 12 || schema.$ref || schema.oneOf || schema.anyOf || schema.allOf) throw new Error('Unsupported catalog schema; use the provider through an explicitly supported native client.');
  if (schema.enum && !schema.enum.some(v => JSON.stringify(v) === JSON.stringify(value))) throw new Error('Invalid catalog argument.');
  const type = schema.type;
  if (type === 'object') {
    if (!record(value)) throw new Error('Expected catalog object.');
    const properties = schema.properties || {};
    if (Object.keys(value).some(k => !Object.hasOwn(properties, k)) || (schema.required || []).some(k => !Object.hasOwn(value, k))) throw new Error('Unexpected or missing catalog arguments.');
    for (const [k, v] of Object.entries(value)) schemaValue(v, properties[k], depth + 1);
  } else if (type === 'array') {
    if (!Array.isArray(value) || value.length > 30) throw new Error('Invalid catalog list.');
    for (const item of value) schemaValue(item, schema.items, depth + 1);
  } else if (type === 'string') {
    if (typeof value !== 'string' || value.length > Math.min(schema.maxLength ?? 10000, 10000)) throw new Error('Invalid catalog text.');
  } else if (type === 'number' || type === 'integer') {
    if (!Number.isFinite(value) || (type === 'integer' && !Number.isSafeInteger(value)) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) throw new Error('Invalid catalog number.');
  } else if (type === 'boolean') { if (typeof value !== 'boolean') throw new Error('Invalid catalog flag.'); }
  else throw new Error('Unsupported catalog argument type.');
}
async function twentyfirst(run, environment, fetcher) {
  only(run.parameters, ['tool', 'arguments']);
  const permitted = run.operation === 'generate' ? ['generate'] : ['discover', 'search', 'get_inspiration', 'get_component', 'search_components', 'get_component_details'];
  if (!permitted.includes(run.parameters.tool)) throw new Error('Only scoped catalog/generate tools are supported. Install, publish and account changes are unavailable.');
  let session, protocol = '2025-03-26', seq = 0, calls = 0;
  const rpc = async (method, params, notification = false) => {
    calls++;
    let response;
    try { response = await fetcher('https://21st.dev/api/mcp', {
      method: 'POST', headers: { Authorization: 'Bearer ' + environment.API_KEY_21ST, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(seq > 0 ? { 'MCP-Protocol-Version': protocol } : {}), ...(session ? { 'Mcp-Session-Id': session } : {}) },
      redirect: 'error', signal: AbortSignal.timeout(30000), body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++seq }), method, params })
    }); } catch (error) { error.uncertain = true; throw error; }
    if (response.status < 200 || response.status >= 300) { await response.body?.cancel(); throw new Error('21st.dev HTTP ' + response.status + '. No automatic retry.'); }
    session = response.headers.get('mcp-session-id') || session;
    if (notification) { await response.body?.cancel(); return; }
    let data;
    try { data = await rpcEnvelope(response, seq); }
    catch (error) { error.uncertain = true; throw error; }
    if (!data || data.id !== seq || data.error || !data.result) throw new Error('21st.dev returned an unsupported/error tool response.');
    return data.result;
  };
  const init = await rpc('initialize', { protocolVersion: protocol, capabilities: {}, clientInfo: { name: 'software-factory', version: '1.1.0' } });
  if (!['2025-03-26', '2025-06-18', '2025-11-25'].includes(init.protocolVersion)) throw new Error('Unsupported MCP protocol.');
  protocol = init.protocolVersion;
  await rpc('notifications/initialized', {}, true);
  const tools = await rpc('tools/list', {});
  if (run.parameters.tool === 'discover') return { data: { tools: (tools.tools || []).filter(t => permitted.includes(t.name) && t.name !== 'discover').map(t => ({ name: t.name, description: typeof t.description === 'string' ? t.description.slice(0, 1000) : '', inputSchema: t.inputSchema })) }, external_calls: calls, usd: null };
  const selected = tools.tools?.find(t => t.name === run.parameters.tool);
  if (!selected) throw new Error('Requested 21st.dev tool is not offered by the current server.');
  schemaValue(run.parameters.arguments, selected.inputSchema);
  const data = await rpc('tools/call', { name: selected.name, arguments: run.parameters.arguments });
  if (data.isError) throw new Error('21st.dev tool reported failure.');
  return { data, external_calls: calls, usd: null };
}
async function strix(root, run, environment, execute) {
  only(run.parameters, ['target']);
  if (!validTarget(run.parameters.target) || !run.scope.targets.includes(run.parameters.target)) throw new Error('Scanner target is outside the approved URL allowlist.');
  if (environment.STRIX_LLM !== run.scope.model) throw new Error('Scanner model differs from the approved plan.');
  const binary = await executable('strix', environment);
  if (!binary) throw new Error('Strix is not installed.');
  const directory = await safePath(root, 'factory/.local/integrations/strix/' + run.id);
  await mkdir(directory, { recursive: true });
  const env = { ...cleanEnvironment(environment), HOME: directory, USERPROFILE: directory,
    STRIX_LLM: environment.STRIX_LLM, LLM_API_KEY: environment.LLM_API_KEY };
  const help = await execute(binary, ['--help'], { env: cleanEnvironment(environment), timeout: 10000 });
  if (help.exit_code !== 0 || !['--max-budget', '--max-turns', '--config', '--non-interactive'].every(flag => help.stdout.includes(flag))) throw new Error('Installed Strix lacks required scope/budget flags.');
  const result = await execute(binary, ['--non-interactive', '--target', run.parameters.target, '--scan-mode', 'quick',
    '--max-budget', String(run.scope.max_usd), '--max-turns', String(run.scope.max_turns), '--config', path.join(directory, 'config.json'),
    '--instruction', 'Assess only the explicitly approved target URL. Do not modify application source, publish changes, or test other hosts. Report findings and stop at the approved scope/budget.'],
  { cwd: directory, env, timeout: 300000 });
  return { status: result.uncertain ? 'uncertain' : [0, 2].includes(result.exit_code) ? 'completed' : 'failed',
    data: { ...result, note: 'Process exit is not a security PASS. The security reviewer must inspect scan completion, findings and budget-stop evidence.' },
    external_calls: null, usd: null };
}
export async function executeIntegration(root, config, run, { environment = process.env, fetcher = fetch, execute = native, signal } = {}) {
  const local = await prerequisites(root, config, environment);
  if (local[run.tool]?.status !== 'available') throw new Error(local[run.tool]?.detail || 'Integration is unavailable.');
  const request = (url, options = {}) => fetcher(url, { ...options, signal: signal ? AbortSignal.any([signal, ...(options.signal ? [options.signal] : [])]) : options.signal });
  const command = (file, args, options = {}) => execute(file, args, { ...options, ...(signal ? { signal } : {}) });
  let result;
  if (run.tool === 'context7') result = await context7(root, run, environment, request);
  else if (run.tool === 'graphify') result = await graphify(root, run, environment, command);
  else if (run.tool === 'twentyfirst') result = await twentyfirst(run, environment, request);
  else if (run.tool === 'strix') result = await strix(root, run, environment, command);
  else throw new Error('Unsupported integration.');
  return { status: 'completed', ...result, connection_binding: local[run.tool].binding };
}
export function performance(state) {
  const jobs = state.jobs.filter(j => j.status === 'merged');
  const number = values => values.length ? values.reduce((n, v) => n + v, 0) : null;
  const cohorts = new Map();
  for (const job of jobs) {
    const tools = [...new Set((state.integration_runs || []).filter(r => r.job_id === job.id).map(r => r.tool))].sort();
    const key = tools.join(',');
    if (!cohorts.has(key)) cohorts.set(key, { tools, jobs: [] });
    cohorts.get(key).jobs.push(job);
  }
  return { completed_jobs: jobs.length,
    measured_tokens: number(jobs.map(j => j.usage?.tokens).filter(Number.isFinite)),
    known_usd: number(jobs.map(j => j.usage?.usd).filter(Number.isFinite)),
    usage_complete: jobs.length > 0 && jobs.every(j => j.usage?.completeness === 'complete'),
    elapsed_ms: number(jobs.map(j => Date.parse(j.updated_at) - Date.parse(j.created_at)).filter(v => Number.isFinite(v) && v >= 0)),
    rework_requests: state.commands.filter(c => c.action === 'rework' && c.status === 'completed').length,
    defects: null,
    cohorts: [...cohorts.values()].map(group => {
      const durations = group.jobs.map(j => Date.parse(j.updated_at) - Date.parse(j.created_at)).filter(v => Number.isFinite(v) && v >= 0);
      const tokens = group.jobs.map(j => j.usage?.tokens).filter(Number.isFinite);
      return { tools: group.tools, jobs: group.jobs.length, average_elapsed_ms: durations.length ? number(durations) / durations.length : null,
        average_known_tokens: tokens.length ? number(tokens) / tokens.length : null, token_samples: tokens.length };
    }) };
}
