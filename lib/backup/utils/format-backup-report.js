import serializeReport from '../../command-report/utils/serialize-report.js';

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

/** Report delivery separately from deferred cleanup, without changing backup policy. */
export default function formatBackupReport({ result, failure, closeFailed = false }) {
  const confirmed =
    result?.agentId === 'emori' && result.status === 'completed' && result.delivery === 'confirmed';
  const split =
    confirmed && (result.remoteRetention !== undefined || result.localRetention !== undefined);
  const remoteRetained = split && result.remoteRetention === 'completed';
  const localRetained = split && result.localRetention === 'completed';
  const retained =
    confirmed && result.retention === 'completed' && (!split || (remoteRetained && localRetained));
  const attention = Boolean(failure || closeFailed || !retained);
  const code = codes.has(failure?.message ?? result?.code)
    ? (failure?.message ?? result.code)
    : 'task-failed';
  const stage = stages.has(result?.stage) ? ` at ${result.stage}` : '';
  const card = {
    id: 'backup-agent-nightly',
    title: 'Backup agent nightly',
    status:
      failure || closeFailed || result?.status === 'failed'
        ? 'error'
        : retained
          ? 'success'
          : confirmed
            ? 'warning'
            : 'unknown',
    summary: confirmed
      ? `Archive delivered to Drive and verified; ${retained ? 'retention complete' : 'cleanup pending'}.`
      : 'Backup completion and Drive delivery are not confirmed by this wrapper.',
    facts: [],
    findings: [],
    actions: [],
  };
  const archive = result?.archive;
  if (
    confirmed &&
    typeof archive?.name === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,155}\.tar\.gz$/u.test(archive.name) &&
    !/(?:gh[pousr]_|github_pat_|ops_|opsa_)/iu.test(archive.name)
  )
    card.facts.push({ label: 'Archive', value: archive.name });
  if (confirmed && Number.isSafeInteger(archive?.size) && archive.size > 0)
    card.facts.push({ label: 'Size', value: `${archive.size} bytes` });
  card.facts.push(
    { label: 'Drive delivery', value: confirmed ? 'Verified' : 'Unconfirmed' },
    {
      label: 'Drive retention',
      value: remoteRetained ? 'Complete' : split ? 'Pending' : 'Not separately recorded',
    },
    {
      label: 'Local retention',
      value: localRetained
        ? 'Complete'
        : split
          ? 'Deferred; local archives may accumulate'
          : 'Not separately recorded',
    },
  );
  if (!split)
    card.facts.push({
      label: 'Retention',
      value: retained ? 'Complete (combined result)' : 'Pending; cleanup may be incomplete',
    });
  if (failure || (confirmed && !retained))
    card.findings.push(
      `Reason${stage}: ${code}${diagnostic(failure?.diagnostic ?? result?.diagnostic)}.`,
    );
  if (failure?.message === 'backup-run-locked')
    card.findings.push('Skipped: this backup execution; another run holds the lock.');
  if (closeFailed) card.findings.push('Failed: backup lock descriptor close.');
  if (attention)
    card.actions.push(
      failure?.message === 'backup-run-locked'
        ? 'Wait for the lock owner to finish; do not remove its lock.'
        : next,
    );
  let stderr = '';
  if (failure || (confirmed && !retained))
    stderr = `Backup ${failure ? 'task failed' : remoteRetained && !localRetained ? 'local pruning deferred' : 'retention deferred'}${stage} (${code})${diagnostic(failure?.diagnostic ?? result?.diagnostic)}; ${next}\n`;
  if (closeFailed) stderr += 'Backup lock descriptor close failed.\n';
  return { stdout: serializeReport([card]), stderr };
}
