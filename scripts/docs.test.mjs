import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  for (const file of ['software-factory/GENERATION.md', 'software-factory-with-claude/software-factory.md',
    'low-cost-software-factory/GENERATION.md']) {
    const text = await readFile(path.join(root, file), 'utf8');
    assert.match(text, /--live/);
    assert.match(text, /SAME/);
    assert.match(text, /historical invocations/);
    assert.match(text, /environment/);
    assert.match(text, /bounded|Bound|Bounded/i);
  }
});
