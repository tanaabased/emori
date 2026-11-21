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

const script = resolve('scripts/backup-agent.sh');
const fixture = resolve('lib/backup/test/managed-command.fixture.js');
const reserved =
  'emori-nightly-2026-01-01T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz';
const newArchive = 'emori-2026-11-13T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz';

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

  it('uploads exact bytes and removes only its own archive', async () => {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const names = await readdir(output);
    assert(names.includes(reserved));
    assert(!names.includes(newArchive));
    assert.equal(names.length, 5);
    const [destination, create, upload] = await calls();
    assert.deepEqual(create, ['agent-system', 'backup', 'create', '--json']);
    assert.equal(upload[1], 'upload');
    assert.equal(upload[2], join(output, newArchive));
    assert.equal(upload[upload.indexOf('--parent') + 1], destination[2]);
    assert.equal((await calls()).length, 3);
  });

  for (const mode of ['create-failure', 'upload-failure']) {
    it(`preserves the archive after ${mode}`, async () => {
      assert.equal(run(mode).status, 1);
      assert.equal(await readFile(join(output, newArchive), 'utf8'), 'exact completed bytes');
      assert.equal((await calls()).length, mode === 'create-failure' ? 2 : 3);
    });
  }

  it('refuses a public destination before creating a backup', async () => {
    assert.notEqual(run('public').status, 0);
    assert.equal((await calls()).length, 1);
  });
});
