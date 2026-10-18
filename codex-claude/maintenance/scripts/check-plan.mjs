#!/usr/bin/env node
// Read-only, offline plan validation. Never approves or dispatches a job.
import { readFile } from 'node:fs/promises';
import { validatePlan } from './product-workflow.mjs';
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node check-plan.mjs PLAN.json\nOffline reference-plan validation only; no provider, Git or dashboard operations.');
} else if (args.length !== 1 || args[0].startsWith('--')) {
  console.error('Usage: node check-plan.mjs PLAN.json'); process.exitCode = 2;
} else {
  try {
    const plan = JSON.parse(await readFile(args[0], 'utf8'));
    const errors = validatePlan(plan);
    console.log(JSON.stringify({ status: errors.length ? 'INVALID' : 'VALID_PLAN_METADATA', mode: plan?.mode ?? null, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'INVALID', error: error instanceof SyntaxError ? 'Invalid JSON' : error.code || 'Unable to validate input' }));
    process.exitCode = 1;
  }
}
