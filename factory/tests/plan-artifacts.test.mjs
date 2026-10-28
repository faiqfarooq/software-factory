import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createPlanWord } from '../runtime/plan-word.mjs';
import { reservePlanExport, reviewPlanExport, readPlanArtifact } from '../runtime/plan-artifacts.mjs';
import { digest } from '../runtime/storage.mjs';

function fixture() {
  const plan = { summary: 'Mobile API parity', base_commit: 'a'.repeat(40), target_branch: 'main', scope: ['Reuse existing APIs'], acceptance: ['Sign in'], permissions: ['Mobile repository only'], budget: 'Existing subscription', features: [], code_analysis: [{ feature_id: 'auth', status: 'partial', detail: 'Authentication baseline', commit: 'a'.repeat(40) }] };
  const revision = { id: 'version-one', number: 1, hash: digest(JSON.stringify(plan)), status: 'draft', plan };
  const job = { id: 'job', title: 'Mobile app', plan, features: [], plan_versions: [revision], decisions: [{ unit: 'product', stage: 'specification', action: 'approve-stage', time: '2026-10-27T00:00:00Z' }] };
  return { job, revision, state: { jobs: [job] } };
}

function documentXml(bytes) {
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26), extraSize = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameSize + extraSize;
    if (bytes.subarray(offset + 30, offset + 30 + nameSize).toString() === 'word/document.xml') return inflateRawSync(bytes.subarray(start, start + size)).toString();
    offset = start + size;
  }
  throw new Error('Missing Word document');
}

test('Word tables retain separate repeating headers when history or review decisions precede code analysis', () => {
  for (const withDecisions of [false, true]) {
    const { job, revision } = fixture();
    if (!withDecisions) job.decisions = [];
    const xml = documentXml(createPlanWord(job, revision).bytes);
    assert.equal((xml.match(/<w:tbl>/g) || []).length, withDecisions ? 3 : 2);
    assert.doesNotMatch(xml, /<\/w:tbl>\s*<w:tbl>/);
    assert.match(xml, /Version/);
    assert.match(xml, /Code status/);
    assert.match(xml, /Authentication baseline/);
  }
});

test('a failed page review blocks download and permits regeneration without replacing the original artifact', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'factory-plan-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { state, job, revision } = fixture();
  const { artifact } = reservePlanExport(state, { id: 'first', job_id: job.id, version: revision.id });
  const bytes = createPlanWord(job, revision).bytes;
  Object.assign(artifact, { status: 'rendered', pages: 2, sha256: digest(bytes) });
  const folder = path.join(root, 'factory/.local/plan-artifacts', artifact.id);
  await mkdir(folder, { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aewoAAAAASUVORK5CYII=', 'base64');
  await Promise.all([writeFile(path.join(folder, 'plan.docx'), bytes), writeFile(path.join(folder, 'render.json'), JSON.stringify({ sha256: artifact.sha256, pages: [{ page: 1 }, { page: 2 }] })), ...[1, 2].map(page => writeFile(path.join(folder, 'page-' + page + '.png'), png))]);
  const review = { artifact_id: artifact.id, sha256: artifact.sha256, inspected_pages: [2], note: 'Repeating table headings are incorrect on page 2.' };
  await assert.rejects(reviewPlanExport(root, job, review), /every rendered page/);
  await assert.rejects(readPlanArtifact(root, job, artifact.id), /review is pending/);
  await assert.rejects(reviewPlanExport(root, job, { ...review, status: 'needs-action', sha256: '0'.repeat(64) }), /Word bytes/);
  const result = await reviewPlanExport(root, job, { ...review, status: 'needs-action' });
  assert.equal(result.status, 'needs-action');
  assert.equal(artifact.layout_review, 'needs-action');
  await assert.rejects(readPlanArtifact(root, job, artifact.id), /review is pending/);
  const retry = reservePlanExport(state, { id: 'retry', job_id: job.id, version: revision.id });
  assert.equal(retry.duplicate, false);
  assert.notEqual(retry.artifact.id, artifact.id);
  assert.equal(job.plan_artifacts[0], artifact);

  // A full review of unchanged rendered bytes still enables the normal download path.
  Object.assign(artifact, { status: 'rendered' });
  await reviewPlanExport(root, job, { ...review, inspected_pages: [1, 2], note: 'Synthetic complete page-review fixture for download validation.' });
  const download = await readPlanArtifact(root, job, artifact.id);
  assert.deepEqual(download.bytes, bytes);
  assert.equal(download.filename, 'plan-v1.docx');
  await writeFile(path.join(folder, 'plan.docx'), Buffer.concat([bytes, Buffer.from('changed')]));
  await assert.rejects(readPlanArtifact(root, job, artifact.id), /Word file changed/);
});
