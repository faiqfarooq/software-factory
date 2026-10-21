import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { git } from './checks.mjs';

const fail = message => { throw new Error(message); };
const text = (v, max = 2000) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\x00-\x1f]/.test(v);
const sha = v => typeof v === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
const only = (v, fields) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !fields.includes(k))) fail('Unknown mobile fields.'); };
const list = v => Array.isArray(v) && v.length > 0 && v.length <= 500 && v.every(x => text(x));
export function purpose(value = 'software') {
  if (!['software', 'web-to-mobile'].includes(value)) fail('Choose software or web-to-mobile factory purpose.');
  return value;
}
function address(value, repository = false) {
  if (!text(value)) return false;
  try {
    const u = new URL(value);
    return !u.username && !u.password && !u.search && !u.hash && !!u.hostname &&
      (u.protocol === 'https:' || (!repository && u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)));
  } catch { return false; }
}
export function mobileRequest(value) {
  only(value, ['source_repo', 'platforms', 'strategy', 'api_base_url']);
  if (!text(value.source_repo) || (!address(value.source_repo, true) && !(path.isAbsolute(value.source_repo) && !value.source_repo.startsWith('\\\\') && !value.source_repo.startsWith('//')))) fail('Frontend source must be an absolute local path or credential-free HTTPS Git URL.');
  if (!Array.isArray(value.platforms) || !value.platforms.length || new Set(value.platforms).size !== value.platforms.length || !value.platforms.every(p => ['android', 'ios'].includes(p))) fail('Choose Android and/or iOS.');
  if (!['assess', 'expo-native', 'capacitor'].includes(value.strategy) || (value.api_base_url !== '' && !address(value.api_base_url))) fail('Choose a mobile approach and a public HTTPS API address (or loopback development URL), without credentials or query parameters.');
  return structuredClone(value);
}
export function mobileAnalysis(value) {
  only(value, ['source_commit', 'framework', 'screens', 'api_modules', 'auth', 'risks', 'recommendation']);
  if (!sha(value.source_commit) || !text(value.framework) || !list(value.screens) || !Array.isArray(value.api_modules) || value.api_modules.length > 500 || !value.api_modules.every(x => text(x)) || !text(value.auth) || !Array.isArray(value.risks) || value.risks.length > 500 || !value.risks.every(x => text(x)) || !['expo-native', 'capacitor'].includes(value.recommendation)) fail('Mobile analysis needs the inspected source commit, framework, screens, API modules, authentication, risks and recommended approach.');
  return structuredClone(value);
}
export function validateMobilePlan(value, job, acceptance) {
  if (job.purpose !== 'web-to-mobile') { if (value !== undefined) fail('Mobile plans require a web-to-mobile request.'); return; }
  only(value, ['source_commit', 'strategy', 'api_base_url', 'backend_changes', 'screens', 'api_contracts', 'auth', 'storage', 'offline', 'device_checks', 'blockers']);
  if (!job.mobile_analysis || value.source_commit !== job.mobile_analysis.source_commit || !['expo-native', 'capacitor'].includes(value.strategy) || value.backend_changes !== false) fail('Mobile plan must pin the analysed source commit, select an approach and reuse the backend without changes.');
  if (job.mobile.strategy !== 'assess' && value.strategy !== job.mobile.strategy) fail('The mobile approach differs from the requested strategy. Start a revised request to change it.');
  if (!address(value.api_base_url) || (job.mobile.api_base_url && new URL(value.api_base_url).href !== new URL(job.mobile.api_base_url).href)) fail('Identify the existing API address before approving mobile specification; it must match the requested backend.');
  if (!['auth', 'storage', 'offline'].every(k => text(value[k])) || !Array.isArray(value.blockers) || value.blockers.length) fail('Resolve backend/mobile blockers and specify authentication, secure storage and offline behaviour before implementation.');
  if (!Array.isArray(value.screens) || !value.screens.length || value.screens.length > 500) fail('Map web screens to mobile screens and acceptance criteria.');
  for (const s of value.screens) {
    only(s, ['web', 'mobile', 'acceptance']);
    if (!text(s.web) || !text(s.mobile) || !text(s.acceptance) || !acceptance.includes(s.acceptance)) fail('Each mobile screen needs an approved acceptance criterion.');
  }
  if (!Array.isArray(value.api_contracts) || !value.api_contracts.length || value.api_contracts.length > 500) fail('Inventory the existing API contracts and their parity checks.');
  for (const a of value.api_contracts) {
    only(a, ['method', 'path', 'check']);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'WS', 'GRAPHQL'].includes(a.method) || !text(a.path, 500) || !a.path.startsWith('/') || /[?#\s]/.test(a.path) || !text(a.check)) fail('API contracts need method, parameterized path and parity check; exclude secrets and request values.');
  }
  if (!Array.isArray(value.device_checks) || value.device_checks.length > 100) fail('Plan device checks for each mobile platform.');
  for (const d of value.device_checks) { only(d, ['platform', 'check']); if (!job.mobile.platforms.includes(d.platform) || !text(d.check)) fail('Invalid mobile device check.'); }
  if (!job.mobile.platforms.every(p => value.device_checks.some(d => d.platform === p))) fail('Plan device checks for every requested platform.');
  if (job.phase === 'feature' && job.mode === 'product' && (value.strategy !== job.plan.mobile.strategy || value.source_commit !== job.plan.mobile.source_commit || new URL(value.api_base_url).href !== new URL(job.plan.mobile.api_base_url).href)) fail('Feature approach/source/backend must match the approved mobile product.');
  if (job.phase === 'product' && !job.mobile_analysis.screens.every(screen => value.screens.some(s => s.web === screen))) fail('Map every discovered web screen into the mobile roadmap.');
}
export function mobileQuality(job, unit) {
  if (job.purpose !== 'web-to-mobile') return;
  const plan = unit.plan?.mobile || job.plan?.mobile;
  if (!plan) fail('Missing approved mobile plan.');
  const passed = label => unit.checks?.some(c => c.label === label && c.status === 'passed' && c.commit === unit.commit);
  if (!plan.api_contracts.every(a => passed(a.check)) || !plan.device_checks.every(d => passed(d.check))) fail('Mobile QA requires passing API parity and device checks at the reviewed commit. Browser previews alone do not pass device QA.');
  if (!plan.device_checks.every(d => unit.mobile_runs?.some(r => r.platform === d.platform && r.check === d.check && r.commit === unit.commit && r.status === 'passed'))) fail('Record actual device/emulator runs for every planned mobile check at this commit.');
}
export function mobileRuns(value, job) {
  if (job.purpose !== 'web-to-mobile' || !Array.isArray(value) || value.length > 100) fail('Invalid mobile device runs.');
  for (const r of value) {
    only(r, ['platform', 'check', 'device', 'runtime', 'commit', 'status', 'detail']);
    if (!job.mobile.platforms.includes(r.platform) || !['device', 'emulator'].includes(r.runtime) || !['passed', 'needs-action', 'not-checked'].includes(r.status) || !sha(r.commit) || !['check', 'device', 'detail'].every(k => text(r[k]))) fail('Device runs need platform, actual device/emulator, check, commit, status and result details.');
  }
  return structuredClone(value);
}
export async function assertMobileSource(target, mobile) {
  const request = mobileRequest(mobile);
  if (address(request.source_repo, true)) return; // Remote access is deliberately deferred to the owner.
  const source = await realpath(request.source_repo), destination = await realpath(target);
  const canonical = v => process.platform === 'win32' ? path.resolve(v).toLowerCase() : path.resolve(v);
  if (canonical(source) === canonical(destination) || canonical(source).startsWith(canonical(destination) + path.sep) || canonical(destination).startsWith(canonical(source) + path.sep)) fail('Use separate, non-nested frontend and mobile output repositories.');
}

