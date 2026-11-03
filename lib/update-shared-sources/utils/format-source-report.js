const reasons = {
  unsupported: 'Source is not approved for shared maintenance.',
  missing: 'Approved source is missing from the local inventory.',
  interrupted: 'Previous run ended without a final result; unfinished steps are unverified.',
  'path-excluded': 'Source aliases an excluded or noncanonical path; no inspection or mutation.',
  'checkout-missing': 'Configured checkout does not exist.',
  'not-bun':
    'Committed `package.json` and Bun lockfile are required; dependencies were not installed.',
  noncanonical: 'Canonical checkout identity is not established.',
  'non-main': 'Checkout is not on `main`.',
  detached: 'Checkout has a detached HEAD.',
  'dirty-or-unknown': 'Checkout has changes or cleanliness is unknown.',
  'unsafe-upstream': 'Expected upstream is not established.',
  'unknown-revision': 'Current revision is unknown.',
  'checkout-changed': 'Checkout changed during the run.',
  ahead: 'Local `main` is ahead of upstream.',
  diverged: 'Local `main` has diverged from upstream.',
  'deadline-exceeded': 'Operation budget expired.',
  'revision-invalid': 'Git did not return a usable target revision.',
  'ancestry-invalid': 'Git did not return usable ancestry information.',
  'checkout-verification-failed': 'The resulting checkout could not be verified.',
  'operation-failed': 'Command or inspection failed; inspect the native run diagnostics.',
  'build-evidence-invalid':
    'Build inputs or artifacts could not be verified; sync is not reusable.',
};
const steps = {
  fetched: 'Fetched upstream',
  advanced: 'Advanced fast-forward',
  unchanged: 'Revision unchanged',
  'dependencies-installed': 'Frozen dependencies installed',
  synced: 'Agent System sync completed',
  'build-current': 'Successful build inputs and artifacts verified; sync not needed',
};

function sourceChange(result) {
  const revision = (value) =>
    typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)
      ? `\`${value.slice(0, 12)}\``
      : '';
  const before = revision(result.before);
  const after = revision(result.after);
  const target = revision(result.target);
  const unchanged =
    before && after ? result.before === result.after : (result.steps ?? []).includes('unchanged');
  const change = after
    ? unchanged
      ? `Unchanged ${after}`
      : before
        ? `${before} → ${after}`
        : `Observed ${after}`
    : before
      ? `Before ${before}; after unknown`
      : (result.steps ?? []).includes('advanced')
        ? 'Advanced fast-forward; revision unavailable'
        : (result.steps ?? []).includes('fetched')
          ? 'Fetched; change not verified'
          : 'Not attempted or unverified';
  return `${change}${target && result.target !== result.after ? `; target ${target} (not verified as reached)` : ''}`;
}

