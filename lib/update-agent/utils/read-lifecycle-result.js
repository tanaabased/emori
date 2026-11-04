import safeText from '../../command-report/utils/safe-text.js';

/** Select bounded report fields; the managed command owns its schema and verdict. */
export default function readLifecycleResult(value, { operation, environment }) {
  const reporting = [];
  const text = (value, maximum = 120) => safeText(value, maximum, environment);
  const select = (item) => {
    const selected = Object.fromEntries(
      ['component', 'code', 'message', 'stepId', 'status', 'remediation']
        .filter((key) => typeof item?.[key] === 'string')
        .map((key) => [key, text(item[key], ['message', 'remediation'].includes(key) ? 384 : 120)]),
    );
    for (const key of ['component', 'code', 'message'])
      if (!selected[key]) selected[key] = 'Unavailable';
    return selected;
  };
  const entries = (items, label, maximum, finding = false) => {
    if (!Array.isArray(items)) {
      reporting.push(`${label} unavailable.`);
      return { details: [], omitted: 0 };
    }
    const usable = items.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (
      usable.length !== items.length ||
      usable.some((item) =>
        ['component', 'code', 'message', ...(finding ? ['status'] : [])].some(
          (key) => typeof item[key] !== 'string' || !item[key].trim(),
        ),
      )
    )
      reporting.push(`${label} partially unavailable.`);
    const ordered = finding
      ? [...usable].sort((a, b) => Number(a.status === 'healthy') - Number(b.status === 'healthy'))
      : usable;
    return {
      details: ordered.slice(0, maximum).map(select),
      omitted: items.length - Math.min(ordered.length, maximum),
      ...(finding ? { warnings: usable.filter((item) => item.status !== 'healthy').length } : {}),
    };
  };
  if (operation === 'doctor') {
    const status = text(value?.status);
    if (!status) reporting.push('Doctor status unavailable.');
    const findings = entries(value?.findings, 'Doctor findings', 12, true);
    return {
      health: {
        ...(status ? { status } : {}),
        findings: findings.details,
        omitted: findings.omitted,
        ...(findings.warnings !== undefined ? { warnings: findings.warnings } : {}),
      },
      ...(reporting.length ? { reporting } : {}),
    };
  }
  const outcomes = Array.isArray(value?.outcomes) ? value.outcomes : undefined;
  const unattempted = Array.isArray(value?.unattempted) ? value.unattempted.length : undefined;
  const countable = outcomes?.filter((item) => typeof item?.status === 'string');
  if (!outcomes || countable.length !== outcomes.length)
    reporting.push('Install component counts unavailable or incomplete.');
  if (value?.unattempted !== undefined && unattempted === undefined)
    reporting.push('Unattempted Install component count unavailable.');
  const warnings = entries(value?.warnings, 'Install warnings', 8);
  return {
    setup: 'skipped',
    lifecycle: {
      ...(outcomes
        ? {
            completed: countable.filter((item) => item.status !== 'skipped').length,
            skipped: countable.filter((item) => item.status === 'skipped').length,
          }
        : {}),
      ...(unattempted !== undefined ? { unattempted } : {}),
    },
    ...(Array.isArray(value?.warnings) ? { warnings: value.warnings.length } : {}),
    warningDetails: warnings.details,
    warningsOmitted: warnings.omitted,
    ...(reporting.length ? { reporting } : {}),
  };
}
