import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import runUpdateTask from '../task.js';
import updateStorage from '../storage.js';
import verifyUpdate from '../verify.js';

const head = 'a'.repeat(40);
const original = (workspace) => ({
  version: 1,
  job: 'update-agent',
  workspace,
  id: 'original',
  status: 'attention',
  reason: 'doctor-unhealthy',
  before: head,
  after: head,
  steps: {
    source: { status: 'completed' },
    dependencies: { status: 'completed' },
    install: { status: 'completed', warnings: 1 },
    doctor: { status: 'blocked', reason: 'doctor-unhealthy' },
  },
});
const observation = (workspace) => ({
  workspace,
  canonical: true,
  head,
  dirty: false,
  branch: 'main',
  inProgress: false,
  upstream: 'origin/main',
  remoteApproved: true,
});
function fixture(record = original('/fixture/emori'), observed = observation('/fixture/emori')) {
  const calls = [],
    writes = [];
  return {
    calls,
    writes,
    options: {
      workspace: '/fixture/emori',
      id: 'verification',
      now: () => 1000,
      storage: {
        read: async () => record,
        assertHeld: async () => calls.push('lock'),
        write: async (value, name) => writes.push({ value: structuredClone(value), name }),
      },
      commands: {
        inspect: async () => {
          calls.push('inspect');
          return observed;
        },
        doctor: async () => {
          calls.push('doctor');
          return { health: { status: 'healthy', findings: [], omitted: 0, warnings: 0 } };
        },
      },
    },
  };
}
describe('lib/update-agent/verify', () => {
  it('should inspect and check Doctor once, retaining a separately linked observation without rewriting the update', async () => {
    const record = original('/fixture/emori'),
      before = structuredClone(record),
      f = fixture(record);
    const value = await verifyUpdate(f.options);
    assert.deepEqual(record, before);
    assert.deepEqual(f.calls, ['lock', 'inspect', 'doctor', 'lock', 'inspect']);
    assert.equal(value.verification.updateId, 'original');
    assert.equal(value.verification.status, 'success');
    assert.equal(value.verification.steps.doctor.elapsedMs, 0);
    assert(f.writes.every(({ name }) => name === 'verification'));
    assert.equal(value.result.steps.doctor.status, 'blocked');
  });
  it('should refuse uncertain, malformed, wrong-workspace and incompletely applied checkpoints before commands', async () => {
    for (const change of [
      undefined,
      { pending: 'install' },
      { predecessor: 'uncertain' },
      { workspace: '/other' },
      { status: 'running' },
      { after: 'invalid' },
      { steps: { install: { status: 'completed' } } },
      { steps: { ...original('/fixture/emori').steps, install: { status: 'running' } } },
      {
        steps: {
          ...original('/fixture/emori').steps,
          doctor: { status: 'blocked', elapsedMs: -1 },
        },
      },
    ]) {
      const f = fixture(change === undefined ? null : { ...original('/fixture/emori'), ...change });
      await assert.rejects(verifyUpdate(f.options), /verification-refused/);
      assert.deepEqual(f.calls, []);
      assert.deepEqual(f.writes, []);
    }
  });
  it('should refuse changed revision, dirty checkout, unsupported identity and missing lock without Doctor or writes', async () => {
    for (const change of [
      { head: 'b'.repeat(40) },
      { dirty: true },
      { canonical: false },
      { workspace: '/other' },
      { branch: 'task' },
      { inProgress: true },
      { remoteApproved: false },
    ]) {
      const f = fixture(original('/fixture/emori'), {
        ...observation('/fixture/emori'),
        ...change,
      });
      await assert.rejects(verifyUpdate(f.options), /verification-refused/);
      assert(!f.calls.includes('doctor'));
      assert.deepEqual(f.writes, []);
    }
    const f = fixture();
    f.options.storage.assertHeld = async () => {
      throw new Error('update-lock-lost');
    };
    await assert.rejects(verifyUpdate(f.options), /update-lock-lost/);
    assert.deepEqual(f.writes, []);
  });
  it('should retain a failed/stale verification without retrying or blessing the original attempt', async () => {
    for (const reason of [
      'doctor-unhealthy',
      'automation-execution-stale',
      'command-timeout',
      'command-failed',
    ]) {
      const f = fixture();
      f.options.commands.doctor = async () => {
        f.calls.push('doctor');
        throw Object.assign(
          new Error(reason),
          reason === 'command-failed'
            ? {
                exitCode: 9,
                reporting: ['Doctor output unreadable.'],
                processFailure: { kind: 'exit', exitCode: 9 },
              }
            : {},
        );
      };
      const value = await verifyUpdate(f.options);
      assert.equal(value.verification.status, 'attention');
      assert.equal(value.verification.reason, reason);
      if (reason === 'command-failed') {
        assert.equal(value.verification.steps.doctor.exitCode, 9);
        assert.equal(value.verification.steps.doctor.processFailure.exitCode, 9);
        assert.deepEqual(value.verification.steps.doctor.reporting, ['Doctor output unreadable.']);
      }
      assert.equal(value.result.status, 'attention');
      assert.equal(f.calls.filter((item) => item === 'doctor').length, 1);
    }
  });
});
describe('lib/update-agent/verify (filesystem component)', () => {
  it('should keep original archive bytes and distinct verification archives through repeated checks', async () => {
    const workspace = await realpath(await mkdtemp(join(tmpdir(), 'verify-agent-')));
    let storage;
    try {
      storage = await updateStorage(workspace);
      const record = original(workspace);
      await storage.write(record);
      const statusPath = join(workspace, '.private/update-agent/status.json');
      const before = await readFile(statusPath, 'utf8');
      const commands = {
        inspect: async () => observation(workspace),
        doctor: async () => ({
          health: { status: 'healthy', findings: [], omitted: 0, warnings: 0 },
        }),
      };
      for (const id of ['first', 'second'])
        await verifyUpdate({ workspace, storage, commands, id });
      assert.equal(await readFile(statusPath, 'utf8'), before);
      assert.equal(
        await readFile(join(workspace, '.private/update-agent/runs/original.json'), 'utf8'),
        before,
      );
      for (const id of ['first', 'second'])
        assert.equal(
          JSON.parse(await readFile(join(workspace, `.private/update-agent/runs/${id}.json`)))
            .updateId,
          'original',
        );
      assert.equal((await storage.read('verification')).id, 'second');
    } finally {
      await storage?.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
describe('lib/update-agent/task recovery modes', () => {
  it('should ignore verification for an older update and reject a malformed retained update', async () => {
    for (const malformed of [false, true]) {
      let output = '';
      const record = {
        ...original('/fixture/emori'),
        id: 'new-update',
        status: 'success',
        steps: {
          ...original('/fixture/emori').steps,
          doctor: { status: 'completed', health: { status: 'healthy', findings: [] } },
        },
        ...(malformed ? { job: 'other-job' } : {}),
      };
      const code = await runUpdateTask({
        argv: ['--report-only'],
        cwd: '/fixture/emori',
        canonicalize: async () => '/fixture/emori',
        open: async () => ({
          read: async (name) => (name === 'verification' ? { updateId: 'older-update' } : record),
          close: async () => {},
        }),
        stdout: {
          write: (value) => {
            output += value;
          },
        },
        stderr: { write: () => {} },
        commands: () => assert.fail('commands constructed'),
      });
      assert.equal(code, malformed ? 1 : 0);
      assert.equal(JSON.parse(output).cards[0].status, malformed ? 'error' : 'warning');
    }
  });
  it('should show help before runtime, canonicalization or storage access and reject conflicting flags', async () => {
    let text = '';
    const options = {
      runtimeVersion: 'invalid',
      stdout: {
        write: (value) => {
          text += value;
        },
      },
      stderr: { write: () => {} },
      canonicalize: async () => assert.fail('state accessed'),
      open: async () => assert.fail('state accessed'),
    };
    assert.equal(await runUpdateTask({ ...options, argv: ['--help'] }), 0);
    assert.match(text, /--verify-only/);
    text = '';
    assert.equal(await runUpdateTask({ ...options, argv: ['--verify-only', '--report-only'] }), 1);
    assert.equal(JSON.parse(text).cards[0].status, 'error');
  });
  it('should read retained evidence without constructing commands or replaying an update', async () => {
    let output = '',
      closed = false;
    const exit = await runUpdateTask({
      argv: ['--report-only'],
      cwd: '/fixture/emori',
      canonicalize: async () => '/fixture/emori',
      open: async () => ({
        read: async (name) => (name === 'verification' ? undefined : original('/fixture/emori')),
        close: async () => {
          closed = true;
        },
      }),
      commands: () => assert.fail('command construction'),
      run: () => assert.fail('update replay'),
      stdout: {
        write: (value) => {
          assert(closed);
          output += value;
        },
      },
      stderr: { write: () => {} },
    });
    assert.equal(exit, 1);
    assert.match(output, /Retained report only/);
    assert.equal(JSON.parse(output).cards.length, 1);
  });
});
