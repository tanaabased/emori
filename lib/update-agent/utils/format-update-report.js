import { failureCode } from '../run.js';

const earlyCodes = new Set([
  'arguments-invalid',
  'runtime-unsupported',
  'backup-run-locked',
  'update-run-locked',
  'backup-lock-lost',
  'update-lock-lost',
  'private-directory-unsafe',
  'update-lock-unsafe',
]);
const labels = {
  source: 'Source',
  dependencies: 'Frozen dependencies',
  install: 'Install (skip setup)',
  doctor: 'Doctor (normal checks)',
  loaded: 'Loaded source/profile',
};
const statuses = {
  completed: 'Completed',
  skipped: 'Skipped',
  blocked: 'Pending',
  running: 'Uncertain',
  unattempted: 'Not attempted',
};

function nextAction(code) {
  if (code === 'runtime-unsupported')
    return 'Use a Bun runtime matching `package.json#engines.bun`, then retry.';
  if (code === 'arguments-invalid')
    return 'Run `bun scripts/update-agent-task.js` without arguments.';
  if (code.endsWith('-run-locked'))
    return 'Wait for the lock owner to finish; do not remove its lock.';
  if (code === 'automation-execution-stale')
    return 'Reconcile the changed configuration through Agent System Install, then verify loaded state.';
  return 'Inspect `.private/update-agent/status.json` and native run details before recovery; do not blindly replay uncertain mutations.';
}

/** Render owned facts only; neither raw child output nor arbitrary exception text is report content. */
export default function formatUpdateReport({ result, failure, closeFailed = false }) {
  const complete =
    result?.status === 'success' &&
    Object.keys(labels).every((name) => result.steps?.[name]?.status === 'completed');
  const failed = Boolean(failure || closeFailed);
  const attention = failed || !complete;
  const reason = failure ?? (result?.reason ? new Error(result.reason) : undefined);
  const code = earlyCodes.has(reason?.message) ? reason.message : failureCode(reason);
  const heading = failed ? 'failed' : attention ? 'needs attention' : 'completed';
  const lines = [`## Agent update ${heading}`, ''];
  if (result) {
    for (const [name, label] of Object.entries(labels)) {
      const step = result.steps?.[name];
      const status = statuses[step?.status] ?? 'Not attempted';
      const unchanged = name === 'source' && step?.status === 'completed' && step.changed === false;
      lines.push(`- ${status}: ${label}${unchanged ? ' (unchanged)' : ''}.`);
    }
    const revision = (value) => (/^[a-f0-9]{40}$/.test(value) ? value.slice(0, 12) : 'unknown');
    lines.push(`- Revisions: ${revision(result.before)} → ${revision(result.after)}.`);
    const lifecycle = result.steps?.install?.lifecycle;
    if (lifecycle) {
      for (const name of ['completed', 'skipped', 'unattempted']) {
        if (Number.isSafeInteger(lifecycle[name]) && lifecycle[name] >= 0)
          lines.push(`- Install components ${name}: ${lifecycle[name]}.`);
      }
    }
    const warnings = result.steps?.install?.warnings;
    if (Number.isSafeInteger(warnings) && warnings > 0)
      lines.push(`- Warnings: Install reported ${warnings}; inspect native lifecycle details.`);
    if (Object.hasOwn(labels, result.pending))
      lines.push(
        `- Uncertain: ${labels[result.pending]}; completed work has not been rolled back.`,
      );
  } else {
    lines.push('- Not attempted: maintenance completion is not established.');
  }
  if (code.endsWith('-run-locked'))
    lines.push('- Skipped: this execution; another run holds the lock.');
  if (closeFailed) lines.push('- Failed: exclusion descriptor close.');
  if (attention) lines.push(`- Reason: \`${code}\`.`, `- Next: ${nextAction(code)}`);
  lines.push(
    '- Reporting: Agent System handles formatting/delivery separately; stdout is not delivery confirmation.',
  );
  return {
    stdout: `${lines.join('\n')}\n`,
    stderr: attention
      ? `Agent update (${code})${closeFailed ? '; exclusion-close-failed' : ''}.\n`
      : '',
    exitCode: attention ? 1 : 0,
  };
}
