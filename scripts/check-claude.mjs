#!/usr/bin/env node
// Read-only evidence collector. Never publishes factory state or raw transcripts.
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export function execute(file, args, { cwd, input = '', timeout = 120000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(file, args, { cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', done = false;
    const finish = code => { if (done) return; done = true; clearTimeout(timer); resolve({ code, stdout, stderr }); };
    const timer = setTimeout(() => { child.kill(); finish('TIMEOUT'); }, timeout);
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => finish(error.code || 'ERROR'));
    child.once('close', code => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function claudeCommand() {
  if (process.platform !== 'win32') return ['claude', []];
  const result = await execute('where.exe', ['claude'], { timeout: 10000 });
  const files = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  const exe = files.find(file => /\.exe$/i.test(file));
  if (exe) return [exe, []];
  const shim = files.find(file => /\.cmd$/i.test(file));
  if (shim) {
    const cli = path.join(path.dirname(shim), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    try { await access(cli); return [process.execPath, [cli]]; } catch {}
  }
  throw new Error('CLI_NOT_FOUND');
}

export function errorCategory(text = '', code) {
  if (code === 'TIMEOUT') return 'timeout';
  if (code === 'ENOENT' || text === 'CLI_NOT_FOUND') return 'installation';
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return 'dns';
  if (/CERT_|certificate|SSL|TLS/i.test(text)) return 'tls';
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(text)) return 'connection';
  if (/\b401\b|unauthenticated|invalid api key|not logged in/i.test(text)) return 'authentication';
  if (/\b429\b|rate limit/i.test(text)) return 'rate-limit';
  if (/unknown model|model.*not found/i.test(text)) return 'model-access';
  if (/\b403\b|permission denied|access denied/i.test(text)) return 'access-denied';
  return 'unknown';
}

export function summarize(result, model) {
  const passed = result.status === 'complete' && result.exit_code === 0 &&
    result.actual_model === model && result.session_matches === true;
  return {
    status: passed ? 'PASS' : 'BLOCKED', requested_model: model,
    actual_model: result.actual_model ?? null, exit_code: result.exit_code ?? null,
    session_matches: result.session_matches ?? null,
    error_category: passed ? null : result.actual_model && result.actual_model !== model
      ? 'model-mismatch' : errorCategory(result.private_error, result.exit_code),
    retry_count: result.retry_events?.length ?? 0,
    // Missing counters remain null. Retry events are not additional usage totals.
    usage: Object.fromEntries(['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
      .map(key => [key, result.usage?.[key] ?? null])),
    reported_api_equivalent_usd: result.reported_api_equivalent_usd ?? null
  };
}

export function fromStream(response, session) {
  const events = response.stdout.split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const terminal = events.filter(event => event.type === 'result').at(-1);
  const models = [...new Set(events.filter(event => event.type === 'assistant' && !event.parent_tool_use_id)
    .map(event => event.message?.model).filter(Boolean))];
  const init = events.find(event => event.type === 'system' && event.subtype === 'init');
  return {
    status: terminal && !terminal.is_error && response.code === 0 ? 'complete' : 'blocked',
    actual_model: models.length === 1 ? models[0] : models.length ? models.join(',') : null,
    session_matches: (terminal?.session_id ?? init?.session_id) === session,
    exit_code: response.code, usage: terminal?.usage,
    reported_api_equivalent_usd: terminal?.total_cost_usd,
    retry_events: events.filter(event => event.type === 'system' && event.subtype === 'api_retry'),
    private_error: [response.stderr, ...events.filter(event => event.type === 'system' && event.subtype === 'api_retry')
      .map(event => [event.error, event.error_status].filter(Boolean).join(' ')), ...(terminal?.errors ?? []),
      terminal?.is_error ? terminal.result : ''].join('\n')
  };
}

export function options(args) {
  const result = { live: false, model: 'claude-opus-5-5', cwd: process.cwd(), label: 'unspecified' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--live') result.live = true;
    else if (args[i] === '--help') result.help = true;
    else if (['--model', '--cwd', '--adapter', '--label'].includes(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('Missing option value');
      result[args[i].slice(2)] = args[++i];
    } else throw Error('Unknown option');
  }
  if (result.adapter && !result.live) throw Error('--adapter requires --live');
  result.cwd = path.resolve(result.cwd);
  return result;
}

async function main() {
  const config = options(process.argv.slice(2));
  if (config.help) { console.log('check-claude [--live] [--model ID] [--cwd PROJECT] [--adapter provider.mjs] [--label ENVIRONMENT]\nDefault: local version/auth only. --live consumes provider usage. Never writes factory state.'); return; }
  const base = { checked_at: new Date().toISOString(), environment_label: config.label, cwd: config.cwd,
    mode: config.live ? config.adapter ? 'adapter' : 'cli' : 'local-only' };
  let report;
  if (config.live) {
    let result;
    if (config.adapter) {
      const adapter = await import(pathToFileURL(path.resolve(config.adapter)).href);
      if (typeof adapter.launchClaude !== 'function') throw Error('ADAPTER_INTERFACE');
      result = await adapter.launchClaude({ role: 'spec-writer', model: config.model, name: 'connection-check',
        check: true, cwd: config.cwd, prompt: 'Reply only OK. Do not use tools.', timeout: 120000 });
    } else {
      const [file, prefix] = await claudeCommand(), session = randomUUID();
      const response = await execute(file, [...prefix, '--print', '--model', config.model, '--output-format',
        'stream-json', '--verbose', '--permission-prompts', 'none', '--tools', '', '--session-id', session,
        '--name', 'connection-check'], { cwd: config.cwd, input: 'Reply only OK. Do not use tools.' });
      result = fromStream(response, session);
    }
    report = { ...base, ...summarize(result, config.model) };
  } else {
    const [file, prefix] = await claudeCommand();
    const version = await execute(file, [...prefix, '--version'], { cwd: config.cwd, timeout: 20000 });
    const auth = await execute(file, [...prefix, 'auth', 'status'], { cwd: config.cwd, timeout: 20000 });
    let loggedIn = null; try { loggedIn = JSON.parse(auth.stdout).loggedIn === true; } catch {}
    report = { ...base, status: version.code === 0 && loggedIn === true ? 'LOCAL_READY' : 'BLOCKED',
      version: version.stdout.match(/\b\d+\.\d+\.\d+\b/)?.[0] ?? null, logged_in: loggedIn,
      live_access: 'unchecked' };
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'BLOCKED') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.log(JSON.stringify({ status: 'BLOCKED', error_category: errorCategory(error.message, error.code),
    next_step: 'Check CLI installation, options, adapter export, and scoped runtime access. No raw errors or credentials are printed.' }, null, 2)); process.exitCode = 1; });
