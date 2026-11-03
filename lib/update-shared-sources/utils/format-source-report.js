import { createHash } from 'node:crypto';

import serializeReport from '../../command-report/utils/serialize-report.js';

const reasons = {
  unsupported: 'Source is not approved for shared updates.',
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

const phaseLabels = {
  inspect: 'Inspect source',
  fetch: 'Check for source changes',
  revalidate: 'Recheck checkout safety',
  advance: 'Advance source',
  install: 'Install required dependencies',
  sync: 'Build and sync shared tools',
  'build-check': 'Verify build artifacts',
};
const knownSteps = new Set([
  'fetched',
  'advanced',
  'unchanged',
  'dependencies-installed',
  'synced',
  'build-current',
]);
const revision = (value) =>
  typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value)
    ? value.slice(0, 12)
    : undefined;

/** One application card per source; never infer activation from files or a restart request. */
export default function formatSourceReport(
  results,
  { historical = false, previous = [], failure, closeFailed = false, retained = false } = {},
) {
  let attention = results.length === 0;
  const diagnostics = [];
  const cards = results.map((result) => {
    const approved = ['canon', 'openclaw-agent-system'].includes(result.id);
    const named = approved || ['emori', 'smutlord'].includes(result.id);
    const id = named ? result.id : createHash('sha256').update(String(result.id)).digest('hex');
    const status = ['completed', 'excluded', 'skipped', 'pending', 'failed'].includes(result.status)
      ? result.status
      : 'unknown';
    const steps = result.steps ?? [],
      pending = result.pending ?? [];
    const uncertain = pending.length > 0 || steps.some((step) => !knownSteps.has(step));
    const current = Boolean(
      revision(result.before) &&
      result.before === result.after &&
      result.after === result.target &&
      steps.includes('unchanged') &&
      steps.includes('dependencies-installed'),
    );
    const activationOnly =
      result.id === 'openclaw-agent-system' &&
      status === 'completed' &&
      pending.length === 1 &&
      pending[0] === 'restart' &&
      steps.includes('dependencies-installed') &&
      steps.some((step) => ['synced', 'build-current'].includes(step));
    const failed = status === 'failed';
    const sourceAttention =
      !['completed', 'excluded'].includes(status) ||
      (uncertain && !activationOnly) ||
      Boolean(result.reason) ||
      (result.exitCode !== undefined && result.exitCode !== 0) ||
      (!approved && status !== 'excluded');
    attention ||= sourceAttention || historical;
    const unverifiedActivation = result.id === 'openclaw-agent-system' && status !== 'excluded';
    const warning =
      historical ||
      uncertain ||
      unverifiedActivation ||
      sourceAttention ||
      failure ||
      closeFailed ||
      (status === 'completed' &&
        (!steps.includes('dependencies-installed') ||
          !revision(result.after) ||
          result.after !== result.target));
    const card = {
      id: `shared-source:${id}`,
      title: named ? result.id : 'Other source',
      status:
        failed || result.exitCode > 0
          ? 'error'
          : status === 'excluded' && !warning
            ? 'success'
            : status === 'completed' && approved
              ? warning
                ? 'warning'
                : 'success'
              : status === 'unknown'
                ? 'unknown'
                : 'warning',
      summary:
        status === 'excluded'
          ? 'Excluded; no inspection or mutation. All update steps not attempted.'
          : status === 'completed'
            ? current && !warning
              ? 'Already up to date.'
              : current
                ? 'Source unchanged; completed work and outstanding warnings are recorded below.'
                : 'Source update completed; review required checks and activation below.'
            : failed
              ? 'Source update failed; completed steps remain facts.'
              : 'Source update skipped, incomplete or unverified.',
      facts: [],
      findings: [],
      actions: [],
    };
    if (status !== 'excluded') {
      const before = revision(result.before),
        after = revision(result.after),
        target = revision(result.target);
      card.facts.push(
        {
          label: 'Source revision',
          value: after
            ? before === after
              ? `Unchanged ${after}`
              : `${before ?? 'Unknown'} → ${after}`
            : `Before ${before ?? 'unknown'}; after unknown${target ? `; target ${target} not verified as reached` : ''}`,
        },
        {
          label: 'Install required dependencies',
          value: steps.includes('dependencies-installed')
            ? 'Reconciled (frozen)'
            : failed && result.phase === 'install'
              ? 'Failed'
              : 'Not attempted or unverified',
        },
        {
          label: 'Build and sync shared tools',
          value:
            result.id === 'canon'
              ? 'Not applicable'
              : steps.includes('synced')
                ? 'Complete'
                : steps.includes('build-current')
                  ? 'Current; build inputs and artifacts verified; sync not needed'
                  : failed && result.phase === 'sync'
                    ? 'Failed; partial build possible'
                    : 'Not attempted or unverified',
        },
      );
      if (unverifiedActivation) {
        card.facts.push({
          label: 'Activation/restart',
          value: pending.includes('restart')
            ? 'Gateway restart pending; running build unverified'
            : 'Running build unverified',
        });
        card.findings.push(
          'Loaded-build evidence unavailable: no supported running-instance artifact observation is available. An on-disk digest or unchanged fetch does not verify activation.',
        );
        card.actions.push(
          pending.includes('restart') && !failed
            ? 'Arrange a separately authorized operator restart when work is idle. Automatic restart is disabled; another source update is not required. Activation remains unverified without matching loaded-build evidence.'
            : 'Inspect retained build evidence and native run details; do not interrupt active work or restart a failed partial build blindly.',
        );
      }
      if (result.reason)
        card.findings.push(
          Object.hasOwn(reasons, result.reason)
            ? reasons[result.reason]
            : 'Unrecognized outcome; inspect the native run.',
        );
      if (steps.some((step) => !knownSteps.has(step)))
        card.findings.push('Unrecognized step (not verified).');
      if (pending.some((step) => step !== 'restart'))
        card.findings.push('Unrecognized pending work; completion is unverified.');
      if (failed) {
        const phase = Object.hasOwn(phaseLabels, result.phase) ? result.phase : 'unknown';
        const exit =
          Number.isInteger(result.exitCode) && result.exitCode > 0 && result.exitCode <= 255
            ? `; exit ${result.exitCode}`
            : '';
        card.findings.push(`Failed step: ${phase}${exit}.`);
        diagnostics.push(`${named ? result.id : 'Other source'}: ${phase} failed${exit}.`);
      }
      for (const timing of result.timings ?? [])
        if (
          Object.hasOwn(phaseLabels, timing.phase) &&
          Number.isFinite(timing.elapsedMs) &&
          timing.elapsedMs >= 0
        )
          card.facts.push({
            label: `${phaseLabels[timing.phase]} (${timing.phase})`,
            value: `${(timing.elapsedMs / 1000).toFixed(1)}s`,
          });
      if (!result.timings?.length)
        card.facts.push({ label: 'Phase timings', value: 'Unavailable for this retained outcome' });
      if (sourceAttention && !card.actions.length)
        card.actions.push(
          'Inspect the affected native run and resolve its reported condition before retrying updates.',
        );
    }
    if (retained)
      card.findings.push(
        'Retained report only; no source update, activation check or message delivery was performed.',
      );
    if (historical)
      card.findings.push(
        'Historical record: previous interrupted source update. Completed steps remain facts; unfinished steps are unverified. No completion or rollback is inferred.',
      );
    if (previous.some((item) => item.id === result.id))
      card.findings.push(
        'A previous interrupted update is retained separately; this card describes the current recorded outcome.',
      );
    if (failure || closeFailed) {
      card.findings.push(
        closeFailed
          ? 'Journal cleanup failed; completed source steps still apply.'
          : 'Wrapper or journal operation failed; inspect retained evidence.',
      );
      card.actions.push(
        'Inspect the retained journal and native run; do not rerun updates to resend reports.',
      );
    }
    return card;
  });
  if (!cards.length)
    cards.push({
      id: 'shared-source-report',
      title: 'Shared-source update',
      status: failure || closeFailed ? 'error' : 'unknown',
      summary: 'No source outcomes recorded. No successful update is inferred.',
      findings: [
        historical
          ? 'Retained evidence is interrupted.'
          : 'Inventory or retained evidence is unavailable or empty.',
        ...(closeFailed ? ['Journal cleanup failed.'] : []),
      ],
      actions: ['Inspect the manifest inventory and private journal before another update.'],
    });
  return {
    stdout: serializeReport(cards),
    stderr: diagnostics.length ? `${diagnostics.join('\n')}\n` : '',
    exitCode: attention ? 1 : 0,
  };
}
