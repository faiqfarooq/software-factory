import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, fromStream, options, execute } from './check-claude.mjs';

const model = 'claude-opus-5-5';
const success = { status: 'complete', actual_model: model, exit_code: 0, session_matches: true };
test('access needs completed exact-model evidence, zero exit, and matching session', () => {
  assert.equal(summarize(success, model).status, 'PASS');
  for (const change of [{ actual_model: null }, { actual_model: 'other' }, { exit_code: 1 },
    { session_matches: false }, { status: 'blocked' }])
    assert.equal(summarize({ ...success, ...change }, model).status, 'BLOCKED');
});
test('init configured model and retries alone never establish access or zero usage', () => {
  const response = { code: 'TIMEOUT', stdout: [
    { type: 'system', subtype: 'init', model, session_id: 's' },
    { type: 'system', subtype: 'api_retry', error: 'unknown' }
  ].map(JSON.stringify).join('\n'), stderr: '' };
  const report = summarize(fromStream(response, 's'), model);
  assert.equal(report.actual_model, null);
  assert.equal(report.retry_count, 1);
  assert.equal(report.error_category, 'timeout');
  assert.equal(report.usage.input_tokens, null);
  assert.equal(report.reported_api_equivalent_usd, null);
});
test('terminal usage is counted once and model comes from assistant response', () => {
  const response = { code: 0, stderr: '', stdout: [
    { type: 'assistant', message: { model } },
    { type: 'result', session_id: 's', usage: { input_tokens: 5, output_tokens: 2 }, total_cost_usd: 0.0001 }
  ].map(JSON.stringify).join('\n') };
  const report = summarize(fromStream(response, 's'), model);
  assert.equal(report.status, 'PASS');
  assert.equal(report.usage.input_tokens, 5);
  assert.equal(report.usage.output_tokens, 2);
});
test('public report does not expose stderr, private transcript, or identity', () => {
  const report = summarize({ ...success, status: 'blocked', private_error: 'ECONNRESET Authorization: secret@example.com',
    private_evidence: ['token-secret'] }, model);
  assert.equal(report.error_category, 'connection');
  assert.doesNotMatch(JSON.stringify(report), /secret|Authorization|private_evidence/);
});
test('live calls require an explicit flag; malformed options fail', () => {
  assert.equal(options([]).live, false);
  assert.throws(() => options(['--adapter', 'provider.mjs']));
  assert.throws(() => options(['--model']));
  assert.throws(() => options(['--unsafe']));
});
test('process failures and timeouts settle rather than hanging', async () => {
  const missing = await execute('factory-nonexistent-executable', [], { timeout: 1000 });
  assert.equal(missing.code, 'ENOENT');
  const hung = await execute(process.execPath, ['-e', 'setTimeout(()=>{}, 5000)'], { timeout: 100 });
  assert.equal(hung.code, 'TIMEOUT');
});
