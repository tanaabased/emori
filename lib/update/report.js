import safeText from '../command-report/utils/safe-text.js';

const labels = { success: '✅', warning: '⚠️', error: '❌', pending: '—' };
const remedies = {
  'dirty-or-unknown': 'Review and commit or move local changes before the next update.',
  'non-main': 'Return the checkout to main when its current work is finished.',
  detached: 'Restore the intended main checkout before the next update.',
  ahead: 'Reconcile local commits with origin/main; no reset was attempted.',
  diverged: 'Reconcile local commits with origin/main; no reset was attempted.',
  'in-progress': 'Finish the in-progress Git operation before the next update.',
  'unsafe-upstream': 'Restore the expected repository remote and origin/main upstream.',
  noncanonical: 'Restore the configured ordinary checkout; task worktrees are not updated.',
  'checkout-missing': 'Restore the configured checkout before the next update.',
  'backup-run-locked': 'Let the active backup or updater finish, then use a later update run.',
  'runtime-unsupported': 'Use the supported stable Bun maintenance runtime.',
  'agent-binding-required': 'Run through the installed Agent System automation with managed Git.',
};

export function failure(error, step) {
  const reason = error?.message;
  return {
    status: error?.skipped || reason === 'backup-run-locked' ? 'warning' : 'error',
    label: error?.skipped || reason === 'backup-run-locked' ? 'Skipped' : 'Failed',
    result: `${step}: ${safeText(reason, 120) || 'command failed'}${Number.isInteger(error?.exitCode) ? ` (exit ${error.exitCode})` : ''}.`,
    action:
      remedies[reason] ??
      `Inspect the ${step} failure in this run's details and resolve it before retrying.`,
  };
}

/** One Markdown card in the native report document; untrusted cells cannot create new rows. */
export default function report({
  id,
  title,
  columns,
  rows,
  actions = [],
  notes = [],
  now = new Date(),
}) {
  const clean = (value) =>
    safeText(String(value ?? '—'), 500)
      .replace(/[\r\n]+/gu, ' ')
      .replace(/[\\`*_[\]<>|]/gu, '\\$&');
  const status = rows.some((row) => row.status === 'error')
    ? 'error'
    : actions.length || rows.some((row) => row.status === 'warning')
      ? 'warning'
      : 'success';
  const suffix =
    status === 'success' ? 'RUN RESULTS' : status === 'error' ? 'RUN FAILED' : 'ACTION NEEDED';
  const date = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const lines = [
    `## ${labels[status]} ${title} · ${suffix}`,
    '',
    `**Agent:** EMORI · ${date} (America/New_York)`,
    '',
    `| ${columns.map(clean).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) =>
        `| ${[row.name, `${labels[row.status]} ${row.label}`, ...row.cells].map(clean).join(' | ')} |`,
    ),
    '',
    ...(actions.length
      ? [...new Set(actions)].map((action) => `**Next action:** ${clean(action)}`)
      : ['**Action needed:** None.']),
    ...notes.flatMap((note) => ['', clean(note)]),
  ];
  const body = lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
  const encode = (value) =>
    `${JSON.stringify({ schema: 'agent-system.report', version: 1, cards: [{ id, format: 'markdown', body: value }] })}\n`;
  const stdout = encode(body);
  if (Buffer.byteLength(stdout) > 16 * 1024)
    return {
      stdout: encode(
        `> ## ❌ ${title} · REPORT UNAVAILABLE\n>\n> Report details exceeded the native report limit. No green result is inferred.\n>\n> **Next action:** Inspect this run's native details; do not repeat updates to resend a report.`,
      ),
      exitCode: 1,
    };
  return {
    stdout,
    exitCode: status === 'success' ? 0 : 1,
  };
}