// Reads committed blobs only. Never checks out files, runs source scripts or contacts a remote.
export async function inspectFrontend(source, target) {
  if (typeof source !== 'string' || !path.isAbsolute(source) || source.startsWith('\\\\') || source.startsWith('//')) fail('Clone remote sources with owner approval first, then inspect an absolute local Git root.');
  const root = await realpath(source), destination = await realpath(target);
  const canonical = v => process.platform === 'win32' ? path.resolve(v).toLowerCase() : path.resolve(v);
  if (canonical(root) === canonical(destination) || canonical(root).startsWith(canonical(destination) + path.sep) || canonical(destination).startsWith(canonical(root) + path.sep)) fail('Use separate, non-nested frontend and mobile output repositories.');
  if (canonical(await git(root, ['rev-parse', '--show-toplevel'])) !== canonical(root)) fail('Choose the frontend Git root.');
  const commit = await git(root, ['rev-parse', '--verify', 'HEAD']);
  const entries = (await git(root, ['ls-tree', '-r', '-z', commit])).split('\0').filter(Boolean);
  const selected = entries.flatMap(entry => {
    const [meta, name] = entry.split('\t'), [mode, type, hash] = meta.split(' ');
    if (!name || type !== 'blob' || !['100644', '100755'].includes(mode) || /(?:^|\/)(?:factory|node_modules|dist|build|vendor|\.git)(?:\/|$)/i.test(name) || /(?:secret|credential|\.env|token|key|lock)/i.test(name) || !/\.(?:[cm]?[jt]sx?|vue|svelte|html|css)$|(?:^|\/)package\.json$/i.test(name)) return [];
    return [{ name, hash }];
  });
  const files = selected.slice(0, 400), screens = [], api = [], dependencies = new Set(); let bytes = 0, skipped = 0;
  for (const f of files) {
    const size = Number(await git(root, ['cat-file', '-s', f.hash]));
    if (size > 128000 || bytes + size > 2000000) { skipped++; continue; }
    const content = await git(root, ['cat-file', 'blob', f.hash]); bytes += size;
    if (/(?:^|\/)(?:app|pages|routes|screens)(?:\/|$)/i.test(f.name)) screens.push(f.name);
    if (/\bfetch\s*\(|\baxios\b|\bgraphql\b|\bWebSocket\b/.test(content)) api.push(f.name);
    if (/(?:^|\/)package\.json$/.test(f.name)) try { const p = JSON.parse(content); for (const dep of ['react', 'next', 'vue', 'nuxt', '@angular/core', 'svelte', '@sveltejs/kit', 'vite']) if (p.dependencies?.[dep] || p.devDependencies?.[dep]) dependencies.add(dep); } catch {}
  }
  return { source_commit: commit, framework_candidates: [...dependencies], screen_candidates: screens, api_module_candidates: api,
    selected_files: files.length - skipped, truncated: selected.length > files.length || skipped > 0, identity: 'committed-source-inspection',
    limitations: ['Heuristic candidates require agent inspection; authentication and API contracts are not inferred as verified.', 'Only selected committed text files were inspected. Working-tree changes, secrets, symlinks and scripts were excluded.'],
    next: 'Publish mobile_analysis during feasibility after inspecting candidates and recording authentication, risks and recommendation.' };
}
