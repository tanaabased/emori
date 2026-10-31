const reasons = {
  unsupported: 'Source is not approved for shared maintenance.',
  missing: 'Approved source is missing from the local inventory.',
  interrupted: 'Previous run ended without a final result; unfinished steps are unverified.',
  'path-excluded': 'Source aliases an excluded or noncanonical path; no inspection or mutation.',
  'checkout-missing': 'Configured checkout does not exist.',
  'not-bun':
    'Committed package.json and Bun lockfile are required; dependencies were not installed.',
  noncanonical: 'Canonical checkout identity is not established.',
  'non-main': 'Checkout is not on main.',
  detached: 'Checkout has a detached HEAD.',
  'dirty-or-unknown': 'Checkout has changes or cleanliness is unknown.',
  'unsafe-upstream': 'Expected upstream is not established.',
  'unknown-revision': 'Current revision is unknown.',
  'checkout-changed': 'Checkout changed during the run.',
  ahead: 'Local main is ahead of upstream.',
  diverged: 'Local main has diverged from upstream.',
  'deadline-exceeded': 'Operation budget expired.',
  'revision-invalid': 'Git did not return a usable target revision.',
  'ancestry-invalid': 'Git did not return usable ancestry information.',
  'checkout-verification-failed': 'The resulting checkout could not be verified.',
  'operation-failed': 'Command or inspection failed; inspect the native run diagnostics.',
};
const steps = {
  fetched: 'Fetched upstream',
  advanced: 'Advanced fast-forward',
  unchanged: 'Revision unchanged',
  'dependencies-installed': 'Frozen dependencies installed',
  synced: 'Agent System sync completed',
};

/** Render only owned vocabulary and revisions, never arbitrary subprocess/error text. */
export default function formatSourceReport(results) {
  const lines = ['## Shared-source update', ''];
  const diagnostics = [];
  let attention = results.length === 0;
  if (!results.length) lines.push('No source outcomes recorded.', '');
  for (const result of results) {
    const id = ['canon', 'openclaw-agent-system'].includes(result.id) ? result.id : 'other source';
    const status = ['completed', 'excluded', 'skipped', 'pending', 'failed'].includes(result.status)
      ? result.status
      : 'unknown';
    const pending = result.pending ?? [];
    attention ||= !['completed', 'excluded'].includes(status) || pending.length > 0;
    attention ||= (result.steps ?? []).some((step) => !Object.hasOwn(steps, step));
    attention ||= id === 'other source' && status !== 'excluded';
    lines.push(`### ${id}: ${status}`, '');
    for (const step of result.steps ?? [])
      lines.push(
        `- ${Object.hasOwn(steps, step) ? steps[step] : 'Unrecognized step (not verified)'}.`,
      );
    for (const key of ['before', 'target', 'after']) {
      if (/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result[key] ?? ''))
        lines.push(`- ${key}: \`${result[key]}\``);
    }
    if (status === 'excluded')
      lines.push('- Agent repository excluded; no inspection or mutation.');
    if (result.reason)
      lines.push(
        `- ${Object.hasOwn(reasons, result.reason) ? reasons[result.reason] : 'Unrecognized outcome; inspect the native run.'}`,
      );
    if (pending.length)
      lines.push(
        '- Pending: Gateway restart. Automatic restart is disabled because a no-interruption handoff is not established. Arrange an operator restart when work is idle; the running build is unverified.',
      );
    if (status === 'failed') {
      const phase = ['inspect', 'fetch', 'revalidate', 'advance', 'install', 'sync'].includes(
        result.phase,
      )
        ? result.phase
        : 'unknown';
      const exit =
        Number.isInteger(result.exitCode) && result.exitCode > 0 && result.exitCode <= 255
          ? `; exit ${result.exitCode}`
          : '';
      lines.push(`- Failed step: ${phase}${exit}.`);
      diagnostics.push(`${id}: ${phase} failed${exit}.`);
    }
    lines.push('');
  }
  if (attention)
    lines.push(
      'Next: inspect the affected run and resolve its reported condition before retrying maintenance. A pending restart does not require another source update; arrange it separately without interrupting active work.',
      '',
    );
  lines.push(
    'Report delivery is separate from maintenance. Do not rerun maintenance solely to resend this report.',
    '',
  );
  return {
    stdout: lines.join('\n'),
    stderr: diagnostics.length ? `${diagnostics.join('\n')}\n` : '',
    exitCode: attention ? 1 : 0,
  };
}
