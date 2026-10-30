const codes = new Set([
  'agent-binding-required',
  'archive-being-deleted',
  'archive-changed',
  'archive-outside-backups',
  'archive-unsafe',
  'arguments-invalid',
  'backup-capture-invalid',
  'backup-create-failed',
  'backup-lock-lost',
  'backup-lock-required',
  'backup-lock-unsafe',
  'backup-run-locked',
  'delivery-record-conflict',
  'delivery-record-invalid',
  'delivery-record-unsafe',
  'drive-folder-unsafe',
  'drive-list-duplicates',
  'drive-list-incomplete',
  'drive-list-limit',
  'duplicate-remote-archive',
  'legacy-backup-lock',
  'local-prune-failed',
  'local-retention-changed',
  'managed-command-failed',
  'managed-output-invalid',
  'private-directory-unsafe',
  'receipt-conflict',
  'record-name-invalid',
  'remote-delete-unverified',
  'remote-file-missing',
  'remote-integrity-failed',
  'remote-retention-unconfirmed',
  'resume-record-required',
  'retention-ownership-unconfirmed',
  'retention-preview-invalid',
  'unresolved-upload',
  'upload-outcome-unknown',
]);
const stages = new Set([
  'preflight',
  'create',
  'upload',
  'remote-check',
  'retention',
  'retention-preview',
  'retention-preflight',
  'remote-retention',
  'local-retention',
]);
const next = 'Inspect `.private/backup-drive/status.json` and `deliveries.json` before recovery.';

function diagnostic(value) {
  if (!['backup', 'google'].includes(value?.command)) return '';
  const reason = ['timeout', 'output-limit', 'spawn', 'exit'].includes(value.reason)
    ? value.reason
    : 'unknown';
  const exit =
    Number.isInteger(value.exit) && value.exit >= 0 && value.exit <= 255
      ? `; child exit ${value.exit}`
      : '';
  const signal = ['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(value.signal)
    ? `; signal ${value.signal}`
    : '';
  return ` (${value.command}: ${reason}${exit}${signal})`;
}

/** Render only owned result facts; arbitrary errors and child output must stay private. */
export default function formatBackupReport({ result, failure, closeFailed = false }) {
  const confirmed =
    result?.agentId === 'emori' && result.status === 'completed' && result.delivery === 'confirmed';
  const retained = confirmed && result.retention === 'completed';
  const attention = failure || closeFailed || !retained;
  const code = codes.has(failure?.message ?? result?.code)
    ? (failure?.message ?? result.code)
    : 'task-failed';
  const stage = stages.has(result?.stage) ? ` at ${result.stage}` : '';
  const lines = [
    `## Backup ${failure || closeFailed ? 'failed' : attention ? 'needs attention' : 'completed'}`,
    '',
    confirmed
      ? '- Completed: backup archive delivered to Drive and verified.'
      : '- Pending: backup completion and Drive delivery are not confirmed by this wrapper.',
    retained ? '- Completed: retention.' : '- Pending: retention; cleanup may be incomplete.',
  ];
  if (failure?.message === 'backup-run-locked')
    lines.push('- Skipped: this backup execution; another run holds the lock.');
  if (closeFailed) lines.push('- Failed: backup lock descriptor close.');
  if (attention) lines.push(`- Next: ${next}`);
  let stderr = '';
  if (failure || (confirmed && !retained)) {
    stderr = `Backup ${failure ? 'task failed' : 'retention deferred'}${stage} (${code})${diagnostic(failure?.diagnostic ?? result?.diagnostic)}; ${next}\n`;
  }
  if (closeFailed) stderr += 'Backup lock descriptor close failed.\n';
  return { stdout: `${lines.join('\n')}\n`, stderr };
}
