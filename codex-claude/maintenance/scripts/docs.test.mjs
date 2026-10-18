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
test('every edition requires explicit live checks and current readiness separated from history', async () => {
  for (const file of ['codex-claude/GENERATION.md', 'claude-only/GENERATION.md',
    'low-cost/GENERATION.md']) {
    const text = await readFile(path.join(root, file), 'utf8');
    assert.match(text, /--live/);
    assert.match(text, /SAME/);
    assert.match(text, /historical invocations/);
    assert.match(text, /environment/);
    assert.match(text, /bounded|Bound|Bounded/i);
  }
});


test('all editions carry the same self-contained product/design/control contract', async () => {
  const contracts = [];
  for (const edition of ['claude-only', 'codex-claude', 'low-cost']) {
    const prompt = await readFile(path.join(root, edition, 'GENERATION.md'), 'utf8');
    const start = prompt.indexOf('## Product mode, design references and dashboard control (workflow version 2)');
    const end = prompt.indexOf('### Explicit generated entry points');
    assert.ok(start > 0 && end > start, 'Missing product extension: ' + edition);
    contracts.push(prompt.slice(start, end));
    const guide = await readFile(path.join(root, edition, 'docs/PRODUCT.md'), 'utf8');
    for (const heading of ['## Beginner setup', '## Choose the mode explicitly', '## Requirements and roadmap', '## Follow a supplied design', '## Automatic sequential execution', '## One dashboard for visibility and control', '## Pause, changes and recovery']) assert.ok(guide.includes(heading), edition + ': ' + heading);
  }
  assert.equal(contracts[0], contracts[1]);
  assert.equal(contracts[1], contracts[2]);
});

test('generation contracts preserve ownership, modes, final acceptance and control boundaries', async () => {
  for (const edition of ['claude-only', 'codex-claude', 'low-cost']) {
    const prompt = await readFile(path.join(root, edition, 'GENERATION.md'), 'utf8');
    for (const invariant of [
      'mode=product', 'mode=feature', 'dependency cycles', 'mandatory requirement',
      'not a target-branch merge', 'five fresh independent final-product reviews',
      'Child verdicts alone cannot approve the aggregate', 'Owner disconnected',
      'CSRF', 'Origin', 'existing verified owner', 'same immutable',
      'go ahead', 'merge code', 'Control available', 'reference changes',
      'whole-product', 'Pause requested', 'Cancellation requested'
    ]) assert.ok(prompt.toLowerCase().includes(invariant.toLowerCase()), edition + ' missing invariant: ' + invariant);
  }
});
