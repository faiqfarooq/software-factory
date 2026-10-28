import { VERSION } from './profiles.mjs';

// Public, static help only. No project state, credentials or executable callbacks.
const action = (id, purpose, when, args, example) => ({
  id, name: id.split(' ').at(-1), purpose, when, arguments: args, example
});
const cli = 'node factory/runtime/cli.mjs ';
const general = [
  action('start', 'Start the local dashboard and print its private link.',
    'Open or reopen Factory from the installed application folder.',
    'Optional: --project PATH, --port NUMBER, --no-open. Keep the terminal running.', cli + 'start'),
  action('check', 'Refresh local tool and repository prerequisites without model calls.',
    'The setup checklist needs a fresh local check.', 'Optional: --project PATH.', cli + 'check'),
  action('status', 'Show job status and outstanding command summaries.',
    'Check progress from a terminal.', 'Optional: --project PATH.', cli + 'status'),
  action('role-context', 'Show the assigned model, shared skill and enabled tools for one role.',
    'The owner prepares a focused specialist task.', '--role ROLE; optional --project PATH.', cli + 'role-context --role builder'),
  action('integrations', 'Show optional integration availability and receipt summaries.',
    'Inspect tool status without starting a tool.', 'Optional: --project PATH.', cli + 'integrations'),
  action('inspect-frontend', 'Inspect selected committed frontend files without executing source scripts.',
    'Analyse a separate web source from a mobile output workspace.',
    '--source ABSOLUTE_FRONTEND_PATH; optional --project MOBILE_OUTPUT_PATH.', cli + 'inspect-frontend --source "D:\\web-app"')
];
const owner = [
  action('owner connect', 'Connect or reconnect the actual configured owner session.',
    'The dashboard is running and this real owner should listen.',
    '--session ACTUAL_SESSION_ID --runtime codex|claude|deepseek.', cli + 'owner connect --session ACTUAL_SESSION_ID --runtime codex'),
  action('owner next', 'Wait for and acknowledge the next queued dashboard instruction.',
    'The connected owner is ready to receive authorized work; this never approves a stage or starts a feature by itself.',
    '--session ACTUAL_SESSION_ID; optional --wait 0..55000 (milliseconds).', cli + 'owner next --session ACTUAL_SESSION_ID --wait 50000'),
  action('owner heartbeat', 'Renew the connected owner lease.',
    'During long work, at least every 60 seconds. The lease lasts 90 seconds.',
    '--session ACTUAL_SESSION_ID.', cli + 'owner heartbeat --session ACTUAL_SESSION_ID'),
  action('owner publish', 'Publish actual progress, a stage deliverable or a reconciled stop.',
    'Report the current authorized command and its real evidence.',
    '--session ACTUAL_SESSION_ID --file PRIVATE_JSON_PAYLOAD; follow WORKFLOW.md.', cli + 'owner publish --session ACTUAL_SESSION_ID --file factory/.local/publish.json'),
  action('owner worker', 'Record actual specialist execution, result and usage.',
    'Track the configured worker or reconcile an interrupted worker; registration does not launch it.',
    '--session ACTUAL_SESSION_ID --file PRIVATE_JSON_PAYLOAD.', cli + 'owner worker --session ACTUAL_SESSION_ID --file factory/.local/worker.json'),
  action('owner workspace', 'Prepare repositories, capture reviewed snapshots or integrate approved work.',
    'Use the operation allowed by the current stage and repository policy. A merge requires exact human consent.',
    '--session ACTUAL_SESSION_ID --file PRIVATE_JSON_PAYLOAD; operations and checks are in WORKFLOW.md.', cli + 'owner workspace --session ACTUAL_SESSION_ID --file factory/.local/workspace.json'),
  action('owner checks', 'Record real live-model access and continuation evidence.',
    'Only during an explicitly authorized check-live command; it can consume provider usage.',
    '--session ACTUAL_SESSION_ID --file PRIVATE_JSON_PAYLOAD.', cli + 'owner checks --session ACTUAL_SESSION_ID --file factory/.local/checks.json'),
  action('owner tool', 'Reserve and start an enabled, role-allowed integration invocation.',
    'An approved plan or bounded planning consent authorizes this operation.',
    '--session ACTUAL_SESSION_ID --file PRIVATE_JSON_PAYLOAD with a stable invocation ID.', cli + 'owner tool --session ACTUAL_SESSION_ID --file factory/.local/tool.json'),
  action('owner tool-result', 'Read the status and result of a reserved invocation.',
    'Poll an existing invocation instead of launching it again.',
    '--session ACTUAL_SESSION_ID --file JSON containing the invocation id.', cli + 'owner tool-result --session ACTUAL_SESSION_ID --file factory/.local/tool-id.json'),
  action('owner tool-cancel', 'Request cancellation of an active integration.',
    'An acknowledged pause/cancel command exists. Inspect processes before confirming the stop.',
    '--session ACTUAL_SESSION_ID --file JSON containing the invocation id.', cli + 'owner tool-cancel --session ACTUAL_SESSION_ID --file factory/.local/tool-id.json'),
  action('owner tool-reconcile', 'Record conclusive reconciliation of an uncertain invocation.',
    'The actual process/container has been inspected and the local invocation has ended.',
    '--session ACTUAL_SESSION_ID --file JSON containing id and the actual reconciliation note.', cli + 'owner tool-reconcile --session ACTUAL_SESSION_ID --file factory/.local/tool-reconcile.json'),
  action('owner feature-readiness', 'Record the actual result of a planned feature readiness check.',
    'A Streamlined feature lists readiness labels and their real checks have been run.',
    '--session ACTUAL_SESSION_ID --file JSON with job_id, feature, plan_hash and the actual check results.', cli + 'owner feature-readiness --session ACTUAL_SESSION_ID --file factory/.local/readiness.json'),
  action('owner review-plan-export', 'Register genuine page-by-page inspection of a rendered plan document.',
    'A plan export reports status rendered and every registered page image has actually been inspected.',
    '--session ACTUAL_SESSION_ID --file JSON with job_id and the review; a claimed review without inspected pages is refused.', cli + 'owner review-plan-export --session ACTUAL_SESSION_ID --file factory/.local/plan-review.json'),
  action('owner recover-command', 'Resume an interrupted staged command for publication only.',
    'The original connected owner holds a real result whose publication was interrupted; no worker or paid call is replayed.',
    '--session ACTUAL_SESSION_ID --file JSON with command_id and the reconciliation note. Refused for pause, cancel and integration commands.', cli + 'owner recover-command --session ACTUAL_SESSION_ID --file factory/.local/recover.json'),
  action('owner finish', 'Complete, block or fail the current owner command.',
    'Actual work reached a human checkpoint or terminal result; outstanding work is reconciled.',
    '--session ACTUAL_SESSION_ID --file JSON containing id, status and optional message.', cli + 'owner finish --session ACTUAL_SESSION_ID --file factory/.local/finish.json'),
  action('owner disconnect', 'Disconnect the owner and mark unfinished commands uncertain.',
    'The actual owning session is ending its connection. Preserve and reconcile its work.',
    '--session ACTUAL_SESSION_ID.', cli + 'owner disconnect --session ACTUAL_SESSION_ID'),
  action('owner release', 'Release a reviewed idle disconnected owner binding while preserving history.',
    'Explicitly authorized replacement only. All jobs must be finished/cancelled and all activity reconciled.',
    '--session ACTUAL_NEW_SESSION_ID --runtime RUNTIME --file JSON with expected_owner_id, expected_generation, revision and note.', cli + 'owner release --session ACTUAL_NEW_SESSION_ID --runtime codex --file factory/.local/owner-release.json')
];
const decision = (name, label, purpose, when, args) => ({
  ...action('workflow ' + name, purpose, when, args, 'Dashboard: ' + label), label
});
const workflow = [
  decision('request', 'New request / Start feasibility', 'Start product or feature feasibility analysis.',
    'No unfinished job or outstanding command exists.', 'Choose scope, purpose, title, requirements and target branch or allowed repositories.'),
  decision('check-live', 'Check live access', 'Authorize bounded real-model access and builder continuation checks.',
    'You explicitly consent to provider usage.', 'Review the displayed models and usage scope; local checks alone cannot verify access.'),
  decision('approve-stage', 'Approve & continue', 'Approve the exact displayed offer and authorize one next stage.',
    'Read the completed deliverable first. One chat OR dashboard approval is enough.', 'A current, unexpired stage offer; its evidence and scope must still match.'),
  decision('approve-merge', 'Approve integration / Approve merge', 'Accept the exact reviewed snapshot or merge the reviewed branch, then verify integration.',
    'All required checks, guides, independent reviews and technical approval match the result.', 'Review the separate integration offer; this does not authorize push, deployment or another feature.'),
  decision('start-feature', 'Start next feature', 'Begin the next dependency-ready product feature.',
    'Product design or the preceding feature integration is accepted.', 'Use the current Start next feature offer; later implementation needs its own stage approval.'),
  decision('start-acceptance', 'Start product acceptance', 'Start whole-product journeys and fresh aggregate reviews.',
    'Every product feature has been accepted.', 'Use the current acceptance-start offer. Final integration needs another decision.'),
  decision('revise', 'Request changes', 'Return to the current or an earlier stage and refresh affected evidence.',
    'Work is at a checkpoint, blocked or paused, with activity reconciled.', 'Describe the requested changes and select the return stage.'),
  decision('revise-product', 'Revise product roadmap', 'Revise the parent product scope and revalidate affected features.',
    'An active feature or product acceptance reveals a product-level change.', 'Describe the changes and select a product stage; integrated history is preserved.'),
  decision('rework', 'Request changes / Request rework', 'Request rework through the appropriate current or earlier-stage revision.',
    'A reconciled checkpoint needs corrections. Staged jobs normally use Request changes.', 'Give a concrete note and the appropriate return stage; keep the same builder.'),
  decision('pause', 'Pause', 'Request a stop in new dispatch and reconciliation of active work.',
    'Work is planning, implementing or reviewing.', 'Wait for confirmed paused status; a request alone does not prove workers/tools stopped.'),
  decision('resume', 'Resume current stage', 'Continue the same paused stage after reconciliation.',
    'The job is paused and outstanding activity is reconciled.', 'Changed scope, source or permissions still require the real revision checkpoint.'),
  decision('cancel', 'Cancel work', 'Request cancellation while preserving partial work and history.',
    'You want to end unfinished work.', 'The owner must stop/reconcile actual activity before confirming cancelled.'),
  decision('save-draft', 'Plan → Edit plan', 'Save an editable plan draft without changing the approved version.',
    'You want to change scope, features or acceptance before approving again.', 'The job is at a checkpoint with no active workers or tool runs. Repository, branch and baseline changes are refused here.'),
  decision('discard-draft', 'Discard draft', 'Drop the current draft and keep the approved plan.',
    'An edit is no longer wanted.', 'A draft exists; superseded drafts remain readable in version history.'),
  decision('submit-revision', 'Submit revision', 'Promote the draft to a new plan version and ask for approval again.',
    'The draft is complete and its impact has been reviewed.', 'Affected features are revalidated, removed features keep their evidence, and terminal jobs stay read-only.'),
  decision('regenerate', 'Regenerate from code', 'Reanalyse the current source and propose a refreshed plan.',
    'The code moved on and the plan should reflect it.', 'Accepted feature scope is preserved; the refreshed plan still needs approval.'),
  decision('select-design', 'Design → Select layout', 'Record the chosen sample layout for planning.',
    'You reviewed the generated screens and prototype.', 'A design is present on the current plan version; selection alone authorizes no implementation.'),
  decision('design-feedback', 'Design → Save feedback', 'Save written design feedback into planning.',
    'You want design notes carried into the specification.', 'Feedback is planning input, not an approval.'),
  decision('trash', 'Plan trash', 'Move a plan out of the active list while preserving it.',
    'You want to start something else without losing this plan.', 'No pending, running or uncertain activity; workspace metadata is preserved for restoration.'),
  decision('restore', 'Restore plan', 'Return a trashed plan to the active list.',
    'You want to continue the preserved plan.', 'A changed security configuration or revoked readiness leaves it blocked for review rather than runnable.'),
  decision('migrate', 'Switch to Streamlined', 'Move an existing Strict job to the Streamlined profile.',
    'One master-plan approval suits the remaining work.', 'Reversible until execution starts; prepared feature branches and the original builder are preserved.'),
  decision('rollback-migration', 'Undo workflow switch', 'Return a migrated job to Strict stage gates.',
    'The switch was not wanted and no new execution happened.', 'Refused once fresh workers, usage or acceptance receipts exist, and after a security configuration change.'),
  decision('migrate-workflow', 'Adopt staged workflow', 'Archive a legacy job and return it to staged feasibility.',
    'The dashboard flags an active legacy workflow.', 'Reconcile old activity first; old approvals do not authorize new stages.'),
  decision('approve-plan', 'Legacy: Approve plan and start', 'Explain the retained legacy two-gate approval action.',
    'Historical compatibility only. Active legacy jobs must adopt the staged workflow.', 'For current jobs use Approve & continue; this is not an additional shortcut to implementation.')
];

