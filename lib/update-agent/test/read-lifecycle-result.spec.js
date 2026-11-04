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
  it('should retain reported blocked findings on nonzero exit without arbitrary nested fields', async () => {
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
  it('should select reported status and findings without identity, identifier or aggregate checks', () => {
    for (const change of [
      { agentId: 'other', workspaceDir: '/other', unused: { secret: 'never retain' } },
      { status: 'healthy' },
      { findings: [{ ...finding, status: 'new status', code: 'code with spaces' }] },
    ]) {
      const input = { ...doctor, ...change };
      const result = readLifecycleResult(input, context);
      assert.equal(result.health.status, input.status);
      assert.equal(result.health.findings[0].status, input.findings[0].status);
      assert.equal(result.reporting, undefined);
      assert.doesNotMatch(JSON.stringify(result), /other|unused|secret/);
    }
  });
  it('should preserve usable fields when status, collections or individual fields are unavailable', () => {
    for (const value of [undefined, null, [], true, 'text', {}, { findings: {} }]) {
      const result = readLifecycleResult(value, context);
      assert.equal(result.health.status, undefined);
      assert(result.reporting.length);
    }
    const result = readLifecycleResult(
      { findings: [null, finding, { message: 'Keep detail' }] },
      context,
    );
    assert.equal(result.health.findings[0].code, finding.code);
    assert.equal(result.health.findings[1].message, 'Keep detail');
    assert(result.reporting.some((item) => item.includes('partially unavailable')));
    const novel = readLifecycleResult({ status: 'pending', findings: [] }, context);
    assert.equal(novel.health.status, 'pending');
  });
  it('should keep exit code independent from reported health and unreadable output', async () => {
    for (const stdout of [
      JSON.stringify(doctor),
      'not json',
      JSON.stringify(doctor) + '{}',
      '{}',
    ]) {
      const result = await commands({ status: 0, stdout }).doctor(500);
      assert.equal(result.exitCode, 0);
      if (stdout === JSON.stringify(doctor)) assert.equal(result.health.status, 'blocked');
      else {
        assert.equal(result.health.status, undefined);
        assert(result.reporting.length);
      }
    }
    for (const stdout of ['not json', '{}', JSON.stringify({ status: 'healthy', findings: [] })])
      await assert.rejects(commands({ status: 17, stdout }).doctor(500), (error) => {
        assert.equal(error.message, 'command-failed');
        assert.equal(error.exitCode, 17);
        assert.deepEqual(error.processFailure, { kind: 'exit', exitCode: 17 });
        return true;
      });
  });
  it('should distinguish native refusals, timeouts and process failures regardless of output', async () => {
    for (const [response, code] of [
      [{ error: { code: 'ETIMEDOUT' } }, 'command-timeout'],
      [{ error: { code: 'ENOBUFS' } }, 'command-output-limit'],
      [{ status: null, signal: 'SIGTERM' }, 'command-failed'],
      [{ error: { code: 'ENOENT' } }, 'command-failed'],
      [
        { status: 1, stderr: 'automation-execution-stale', stdout: 'not json' },
        'automation-execution-stale',
      ],
      [
        { status: 0, stderr: 'automation-execution-stale', stdout: JSON.stringify(doctor) },
        'automation-execution-stale',
      ],
    ])
      await assert.rejects(commands(response).doctor(500), { message: code });
  });
  it('should sanitize status and identifier fields as well as messages', () => {
    const result = readLifecycleResult(
      {
        status: 'private/value',
        findings: [{ ...finding, status: 'private%2Fvalue', code: 'private/value' }],
      },
      context,
    );
    assert.doesNotMatch(JSON.stringify(result), /private|%2F/);
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
