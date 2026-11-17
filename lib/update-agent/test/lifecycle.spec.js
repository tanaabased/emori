import assert from 'node:assert/strict';

import lifecycle from '../lifecycle.js';

const execute = (value) => async () => JSON.stringify(value);
describe('lib/update-agent/lifecycle', () => {
  it('should keep explicit setup skipping green but surface other native Install warnings', async () => {
    const value = { outcomes: [], warnings: [{ code: 'setup-skipped' }] };
    assert.equal((await lifecycle('install', execute(value))).status, 'success');
    value.warnings.push({
      code: 'manual',
      message: 'Review configuration.',
      remediation: 'Repair the schedule.',
    });
    const result = await lifecycle('install', execute(value));
    assert.equal(result.status, 'warning');
    assert(result.actions.includes('Repair the schedule.'));
  });
  it('should report native Doctor drift on its expected nonzero exit without hiding actual process failures', async () => {
    const health = JSON.stringify({
      status: 'drift',
      findings: [{ status: 'drift', message: 'Schedule differs.', remediation: 'Repair it.' }],
    });
    const failed = async () => {
      throw Object.assign(new Error('command-failed'), { exitCode: 1, stdout: health });
    };
    assert.equal((await lifecycle('doctor', failed)).status, 'warning');
    for (const reason of ['timeout', 'cancelled', 'automation-execution-stale'])
      await assert.rejects(
        lifecycle('doctor', async () => {
          throw Object.assign(new Error(reason), { exitCode: 1, stdout: health });
        }),
        { message: reason },
      );
    await assert.rejects(
      lifecycle('doctor', async () => {
        throw Object.assign(new Error('command-failed'), {
          exitCode: 1,
          stdout: JSON.stringify({ status: 'healthy', findings: [] }),
        });
      }),
      /command-failed/,
    );
  });
  it('should not treat unreadable success as verified application or health', async () => {
    for (const operation of ['install', 'doctor']) {
      const result = await lifecycle(operation, async () => 'not JSON');
      assert.equal(result.status, 'warning');
      assert(result.actions.length);
    }
  });
});
