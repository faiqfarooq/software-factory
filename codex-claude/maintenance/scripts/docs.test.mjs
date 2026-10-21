import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
async function markdown(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) result.push(...await markdown(file));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(file);
  }
  return result;
}
test('all relative Markdown links resolve with exact case for Linux clones', async () => {
  for (const file of await markdown(root)) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|#)/.test(target)) continue;
      const full = path.resolve(path.dirname(file), decodeURIComponent(target.split('#')[0]));
      await access(full);
      const relative = path.relative(root, full);
      assert.ok(!relative.startsWith('..'), 'Link escapes package: ' + target);
      let dir = root;
      for (const part of relative.split(path.sep)) {
        assert.ok((await readdir(dir)).includes(part), 'Case mismatch: ' + target);
        dir = path.join(dir, part);
      }
    }
  }
});
test('every edition requires explicit live checks and accurate separate readiness', async () => {
  for (const file of ['codex-claude/GENERATION.md', 'claude-only/GENERATION.md',
    'low-cost/GENERATION.md']) {
    const text = await readFile(path.join(root, file), 'utf8');
    assert.match(text, /Live checks require explicit/);
    assert.match(text, /SAME/);
    assert.match(text, /history/);
    assert.match(text, /environment/);
    assert.match(text, /bounded|Bound|Bounded/i);
  }
});


test('all editions reuse the same minimal-file and product/control contract', async () => {
  const contracts = [];
  for (const edition of ['claude-only', 'codex-claude', 'low-cost']) {
    const prompt = await readFile(path.join(root, edition, 'GENERATION.md'), 'utf8');
    const start = prompt.indexOf('## Minimal application files');
    const end = prompt.indexOf('## Validation and handoff');
    assert.ok(start > 0 && end > start, 'Missing shared contract: ' + edition);
    contracts.push(prompt.slice(start, end));
    const guide = await readFile(path.join(root, edition, 'docs/PRODUCT.md'), 'utf8');
    for (const heading of ['## Beginner setup', '## Choose the mode explicitly', '## Requirements and roadmap', '## Follow a supplied design', '## Human-approved sequential execution', '## One dashboard for visibility and control', '## Pause, changes and recovery']) assert.ok(guide.includes(heading), edition + ': ' + heading);
  }
  assert.equal(contracts[0], contracts[1]);
  assert.equal(contracts[1], contracts[2]);
});

test('setup prompts preserve ownership, modes, final acceptance and control boundaries', async () => {
  for (const edition of ['claude-only', 'codex-claude', 'low-cost']) {
    const prompt = await readFile(path.join(root, edition, 'GENERATION.md'), 'utf8');
    for (const invariant of [
      'mode=product', 'mode=feature', 'dependency cycles', 'mandatory requirement',
      'not a target-branch merge', 'five fresh independent final-product reviews',
      'Child verdicts alone cannot approve the aggregate', 'Owner disconnected',
      'CSRF', 'Origin', 'existing verified owner', 'same immutable',
      'go ahead', 'merge code', 'Owner disconnected', 'reference changes',
      'whole-product', 'Pause requested', 'Cancellation requested'
    ]) assert.ok(prompt.toLowerCase().includes(invariant.toLowerCase()), edition + ' missing invariant: ' + invariant);
  }
});

test('Claude-only prompt forbids accidental Codex setup and all prompts reuse the shipped dashboard', async () => {
  const claude = await readFile(path.join(root, 'claude-only/GENERATION.md'), 'utf8');
  assert.match(claude, /Do not add \.agents\//);
  assert.doesNotMatch(claude, /LOCAL CODEX SUPPORT|Also support my local Codex/);
  for (const edition of ['claude-only', 'codex-claude', 'low-cost']) {
    const prompt = await readFile(path.join(root, edition, 'GENERATION.md'), 'utf8');
    assert.ok(prompt.includes('--edition ' + edition));
    assert.match(prompt, /Do not regenerate the dashboard/);
    assert.match(prompt, /factory\/\.local/);
    assert.match(prompt, /Do not generate empty boards/);
  }
});
