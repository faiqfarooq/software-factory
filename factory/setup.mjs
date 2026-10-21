import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, readdir, unlink, realpath } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { VERSION, profile, models } from './runtime/profiles.mjs';
import { atomic, digest, exists, json, safePath, stamp, readState, saveState, locked, event } from './runtime/storage.mjs';
import { inspect } from './runtime/checks.mjs';
import { options, openBrowser } from './runtime/cli.mjs';
import { serve } from './runtime/server.mjs';

export const SOURCE = path.dirname(fileURLToPath(import.meta.url));
const normalized = value => value.replaceAll('\r\n', '\n');
export const BUNDLE_FILES = [
  'README.md', 'runtime/profiles.mjs', 'runtime/storage.mjs', 'runtime/checks.mjs',
  'runtime/workflow.mjs', 'runtime/server.mjs', 'runtime/cli.mjs', 'runtime/WORKFLOW.md',
  'runtime/LICENSE', 'dashboard/index.html', 'dashboard/style.css', 'dashboard/app.js'
];
export async function buildManifest(source = SOURCE) {
  const files = {};
  for (const name of BUNDLE_FILES) files[name] = digest(await readFile(await safePath(source, name)));
  const manifest = { schema_version: 1, version: VERSION, files };
  await atomic(path.join(source, 'manifest.json'), manifest);
  return manifest;
}
export async function verifyBundle(source = SOURCE) {
  const manifest = await json(await safePath(source, 'manifest.json'));
  if (manifest.schema_version !== 1 || manifest.version !== VERSION || !manifest.files ||
      Object.keys(manifest.files).length !== BUNDLE_FILES.length || BUNDLE_FILES.some(name => !Object.hasOwn(manifest.files, name))) throw new Error('Unsupported or incomplete package manifest.');
  for (const name of BUNDLE_FILES) {
    if (!/^[a-f0-9]{64}$/.test(manifest.files[name]) || digest(await readFile(await safePath(source, name))) !== manifest.files[name]) throw new Error('Package checksum mismatch: ' + name);
  }
  return manifest;
}
function skill(edition, location) {
  const forwarder = edition === 'codex-claude' && location.startsWith('.claude/');
  return '---\nname: factory\ndescription: Run this project\'s software factory through its shared dashboard, with plan and merge approvals.\n---\n\n' +
    (forwarder ? 'Forward this request to the registered Codex factory owner. Never register Claude as an owner or create another orchestrator. If no supported forwarding bridge is available, direct the user to invoke `$factory` in the same project\'s Codex session.\n' :
      'Read [the owner protocol](../../../factory/runtime/WORKFLOW.md) from the application root, then connect this existing ' + (edition === 'claude-only' ? 'Claude' : 'Codex') + ' session and listen for typed dashboard commands. Use the real host session identity and the edition/model routing in factory/config.json. Never claim background control without an active listener.\n\n' +
      'Only the owner dispatches specialists. Preserve ten roles, five independent reviews, the same builder for rework, and the separate plan/start and final-merge approvals. Execute only an acknowledged scoped command. Publish actual progress and evidence through factory/runtime/cli.mjs; do not rewrite the dashboard or normalized state directly. Missing native capabilities stay visible as blocked.\n');
}
export async function planInstall(root, edition, source = SOURCE) {
  const selected = profile(edition), manifest = await verifyBundle(source);
  root = await realpath(path.resolve(root));
  const rootBinding = digest(process.platform === 'win32' ? root.toLowerCase() : root);
  if (path.resolve(root, 'factory').toLowerCase() === path.resolve(source).toLowerCase()) throw new Error('Choose your application folder, not this package checkout.');
  const receiptPath = await safePath(root, 'factory/.local/install.json');
  const journalPath = await safePath(root, 'factory/.local/installing.json');
  const receipt = await json(receiptPath, null), journal = await json(journalPath, null);
  if ((receipt && receipt.root_binding !== rootBinding) || (journal && journal.root_binding !== rootBinding)) throw new Error('This private installation belongs to another project path. Use an explicit relocation/migration; never import another owner/history.');
  if (journal && (journal.edition !== edition || journal.bundle_hash !== digest(JSON.stringify(manifest)))) throw new Error('An interrupted installation needs the same package and edition to resume.');
  if (receipt && (receipt.schema_version !== 1 || receipt.edition !== edition)) throw new Error('Changing editions requires an explicit migration. Existing integrations and history were preserved.');
  const previous = receipt?.files || journal?.files || {};
  if (!receipt && !journal && await exists(await safePath(root, 'factory'))) {
    const entries = await readdir(await safePath(root, 'factory'));
    if (entries.length) throw new Error('An existing unmanaged factory needs a reviewed migration; setup will not overwrite it.');
  }
  if (await exists(await safePath(root, 'factory/.local/server.lock'))) throw new Error('Stop the dashboard and reconcile any active owner before installing/upgrading.');
  const changes = [], managed = {};
  const add = async (relative, content, managedFile = true) => {
    const destination = await safePath(root, relative);
    const before = await exists(destination) ? await readFile(destination, 'utf8') : null;
    const hash = digest(normalized(content));
    if (before !== null && normalized(before) !== normalized(content) && managedFile && previous[relative] !== digest(normalized(before))) throw new Error('File conflict; preserved without changes: ' + relative);
    if (before === null || normalized(before) !== normalized(content)) changes.push({ path: relative, content, before_hash: before === null ? null : digest(before), hash });
    if (managedFile) managed[relative] = hash;
  };
  for (const name of BUNDLE_FILES) {
    const content = await readFile(await safePath(source, name), 'utf8');
    if (digest(content) !== manifest.files[name]) throw new Error('Package changed while preparing setup: ' + name);
    await add('factory/' + name, content);
  }
  for (const name of selected.skills) await add(name, skill(edition, name));
  const configPath = await safePath(root, 'factory/config.json');
  const existingConfig = await json(configPath, null);
  if (existingConfig && (existingConfig.schema_version !== 1 || existingConfig.edition !== edition)) throw new Error('Existing configuration needs an explicit schema/edition migration.');
  const report = await inspect(root, edition);
  const config = existingConfig ? { ...existingConfig, version: VERSION } : {
    schema_version: 1, version: VERSION, edition, project_name: path.basename(root),
    target_branch: report.target_branch, models: models(edition), roles: selected.roles, budgets: { usd: null, tokens: null }
  };
  if (!config.roles || Object.keys(config.roles).length !== Object.keys(selected.roles).length ||
      Object.entries(selected.roles).some(([role, runtime]) => config.roles[role] !== runtime)) throw new Error('Existing role routing differs from the edition; resolve it explicitly before upgrade.');
  await add('factory/config.json', JSON.stringify(config, null, 2) + '\n', false);
  const ignorePath = await safePath(root, '.gitignore');
  const ignore = await exists(ignorePath) ? await readFile(ignorePath, 'utf8') : '';
  const rule = '/factory/.local/';
  if (!ignore.split(/\r?\n/).includes(rule)) await add('.gitignore', ignore + (ignore && !ignore.endsWith('\n') ? '\n' : '') + rule + '\n', false);
  return { root, rootBinding, edition, manifest, changes, managed, config, report, previous };
}
export async function install(plan) {
  // Recheck every input before the first write; never overwrite a file changed after approval.
  for (const change of plan.changes) {
    const destination = await safePath(plan.root, change.path);
    const current = await exists(destination) ? digest(await readFile(destination)) : null;
    if (current !== change.before_hash) throw new Error('File changed since setup preview: ' + change.path);
  }
  return locked(plan.root, async () => {
    const journalPath = await safePath(plan.root, 'factory/.local/installing.json');
    // On interrupted installation these hashes allow only this exact approved bundle to resume.
    await atomic(journalPath, { root_binding: plan.rootBinding, edition: plan.edition, bundle_hash: digest(JSON.stringify(plan.manifest)), files: { ...plan.previous, ...plan.managed } });
    for (const change of plan.changes) await atomic(await safePath(plan.root, change.path), change.content);
    await atomic(await safePath(plan.root, 'factory/.local/install.json'), {
      schema_version: 1, version: VERSION, root_binding: plan.rootBinding, edition: plan.edition, files: plan.managed,
      bundle_hash: digest(JSON.stringify(plan.manifest)), installed_at: stamp()
    });
    const state = await readState(plan.root);
    for (const check of plan.report.checks) if (!['live', 'continuation', 'browser', 'acceptance'].includes(check.id) || !state.checks.some(c => c.id === check.id)) {
      state.checks = state.checks.filter(c => c.id !== check.id); state.checks.push(check);
    }
    state.checks = state.checks.filter(c => c.id !== 'package');
    state.checks.unshift({ id: 'package', label: 'Shared factory package', status: 'passed', detail: 'Version ' + VERSION + ' installed and checksums verified.', time: stamp() });
    if (plan.edition === 'low-cost' && !state.checks.some(c => c.id === 'api-runner')) state.checks.push({ id: 'api-runner', label: 'DeepSeek tool-calling owner', status: 'needs-action', detail: 'The shared package does not include an API coding agent.', action: 'Generate/connect the edition runner using low-cost/GENERATION.md; verify its actual tools and owner identity.', time: stamp() });
    state.setup_receipts ||= [];
    state.setup_receipts.push({ time: stamp(), edition: plan.edition, version: VERSION, paths: plan.changes.map(c => c.path), scope: 'Local package installation and prerequisite checks only. No paid calls, app build, merge, push or deployment.' });
    event(state, 'Setup complete: ' + profile(plan.edition).label + '. Review the checklist.'); await saveState(plan.root, state);
    await unlink(journalPath);
    return { changed: plan.changes.length, root: plan.root };
  });
}
export async function main(args = process.argv.slice(2)) {
  const { flags, positionals } = options(args);
  const allowed = ['project', 'edition', 'yes', 'no-serve', 'no-open', 'verify', 'build-manifest', 'help'];
  if (positionals.length || Object.keys(flags).some(k => !allowed.includes(k))) throw new Error('Unknown option. Use --help.');
  for (const name of ['yes', 'no-serve', 'no-open', 'verify', 'build-manifest', 'help']) if (flags[name] !== undefined && flags[name] !== true) throw new Error('--' + name + ' does not take a value.');
  if (flags.help) { console.log('node factory/setup.mjs --project <app> [--edition claude-only|codex-claude|low-cost] [--yes] [--no-serve]\n--verify verifies package files; --build-manifest refreshes the release manifest after maintainer edits.'); return; }
  if (flags['build-manifest']) { await buildManifest(); console.log('Package manifest updated. Run the offline tests before distribution.'); return; }
  if (flags.verify) { await verifyBundle(); console.log('Package checksums verified: ' + VERSION); return; }
  await verifyBundle();
  let root = flags.project, edition = flags.edition, rl;
  const ask = async prompt => {
    if (!stdin.isTTY) throw new Error('Noninteractive setup needs --project, --edition and --yes.');
    rl ||= createInterface({ input: stdin, output: stdout }); return rl.question(prompt);
  };
  try {
    if (typeof root !== 'string') root = (await ask('Application folder: ')).trim();
    if (!root) throw new Error('Choose an existing application folder.');
    if (typeof edition !== 'string') {
      const choice = (await ask('Edition: 1 Claude only, 2 Codex + Claude, 3 API providers [1]: ')).trim() || '1';
      edition = ({ 1: 'claude-only', 2: 'codex-claude', 3: 'low-cost' })[choice];
    }
    profile(edition);
    const plan = await planInstall(root, edition);
    console.log('\n' + profile(edition).label + ' → ' + plan.root);
    console.log(plan.changes.length ? plan.changes.map(c => '  ' + (c.before_hash ? 'Update ' : 'Create ') + c.path).join('\n') : 'Already installed. Existing files match.');
    console.log('Also record the setup receipt and local checklist under ignored factory/.local/.\nScope: local package setup and checks. No account changes, dependency installs, paid calls or app build.');
    if (!flags.yes && (await ask('Approve this setup? [y/N] ')).trim().toLowerCase() !== 'y') { console.log('Setup cancelled. No files changed.'); return; }
    const result = await install(plan);
    console.log('Setup complete. ' + result.changed + ' file(s) changed. ' + plan.report.checks.filter(c => c.status === 'needs-action').length + ' checklist item(s) need attention.');
    if (flags['no-serve']) { console.log('Start dashboard from the application: node factory/runtime/cli.mjs start'); return result; }
    const server = await serve(plan.root);
    console.log('Dashboard: ' + server.url + '\nOpen this private link in your browser. Keep this terminal running.');
    if (!flags['no-open']) await openBrowser(server.url).catch(() => console.log('Browser could not be opened automatically. Use the printed link.'));
    const stop = async () => { await server.close(); process.exit(0); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return server;
  } finally { rl?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
