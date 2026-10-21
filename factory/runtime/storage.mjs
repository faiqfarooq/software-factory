import { lstat, realpath, readFile, writeFile, rename, mkdir, unlink, open } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const digest = data => createHash('sha256').update(data).digest('hex');
export const stamp = () => new Date().toISOString();
export const uid = () => randomUUID();
export async function exists(file) {
  try { await lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
export async function json(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback); throw e; }
}
// Validate every existing path component, including junctions on Windows.
export async function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') ||
      relative.includes('\0') || path.posix.isAbsolute(relative) || relative.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Unsafe package path.');
  }
  const base = await realpath(root);
  let cursor = base;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    try {
      const stat = await lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error('Refusing symbolic link or junction: ' + relative);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return cursor;
}
export async function atomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + uid() + '.tmp';
  try {
    await writeFile(temp, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temp, file);
  } finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}
// Never break a stale lock automatically. A crashed writer needs explicit reconciliation.
export async function locked(root, task) {
  const file = await safePath(root, 'factory/.local/write.lock');
  await mkdir(path.dirname(file), { recursive: true });
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Factory is busy or interrupted. Reconcile factory/.local/write.lock before retrying.'); throw e; }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, time: stamp() })); return await task(); }
  finally { await handle.close(); await unlink(file); }
}
export async function readConfig(root) {
  const config = await json(await safePath(root, 'factory/config.json'));
  if (config.schema_version !== 1) throw new Error('Unsupported factory configuration schema.');
  return config;
}
export async function readState(root) {
  return json(await safePath(root, 'factory/.local/state.json'), {
    schema_version: 1, revision: 0, checks: [], jobs: [], commands: [], activity: [], owner: null
  });
}
export async function saveState(root, state) {
  state.revision++;
  await atomic(await safePath(root, 'factory/.local/state.json'), state);
}
export function event(state, message) {
  state.activity.unshift({ id: uid(), time: stamp(), message });
  state.activity = state.activity.slice(0, 200);
}
