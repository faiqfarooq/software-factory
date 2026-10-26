# Factory troubleshooting

## Dashboard does not open

From the installed app run node factory/runtime/cli.mjs start and open its printed private link. Keep that process running. Node.js 22+ is required; Python is unnecessary. Use --no-open if automatic browser opening is unavailable. Do not serve the workspace or .local directory with a generic static server. The shared service exposes fixed assets and sanitized authenticated state only.

## Owner disconnected or not listening

The dashboard cannot wake a closed/idle chat. Invoke the installed factory skill in the original owner session and follow [the owner protocol](../../factory/runtime/WORKFLOW.md). Hybrid Claude forwards to Codex; it does not replace it. The API edition needs the real DeepSeek-owned coding runner. A pairing receipt is not a live provider/model check. Buttons disable after the owner lease expires; queued actions stay pending until acknowledged.

## Login, permissions or provider checks fail

Use the checklist's precise next action and the native host/account interface. Local executable presence does not prove authentication/model access. Authorize bounded live diagnostics explicitly; they must run in the same worker adapter, cwd and permission/network environment. Preserve sanitized terminal/model/session evidence and unknown usage. An external terminal success does not prove the worker environment works. Do not disable restrictions, reinstall/reauthenticate without evidence, silently swap models or launch replacement workers.

## Approval changed, expired or target moved

Refresh the current plan/offer and inspect changes. Offers bind the displayed owner, scope and commit; old consent cannot authorize new scope. A changed target requires reconciliation and fresh final evidence. An approval is pending until acknowledged, not proof of a completed merge. Never bypass five reviews, approver or either app guide.

## Interrupted process or installation

Pending commands expire on server restart; running commands become uncertain. Reconnect the SAME owner and reconcile actual workers, Git and receipts before resuming. Never automatically replay paid work. Server/write locks record a PID/time; inspect the actual process and reconcile before removing only the confirmed stale lock. Do not blanket-delete .local or steal a lock. A partially installed bundle can resume only with the same edition/package after lock reconciliation; modified files stop with a conflict.

## Update conflicts or legacy factories

Stop and reconcile the active owner/server, then run setup from the trusted checkout. Checksums permit updates to unchanged managed assets. Config, jobs and history survive. A modified asset, edition change or unmanaged old factory needs an explicit reviewed migration; never overwrite user files or import another project's sessions, grants or secrets.

[Shared setup](../../factory/README.md) ? [Product workflow](PRODUCT.md)

## Repeated approvals or a stale owner

An exact stage approval from chat OR the dashboard is sufficient. Check Activity before retrying; the owner must reconcile an already queued/claimed decision. Routine authorized tests, fixes and evidence-only reruns do not need another chat confirmation. Changed source/scope still requires its real revision checkpoint.

For an explicitly authorized idle-owner replacement, see [owner release](../../factory/runtime/WORKFLOW.md#explicit-release-of-a-disconnected-owner). It refuses live owners, unfinished jobs and outstanding activity; never impersonate a previous session. Follow the [full guide](../../factory/README.md) for startup, commands, optional host permissions and recovery.
