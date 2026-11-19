import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import openStorage from '../../backup/storage.js';
import runAgent from '../../update-agent/task.js';
import runSources from '../../update-shared-sources/task.js';
import fixture from './tasks.fixture.js';

const predecessor = {
  status: 'warning',
  code: 'automation-execution-failed',
  stepId: 'update-agent',
  message: 'Previous update failed.',
  remediation: 'Inspect earlier runs.',
};

describe('nightly updates (filesystem component, fake managed commands)', () => {
  let f;
  beforeEach(async () => {
    f = await fixture();
  });
  afterEach(async () => f.close());

  it('should refresh both shared sources, sync even unchanged Agent System, and report one green table', async () => {
    f.states['openclaw-agent-system'].head = f.states['openclaw-agent-system'].target;
    const result = await f.run(runSources);
    assert.equal(result.exitCode, 0);
    assert.equal(result.document.cards.length, 1);
    assert.equal(result.document.cards[0].format, 'markdown');
    assert.match(result.body, /✅ UPDATE SOURCES/);
    assert.match(result.body, /Canon.*✅ Updated/);
    assert.match(result.body, /Agent System.*✅ Current/);
    assert.match(result.body, /Action needed:\*\* None/);
    assert.doesNotMatch(result.body, /⚠️|❌/);
    assert.equal(f.states.canon.head, f.states.canon.target);
    assert(
      f.calls.some(
        (call) => call.id === 'openclaw-agent-system' && call.argv.join(' ') === 'run sync',
      ),
    );
    assert(!f.calls.some((call) => call.family === 'openclaw'));
  });

  it('should update EMORI, skip setup, and finish with verified health', async () => {
    const result = await f.run(runAgent);
    assert.equal(result.exitCode, 0);
    assert.match(result.body, /✅ UPDATE AGENT/);
    assert.match(result.body, /Install.*✅ Aligned.*Setup intentionally skipped/);
    assert.match(result.body, /Doctor.*✅ Healthy/);
    assert.doesNotMatch(result.body, /ℹ️ Skipped/);
    assert.doesNotMatch(result.body, /⚠️|❌/);
    assert.equal(f.states.emori.head, f.states.emori.target);
    assert.deepEqual(
      f.calls.filter((call) => call.family === 'openclaw').map((call) => call.argv),
      [
        ['agent-system', 'install', '--skip-setup', '--json'],
        ['agent-system', 'doctor', '--json'],
      ],
    );
    assert(f.calls.some((call) => call.family === 'bun' && call.argv.includes('--ignore-scripts')));
  });

  for (const [change, reason] of [
    [{ dirty: true }, 'dirty-or-unknown'],
    [{ branch: 'feature' }, 'non-main'],
    [{ branch: '' }, 'detached'],
    [{ counts: '1 0' }, 'ahead'],
    [{ counts: '1 1' }, 'diverged'],
    [{ remote: 'git@github.com:other/emori.git' }, 'unsafe-upstream'],
  ])
    it(`should preserve an ineligible agent checkout (${reason})`, async () => {
      Object.assign(f.states.emori, change);
      const result = await f.run(runAgent);
      assert.notEqual(result.exitCode, 0);
      assert.match(result.body, /⚠️ UPDATE AGENT/);
      assert(result.body.includes(reason));
      assert.match(result.body, /Next action/);
      assert(!f.calls.some((call) => ['merge'].includes(call.argv[0]) || call.family !== 'git'));
      assert.equal(f.states.emori.head, 'a'.repeat(40));
    });

  it('should skip only the dirty shared source and still update the eligible source', async () => {
    f.states.canon.dirty = true;
    const result = await f.run(runSources);
    assert.match(result.body, /⚠️ UPDATE SOURCES/);
    assert.match(result.body, /Canon.*⚠️ Skipped/);
    assert.match(result.body, /Agent System.*✅ Updated/);
    assert.equal(f.states.canon.head, 'a'.repeat(40));
    assert(!f.calls.some((call) => call.id === 'canon' && call.family !== 'git'));
    assert.equal(f.states['openclaw-agent-system'].head, f.states['openclaw-agent-system'].target);
  });

  it('should distinguish a dirty repository stop from steps that never ran', async () => {
    f.states.emori.dirty = true;
    const result = await f.run(runAgent);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.body, /⚠️ UPDATE AGENT · ACTION NEEDED/);
    assert.match(result.body, /Repository.*⚠️ Skipped.*dirty-or-unknown.*1 changed path/);
    for (const step of ['Dependencies', 'Install', 'Doctor'])
      assert.ok(result.body.includes(`| ${step} | ℹ️ Skipped | Skipped |`));
    assert.match(result.body, /Next action.*git status --short.*affected checkout.*commit or move/);
    assert.doesNotMatch(result.body, /local-work/);
    assert(!f.calls.some((call) => call.argv[0] === 'fetch'));
  });

  it('should report unreadable Git status without trusting partial output', async () => {
    f.failures.emori = {
      'git status --porcelain=v2 --branch --untracked-files=all': Object.assign(
        new Error('command-failed'),
        { exitCode: 17, stdout: '? private-path' },
      ),
    };
    const result = await f.run(runAgent);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.body, /❌ UPDATE AGENT · RUN FAILED/);
    assert.match(result.body, /Repository.*❌ Failed.*exit 17.*status could not be read/i);
    assert.match(result.body, /Next action.*git status --short/);
    assert.doesNotMatch(result.body, /private-path/);
  });

  it('should preserve merge/rebase work even when the working tree appears clean', async () => {
    await writeFile(join(f.workspace, '.git', 'MERGE_HEAD'), 'c'.repeat(40));
    const result = await f.run(runAgent);
    assert.match(result.body, /in-progress/);
    assert(!f.calls.some((call) => call.argv[0] === 'merge' || call.family === 'openclaw'));
  });

  it('should report dependency failure as red without claiming Install or Doctor ran', async () => {
    f.failures.emori = {
      'bun install --frozen-lockfile --ignore-scripts': Object.assign(new Error('command-failed'), {
        exitCode: 17,
      }),
    };
    const result = await f.run(runAgent);
    assert.match(result.body, /❌ UPDATE AGENT/);
    assert.match(result.body, /Dependencies.*❌ Failed.*exit 17/);
    assert.match(result.body, /Repository.*✅ Updated/);
    assert.match(result.body, /Install.*ℹ️ Skipped.*\| Skipped \|/);
    assert.match(result.body, /Doctor.*ℹ️ Skipped.*\| Skipped \|/);
    assert(!f.calls.some((call) => call.family === 'openclaw'));
  });

  it('should retain successful source progress when build/sync fails', async () => {
    f.failures['openclaw-agent-system'] = {
      'bun run sync': Object.assign(new Error('command-failed'), { exitCode: 2 }),
    };
    const result = await f.run(runSources);
    assert.match(result.body, /❌ UPDATE SOURCES/);
    assert.match(result.body, /Canon.*✅ Updated/);
    assert.match(result.body, /Agent System.*❌ Failed.*Dependencies installed.*Build\/sync/);
    assert.match(result.body, /Next action/);
  });

  for (const task of [runAgent, runSources])
    it(`should refuse checkout changes during dependency installation (${task.name})`, async () => {
      const result = await f.run(task, {
        commands: (options) => {
          const execute = f.commands(options);
          return async (family, argv) => {
            const output = await execute(family, argv);
            if (family === 'bun' && argv[0] === 'install')
              f.states[options.cwd.split('/').at(-1)].dirty = true;
            return output;
          };
        },
      });
      assert.match(result.body, /checkout-changed/);
      assert(
        !f.calls.some((call) => call.family === 'openclaw' || call.argv.join(' ') === 'run sync'),
      );
    });

  it('should ignore old interrupted checkpoints and permit the next run after an interrupted inspection', async () => {
    const directory = join(f.workspace, '.private', 'update-agent');
    await mkdir(directory, { recursive: true });
    const path = join(directory, 'status.json');
    const historical = '{"status":"running","pending":"source","reason":"interrupted-run"}';
    await writeFile(path, historical);
    f.failures.emori = { 'git rev-parse --show-toplevel': new Error('cancelled') };
    assert.notEqual((await f.run(runAgent)).exitCode, 0);
    delete f.failures.emori;
    assert.equal((await f.run(runAgent)).exitCode, 0);
    assert.equal(await readFile(path, 'utf8'), historical);
  });

  for (const task of [runAgent, runSources]) {
    it(`should exclude ${task.name} while backup or another updater holds the common lock`, async () => {
      const lock = await openStorage(f.workspace);
      try {
        const result = await f.run(task);
        assert.match(result.body, /⚠️.*ACTION NEEDED/);
        assert.equal(f.calls.length, 0);
      } finally {
        await lock.close();
      }
      assert.equal((await f.run(task)).exitCode, 0);
    });
    it(`should reject unsupported runtimes and noncanonical invocation before operational commands (${task.name})`, async () => {
      assert.match((await f.run(task, { runtimeVersion: '1.5.0' })).body, /runtime-unsupported/);
      assert.equal(f.calls.length, 0);
      const result = await f.run(task, { canonicalize: async (path) => path });
      assert.match(result.body, /unsupported-target/);
      assert.equal(f.calls.length, 0);
    });
    it(`should honor cancellation without lifecycle calls and release exclusion (${task.name})`, async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await f.run(task, { signal: controller.signal });
      assert.notEqual(result.exitCode, 0);
      assert(!f.calls.some((call) => call.family === 'openclaw'));
      const lock = await openStorage(f.workspace);
      await lock.close();
    });
  }

  it('should succeed without replaying historical execution or delivery failures', async () => {
    f.native.doctor = {
      status: 'healthy',
      findings: [
        predecessor,
        {
          status: 'warning',
          code: 'automation-delivery-failed',
          message: 'Past delivery failed.',
        },
      ],
    };
    const { exitCode, body: report } = await f.run(runAgent);
    assert.equal(exitCode, 0, report);
    assert.match(report, /Doctor.*Healthy/);
    assert.doesNotMatch(report, /Previous update failed|Past delivery failed|Inspect earlier runs/);
  });

  it('should display a current advisory without failing a verified run', async () => {
    f.native.doctor = {
      status: 'healthy',
      findings: [
        predecessor,
        { status: 'warning', message: 'Current advisory.', remediation: 'Review settings.' },
      ],
    };
    const { exitCode, body: report } = await f.run(runAgent);
    assert.equal(exitCode, 0, report);
    assert.match(report, /Doctor.*Advisories.*Current advisory/);
    assert.match(report, /Review settings/);
    assert.doesNotMatch(report, /Previous update failed|Inspect earlier runs/);
  });

  it('should still fail when Doctor reports current blocked state', async () => {
    f.failures.emori = {
      'openclaw agent-system doctor --json': Object.assign(new Error('command-failed'), {
        exitCode: 1,
        stdout: JSON.stringify({
          status: 'blocked',
          findings: [predecessor, { status: 'blocked', message: 'Current check blocked.' }],
        }),
      }),
    };
    const { exitCode, body: report } = await f.run(runAgent);
    assert.notEqual(exitCode, 0);
    assert.match(report, /Doctor.*Current check blocked/);
    assert.doesNotMatch(report, /Previous update failed/);
  });

  it('should not let a healthy payload with an advisory hide a nonzero Doctor exit', async () => {
    f.failures.emori = {
      'openclaw agent-system doctor --json': Object.assign(new Error('command-failed'), {
        exitCode: 1,
        stdout: JSON.stringify({
          status: 'healthy',
          findings: [{ status: 'warning', message: 'Current advisory.' }],
        }),
      }),
    };
    const { exitCode, body: report } = await f.run(runAgent);
    assert.notEqual(exitCode, 0);
    assert.match(report, /Doctor.*Failed.*command-failed/);
  });

  it('should make remaining Doctor repairs actionable without treating expected setup skipping as a warning', async () => {
    f.native.doctor = {
      status: 'drift',
      findings: [
        {
          status: 'drift',
          message: 'Backup schedule differs.',
          remediation: 'Apply the declared backup schedule.',
        },
      ],
    };
    const result = await f.run(runAgent);
    assert.match(result.body, /⚠️ UPDATE AGENT/);
    assert.match(result.body, /Install.*✅ Aligned/);
    assert.match(result.body, /Doctor.*⚠️ Drift detected/);
    assert.match(result.body, /Next action.*Apply the declared backup schedule/);
  });

  it('should report unreadable health instead of promoting process success to green', async () => {
    f.native.doctor = {};
    const result = await f.run(runAgent);
    assert.notEqual(result.exitCode, 0);
    assert.match(result.body, /Doctor.*⚠️ Unverified/);
    assert.match(result.body, /Next action/);
  });

  it('should not bypass a native authority refusal or continue to Doctor', async () => {
    f.failures.emori = {
      'openclaw agent-system install --skip-setup --json': new Error('automation-execution-stale'),
    };
    const result = await f.run(runAgent);
    assert.match(result.body, /❌ UPDATE AGENT/);
    assert.match(result.body, /automation-execution-stale/);
    assert(!f.calls.some((call) => call.argv[1] === 'doctor'));
  });
});
