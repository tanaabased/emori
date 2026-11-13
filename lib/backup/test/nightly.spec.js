import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import openStorage from '../storage.js';
import updateStorage from '../../update-agent/storage.js';

const script = resolve('scripts/backup-agent.sh');
const fixture = resolve('lib/backup/test/managed-command.fixture.js');
const reserved =
  'emori-nightly-2026-01-01T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz';

describe('nightly backup (shell/filesystem component, fake managed services)', () => {
  let workspace, output, bin, log;
  beforeEach(async () => {
    workspace = await realpath(await mkdtemp(join(tmpdir(), 'nightly backup ')));
    output = join(workspace, 'configured backups');
    bin = join(workspace, 'bin');
    log = join(workspace, 'commands');
    await mkdir(output);
    await mkdir(bin);
    await symlink(fixture, join(bin, 'openclaw'));
    await writeFile(join(output, reserved), 'failed-upload leftover');
    await writeFile(join(output, 'manual.tar.gz'), 'manual');
    await writeFile(join(output, `${reserved}.tmp`), 'temporary');
    await symlink(
      join(output, 'manual.tar.gz'),
      join(output, reserved.replace('2026-01', '2025-01')),
    );
    await mkdir(join(output, reserved.replace('2026-01', '2024-01')));
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });
  const run = (mode = '') =>
    spawnSync('bash', [script], {
      cwd: workspace,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        AGENT_SYSTEM_GOG: fixture,
        FIXTURE_OUTPUT: output,
        FIXTURE_MODE: mode,
        FIXTURE_LOG: log,
      },
      encoding: 'utf8',
      timeout: 10000,
    });
  const calls = async () => (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);

  it('uploads exact bytes, removes only reserved regular archives, and keeps five remote uploads across pages', async () => {
    await mkdir(join(workspace, '.private/backup-drive'), { recursive: true });
    const journal = join(workspace, '.private/backup-drive/deliveries.json');
    await writeFile(journal, 'obsolete malformed journal');
    const result = run();
    assert.equal(await readFile(journal, 'utf8'), 'obsolete malformed journal');
    assert.equal(result.status, 0, result.stderr);
    const names = await readdir(output);
    assert(!names.includes(reserved));
    assert(names.includes('manual.tar.gz'));
    assert(names.includes(`${reserved}.tmp`));
    assert(names.includes(reserved.replace('2026-01', '2025-01')));
    assert(names.includes(reserved.replace('2026-01', '2024-01')));
    assert.equal(names.length, 4);
    const commands = await calls();
    assert.deepEqual(
      commands.filter((a) => a[1] === 'delete').map((a) => a[2]),
      ['oldest'],
    );
    assert(
      commands
        .find((a) => a[1] === 'upload')[2]
        .endsWith(
          'emori-nightly-2026-11-13T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz',
        ),
    );
  });
  for (const mode of ['create-failure', 'upload-failure']) {
    it(`retains archives and skips retention after ${mode}`, async () => {
      const result = run(mode);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /local archives retained/);
      assert((await readdir(output)).includes(reserved));
      assert(!(await calls()).some((a) => ['ls', 'delete'].includes(a[1])));
    });
  }
  it('reports delivery succeeded and fails overall when local cleanup fails', async () => {
    await writeFile(
      join(bin, 'rm'),
      '#!/bin/bash\ncase "$*" in *.tar.gz) exit 1;; esac\nexec /bin/rm "$@"\n',
      { mode: 0o755 },
    );
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /delivery succeeded \/ cleanup failed/);
    assert(!(await calls()).some((a) => a[1] === 'delete'));
  });
  for (const mode of ['list-failure', 'incomplete', 'delete-failure']) {
    it(`reports post-delivery failure for ${mode}`, () => {
      const result = run(mode);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /delivery succeeded \/ cleanup failed/);
    });
  }
  it('refuses a public destination before creating a backup', async () => {
    assert.notEqual(run('public').status, 0);
    assert.equal((await calls()).length, 1);
  });
  it('excludes backup and updater runs using the existing lock', async () => {
    const lock = await updateStorage(workspace);
    try {
      assert.notEqual(run().status, 0);
    } finally {
      await lock.close();
    }
    assert.equal(run().status, 0);
  });
  it('refuses legacy lock markers and linked private storage', async () => {
    await mkdir(join(workspace, '.private/backup-drive'), { recursive: true });
    await writeFile(join(workspace, '.private/backup-drive/run.lock'), 'legacy');
    await assert.rejects(openStorage(workspace), /legacy-backup-lock/);
    await rm(join(workspace, '.private'), { recursive: true });
    await symlink(bin, join(workspace, '.private'));
    await assert.rejects(openStorage(workspace), /private-directory-unsafe/);
  });
});
