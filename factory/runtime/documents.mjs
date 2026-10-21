import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import { digest, safePath } from './storage.mjs';

export const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const exec = promisify(execFile), LIMIT = 20 * 1024 * 1024;
const fail = () => { throw new Error('Expected a readable Microsoft Word .docx package.'); };
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function wordEvidence(guide, commit) {
  const v = guide?.verification;
  return Boolean(guide?.status === 'complete' && guide.commit === commit && guide.format === 'docx' &&
    typeof guide.entry === 'string' && /\.docx$/i.test(guide.entry) && v?.method === 'rendered-pages' && v.status === 'passed' &&
    hex(v.sha256) && Number.isSafeInteger(v.pages) && v.pages > 0 && v.pages <= 10000);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Bounded structural checks, not a renderer or full OOXML schema validator.
// Package structure: https://learn.microsoft.com/en-us/office/open-xml/general/how-to-create-a-package
export function inspectWord(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > LIMIT) fail();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) fail();
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (!count || count > 10000 || count !== bytes.readUInt16LE(end + 8) || start + size !== end) fail();
  const entries = new Map(); let offset = start, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) fail();
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), crc = bytes.readUInt32LE(offset + 16);
    const compressed = bytes.readUInt32LE(offset + 20), length = bytes.readUInt32LE(offset + 24), nameSize = bytes.readUInt16LE(offset + 28);
    const next = offset + 46 + nameSize + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42), name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    expanded += length;
    if (next > end || !name || entries.has(name) || /[\\:\0]/.test(name) || name.startsWith('/') || name.split('/').some(p => p === '..' || p === '.') ||
        (flags & 1) || ![0, 8].includes(method) || bytes.readUInt16LE(offset + 34) || local + 30 > start || expanded > 100 * 1024 * 1024 || /vbaProject\.bin$/i.test(name)) fail();
    entries.set(name, { local, compressed, length, crc, flags, method }); offset = next;
  }
  if (offset !== end) fail();
  const part = name => {
    const e = entries.get(name); if (!e || e.length > 10 * 1024 * 1024) fail();
    const p = e.local;
    if (bytes.readUInt32LE(p) !== 0x04034b50 || bytes.readUInt16LE(p + 6) !== e.flags || bytes.readUInt16LE(p + 8) !== e.method) fail();
    const n = bytes.readUInt16LE(p + 26), dataStart = p + 30 + n + bytes.readUInt16LE(p + 28);
    if (dataStart + e.compressed > start || bytes.subarray(p + 30, p + 30 + n).toString('utf8') !== name) fail();
    const packed = bytes.subarray(dataStart, dataStart + e.compressed);
    const data = e.method === 8 ? inflateRawSync(packed, { maxOutputLength: 10 * 1024 * 1024 }) : packed;
    if (data.length !== e.length || crc32(data) !== e.crc) fail();
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail();
    return xml;
  };
  const types = part('[Content_Types].xml'), relations = part('_rels/.rels'), document = part('word/document.xml');
  if (!types.includes(WORD_MIME + '.main+xml') || /macroEnabled|vbaProject/i.test(types) ||
      !/officeDocument/.test(relations) || !/Target\s*=\s*["']\/?word\/document\.xml["']/.test(relations) ||
      !/<(?:\w+:)?document\b/.test(document) || !/<(?:\w+:)?body\b/.test(document) ||
      !/(?:schemas\.openxmlformats\.org\/wordprocessingml\/2006\/main|purl\.oclc\.org\/ooxml\/wordprocessingml\/main)/.test(document)) fail();
  return { sha256: digest(bytes), bytes: bytes.length };
}
export async function committedWord(root, guide, commit) {
  if (!wordEvidence(guide, commit) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) throw new Error('Word documentation needs a matching commit and completed rendered-page review.');
  await safePath(root, guide.entry);
  if (guide.entry.startsWith('factory/.local/') || guide.entry.startsWith('.git/')) throw new Error('Documentation must be a committed application guide.');
  const { stdout } = await exec('git', ['-C', root, 'show', '--no-ext-diff', '--no-textconv', commit + ':' + guide.entry], { encoding: 'buffer', timeout: 10000, maxBuffer: LIMIT, windowsHide: true });
  const inspected = inspectWord(stdout);
  if (inspected.sha256 !== guide.verification.sha256) throw new Error('Word file changed since its rendered-page review. Render and inspect this exact file again.');
  return stdout;
}
