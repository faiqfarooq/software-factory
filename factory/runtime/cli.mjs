import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { serve } from './server.mjs';
import { json, readConfig, safePath, readState, locked, saveState, event } from './storage.mjs';
import { inspect } from './checks.mjs';
import { roleContext, integrationView } from './integrations.mjs';

export function options(args) {
  const positionals = [], flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const name = args[i].slice(2);
      if (!/^[a-z][a-z-]*$/.test(name) || Object.hasOwn(flags, name)) throw new Error('Invalid or duplicate option.');
      flags[name] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    } else positionals.push(args[i]);
  }
  return { positionals, flags };
}
export async function ownerCall(root, operation, input) {
  const connection = await json(await safePath(root, 'factory/.local/connection.json'));
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(connection.origin)) throw new Error('Invalid owner connection address.');
  const response = await fetch(connection.origin + '/api/owner/' + operation, {
    method: 'POST', headers: { Authorization: 'Bearer ' + connection.owner_key, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(65000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Owner command failed.');
  return result;
}
export async function openBrowser(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/#(?:[a-f0-9]{64})$/.test(url)) throw new Error('Refusing an invalid dashboard URL.');
  const [file, args] = process.platform === 'win32' ? ['powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', "Start-Process -WindowStyle Hidden -FilePath '" + url + "'"]] :
    process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  await new Promise((resolve, reject) => execFile(file, args, { timeout: 10000, windowsHide: true }, error => error ? reject(error) : resolve()));
}
export async function main(args = process.argv.slice(2)) {
  const { positionals: words, flags } = options(args);
  const root = path.resolve(typeof flags.project === 'string' ? flags.project : process.cwd());
  const allowed = words[0] === 'start' ? ['project', 'port', 'no-open'] : words[0] === 'owner' ? ['project', 'session', 'runtime', 'wait', 'file'] : words[0] === 'role-context' ? ['project', 'role'] : ['project'];
  if (Object.keys(flags).some(k => !allowed.includes(k))) throw new Error('Unknown option for this operation.');
  if (words[0] === 'start') {
    if (flags.port !== undefined && (!/^\d+$/.test(String(flags.port)) || Number(flags.port) > 65535)) throw new Error('Invalid dashboard port.');
    const server = await serve(root, { port: flags.port === undefined ? 0 : Number(flags.port) });
    console.log('Dashboard: ' + server.url + '\nKeep this process running. Pairing links are private.');
    if (!flags['no-open']) await openBrowser(server.url).catch(() => console.log('Open the printed link in your browser.'));
    const stop = async () => { try { await server.close(); process.exit(0); } catch (error) { console.error(error.message); } };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return server;
  }
  if (words[0] === 'check') {
    const config = await readConfig(root), report = await inspect(root, config.edition);
    await locked(root, async () => {
      const state = await readState(root);
      for (const check of report.checks) if (!['live', 'continuation', 'browser', 'acceptance'].includes(check.id) || !state.checks.some(c => c.id === check.id)) {
        state.checks = state.checks.filter(c => c.id !== check.id); state.checks.push(check);
      }
      event(state, 'Local prerequisites checked. No model calls.'); await saveState(root, state);
    });
    console.log(JSON.stringify(report, null, 2)); return report;
  }
  if (words[0] === 'status') {
    const state = await readState(root);
    const result = { jobs: state.jobs.map(j => ({ id: j.id, mode: j.mode, status: j.status })), commands: state.commands.filter(c => ['pending', 'running', 'uncertain'].includes(c.status)).map(c => ({ id: c.id, action: c.action, status: c.status })) };
    console.log(JSON.stringify(result, null, 2)); return result;
  }
  if (words[0] === 'role-context') {
    const result = roleContext(await readConfig(root), flags.role); console.log(JSON.stringify(result, null, 2)); return result;
  }
  if (words[0] === 'integrations') {
    const result = integrationView(await readState(root), await readConfig(root)); console.log(JSON.stringify(result, null, 2)); return result;
  }
  if (words[0] === 'owner') {
    const action = words[1], id = flags.session;
    if (typeof id !== 'string') throw new Error('Use --session with the actual owning session id; keep it stable across reconnection.');
    let payload;
    if (action === 'connect') payload = { id, runtime: flags.runtime };
    else if (['next', 'heartbeat', 'disconnect'].includes(action)) payload = { owner_id: id, ...(action === 'next' ? { wait_ms: flags.wait === undefined ? 50000 : Number(flags.wait) } : {}) };
    else if (['publish', 'finish', 'checks', 'tool', 'tool-result', 'tool-cancel', 'tool-reconcile', 'worker', 'workspace'].includes(action)) {
      if (typeof flags.file !== 'string') throw new Error('Use --file with a private JSON payload.');
      const input = JSON.parse(await readFile(path.resolve(root, flags.file), 'utf8'));
      payload = action === 'publish' ? { owner_id: id, update: input } : action === 'finish' ? { owner_id: id, result: input } : action === 'tool' ? { owner_id: id, request: input } : { owner_id: id, ...input };
    } else throw new Error('Owner operations: connect, next, heartbeat, publish, worker, workspace, checks, tool, tool-result, tool-cancel, tool-reconcile, finish, disconnect.');
    const result = await ownerCall(root, action, payload);
    console.log(JSON.stringify(result, null, 2)); return result;
  }
  throw new Error('Usage: node factory/runtime/cli.mjs start|check|status|owner <operation> [--project <app>]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
