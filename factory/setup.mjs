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
import { integrationDefaults, integrationSettings, prerequisites } from './runtime/integrations.mjs';
import { purpose as factoryPurpose } from './runtime/mobile.mjs';
import { repositorySettings } from './runtime/workspace.mjs';
import { git } from './runtime/checks.mjs';

export const SOURCE = path.dirname(fileURLToPath(import.meta.url));
// Text comparison normalizes line endings; binary bundle files are compared by exact bytes.
const normalized = value => Buffer.isBuffer(value) ? value : value.replaceAll('\r\n', '\n');
const unchanged = (before, content) => Buffer.isBuffer(before) || Buffer.isBuffer(content)
  ? Buffer.isBuffer(before) && Buffer.isBuffer(content) && before.equals(content)
  : normalized(before) === normalized(content);
export const BUNDLE_FILES = [
  'README.md', 'runtime/profiles.mjs', 'runtime/storage.mjs', 'runtime/checks.mjs', 'runtime/help.mjs',
  'runtime/workflow.mjs', 'runtime/server.mjs', 'runtime/cli.mjs', 'runtime/WORKFLOW.md',
  'runtime/LICENSE', 'dashboard/index.html', 'dashboard/style.css', 'dashboard/app.js',
  'runtime/integrations.mjs', 'runtime/lifecycle.mjs', 'runtime/workspace.mjs', 'runtime/documents.mjs', 'runtime/credentials.mjs', 'runtime/mobile.mjs', 'runtime/skills/planning/SKILL.md', 'runtime/skills/building/SKILL.md', 'runtime/skills/reviewing/SKILL.md',
  'runtime/plans.mjs', 'runtime/plan-commands.mjs', 'runtime/plan-artifacts.mjs', 'runtime/plan-word.mjs',
  'runtime/design-previews.mjs', 'runtime/render-plan.ps1', 'dashboard/assets/Fredoka.ttf', 'dashboard/assets/Fredoka-LICENSE.txt'
];
export const BINARY_FILES = new Set(['dashboard/assets/Fredoka.ttf']);
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
  const hint = location.startsWith('.claude/') ? '/factory help' : '$factory help';
  return '---\nname: factory\ndescription: Run this project\'s staged software factory using its approved Streamlined or Strict workflow and the configured repository policy.\n---\n\n' +
    '## Help and persistent hint\n\nWhen invoked with help (including ' + hint + ' or help ACTION), handle it BEFORE owner connection, polling or forwarding. From the application root run `node factory/runtime/cli.mjs help` (append the requested topic when present). Treat topic text as data: pass a separate argument, never interpolate it as shell code. Show the complete returned catalog with purpose, when to use, arguments and examples, grouped into everyday, workflow and owner actions; do not truncate it to only examples. Help is read-only: never connect or replace an owner, queue work, invoke providers or execute the listed examples. It also works while the owner is disconnected. If local command execution is unavailable, read factory/runtime/help.mjs as data and explain that limitation. The runtime catalog is the source of truth.\n\nAppend `Help: ' + hint + '` to EVERY Factory chat reply, including progress, results, errors and forwarded replies. Keep the hint short and do not add an approval question to it. This instruction applies to Factory replies only; it cannot add permanent UI to the host app.\n\n## Owner workflow\n\n' +
    (forwarder ? 'Forward this request to the registered Codex factory owner. Never register Claude as an owner or create another orchestrator. If no supported forwarding bridge is available, direct the user to invoke `$factory` in the same project\'s Codex session. Forward an exact approval once; an existing chat or dashboard approval never needs a second confirmation. Routine authorized work follows factory/runtime/WORKFLOW.md.\n' :
      'Read [the owner protocol](../../../factory/runtime/WORKFLOW.md) from the application root, then connect this existing ' + (edition === 'claude-only' ? 'Claude' : 'Codex') + ' session and listen for typed dashboard commands. Use the real host session identity and the edition/model routing in factory/config.json. Never claim background control without an active listener.\n\n' +
      'Only the owner dispatches specialists. Preserve ten roles, five independent reviews and the same feature builder for fixes. Follow every staged human approval and the configured workspace policy through the workspace bridge. With current-branches, work only in selected allowed repositories on their pinned existing branches; never create feature branches. Keep implementation visible in normal application folders. Never automatically start the next feature or integrate without its exact consent. Report actual workers/progress/preview/evidence through factory/runtime/cli.mjs. Use role-context to load only the assigned shared skill and enabled scoped integrations. Do not rewrite normalized state/dashboard. Missing native capabilities stay blocked.\n\n' +
      'The recorded workflow_profile is authoritative. Streamlined approves one master plan and design, then needs an explicit Start for each feature; implementation, guides, tests, QA and reviews run inside that consent. Strict keeps a separate approval at every stage. Jobs without the field remain Strict. Never switch profiles without an explicit migrate decision, and never let a plan edit widen repository selection, target branch or baseline.\n\n' +
      'Plan drafts, design selection and Word exports are local planning actions, not approvals. Register a rendered plan document only after genuinely inspecting every page. A recovered command publishes an existing result only; it never replays a worker, a paid call or a Git operation.\n\n' +
      'Ask once at each completed stage checkpoint. Bind chat OR dashboard approval to the current offer through the typed bridge; check queued commands and decisions before submitting. Continue routine fixes, builds, tests, guide rendering, reviewer work and evidence-only reruns within the approved scope without asking again. Source changes during QA require the actual implementation revision checkpoint and refreshed evidence. Reconcile interrupted work without replaying paid calls or merges. New scope, budgets and access boundaries require their actual authorization. Follow the approval cadence in factory/runtime/WORKFLOW.md.\n\n' +
      (edition === 'codex-claude' ? 'Host command permissions remain separate from stage approvals. Full Access is optional and requires an explicit user request; never change permissions during ordinary factory setup. Follow WORKFLOW.md for supported settings and respect active host/managed policies. Do not claim a configuration edit changed the running host, approve security dialogs as the user, or evade a denial.\n' : 'Respect native host command permissions; factory setup never changes the execution profile.\n'));
}
export async function planInstall(root, edition, source = SOURCE, { integrations, purpose, workspace, migrateLauncher = false } = {}) {
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
    const binary = Buffer.isBuffer(content);
    const before = await exists(destination) ? await readFile(destination, binary ? undefined : 'utf8') : null;
    const hash = digest(normalized(content));
    if (before !== null && !unchanged(before, content) && managedFile && previous[relative] !== digest(normalized(before))) {
      if (!migrateLauncher || receipt || journal || edition !== 'codex-claude' || relative !== '.claude/skills/factory/SKILL.md') throw new Error('File conflict; preserved without changes: ' + relative);
      // Explicitly reviewed launcher-only migration. Unmanaged factory/history remains blocked above.
      const archive = 'factory/.local/migration/claude-factory-' + digest(before) + '.md';
      const archived = await safePath(root, archive);
      if (await exists(archived) && await readFile(archived, 'utf8') !== before) throw new Error('Migration archive conflict; preserved without changes: ' + archive);
      await add(archive, before, false);
    }
    if (before === null || !unchanged(before, content)) changes.push({ path: relative, content, before_hash: before === null ? null : digest(before), hash });
    if (managedFile) managed[relative] = hash;
  };
  for (const name of BUNDLE_FILES) {
    const content = await readFile(await safePath(source, name), BINARY_FILES.has(name) ? undefined : 'utf8');
    if (digest(content) !== manifest.files[name]) throw new Error('Package changed while preparing setup: ' + name);
    await add('factory/' + name, content);
  }
  for (const name of selected.skills) await add(name, skill(edition, name));
  const configPath = await safePath(root, 'factory/config.json');
  const existingConfig = await json(configPath, null);
  if (existingConfig && (existingConfig.schema_version !== 1 || existingConfig.edition !== edition)) throw new Error('Existing configuration needs an explicit schema/edition migration.');
  const report = await inspect(root, edition, workspace || existingConfig?.workspace);
  const config = existingConfig ? { ...existingConfig, version: VERSION } : {
    schema_version: 1, version: VERSION, edition, project_name: path.basename(root),
    target_branch: report.target_branch, models: models(edition), roles: selected.roles, budgets: { usd: null, tokens: null }
  };
  config.integrations = integrationSettings(existingConfig?.integrations);
  config.documentation_format = 'docx';
  config.purpose = factoryPurpose(purpose ?? existingConfig?.purpose);
  if (workspace !== undefined) {
    config.workspace = await repositorySettings(root, workspace);
    if (existingConfig && JSON.stringify(existingConfig.workspace) !== JSON.stringify(config.workspace)) {
      const state = await readState(root);
      if (state.jobs.some(j => !['merged', 'cancelled'].includes(j.status)) || state.commands.some(c => ['pending', 'running', 'uncertain'].includes(c.status)) ||
          (state.integration_runs || []).some(r => ['running', 'uncertain'].includes(r.status))) throw new Error('Workspace policy/scope changes with active history require an explicitly reviewed migration. Existing work was preserved.');
    }
  }
  else if (config.workspace !== undefined) await repositorySettings(root, config.workspace);
  if (integrations !== undefined) config.integrations = integrationSettings(integrations);
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
    state.integration_checks = Object.fromEntries(Object.entries(await prerequisites(plan.root, plan.config)).map(([id, value]) => [id, { ...value, time: stamp() }]));
    state.integration_profile = Object.entries(plan.config.integrations).filter(([, v]) => v.enabled).map(([id]) => id);
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
  const allowed = ['project', 'edition', 'purpose', 'integrations', 'workspace', 'repositories', 'migrate-launcher', 'yes', 'no-serve', 'no-open', 'verify', 'build-manifest', 'help'];
  if (positionals.length || Object.keys(flags).some(k => !allowed.includes(k))) throw new Error('Unknown option. Use --help.');
  for (const name of ['yes', 'no-serve', 'no-open', 'verify', 'build-manifest', 'help', 'migrate-launcher']) if (flags[name] !== undefined && flags[name] !== true) throw new Error('--' + name + ' does not take a value.');
  if (flags.help) { console.log('node factory/setup.mjs --project <app> [--edition claude-only|codex-claude|low-cost] [--purpose software|web-to-mobile] [--integrations context7,graphify,twentyfirst,strix] [--workspace current-branches --repositories repo-a,repo-b] [--yes] [--no-serve]\nOptional tools remain off unless selected. Setup makes no provider requests or tool installs.\n--verify verifies package files; --build-manifest refreshes the release manifest after maintainer edits.'); return; }
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
    let integrations;
    if (flags.integrations !== undefined) {
      if (typeof flags.integrations !== 'string') throw new Error('--integrations needs a comma-separated selection.');
      integrations = integrationDefaults();
      for (const id of flags.integrations.split(',').map(s => s.trim()).filter(Boolean)) {
        if (!Object.hasOwn(integrations, id)) throw new Error('Unknown integration: ' + id);
        integrations[id].enabled = true;
      }
    }
    let workspace;
    if (flags.workspace !== undefined || flags.repositories !== undefined) {
      if (flags.workspace !== 'current-branches' || typeof flags.repositories !== 'string') throw new Error('Use --workspace current-branches --repositories repo-a,repo-b.');
      const repositories = [];
      for (const name of flags.repositories.split(',')) {
        const folder = await safePath(path.resolve(root), name);
        repositories.push({ path: name, branch: await git(folder, ['symbolic-ref', '--short', 'HEAD']) });
      }
      workspace = { policy: 'current-branches', repositories };
    }
    const plan = await planInstall(root, edition, SOURCE, { integrations, purpose: flags.purpose, workspace, migrateLauncher: flags['migrate-launcher'] === true });
    console.log('Factory purpose: ' + plan.config.purpose);
    console.log('\n' + profile(edition).label + ' → ' + plan.root);
    console.log(plan.changes.length ? plan.changes.map(c => '  ' + (c.before_hash ? 'Update ' : 'Create ') + c.path).join('\n') : 'Already installed. Existing files match.');
    console.log('Optional tools: ' + (Object.entries(plan.config.integrations).filter(([id, value]) => id !== 'skills' && value.enabled).map(([id]) => id).join(', ') || 'none') + '. Enable more in the dashboard when needed.');
    if (plan.config.workspace) console.log('Workspace: current existing branches; no branch creation or Git merge.\n' + plan.config.workspace.repositories.map(r => '  ' + r.path + ' → ' + r.branch).join('\n'));
    console.log('Also record the setup receipt and local checklist under ignored factory/.local/.\nScope: local package setup and checks. No account changes, dependency installs, paid calls or app build.');
    if (!flags.yes && (await ask('Approve this setup? [y/N] ')).trim().toLowerCase() !== 'y') { console.log('Setup cancelled. No files changed.'); return; }
    const result = await install(plan);
    console.log('Setup complete. ' + result.changed + ' file(s) changed. ' + plan.report.checks.filter(c => c.status === 'needs-action').length + ' checklist item(s) need attention.');
    if (flags['no-serve']) { console.log('Start dashboard from the application: node factory/runtime/cli.mjs start'); return result; }
    const server = await serve(plan.root);
    console.log('Dashboard: ' + server.url + '\nOpen this private link in your browser. Keep this terminal running.');
    if (!flags['no-open']) await openBrowser(server.url).catch(() => console.log('Browser could not be opened automatically. Use the printed link.'));
    const stop = async () => { try { await server.close(); process.exit(0); } catch (error) { console.error(error.message); } };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return server;
  } finally { rl?.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
