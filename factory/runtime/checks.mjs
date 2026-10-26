import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { profile } from './profiles.mjs';
import { exists, stamp, safePath } from './storage.mjs';
const exec = promisify(execFile);

export async function executable(name, environment = process.env) {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of (environment.PATH || environment.Path || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const file = path.join(dir.replace(/^"|"$/g, ''), name + ext);
      try { await access(file, process.platform === 'win32' ? 0 : 1); if ((await stat(file)).isFile()) return file; } catch {}
    }
  }
  return null;
}
export async function git(root, args) {
  const { stdout } = await exec('git', ['-C', root, ...args], { timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true });
  return stdout.trimEnd();
}
export async function inspect(root, edition, workspace) {
  const selected = profile(edition), checks = [];
  const add = (id, label, status, detail, action = '') => checks.push({ id, label, status, detail, action, time: stamp() });
  add('node', 'Node.js', Number(process.versions.node.split('.')[0]) >= 22 ? 'passed' : 'needs-action', process.version, 'Install Node.js 22 or newer.');
  for (const tool of selected.tools) {
    const found = await executable(tool);
    add(tool, tool === 'git' ? 'Git' : tool === 'claude' ? 'Claude Code' : 'Codex', found ? 'passed' : 'needs-action',
      found ? 'Executable found. Account and model access are checked separately.' : 'Executable not found on PATH.', 'Install or expose ' + tool + ' on PATH.');
  }
  let target = null;
  if (workspace?.policy === 'current-branches') {
    target = 'current-branches';
    for (const [index, entry] of workspace.repositories.entries()) {
      try {
        const folder = await safePath(root, entry.path), actual = await git(folder, ['rev-parse', '--show-toplevel']);
        if (path.resolve(actual).toLowerCase() !== path.resolve(folder).toLowerCase()) throw new Error('Not a Git root.');
        const branch = await git(folder, ['symbolic-ref', '--short', 'HEAD']), head = await git(folder, ['rev-parse', '--verify', 'HEAD']).catch(() => null);
        const dirty = await git(folder, ['status', '--porcelain', '--untracked-files=all']);
        add('repository-' + index, entry.path, branch === entry.branch && head ? 'passed' : 'needs-action',
          branch + ' / ' + (head || 'No committed baseline'), 'Reconcile the existing branch/baseline before including this repository in implementation.');
        add('worktree-' + index, entry.path + ' changes', dirty ? 'needs-action' : 'passed',
          dirty ? 'Existing edits preserved.' : 'Working tree is clean.', 'Reconcile intended edits before preparing this repository; never blanket-stage unrelated work.');
      } catch { add('repository-' + index, entry.path, 'needs-action', 'Repository unavailable.', 'Restore access to the configured Git root.'); }
    }
  } else try {
    const actual = await git(root, ['rev-parse', '--show-toplevel']);
    if (path.resolve(actual).toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error('Choose the application Git root.');
    target = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => null);
    const base = await git(root, ['rev-parse', '--verify', 'HEAD']).catch(() => null);
    const dirty = await git(root, ['status', '--porcelain', '--untracked-files=normal']);
    add('repository', 'Application repository', base && target ? 'passed' : 'needs-action', base && target ? 'Git base and target branch found.' : 'A committed base and named target branch are required before building.', 'Include the exact baseline proposal in your plan approval.');
    add('worktree', 'Application changes', dirty ? 'needs-action' : 'passed', dirty ? 'Existing changes detected; setup preserves them.' : 'Working tree is clean.', 'Review existing changes and include only the intended baseline in plan approval.');
  } catch {
    add('repository', 'Application repository', 'needs-action', 'No application Git root at this location.', 'The owner must propose Git initialization and a baseline with the app plan.');
  }
  if (edition === 'low-cost') {
    for (const [id, variable] of [['deepseek', 'DEEPSEEK_API_KEY'], ['qwen', 'QWEN_API_KEY'], ['kimi', 'MOONSHOT_API_KEY']]) {
      add(id, id + ' credentials', process.env[variable] ? 'passed' : 'needs-action', process.env[variable] ? 'Environment variable is present; access is unverified.' : variable + ' is missing.', 'Set ' + variable + ' in the owner environment, then run authorized live checks.');
    }
  }
  add('live', 'Account and model access', 'not-checked', 'No paid model calls during local setup.', 'Connect the owner and choose Check live access.');
  add('continuation', 'Builder continuation', 'not-checked', 'Requires a real builder response and continuation in the same session.', 'The owner records this during authorized live checks.');
  add('browser', 'Application browser checks', 'not-checked', 'Verified on the built application, not on setup files.', 'Run the agreed browser checks during implementation.');
  add('acceptance', 'Complete app acceptance', 'not-checked', 'No app build has started.', 'Approve a plan, complete implementation, tests and independent reviews.');
  const scripts = {};
  if (await exists(path.join(root, 'package.json'))) {
    try {
      const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
      for (const key of ['test', 'lint', 'build', 'dev']) if (typeof manifest.scripts?.[key] === 'string') scripts[key] = manifest.scripts[key];
    } catch { add('manifest', 'Application manifest', 'needs-action', 'package.json could not be read.', 'Repair the manifest before running app commands.'); }
  }
  return { checks, target_branch: target, scripts };
}
