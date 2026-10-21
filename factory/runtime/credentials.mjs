import path from 'node:path';
import { execFile } from 'node:child_process';
import { atomic, json, safePath } from './storage.mjs';

const FILE = 'factory/.local/credentials.json';
export const KEY_ENV = Object.freeze({ context7: 'CONTEXT7_API_KEY', twentyfirst: 'API_KEY_21ST', strix: 'LLM_API_KEY' });
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const key = v => typeof v === 'string' && /^[\x21-\x7e]{1,4096}$/.test(v);
const model = v => typeof v === 'string' && /^[a-z0-9_-]+\/[A-Za-z0-9_.:-]{1,150}$/.test(v);
function only(value, fields) { if (!object(value) || Object.keys(value).some(k => !fields.includes(k))) throw new Error('Unknown credential fields.'); }
function entries(value) {
  only(value, Object.keys(KEY_ENV));
  for (const [id, entry] of Object.entries(value)) {
    only(entry, id === 'strix' ? ['api_key', 'model'] : ['api_key']);
    if ((entry.api_key !== undefined && !key(entry.api_key)) || (entry.model !== undefined && !model(entry.model))) throw new Error('Invalid stored credential data.');
  }
  return structuredClone(value);
}
// Static PowerShell only; secret data goes through stdin, never command arguments or logs.
// DPAPI CurrentUser: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata
async function windowsProtection(input, decrypt) {
  const common = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $value=[Console]::In.ReadToEnd(); ";
  const script = common + (decrypt ?
    "[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))" :
    "[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))");
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise((resolve, reject) => {
    const child = execFile(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000, maxBuffer: 65536 }, (error, stdout) => {
      if (error) reject(new Error('Windows user key protection is unavailable. Start the dashboard under your normal Windows account with its profile loaded.'));
      else resolve(stdout.trim());
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
export const credentialStorage = () => process.platform === 'win32' ? 'windows-user-encrypted' : 'local-file-0600';
export async function loadCredentials(root) {
  const saved = await json(await safePath(root, FILE), null);
  if (!saved) return {};
  try {
    if (saved.schema_version !== 1) throw new Error();
    if (saved.storage === 'windows-user-encrypted' && process.platform === 'win32' && typeof saved.data === 'string' && saved.data.length <= 60000) return entries(JSON.parse(await windowsProtection(saved.data, true)));
    if (saved.storage === 'local-file-0600' && process.platform !== 'win32') return entries(saved.entries);
    throw new Error();
  } catch { throw new Error('Saved integration credentials cannot be read. Restore them under the original OS account, or reconcile factory/.local/credentials.json before retrying.'); }
}
export async function saveCredentials(root, value) {
  const validated = entries(value), storage = credentialStorage();
  const saved = storage === 'windows-user-encrypted' ? { data: await windowsProtection(JSON.stringify(validated), false) } : { entries: validated };
  await atomic(await safePath(root, FILE), { schema_version: 1, storage, ...saved });
}
export function updateCredentials(value, input, config, environment = process.env) {
  only(input, ['id', 'action', 'api_key', 'model', 'revision']);
  if (!Object.hasOwn(KEY_ENV, input.id) || !['save', 'remove'].includes(input.action)) throw new Error('Choose a supported integration credential action.');
  const next = entries(value);
  if (input.action === 'remove') {
    if (input.api_key !== undefined || input.model !== undefined) throw new Error('Remove accepts no credential values.');
    delete next[input.id]; return next;
  }
  if (input.api_key !== undefined && !key(input.api_key)) throw new Error('Enter a nonempty API key without spaces or control characters.');
  if (input.model !== undefined && (input.id !== 'strix' || (input.model !== '' && !model(input.model)))) throw new Error('Use an explicit provider/model for Strix.');
  if (input.api_key === undefined && input.model === undefined) throw new Error('Enter a new API key or Strix model.');
  if (input.model) {
    const providers = config.edition === 'claude-only' ? ['anthropic/'] : config.edition === 'low-cost' ? ['deepseek/', 'moonshot/', 'qwen/', 'dashscope/'] : ['anthropic/', 'openai/'];
    if (!providers.some(p => input.model.startsWith(p))) throw new Error('Strix model provider must match this edition.');
  }
  const updated = { ...next[input.id] };
  if (input.api_key !== undefined) updated.api_key = input.api_key;
  if (input.model !== undefined) { if (input.model) updated.model = input.model; else delete updated.model; }
  if (!updated.api_key && !environment[KEY_ENV[input.id]]) throw new Error('Enter the API key for this integration.');
  next[input.id] = updated; return next;
}
export function credentialEnvironment(value, environment = process.env, id) {
  const result = { ...environment };
  for (const [tool, entry] of Object.entries(value)) if (id === undefined || id === tool) {
    if (entry.api_key) result[KEY_ENV[tool]] = entry.api_key;
    if (tool === 'strix' && entry.model) result.STRIX_LLM = entry.model;
  }
  return result;
}
export function credentialView(value, environment = process.env) {
  return Object.fromEntries(Object.entries(KEY_ENV).map(([id, variable]) => [id, {
    required: true, present: Boolean(value[id]?.api_key || environment[variable]), saved: Boolean(value[id]?.api_key),
    source: value[id]?.api_key ? 'dashboard' : environment[variable] ? 'environment' : null, storage: credentialStorage(),
    ...(id === 'strix' ? { model: value.strix?.model || (model(environment.STRIX_LLM) ? environment.STRIX_LLM : ''), saved_model: Boolean(value.strix?.model) } : {})
  }]));
}
