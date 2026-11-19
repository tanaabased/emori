import safeText from '../command-report/utils/safe-text.js';

const automationHistory = new Set([
  'automation-execution-failed',
  'automation-delivery-failed',
  'automation-delivery-unavailable',
]);

/** Native commands own health and application verdicts; expected setup skipping is informational. */
export default async function lifecycle(operation, execute) {
  let output;
  let failed;
  try {
    output = await execute('openclaw', [
      'agent-system',
      operation,
      ...(operation === 'install' ? ['--skip-setup'] : []),
      '--json',
    ]);
  } catch (error) {
    failed = error;
    output = error.stdout;
  }
  let value;
  try {
    value = JSON.parse(output);
  } catch {
    /* Report unreadable success separately from failed execution. */
  }
  if (operation === 'doctor') {
    if (failed && (failed.message !== 'command-failed' || failed.exitCode !== 1)) throw failed;
    const health = value?.status;
    if (!['healthy', 'drift', 'blocked'].includes(health) || !Array.isArray(value?.findings)) {
      if (failed) throw failed;
      return {
        status: 'warning',
        label: 'Unverified',
        result: 'Doctor result unreadable.',
        actions: [
          'Run Doctor to establish current health; do not repeat updates just to recover a report.',
        ],
      };
    }
    if (health === 'healthy' && failed) throw failed;
    const findings = value.findings.filter(
      (item) => item?.status !== 'healthy' && !automationHistory.has(item?.code),
    );
    if (health === 'healthy' && !findings.length) {
      return {
        status: 'success',
        label: 'Healthy',
        result: 'No outstanding repairs.',
        actions: [],
      };
    }
    const advisory = health === 'healthy' && findings.every((item) => item?.status === 'warning');
    return {
      status: advisory ? 'advisory' : 'warning',
      label: advisory ? 'Advisories' : health === 'drift' ? 'Drift detected' : 'Repair needed',
      result:
        findings
          .slice(0, 3)
          .map((item) => safeText(item?.message, 120))
          .filter(Boolean)
          .join(' ') || `Doctor reports ${health}.`,
      actions: findings
        .slice(0, 6)
        .map((item) => safeText(item?.remediation, 300))
        .filter(Boolean)
        .concat(
          findings.length > 6 || !findings.some((item) => item?.remediation)
            ? [
                advisory
                  ? 'Review the Doctor advisories for details.'
                  : 'Inspect Doctor findings and resolve the outstanding repairs.',
              ]
            : [],
        ),
    };
  }
  if (failed) throw failed;
  if (!Array.isArray(value?.outcomes) || !Array.isArray(value?.warnings))
    return {
      status: 'warning',
      label: 'Unverified',
      result: 'Install completed, but its report is unreadable.',
      actions: ['Run Doctor to verify installed state before making further changes.'],
    };
  const warnings = value.warnings.filter((item) => item?.code !== 'setup-skipped');
  if (warnings.length || value.unattempted?.length)
    return {
      status: 'warning',
      label: 'Attention needed',
      result: `${warnings.length} Install warning(s). Setup intentionally skipped.`,
      actions: warnings
        .slice(0, 6)
        .map((item) => safeText(item?.remediation || item?.message, 300))
        .filter(Boolean)
        .concat(['Resolve the outstanding Install findings; use Doctor to verify current state.']),
    };
  return {
    status: 'success',
    label: 'Aligned',
    result: 'Setup intentionally skipped.',
    actions: [],
  };
}