export function getHelp(topic = '') {
  const groups = [
    { id: 'everyday', label: 'Everyday terminal commands', surface: 'terminal', actions: general },
    { id: 'workflow', label: 'Workflow decisions', surface: 'dashboard / chat approval', actions: workflow },
    { id: 'owner', label: 'Advanced owner operations', surface: 'terminal / actual owner', actions: owner }
  ];
  const query = topic.trim().toLowerCase().replace(/\s+/g, ' ');
  const selected = query ? groups.flatMap(group => {
    const actions = group.id === query ? group.actions : group.actions.filter(a => a.id === query || a.name === query);
    return actions.length ? [{ ...group, actions }] : [];
  }) : groups;
  if (!selected.length) throw new Error('Unknown help topic. Run node factory/runtime/cli.mjs help to list actions.');
  return structuredClone({
    schema_version: 1, version: VERSION, groups: selected,
    operational_commands: general.length + owner.length,
    hint: 'Need help? Open Help or type $factory help / /factory help.',
    introduction: 'Run terminal examples from the installed application folder. Replace uppercase placeholders with real values. Help displays information only; it never executes examples, connects an owner or grants approval.',
    shortcuts: '$factory help in Codex; /factory help in Claude. Both display this catalog before owner connection/forwarding. API runners can use terminal or dashboard help.',
    help_usage: 'node factory/runtime/cli.mjs help [ACTION|everyday|workflow|owner] [--json]; --help also works, including owner next --help.'
  });
}

export function formatHelp(topic = '') {
  const help = getHelp(topic);
  const lines = ['Factory help — ' + help.version, help.introduction, help.shortcuts,
    help.operational_commands + ' operational commands plus read-only help; workflow decisions are listed separately.'];
  for (const group of help.groups) {
    lines.push('', group.label + ' [' + group.surface + ']');
    for (const a of group.actions) lines.push('', a.id + (a.label ? ' — ' + a.label : ''),
      'Purpose: ' + a.purpose, 'When: ' + a.when, 'Arguments / requirements: ' + a.arguments, 'Example: ' + a.example);
  }
  return [...lines, '', help.help_usage, help.hint].join('\n');
}