/** Render only owned vocabulary and revisions, never arbitrary subprocess/error text. */
export default function formatSourceReport(results, { historical = false } = {}) {
  const lines = [
    historical ? '## ⚠️ Previous interrupted source update' : '## UPDATE SHARED SOURCES',
    '',
  ];
  const diagnostics = [];
  let attention = results.length === 0;
  if (historical)
    lines.push(
      'Historical record: completed steps remain facts; unfinished steps are unverified. No completion or rollback is inferred.',
      '',
    );
  if (!results.length) lines.push('No source outcomes recorded.', '');
  else if (!historical) lines.push(`${results.length} source outcomes recorded.`, '');
  for (const result of results) {
    const approved = ['canon', 'openclaw-agent-system'].includes(result.id);
    const namedExclusion =
      result.status === 'excluded' && ['emori', 'smutlord'].includes(result.id);
    const id = approved || namedExclusion ? `\`${result.id}\`` : 'Other source';
    const status = ['completed', 'excluded', 'skipped', 'pending', 'failed'].includes(result.status)
      ? result.status
      : 'unknown';
    const pending = result.pending ?? [];
    const activationOnly =
      result.id === 'openclaw-agent-system' &&
      status === 'completed' &&
      pending.length === 1 &&
      pending[0] === 'restart' &&
      result.steps?.includes('dependencies-installed') &&
      result.steps?.some((step) => ['synced', 'build-current'].includes(step));
    attention ||=
      !['completed', 'excluded'].includes(status) ||
      (pending.length > 0 && !activationOnly) ||
      Boolean(result.reason) ||
      (result.exitCode !== undefined && result.exitCode !== 0);
    attention ||= (result.steps ?? []).some((step) => !Object.hasOwn(steps, step));
    attention ||= !approved && status !== 'excluded';
    const uncertain =
      pending.length > 0 || (result.steps ?? []).some((step) => !Object.hasOwn(steps, step));
    const outcome =
      status === 'completed' && !approved
        ? 'Unknown'
        : status === 'completed'
          ? uncertain
            ? 'Successful with warning'
            : 'Successful'
          : {
              excluded: 'Excluded',
              skipped: 'Skipped',
              pending: 'Pending',
              failed: 'Failed',
              unknown: 'Unknown',
            }[status];
    const icon =
      status === 'failed'
        ? '❌'
        : ['excluded', 'skipped'].includes(status)
          ? '⏭️'
          : outcome === 'Successful'
            ? '✅'
            : '⚠️';
    lines.push('---', '', `## ${icon} ${historical ? 'Previous run · ' : ''}${id}`, '');
    if (status === 'excluded') {
      lines.push('Excluded; no inspection or mutation. All maintenance steps not attempted.', '');
      continue;
    }
    const completed = result.steps ?? [];
    lines.push(
      '| Field | Result |',
      '|---|---|',
      `| Outcome | ${outcome} |`,
      `| Source | ${sourceChange(result)} |`,
      `| Dependencies | ${completed.includes('dependencies-installed') ? 'Reconciled (frozen)' : status === 'failed' && result.phase === 'install' ? 'Failed' : 'Not attempted or unverified'} |`,
      `| Build/sync | ${result.id === 'canon' ? 'Not applicable' : completed.includes('synced') ? 'Complete' : completed.includes('build-current') ? 'Current; build inputs and artifacts verified; sync not needed' : status === 'failed' && result.phase === 'sync' ? 'Failed; partial build possible' : 'Not attempted or unverified'} |`,
      `| Activation/restart | ${pending.includes('restart') ? 'Gateway restart pending; running build unverified' : pending.length ? 'Unknown pending work; not verified' : result.id === 'canon' ? 'Not applicable' : 'Running build unverified'} |`,
      '',
    );
    if (completed.some((step) => !Object.hasOwn(steps, step)))
      lines.push('Unrecognized step (not verified).', '');
    if (result.reason)
      lines.push(
        `${Object.hasOwn(reasons, result.reason) ? reasons[result.reason] : 'Unrecognized outcome; inspect the native run.'}`,
      );
    if (pending.includes('restart'))
      lines.push(
        'Application warning — pending activation: Gateway restart. Automatic restart is disabled because a no-interruption handoff is not established. This warning is retained until suitable loaded-build evidence is available; an unchanged fetch does not clear it.',
      );
    if (pending.some((item) => item !== 'restart'))
      lines.push('Unrecognized pending work; completion is unverified.');
    if (status === 'failed') {
      const phase = [
        'inspect',
        'fetch',
        'revalidate',
        'advance',
        'install',
        'sync',
        'build-check',
      ].includes(result.phase)
        ? result.phase
        : 'unknown';
      const exit =
        Number.isInteger(result.exitCode) && result.exitCode > 0 && result.exitCode <= 255
          ? `; exit ${result.exitCode}`
          : '';
      lines.push(`Failed step: \`${phase}\`${exit}.`);
      diagnostics.push(`${id}: ${phase} failed${exit}.`);
    }
    if (pending.includes('restart') && status === 'failed')
      lines.push(
        '',
        '**Next:** Inspect the failed build/sync in native run details before arranging any operator restart. Do not interrupt active work.',
      );
    else if (pending.includes('restart'))
      lines.push(
        '',
        '**Next:** Arrange an operator restart when work is idle. Automatic restart is disabled; a pending restart does not require another source update.',
      );
    else if (status !== 'completed' || uncertain || !approved)
      lines.push(
        '',
        '**Next:** Inspect the affected native run and resolve its reported condition before retrying maintenance.',
      );
    lines.push('');
  }
  return {
    stdout: lines.join('\n'),
    stderr: diagnostics.length ? `${diagnostics.join('\n')}\n` : '',
    exitCode: attention ? 1 : 0,
  };
}
