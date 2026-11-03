import assert from 'node:assert/strict';

import updateCommands from '../commands.js';
import readLifecycleResult from '../utils/read-lifecycle-result.js';

const context = {
  operation: 'doctor',
  workspace: '/fixture/emori',
  environment: { TOKEN: 'private/value' },
};
const finding = {
  component: 'fixture',
  code: 'fixture-blocked',
  status: 'blocked',
  message: 'Inspect fixture',
  remediation: 'Repair fixture',
};
const doctor = {
  agentId: 'emori',
  workspaceDir: context.workspace,
  status: 'blocked',
  findings: [finding],
};
const commands = (response) =>
  updateCommands({
    workspace: context.workspace,
    environment: { AGENT_SYSTEM_GIT: '/bound/git', TOKEN: 'private/value' },
    storage: { lockFds: [], assertHeld: async () => {} },
    spawn: () => response,
  });
describe('lib/update-agent/utils/read-lifecycle-result', () => {
  it('should retain validated blocked findings on nonzero exit without arbitrary nested fields', async () => {
    await assert.rejects(
      commands({
        status: 1,
        stdout: JSON.stringify({
          ...doctor,
          findings: [
            {
              ...finding,
              settings: { token: 'secret' },
              message: 'private/value and private%2Fvalue',
            },
          ],
        }),
      }).doctor(500),
      (error) => {
        assert.equal(error.message, 'doctor-unhealthy');
        assert.equal(error.health.findings[0].code, finding.code);
        assert.equal(error.health.findings[0].remediation, finding.remediation);
        assert.doesNotMatch(JSON.stringify(error), /private|settings|secret/);
        assert.deepEqual(error.processFailure, { kind: 'exit', exitCode: 1 });
        return true;
      },
    );
  });
  it('should bound findings with omissions and preserve aggregate warning state', () => {
    const result = readLifecycleResult(
      { ...doctor, findings: Array(100).fill({ ...finding, message: 'x'.repeat(10000) }) },
      context,
    );
    assert.equal(result.health.findings.length, 12);
    assert.equal(result.health.omitted, 88);
    assert.equal(result.health.warnings, 100);
    assert(JSON.stringify(result).length < 12000);
    assert.match(result.health.findings[0].message, /detail omitted/);
  });
  it('should reject mismatched identity, contradictory aggregate, malformed findings and incomplete envelopes', () => {
    for (const change of [
      { agentId: 'other' },
      { workspaceDir: '/other' },
      { status: 'healthy' },
      { findings: undefined },
      { findings: [{ ...finding, status: 'unknown' }] },
      { findings: [{ ...finding, code: 'bad\ncode' }] },
    ])
      assert.throws(
        () => readLifecycleResult({ ...doctor, ...change }, context),
        /command-output-invalid/,
      );
  });
  it('should distinguish unhealthy checks, invalid/contradictory output, timeouts and process failures', async () => {
    for (const [response, code] of [
      [{ status: 0, stdout: JSON.stringify(doctor) }, 'command-output-invalid'],
      [
        { status: 1, stdout: JSON.stringify({ ...doctor, status: 'healthy', findings: [] }) },
        'command-failed',
      ],
      [{ status: 0, stdout: 'not json' }, 'command-output-invalid'],
      [{ status: 0, stdout: JSON.stringify(doctor) + '{}' }, 'command-output-invalid'],
      [{ error: { code: 'ETIMEDOUT' } }, 'command-timeout'],
      [{ error: { code: 'ENOBUFS' } }, 'command-output-limit'],
      [{ status: null, signal: 'SIGTERM' }, 'command-failed'],
      [{ error: { code: 'ENOENT' } }, 'command-failed'],
      [
        { status: 1, stderr: 'automation-execution-stale', stdout: JSON.stringify(doctor) },
        'automation-execution-stale',
      ],
    ])
      await assert.rejects(commands(response).doctor(500), { message: code });
  });
  it('should retain only bounded actionable Install warning fields', () => {
    const result = readLifecycleResult(
      {
        ...doctor,
        outcomes: [
          { component: 'fixture', code: 'updated', message: 'Updated fixture', status: 'updated' },
        ],
        warnings: Array(12).fill({
          component: 'fixture',
          code: 'manual',
          message: 'private/value',
          settings: 'secret',
        }),
      },
      { ...context, operation: 'install' },
    );
    assert.equal(result.lifecycle.completed, 1);
    assert.equal(result.warnings, 12);
    assert.equal(result.warningDetails.length, 8);
    assert.equal(result.warningsOmitted, 4);
    assert.doesNotMatch(JSON.stringify(result), /private|settings|secret/);
  });
});
