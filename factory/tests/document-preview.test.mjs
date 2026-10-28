import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dashboard/app.js', import.meta.url), 'utf8');
const prefix = source.slice(0, source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
class Element {
  children = []; attributes = {}; textContent = '';
  constructor(tag) { this.tag = tag; }
  append(...items) { this.children.push(...items); }
  setAttribute(name, value) { this.attributes[name] = value; }
  set innerHTML(_) { throw new Error('Untrusted HTML must never be interpreted'); }
}
const text = element => element.textContent + element.children.map(text).join('');
const find = (element, tag) => [...(element.tag === tag ? [element] : []), ...element.children.flatMap(child => find(child, tag))];
function dashboard() {
  const context = vm.createContext({ URL, location: { hash: '' }, document: { createElement: tag => new Element(tag) } });
  vm.runInContext(prefix, context); return context;
}

test('headings and emphasis render semantically without visible Markdown markers', () => {
  const d = dashboard(), output = d.renderDocument('# Release\n\n## Scope\n\nUse **bold**, *emphasis*, ~~old~~ and `code` with foo_bar_baz.');
  assert.equal(text(find(output, 'h2')[0]), 'Release');
  assert.equal(text(find(output, 'h3')[0]), 'Scope');
  assert.equal(text(find(output, 'strong')[0]), 'bold');
  assert.equal(text(find(output, 'em')[0]), 'emphasis');
  assert.equal(text(find(output, 'del')[0]), 'old');
  assert.equal(text(find(output, 'code')[0]), 'code');
  assert(text(output).includes('foo_bar_baz'));
  assert(!text(output).includes('**')); assert(!text(output).includes('# Release'));
});

test('nested lists, ordered start values, paragraphs and quotes preserve structure', () => {
  const d = dashboard(), output = d.renderDocument('3. First\n   - **Nested**\n4. Second\n\n> Note\n> with context\n\nA paragraph.  \nA hard break.');
  assert.equal(find(output, 'ol')[0].attributes.start, '3');
  assert.equal(find(output, 'ol')[0].children.length, 2);
  assert.equal(find(output, 'ul').length, 1);
  assert.equal(text(find(output, 'strong')[0]), 'Nested');
  assert.equal(text(find(output, 'blockquote')[0]), 'Note with context');
  assert.equal(find(output, 'br').length, 1);
});

test('tables render headers and aligned cells while escaped/code pipes stay inside cells', () => {
  const d = dashboard(), output = d.renderDocument('| Name | Result |\n| :--- | ---: |\n| **Auth** | ready |\n| a \\| b | `x|y` |');
  assert.equal(find(output, 'table').length, 1);
  assert.deepEqual(find(output, 'th').map(text), ['Name', 'Result']);
  assert.deepEqual(find(output, 'td').map(text), ['Auth', 'ready', 'a | b', 'x|y']);
  assert.equal(find(output, 'th')[0].attributes.scope, 'col');
  assert.equal(find(output, 'td')[1].className, 'align-right');
});

test('code fences remain literal and machine roadmap attachments stay out of prose', () => {
  const d = dashboard(), output = d.renderDocument('Before\n\n```json\n{"text":"**literal** <tag>"}\n```\n\n```factory-roadmap\n{"private":"attachment"}\n```\n\nAfter');
  assert.equal(text(find(output, 'pre')[0]), '{"text":"**literal** <tag>"}');
  assert.equal(find(output, 'strong').length, 0);
  assert(!text(output).includes('factory-roadmap')); assert(!text(output).includes('attachment'));
  assert(text(output).endsWith('After'));
});

test('hostile HTML, script URLs and image sources never become executable elements', () => {
  const d = dashboard(), output = d.renderDocument('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n\n[Unsafe](javascript:alert) ![Track](https://evil.example/pixel)\n\n[Safe **docs**](https://example.com/docs)');
  for (const tag of ['script', 'img', 'iframe', 'style', 'object', 'form']) assert.equal(find(output, tag).length, 0);
  assert(text(output).includes('<script>alert(1)</script>'));
  const links = find(output, 'a'); assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://example.com/docs');
  assert.equal(links[0].rel, 'noopener noreferrer');
  assert.equal(text(links[0]), 'Safe docs');
});

test('stage preview and plan lists use formatted documents while diffs remain literal', () => {
  const d = dashboard();
  const current = { lifecycle: 2, title: 'Mobile', phase: 'feature', active_feature: 'F01_F02', stage: 'requirements', timeline: [],
    deliverables: [{ stage: 'requirements', summary: '**Requirements ready**', content: '# Scope\n\n- **Authentication**\n- Courses', limitations: [], coverage: [] }] };
  const output = d.workflowContent(current);
  assert.equal(find(output, 'pre').length, 0);
  assert(find(output, 'h2').some(h => text(h) === 'Scope'));
  assert(find(output, 'strong').some(h => text(h) === 'Authentication'));
  const scope = d.list(['Use **system appearance**.']);
  assert.equal(text(find(scope, 'strong')[0]), 'system appearance');
  assert(source.includes("node('pre', result.diff ||"));
});

test('incomplete Markdown and large documents retain readable content without throwing', () => {
  const d = dashboard();
  assert(text(d.renderDocument('An unmatched **marker and [link](broken')).includes('unmatched **marker'));
  const input = ('Ordinary text with `literal` and **strong**.\n\n').repeat(1000);
  const output = d.renderDocument(input);
  assert.equal(find(output, 'strong').length, 1000);
});
