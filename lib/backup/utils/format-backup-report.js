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

function diagnostic(value, markdown = false) {
  if (!['backup', 'google'].includes(value?.command)) return '';
  const literal = (text) => (markdown ? `\`${text}\`` : text);
  const reason = ['timeout', 'output-limit', 'spawn', 'exit'].includes(value.reason)
    ? value.reason
    : 'unknown';
  const exit =
    Number.isInteger(value.exit) && value.exit >= 0 && value.exit <= 255
      ? `; child exit ${value.exit}`
      : '';
  const signal = ['SIGKILL', 'SIGTERM', 'SIGINT', 'SIGABRT', 'SIGSEGV'].includes(value.signal)
    ? `; signal ${literal(value.signal)}`
    : '';
  return ` (${literal(value.command)}: ${reason}${exit}${signal})`;
}

/** Render only owned result facts; arbitrary errors and child output must stay private. */
export default function formatBackupReport({ result, failure, closeFailed = false }) {
  const confirmed =
    result?.agentId === 'emori' && result.status === 'completed' && result.delivery === 'confirmed';
  const split =
    confirmed && (result.remoteRetention !== undefined || result.localRetention !== undefined);
  const remoteRetained = split && result.remoteRetention === 'completed';
  const localRetained = split && result.localRetention === 'completed';
  const retained =
    confirmed && result.retention === 'completed' && (!split || (remoteRetained && localRetained));
  const attention = failure || closeFailed || !retained;
  const code = codes.has(failure?.message ?? result?.code)
    ? (failure?.message ?? result.code)
    : 'task-failed';
  const stage = stages.has(result?.stage) ? ` at \`${result.stage}\`` : '';
  const outcome = failure || closeFailed ? 'Failed' : attention ? 'Pending' : 'Successful';
  const lines = [
    `## ${failure || closeFailed ? '❌' : attention ? '⚠️' : '✅'} BACKUP AGENT NIGHTLY`,
    '',
    confirmed
      ? `${outcome}. Archive delivered to Drive and verified${retained ? '; retention complete' : '; cleanup pending'}.`
      : `${outcome}. Backup completion and Drive delivery are not confirmed by this wrapper.`,
    '',
    '| Field | Result |',
    '|---|---|',
  ];
  const archive = result?.archive;
  if (
    confirmed &&
    typeof archive?.name === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,155}\.tar\.gz$/.test(archive.name) &&
    !/(?:gh[pousr]_|github_pat_|ops_|opsa_)/i.test(archive.name)
  )
    lines.push(`| Archive | \`${archive.name}\` |`);
  if (confirmed && Number.isSafeInteger(archive?.size) && archive.size > 0)
    lines.push(`| Size | ${archive.size} bytes |`);
  lines.push(
    `| Drive delivery | ${confirmed ? 'Verified' : 'Unconfirmed'} |`,
    `| Drive retention | ${remoteRetained ? 'Complete' : split ? 'Pending' : 'Not separately recorded'} |`,
    `| Local retention | ${localRetained ? 'Complete' : split ? 'Deferred; local archives may accumulate' : 'Not separately recorded'} |`,
  );
  if (!split)
    lines.push(
      `| Retention | ${retained ? 'Complete (combined result)' : 'Pending; cleanup may be incomplete'} |`,
    );
  lines.push('');
  if (failure || (confirmed && !retained))
    lines.push(
      `Reason${stage}: \`${code}\`${diagnostic(failure?.diagnostic ?? result?.diagnostic, true)}.`,
      '',
    );
  if (failure?.message === 'backup-run-locked')
    lines.push('Skipped: this backup execution; another run holds the lock.', '');
  if (closeFailed) lines.push('Failed: backup lock descriptor close.', '');
  if (attention)
    lines.push(
      `**Next:** ${failure?.message === 'backup-run-locked' ? 'Wait for the lock owner to finish; do not remove its lock.' : next}`,
    );
  let stderr = '';
  if (failure || (confirmed && !retained)) {
    const deferred =
      remoteRetained && !localRetained ? 'local pruning deferred' : 'retention deferred';
    stderr = `Backup ${failure ? 'task failed' : deferred}${stage} (${code})${diagnostic(failure?.diagnostic ?? result?.diagnostic)}; ${next}\n`;
  }
  if (closeFailed) stderr += 'Backup lock descriptor close failed.\n';
  return { stdout: `${lines.join('\n')}\n`, stderr };
}
